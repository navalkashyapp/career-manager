import express from 'express';
import { adminDb, adminAuth } from '../firebaseAdmin';
import { GoogleGenAI } from '@google/genai';
import { OrchestratorAgent, JobEvaluation, TailorResult } from '../../agents/OrchestratorAgent';
import { UserProfile } from '../../agents/ResumeTailorAgent';
import { GEMINI_MODELS } from '../../config/gemini';

import { COMMANDS as tracker } from '../../../career-ops/tracker.mjs';
import { DataParserService } from '../services/DataParserService';
import path from 'path';
import { z } from 'zod';
import { execFile } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execFileAsync = util.promisify(execFile);

export const careerOpsRouter = express.Router();

// Authentication Middleware
careerOpsRouter.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Restrict to ONLY the authorized user
    const allowedEmails = ['kashyapnaval35@gmail.com', 'navalkashyaap@gmail.com'];
    if (!allowedEmails.includes(decodedToken.email || '')) {
      return res.status(403).json({ error: 'Forbidden: Email not authorized' });
    }

    // Pass user info to request
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
});

const dataParser = new DataParserService(path.resolve(process.cwd(), 'career-ops'));
const careerOpsPath = path.resolve(process.cwd(), 'career-ops');

// ---------------------------------------------------------------------------
// REST Endpoint: Tracker Query
// ---------------------------------------------------------------------------
careerOpsRouter.get('/tracker', async (req, res) => {
  try {
    const { stdout } = await execFileAsync(process.execPath, ['tracker.mjs', 'query', '--json'], {
      cwd: careerOpsPath,
    });
    const apps = JSON.parse(stdout);

    // Map the fields to match the frontend JobApplication interface
    const mappedApps = apps.map((app: any) => ({
      id: app.id.toString(),
      companyName: app.company,
      jobTitle: app.role,
      stage: app.status,
      dateApplied: app.date,
      score: app.score,
      pdf: app.pdf,
      report: app.report,
      notes: app.notes,
      tailoredResumes: [],
      outreachDrafts: [],
      gapAnalysis: [],
    }));

    res.json(mappedApps);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

careerOpsRouter.post('/tracker/update', async (req, res) => {
  try {
    const { id, data } = req.body;
    if (!id || !data || !data.stage) {
      return res.status(400).json({ error: 'Missing id or stage' });
    }

    // Instead of using sqlite, we must update the markdown file (source of truth)
    // The tracker.mjs parses rows. To update a row, we can read the file, string-replace the row, and write back.
    const filePath = path.join(careerOpsPath, 'data/applications.md');
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Tracker not found' });
    }

    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    let updated = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('|')) {
        const parts = line.split('|').map((p) => p.trim());
        if (parts[1] === id) {
          // # column is usually index 1
          // find the status column (column 6 in legacy format)
          // The best way without importing `tracker-parse.mjs` is to assume column 6.
          parts[6] = data.stage;
          lines[i] = '| ' + parts.slice(1, parts.length - 1).join(' | ') + ' |';
          updated = true;
          break;
        }
      }
    }

    if (updated) {
      fs.writeFileSync(filePath, lines.join('\n'));
      // Sync the DB
      await execFileAsync(process.execPath, ['tracker.mjs', 'sync'], { cwd: careerOpsPath });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// SSE Endpoint: Long-running AI Outreach Generation
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Helper functions for Agents V2 Orchestration
function getOrchestrator(): OrchestratorAgent {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY_1 ||
    process.env.GEMINI_API_KEY_2 ||
    '';
  const aiClient = new GoogleGenAI({ apiKey });
  return new OrchestratorAgent(aiClient, { debug: true });
}

function extractCandidateData(profileData: any): {
  userProfile: UserProfile;
  masterCvMarkdown: string;
} {
  const p = profileData || {};
  const userProfile: UserProfile = {
    fullName: p.name || p.fullName || 'Candidate',
    headline: p.headline || p.targetLevel || '',
    voiceSample: p.voiceSample || '',
    location: p.location || '',
    email: p.email || '',
    phone: p.phone || '',
  };
  const masterCvMarkdown =
    p.masterCvMarkdown || p.resumeText || (typeof p === 'string' ? p : JSON.stringify(p, null, 2));
  return { userProfile, masterCvMarkdown };
}

function buildEvaluationReportMarkdown(evalResult: JobEvaluation): string {
  const dims = evalResult.dimensions;
  return [
    `# Evaluation Report: ${evalResult.jobTitle || 'Role'} at ${evalResult.companyName || 'Company'}`,
    '',
    `**Recommendation:** \`${evalResult.recommendation?.toUpperCase() || 'EVALUATED'}\`  `,
    `**Overall Match Score:** **${typeof evalResult.overallScore === 'number' ? evalResult.overallScore.toFixed(1) : evalResult.overallScore} / 5.0**`,
    '',
    '## 📋 Executive Summary',
    evalResult.jobSummary || 'No summary provided.',
    '',
    '## 📊 Score Breakdown',
    evalResult.scoreBreakdown || '',
    '',
    '## 🔍 Dimension Analysis',
    `### 1. Skill Alignment (${dims?.skillAlignment?.grade || 'N/A'})`,
    ...(dims?.skillAlignment?.evidence?.length
      ? dims.skillAlignment.evidence.map((e: string) => `- ${e}`)
      : ['- No explicit evidence recorded']),
    dims?.skillAlignment?.note ? `\n> ${dims.skillAlignment.note}` : '',
    '',
    `### 2. Culture & Leadership Fit (${dims?.cultureFit?.grade || 'N/A'})`,
    ...(dims?.cultureFit?.evidence?.length
      ? dims.cultureFit.evidence.map((e: string) => `- ${e}`)
      : ['- Standard leadership expectations']),
    dims?.cultureFit?.note ? `\n> ${dims.cultureFit.note}` : '',
    '',
    `### 3. Growth Potential (${dims?.growthPotential?.grade || 'N/A'})`,
    ...(dims?.growthPotential?.evidence?.length
      ? dims.growthPotential.evidence.map((e: string) => `- ${e}`)
      : ['- Unspecified']),
    dims?.growthPotential?.note ? `\n> ${dims.growthPotential.note}` : '',
    '',
    `### 4. Compensation & Policy (${dims?.compensation?.grade || 'N/A'})`,
    ...(dims?.compensation?.evidence?.length
      ? dims.compensation.evidence.map((e: string) => `- ${e}`)
      : ['- Market competitive or unlisted']),
    dims?.compensation?.note ? `\n> ${dims.compensation.note}` : '',
    '',
    '## ⚠️ Dealbreakers & Blockers',
    evalResult.dealbreakers?.length
      ? evalResult.dealbreakers.map((d: string) => `- 🚫 **${d}**`).join('\n')
      : '✅ No dealbreakers or hard blockers detected.',
    '',
    '## 🎯 Gap Analysis',
    evalResult.gaps?.length
      ? evalResult.gaps
          .map(
            (g: any) =>
              `- **[${g.severity?.toUpperCase() || 'GAP'}]** ${g.gap}\n  - *Mitigation strategy:* ${g.fixable}`,
          )
          .join('\n')
      : '✅ No critical gaps identified.',
    '',
    '## 💡 Recommendation Rationale',
    ...(evalResult.recommendationReasons?.length
      ? evalResult.recommendationReasons.map((r: string) => `- ${r}`)
      : ['- Direct match against candidate positioning']),
  ]
    .filter(Boolean)
    .join('\n');
}

function formatEvaluationResponse(evalResult: JobEvaluation, rawJobDescription: string) {
  const reportMarkdown = buildEvaluationReportMarkdown(evalResult);
  return {
    ...evalResult,
    role: evalResult.jobTitle || 'Unknown Role',
    company: evalResult.companyName || 'Unknown Company',
    score: evalResult.overallScore || 0,
    archetype: evalResult.recommendation || 'Evaluated',
    legitimacy: (evalResult.dealbreakers?.length ?? 0) === 0 ? 'High' : 'Review Required',
    evaluationText: reportMarkdown,
    report: reportMarkdown,
    notes: reportMarkdown,
    rawJobDescription: rawJobDescription || '',
  };
}

// ---------------------------------------------------------------------------
// SSE Endpoint: AI Job Evaluation (Agents V2: JobEvaluationAgent)
// ---------------------------------------------------------------------------
const EvaluateAsyncSchema = z.object({
  docId: z.string(),
  userId: z.string(),
  jdText: z.string().optional(),
  url: z.string().url().optional(),
  modelName: z.string().optional(),
  profileData: z.any().optional(),
});

careerOpsRouter.post('/evaluate', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { docId, userId, jdText, profileData } = EvaluateAsyncSchema.parse(req.body);
    if (!jdText || jdText.trim().length < 20) {
      throw new Error('Please provide sufficient Job Description text to evaluate.');
    }

    const docRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('jobsearchhistory')
      .doc(docId);

    sendEvent('progress', { phase: 'Initializing Agents V2 evaluation...', percentage: 15 });

    const orchestrator = getOrchestrator();
    const { userProfile, masterCvMarkdown } = extractCandidateData(profileData);

    sendEvent('progress', {
      phase: 'Analyzing dimensions, culture fit & gap evidence...',
      percentage: 50,
    });

    const evalResult = (await orchestrator.handleAction('evaluate_job', {
      userProfile,
      masterCvMarkdown,
      jobDescription: jdText,
    })) as JobEvaluation;

    const formattedResult = formatEvaluationResponse(evalResult, jdText);

    sendEvent('progress', { phase: 'Saving to Firestore...', percentage: 95 });
    await docRef.set(
      {
        id: docId,
        timestamp: Date.now(),
        input: jdText || '',
        status: 'completed',
        result: formattedResult,
        progressPhase: 'Complete',
        progressPercent: 100,
      },
      { merge: true },
    );

    sendEvent('firestore_ready', { docId, result: formattedResult });
    res.end();
  } catch (err: any) {
    console.error('[evaluate] Error:', err);
    try {
      const { docId, userId } = EvaluateAsyncSchema.parse(req.body);
      const docRef = adminDb
        .collection('users')
        .doc(userId)
        .collection('jobsearchhistory')
        .doc(docId);
      await docRef
        .set(
          {
            status: 'error',
            error: err.message,
            progressPhase: 'Error',
            progressPercent: 0,
          },
          { merge: true },
        )
        .catch(console.error);
    } catch (e) {}
    sendEvent('error', { message: err.message });
    res.end();
  }
});

careerOpsRouter.post('/evaluate-url', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { docId, userId, url, profileData } = EvaluateAsyncSchema.parse(req.body);
    if (!url) {
      throw new Error('URL is required for this endpoint');
    }

    const docRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('jobsearchhistory')
      .doc(docId);

    sendEvent('progress', { phase: 'Scraping Job Description from URL...', percentage: 15 });

    const { JobScraperService } = await import('../services/JobScraperService.js');
    const scrapedText = await JobScraperService.scrapeJobPosting(url);

    if (!scrapedText || scrapedText.length < 50) {
      throw new Error('Failed to extract sufficient text from the provided URL.');
    }

    sendEvent('progress', {
      phase: 'Evaluating with Agents V2 JobEvaluationAgent...',
      percentage: 45,
    });

    const orchestrator = getOrchestrator();
    const { userProfile, masterCvMarkdown } = extractCandidateData(profileData);

    const evalResult = (await orchestrator.handleAction('evaluate_job', {
      userProfile,
      masterCvMarkdown,
      jobDescription: scrapedText,
    })) as JobEvaluation;

    const formattedResult = formatEvaluationResponse(evalResult, scrapedText);

    sendEvent('progress', { phase: 'Syncing Tracker Database...', percentage: 90 });
    try {
      await execFileAsync(process.execPath, ['tracker.mjs', 'sync'], { cwd: careerOpsPath });
    } catch (syncErr) {
      console.warn('tracker.mjs sync non-critical warning:', syncErr);
    }

    sendEvent('progress', { phase: 'Saving to Firestore...', percentage: 95 });
    await docRef.set(
      {
        id: docId,
        timestamp: Date.now(),
        input: url || '',
        status: 'completed',
        result: formattedResult,
        progressPhase: 'Complete',
        progressPercent: 100,
      },
      { merge: true },
    );

    sendEvent('firestore_ready', { docId, result: formattedResult });
    res.end();
  } catch (err: any) {
    console.error('[evaluate-url] Error:', err);
    try {
      const { docId, userId } = EvaluateAsyncSchema.parse(req.body);
      const docRef = adminDb
        .collection('users')
        .doc(userId)
        .collection('jobsearchhistory')
        .doc(docId);
      await docRef
        .set(
          {
            status: 'error',
            error: err.message,
            progressPhase: 'Error',
            progressPercent: 0,
          },
          { merge: true },
        )
        .catch(console.error);
    } catch (e) {}
    sendEvent('error', { message: err.message });
    res.end();
  }
});

// ---------------------------------------------------------------------------
// SSE Endpoint: Extract Job Details from URL using Antigravity (agy)
// ---------------------------------------------------------------------------
const ExtractJobUrlSchema = z.object({
  url: z.string().optional(),
  jdText: z.string().optional(),
});

careerOpsRouter.post('/extract-job-url', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { url, jdText } = ExtractJobUrlSchema.parse(req.body);
    let jobDescriptionText = jdText || '';

    if (url && !jobDescriptionText) {
      sendEvent('progress', { phase: 'Scraping job description from URL...', percentage: 20 });
      const { JobScraperService } = await import('../services/JobScraperService.js');
      jobDescriptionText = await JobScraperService.scrapeJobPosting(url);
    }

    if (!jobDescriptionText || jobDescriptionText.trim().length < 40) {
      throw new Error(
        'Unable to extract sufficient job text from this URL. Please verify the link or paste the text directly.',
      );
    }

    sendEvent('progress', {
      phase: 'Extracting role profile & company with Antigravity Agents V2...',
      percentage: 60,
    });

    const orchestrator = getOrchestrator();

    console.log('\n=== AGY REQUEST (Extract Job) via Agents V2 ===\n');
    const extracted = (await orchestrator.handleAction('parse_job_page', {
      domSnippet: jobDescriptionText,
    })) as any;
    console.log(
      '\n=== AGY RESPONSE (Extract Job) ===\n',
      extracted,
      '\n=================================\n',
    );

    sendEvent('progress', { phase: 'Extraction complete!', percentage: 100 });
    sendEvent('done', {
      companyName: extracted.companyName || 'Unknown Company',
      companyDescription: extracted.companyDescription || '',
      roleTitle: extracted.roleTitle || 'Unknown Title',
      jobTitle: extracted.roleTitle || 'Unknown Title',
      roleDescription: extracted.roleDescription || '',
      jobSummary: extracted.roleDescription || extracted.jobSummary || '',
      location: extracted.location || '',
      salary: extracted.salary || { raw: extracted.salaryRange || '' },
      salaryRange: extracted.salary?.raw || '',
      targetLevel: extracted.experienceLevel || '',
      experienceLevel: extracted.experienceLevel || '',
      department: extracted.department || '',
      requirements: extracted.requirements || [],
      keyRequirements: extracted.requirements || [],
      niceToHaves: extracted.niceToHaves || [],
      qualifications: extracted.qualifications || [],
      responsibilities: extracted.responsibilities || [],
      benefits: extracted.benefits || [],
      remotePolicy: extracted.remotePolicy || 'unknown',
      employmentType: extracted.employmentType || '',
      rawJobDescription: jobDescriptionText,
      jobUrl: url || extracted.applicationUrl || '',
      pageType: extracted.pageType || 'unknown',
      detectedPostings: extracted.detectedPostings || [],
      fieldConfidence: extracted.fieldConfidence || {},
      warnings: extracted.warnings || [],
    });
    res.end();
  } catch (error: any) {
    console.error('[extract-job-url] Error:', error);
    sendEvent('error', { message: error.message || 'Failed to extract job details' });
    res.end();
  }
});

// ---------------------------------------------------------------------------
// SSE Endpoint: Long-running AI Tailor Resume (Agents V2: ResumeTailorAgent)
// ---------------------------------------------------------------------------
const TailorSchema = z.object({
  jdText: z.string(),
  profileData: z.any(),
});

careerOpsRouter.post('/tailor-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const payload = TailorSchema.parse(req.body);
    sendEvent('progress', { phase: 'Analyzing Job Description & Profile...', percentage: 20 });

    const orchestrator = getOrchestrator();
    const { userProfile, masterCvMarkdown } = extractCandidateData(payload.profileData);

    sendEvent('progress', {
      phase: 'Synthesizing tailored resume with Agents V2...',
      percentage: 55,
    });

    console.log('\n=== AGY REQUEST (Tailor Resume) via Orchestrator ===\n');
    const tailorOutput = (await orchestrator.handleAction('tailor_resume', {
      userProfile,
      masterCvMarkdown,
      jobDescription: payload.jdText,
    })) as any;

    console.log(
      '\n=== AGY RESPONSE (Tailor Resume) ===\n',
      tailorOutput,
      '\n===================================\n',
    );

    sendEvent('progress', { phase: 'Complete', percentage: 100 });
    // Returns full structured result (or .result property if nested)
    sendEvent('result', tailorOutput.result || tailorOutput);
    res.end();
  } catch (error: any) {
    console.error('[tailor-stream] Error:', error);
    sendEvent('error', { message: error.message || 'Failed to tailor resume' });
    res.end();
  }
});

// ---------------------------------------------------------------------------
// Endpoint: AI Outreach Generation (Agents V2: OutreachAgent)
// ---------------------------------------------------------------------------
const OutreachSchema = z.object({
  jdText: z.string(),
  profileData: z.any().optional(),
  messageType: z.string().optional(),
  recipient: z.any().optional(),
  channel: z.enum(['linkedin-connection-note', 'linkedin-dm', 'cold-email']).optional(),
});

careerOpsRouter.post('/draft-outreach', async (req, res) => {
  try {
    const { jdText, profileData, messageType, recipient, channel } = OutreachSchema.parse(req.body);
    const orchestrator = getOrchestrator();
    const { userProfile, masterCvMarkdown } = extractCandidateData(profileData);

    const targetChannel =
      channel ||
      (messageType?.toLowerCase().includes('linkedin') ? 'linkedin-connection-note' : 'cold-email');
    const targetRecipient = recipient || {
      name: 'Hiring Manager',
      role: 'Hiring Manager',
      company: 'Target Company',
    };

    const draft = (await orchestrator.handleAction('draft_outreach', {
      userProfile,
      masterCvMarkdown,
      jobDescription: jdText,
      recipient: targetRecipient,
      channel: targetChannel,
    })) as any;

    const recommended =
      (draft.variants || []).find((v: any) => v.angle === draft.recommendedVariant) ||
      draft.variants?.[0];

    res.json({
      ...draft,
      subject: recommended?.subject || 'Re: Application',
      body: recommended?.body || '',
      finalMessage: {
        subject: recommended?.subject || 'Re: Application',
        body: recommended?.body || '',
      },
      draft: recommended,
    });
  } catch (error: any) {
    console.error('[draft-outreach] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to draft outreach' });
  }
});

// ---------------------------------------------------------------------------
// Endpoint: AI Interview Prep (Agents V2: InterviewCoachAgent)
// ---------------------------------------------------------------------------
const PrepSchema = z.object({
  jdText: z.string(),
  companyName: z.string().optional(),
  profileData: z.any().optional(),
  daysAvailable: z.number().optional(),
});

careerOpsRouter.post('/prep-interview', async (req, res) => {
  try {
    const { jdText, companyName, profileData, daysAvailable } = PrepSchema.parse(req.body);
    const orchestrator = getOrchestrator();
    const { userProfile, masterCvMarkdown } = extractCandidateData(profileData);

    const plan = (await orchestrator.handleAction('interview_prep_plan', {
      userProfile,
      masterCvMarkdown,
      jobDescription: jdText,
      daysAvailable: daysAvailable || 7,
    })) as any;

    // Synthesize compatibility questions for legacy consumers (PrepModal, JobDetailsModal)
    const systemDesignQuestions = (plan.blocks || [])
      .filter(
        (b: any) =>
          b.focusTopic?.toLowerCase().includes('system') ||
          b.focusTopic?.toLowerCase().includes('design') ||
          b.focusTopic?.toLowerCase().includes('technical'),
      )
      .map((b: any) => ({
        question: b.drills?.[0] || b.whyItMatters,
        focusAreas: b.resourceQueries || [b.focusTopic],
      }));

    const behavioralPrompts = (plan.blocks || [])
      .filter(
        (b: any) =>
          !b.focusTopic?.toLowerCase().includes('system') &&
          !b.focusTopic?.toLowerCase().includes('design'),
      )
      .map((b: any) => ({
        prompt: b.drills?.[0] || b.whyItMatters,
        whyTheyAskThis: b.whyItMatters || 'Evaluates candidate competence and alignment.',
      }));

    res.json({
      ...plan,
      systemDesignQuestions:
        systemDesignQuestions.length > 0
          ? systemDesignQuestions
          : [
              {
                question: `Design a scalable architecture for ${companyName || 'the role'}'s core services.`,
                focusAreas: ['Scalability', 'Fault Tolerance'],
              },
            ],
      behavioralPrompts:
        behavioralPrompts.length > 0
          ? behavioralPrompts
          : [
              {
                prompt: `Tell me about a time you handled conflict on a technical project.`,
                whyTheyAskThis: 'Evaluates team collaboration and conflict resolution.',
              },
            ],
    });
  } catch (error: any) {
    console.error('[prep-interview] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate interview prep' });
  }
});
