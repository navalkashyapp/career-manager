#!/usr/bin/env node
/**
 * gemini-eval.mjs — Gemini-powered Job Offer Evaluator for career-ops
 *
 * A free-tier alternative to the Claude-based pipeline.
 * Reads evaluation logic from modes/oferta.md + modes/_shared.md,
 * reads the user's resume from cv.md, and evaluates a Job Description
 * passed as a command-line argument.
 *
 * Usage:
 *   node gemini-eval.mjs "Paste full JD text here"
 *   node gemini-eval.mjs --file ./jds/my-job.txt
 *
 * Requires:
 *   GEMINI_API_KEY in .env (or environment variable)
 *
 * Free-tier model: gemini-3.8-flash (generous quota, no billing required)
 *
 * Model deprecation reference (per Google AI for Developers, May 2026):
 *   - gemini-2.0-flash       deprecated 2026-03-31  (do not use)
 *   - gemini-2.0-flash-lite  deprecated 2026-03-31
 *   - gemini-3.8-flash       deprecated 2026-06-17  (current default)
 *   - gemini-3.8-flash-lite  deprecated 2026-07-22
 * Stable Gemini models follow a 12-month lifecycle from their release date.
 * Source: https://ai.google.dev/gemini-api/docs/models
 *
 * When the current default approaches its deprecation date, bump
 * `modelName` below and the `--model` examples accordingly.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TokenAccumulator, formatBreakdown } from './utils/token-tracker.mjs';

const tracker = new TokenAccumulator();
tracker.recordZeroToken('scan');
tracker.recordZeroToken('pdf payload');
import { execFileSync } from 'child_process';
import { outputLanguageInstruction, parseOutputLanguage } from './profile-language.mjs';
import {
  formatReportNumber, releaseReportNumbers, reserveReportNumbers,
} from './reserve-report-num.mjs';

// ---------------------------------------------------------------------------
// Bootstrap: load .env before anything else
// ---------------------------------------------------------------------------
try {
  const { config } = await import('dotenv');
  config();
} catch {
  // dotenv is optional — fall back to process.env if not installed
}

import { GoogleGenerativeAI } from '@google/generative-ai';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const RAW_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = existsSync(join(process.cwd(), 'career-ops', 'modes'))
  ? join(process.cwd(), 'career-ops')
  : RAW_DIR;

const PATHS = {
  // Primary evaluation logic lives in these two mode files
  shared: join(ROOT, 'modes', '_shared.md'),
  oferta: join(ROOT, 'modes', 'oferta.md'),
  // Canonical skill path referenced in Issue #344
  evaluate: join(ROOT, '.claude', 'skills', 'career-ops', 'SKILL.md'),
  cv: join(ROOT, 'cv.md'),
  profile: join(ROOT, 'modes', '_profile.md'),
  profileYml: join(ROOT, 'config', 'profile.yml'),
  reports: join(ROOT, 'reports'),
  tracker: join(ROOT, 'data', 'applications.md'),
  trackerAdditions: join(ROOT, 'batch', 'tracker-additions'),
};

export async function evaluateJob(options = {}) {
  let {
    jdText = '',
    modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    saveReport = true,
    apiKey = process.env.GEMINI_API_KEY,
    onRetry,
    onProgress,
    profileData
  } = options;

  if (!jdText) {
    throw new Error('No Job Description provided.');
  }

  const apiKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    apiKey
  ].filter(Boolean);

  if (apiKeys.length === 0) {
    throw new Error('No GEMINI_API_KEY provided.');
  }

  // ---------------------------------------------------------------------------
  // File helpers
  // ---------------------------------------------------------------------------
  function readFile(path, label) {
    if (!existsSync(path)) {
      console.warn(`⚠️   ${label} not found at: ${path}`);
      return `[${label} not found — skipping]`;
    }
    return readFileSync(path, 'utf-8').trim();
  }

  function validateEvaluationShape(text) {
    const issues = [];
    const requiredBlocks = [
      ['A', /(?:^|\n)#{1,3}\s*(?:A[).:-]?|Block A\b)/im],
      ['B', /(?:^|\n)#{1,3}\s*(?:B[).:-]?|Block B\b)/im],
      ['C', /(?:^|\n)#{1,3}\s*(?:C[).:-]?|Block C\b)/im],
      ['D', /(?:^|\n)#{1,3}\s*(?:D[).:-]?|Block D\b)/im],
      ['E', /(?:^|\n)#{1,3}\s*(?:E[).:-]?|Block E\b)/im],
      ['F', /(?:^|\n)#{1,3}\s*(?:F[).:-]?|Block F\b)/im],
      ['G', /(?:^|\n)#{1,3}\s*(?:G[).:-]?|Block G\b)/im],
    ];

    for (const [label, pattern] of requiredBlocks) {
      if (!pattern.test(text)) issues.push(`missing Block ${label}`);
    }

    const summary = text.match(/---SCORE_SUMMARY---\s*([\s\S]*?)---END_SUMMARY---/);
    if (!summary) {
      issues.push('missing SCORE_SUMMARY block');
    } else {
      const summaryBlock = summary[1];
      for (const key of ['COMPANY', 'ROLE', 'ARCHETYPE', 'LEGITIMACY']) {
        const field = summaryBlock.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'mi'));
        const value = field?.[1]?.trim() ?? '';
        if (!value || (key !== 'COMPANY' && value.toLowerCase() === 'unknown')) {
          issues.push(`SCORE_SUMMARY ${key} is required`);
        }
      }

      const score = summaryBlock.match(/^\s*SCORE:\s*([0-9]+(?:\.[0-9]+)?)/mi);
      const scoreValue = score ? Number(score[1]) : NaN;
      if (!Number.isFinite(scoreValue) || scoreValue < 0 || scoreValue > 5) {
        issues.push('SCORE_SUMMARY score must be a number between 0 and 5');
      }
    }

    if (issues.length > 0) {
      throw new Error(`Gemini returned an invalid career-ops report: ${issues.join('; ')}`);
    }
  }

  function slugifyCompany(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'unknown';
  }

  function tsvSafe(value) {
    return String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim();
  }

  function normalizedTrackerScore(value) {
    const clean = tsvSafe(value);
    if (!clean || clean === '?') return 'N/A';
    return /\/5$/i.test(clean) ? clean : `${clean}/5`;
  }

  // ---------------------------------------------------------------------------
  // Load context files
  // ---------------------------------------------------------------------------
  console.log('\n📂  Loading context files...');

  const sharedContext = readFile(PATHS.shared, 'modes/_shared.md');
  const ofertaLogic = readFile(PATHS.oferta, 'modes/oferta.md');
  const profileContent = readFile(PATHS.profile, 'modes/_profile.md');
  let dynamicProfileYml = readFile(PATHS.profileYml, 'config/profile.yml');
  let dynamicCvContent = readFile(PATHS.cv, 'cv.md');

  if (profileData) {
    console.log('📝  Using dynamically provided profile data from frontend.');

    // Format profileData to YAML-like format for targets
    dynamicProfileYml = `
target_title: "${profileData.targetTitle || ''}"
location: "${profileData.location || ''}"
preferred_compensation: "${profileData.preferredCompensation || ''}"
core_skills:
${Object.entries(profileData.coreSkills || {}).map(([category, skills]) => `  ${category}:\n${(skills || []).map(s => `    - ${s}`).join('\n')}`).join('\n')}
    `.trim();

    // Format resume data into markdown
    dynamicCvContent = `
# ${profileData.fullName || 'Candidate'}

## Experience
${(profileData.careerHistory || []).map(job => `
### ${job.title} at ${job.company} (${job.startDate || 'Unknown'} - ${job.endDate || 'Present'})
${job.description ? `${job.description}\n` : ''}
${(job.highlights || []).map(h => `- ${h}`).join('\n')}
`).join('\n')}

## Education
${(profileData.education || []).map(edu => `
- ${edu.degree} in ${edu.field} from ${edu.institution} (${edu.graduationYear})
`).join('\n')}

## Projects
${(profileData.projects || []).map(p => `
- **${p.name}**: ${p.description}
  Technologies: ${(p.technologies || []).join(', ')}
`).join('\n')}
    `.trim();
  }

  const languageInstruction = outputLanguageInstruction(parseOutputLanguage(dynamicProfileYml));

  // ---------------------------------------------------------------------------
  // Build the system prompt (mirrors the Claude skill router logic)
  // ---------------------------------------------------------------------------
  const systemPromptBase = `You are career-ops, an AI-powered job search assistant.
You evaluate job offers against the user's CV using a structured A-G scoring system.

Your evaluation methodology is defined below. Follow it exactly.

═══════════════════════════════════════════════════════
SYSTEM CONTEXT (_shared.md)
═══════════════════════════════════════════════════════
${sharedContext}

═══════════════════════════════════════════════════════
EVALUATION MODE (oferta.md)
═══════════════════════════════════════════════════════
${ofertaLogic}

═══════════════════════════════════════════════════════
CANDIDATE RESUME (cv.md)
═══════════════════════════════════════════════════════
${dynamicCvContent}

═══════════════════════════════════════════════════════
CANDIDATE PROFILE & TARGETS (config/profile.yml)
═══════════════════════════════════════════════════════
${dynamicProfileYml}

═══════════════════════════════════════════════════════
USER ARCHETYPES & NARRATIVE (_profile.md)
═══════════════════════════════════════════════════════
${profileContent}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS CLI SESSION
═══════════════════════════════════════════════════════
1. You do NOT have access to WebSearch, Playwright, or file writing tools.
   - For Block D (Comp research): provide salary estimates based on your training data, clearly noted as estimates.
   - For Block G (Legitimacy): analyze the JD text only; skip URL/page freshness checks.
   - Post-evaluation file saving is handled by the script, not by you.
2. ${languageInstruction}`;

  const agent1Prompt = systemPromptBase + `
3. You are the Foundation Agent. Generate ONLY the following sections in full:
   ## A) Role Summary
   ## B) Match with CV
   ## C) Level and Strategy
4. At the very end, output a machine-readable summary block in this exact format:

---SCORE_SUMMARY---
COMPANY: <company name or "Unknown">
ROLE: <role title>
LOCATION: <location or "Remote" or "Unknown">
SCORE: <global score as decimal, e.g. 3.8>
ARCHETYPE: <detected archetype>
---END_SUMMARY---
`;

  const agent2Prompt = systemPromptBase + `
3. You are the Market & Prep Agent. Generate ONLY the following sections in full:
   ## D) Comp and Demand
   ## E) Customization Plan
   ## F) Interview Plan
4. Do NOT output a SCORE_SUMMARY block.
`;

  const agent3Prompt = systemPromptBase + `
3. You are the Risk & Application Agent. Generate ONLY the following sections in full:
   ## G) Posting Legitimacy
   ## Risk Summary
   ## H) Draft Application Answers
   ## Keywords extracted
4. At the very end, output a machine-readable summary block in this exact format:

---SCORE_SUMMARY---
LEGITIMACY: <High Confidence | Proceed with Caution | Suspicious>
---END_SUMMARY---
`;

  // ---------------------------------------------------------------------------
  // Call Gemini API (Multi-Agent Pipeline)
  // ---------------------------------------------------------------------------
  console.log(`🤖  Calling Gemini via Multi-Agent Pipeline... this may take 15-30 seconds.\n`);

  const clients = apiKeys.map(k => new GoogleGenerativeAI(k));

  async function withExponentialBackoff(operation, timeoutMs = 600000) {
    const startTime = Date.now();
    let delay = 5000;
    let attempt = 1;
    while (true) {
      try {
        const clientIndex = (attempt - 1) % clients.length;
        const currentClient = clients[clientIndex];
        return await operation(currentClient);
      } catch (err) {
        const is503 = err?.status === 503 || String(err?.message || '').includes('503') || String(err?.message || '').includes('high demand');
        const is429 = err?.status === 429 || String(err?.message || '').includes('429');
        if (!is503 && !is429) throw err;

        const timeElapsed = Date.now() - startTime;
        if (timeElapsed + delay > timeoutMs) {
          throw new Error(`Timeout of ${timeoutMs}ms exceeded while retrying API. Last error: ${err.message}`);
        }
        process.stderr.write(`[API Error] ${err.status || err.message}. Switching key and retrying in ${delay / 1000} seconds...\n`);

        if (onRetry) {
          onRetry(attempt, delay, timeElapsed, timeoutMs);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        attempt++;
      }
    }
  }

  let evaluationText;
  let cleanedJdJson;
  try {
    if (onProgress) onProgress('Extracting core job details...', 10);
    console.log(`[Multi-Agent] Starting JD Extractor (gemini-3.8-flash)...`);

    const extractPrompt = `You are an expert technical recruiter and text analyst.
I have a raw job description that may contain noise, boilerplate, EEO statements, or formatting artifacts.
Extract the core details and return them as a structured JSON object.
Use the following schema:
{
  "companyDetails": "Key company information",
  "roleSummary": "Summary of the role",
  "coreResponsibilities": ["responsibility 1", "responsibility 2"],
  "requirements": ["requirement 1", "requirement 2"],
  "preferredSkills": ["skill 1"],
  "compensationAndBenefits": "Any salary or benefit info",
  "postingLegitimacySignals": "Any signals about hiring freeze, remote policies, etc."
}

RAW JOB DESCRIPTION:
${jdText}`;

    const useLocalCli = true;

    const extractRes = await withExponentialBackoff(async (client) => {
      if (useLocalCli) {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const { stdout } = await execFileAsync('/usr/local/bin/agy', ['-p', extractPrompt], { maxBuffer: 10 * 1024 * 1024, timeout: 120000 });
        // Find JSON block in markdown if agy wraps it, or extract { ... } directly
        let text = stdout.trim();
        const jsonMatch = text.match(/```(?:json)?\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          text = jsonMatch[1].trim();
        } else {
          const start = text.indexOf('{');
          const end = text.lastIndexOf('}');
          if (start !== -1 && end !== -1 && end > start) {
            text = text.slice(start, end + 1);
          }
        }
        return { response: { text: () => text } };
      }

      const extractorModel = client.getGenerativeModel({
        model: 'gemini-3.8-flash',
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json' }
      });
      return extractorModel.generateContent(extractPrompt);
    });
    const cleanedJd = extractRes.response.text();

    // We parse it here to ensure it's valid JSON, then pass the structured string to the next step
    cleanedJdJson = JSON.parse(cleanedJd);

    const prompt = `JOB DESCRIPTION TO EVALUATE:\n\n${cleanedJd}`;

    console.log(`[Gemini API Request] Contents:\n`, prompt.substring(0, 500) + '...\n[Truncated]');
    console.log('='.repeat(60));

    if (onProgress) onProgress('Running parallel evaluation agents...', 30);

    const runAgent = async (sysPrompt, agentName, targetModel) => {
      console.log(`[Multi-Agent] Starting ${agentName} (${targetModel})...`);
      const result = await withExponentialBackoff(async (client) => {
        if (useLocalCli) {
          const { execFile } = await import('child_process');
          const { promisify } = await import('util');
          const execFileAsync = promisify(execFile);
          const combinedPrompt = `${sysPrompt}\n\n${prompt}`;
          const { stdout } = await execFileAsync('/usr/local/bin/agy', ['-p', combinedPrompt], { maxBuffer: 10 * 1024 * 1024, timeout: 120000 });
          return { response: { text: () => stdout.trim() } };
        }

        const model = client.getGenerativeModel({
          model: targetModel,
          systemInstruction: sysPrompt,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 8192,
          },
        });
        return model.generateContent(prompt);
      });
      const usage = {
        prompt_tokens: result.response.usageMetadata?.promptTokenCount ?? 0,
        completion_tokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
        total_tokens: result.response.usageMetadata?.totalTokenCount ?? 0,
        cached_tokens: result.response.usageMetadata?.cachedContentTokenCount ?? 0
      }
      tracker.record(`eval-${agentName}`, usage);
      return result.response.text();
    };

    let completedAgents = 0;
    const handleAgent = async (sysPrompt, agentName, targetModel) => {
      const text = await runAgent(sysPrompt, agentName, targetModel);
      completedAgents++;
      if (onProgress) onProgress(`${agentName} completed.`, 30 + (completedAgents * 20));
      return text;
    };

    const results = [];
    if (useLocalCli) {
      console.log('[Multi-Agent] Running sequentially to prevent CLI overloading...');
      results.push(await handleAgent(agent1Prompt, 'Foundation Agent', 'gemini-3.8-flash').then(v => ({ status: 'fulfilled', value: v })).catch(e => ({ status: 'rejected', reason: e })));
      results.push(await handleAgent(agent2Prompt, 'Market & Prep Agent', 'gemini-3.8-flash').then(v => ({ status: 'fulfilled', value: v })).catch(e => ({ status: 'rejected', reason: e })));
      results.push(await handleAgent(agent3Prompt, 'Risk & Application Agent', 'gemini-3.8-flash').then(v => ({ status: 'fulfilled', value: v })).catch(e => ({ status: 'rejected', reason: e })));
    } else {
      results.push(handleAgent(agent1Prompt, 'Foundation Agent', 'gemini-3.8-flash').then(v => ({ status: 'fulfilled', value: v })).catch(e => ({ status: 'rejected', reason: e })));
      results.push(handleAgent(agent2Prompt, 'Market & Prep Agent', 'gemini-3.8-flash').then(v => ({ status: 'fulfilled', value: v })).catch(e => ({ status: 'rejected', reason: e })));
      results.push(handleAgent(agent3Prompt, 'Risk & Application Agent', 'gemini-3.8-flash').then(v => ({ status: 'fulfilled', value: v })).catch(e => ({ status: 'rejected', reason: e })));
      await Promise.all(results);
    }

    const text1 = results[0].status === 'fulfilled' ? results[0].value : [
      "> Error: Foundation Agent failed: " + (results[0].reason?.message || 'Unknown'),
      "",
      "## A) Role Summary",
      "Failed to generate.",
      "",
      "## B) Match with CV",
      "Failed to generate.",
      "",
      "## C) Level and Strategy",
      "Failed to generate.",
      "",
      "---SCORE_SUMMARY---",
      "COMPANY: Unknown",
      "ROLE: N/A",
      "LOCATION: Unknown",
      "SCORE: 0",
      "ARCHETYPE: N/A",
      "---END_SUMMARY---"
    ].join('\n');

    const text2 = results[1].status === 'fulfilled' ? results[1].value : [
      "> Error: Market & Prep Agent failed: " + (results[1].reason?.message || 'Unknown'),
      "",
      "## D) Comp and Demand",
      "Failed to generate.",
      "",
      "## E) Customization Plan",
      "Failed to generate.",
      "",
      "## F) Interview Plan",
      "Failed to generate."
    ].join('\n');

    const text3 = results[2].status === 'fulfilled' ? results[2].value : [
      "> Error: Risk & Application Agent failed: " + (results[2].reason?.message || 'Unknown'),
      "",
      "## G) Posting Legitimacy",
      "Failed to generate.",
      "",
      "---SCORE_SUMMARY---",
      "LEGITIMACY: Unknown",
      "---END_SUMMARY---"
    ].join('\n');

    let company = 'Unknown', role = 'Unknown', location = 'Unknown', score = '?', archetype = 'Unknown', legitimacy = 'Unknown';

    const extractScoreSummary = (text) => {
      const m = text.match(/---SCORE_SUMMARY---\s*([\s\S]*?)---END_SUMMARY---/);
      if (!m) return {};
      const block = m[1];
      const ex = (key) => {
        const r = new RegExp(`^\\s*${key}:\\s*(.+)$`, 'mi');
        const match = block.match(r);
        return match ? match[1].trim() : undefined;
      };
      return {
        company: ex('COMPANY'),
        role: ex('ROLE'),
        location: ex('LOCATION'),
        score: ex('SCORE'),
        archetype: ex('ARCHETYPE'),
        legitimacy: ex('LEGITIMACY')
      };
    };

    const sum1 = extractScoreSummary(text1);
    const sum3 = extractScoreSummary(text3);

    company = sum1.company || company;
    role = sum1.role || role;
    location = sum1.location || location;
    score = sum1.score || score;
    archetype = sum1.archetype || archetype;
    legitimacy = sum3.legitimacy || legitimacy;

    const clean = (t) => t.replace(/---SCORE_SUMMARY---[\s\S]*?---END_SUMMARY---/g, '').trim();

    evaluationText = `${clean(text1)}\n\n${clean(text2)}\n\n${clean(text3)}\n\n---SCORE_SUMMARY---\nCOMPANY: ${company}\nROLE: ${role}\nLOCATION: ${location}\nSCORE: ${score}\nARCHETYPE: ${archetype}\nLEGITIMACY: ${legitimacy}\n---END_SUMMARY---`;

    console.log('='.repeat(60));
    console.log(`[Gemini API Response] Multi-Agent Synthesis Complete`);
    console.log(`[Gemini API Response] Response Text:\n`, evaluationText.substring(0, 500) + '...\n[Truncated]');
    console.log('='.repeat(60));
  } catch (err) {
    const sanitizedMsg = (err.message || '').split(apiKey).join('[REDACTED]');
    throw new Error(`Gemini API error (Multi-Agent): ${sanitizedMsg}`);
  }

  try {
    validateEvaluationShape(evaluationText);
  } catch (err) {
    throw new Error(`Gemini output failed validation: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // Display evaluation
  // ---------------------------------------------------------------------------
  console.log('\n' + '═'.repeat(66));
  console.log('  CAREER-OPS EVALUATION — powered by Google Gemini');
  console.log('═'.repeat(66) + '\n');
  console.log(evaluationText);

  // ---------------------------------------------------------------------------
  // Parse score summary
  // ---------------------------------------------------------------------------
  const summaryMatch = evaluationText.match(
    /---SCORE_SUMMARY---\s*([\s\S]*?)---END_SUMMARY---/
  );

  let company = 'unknown';
  let role = 'unknown';
  let location = 'unknown';
  let score = '?';
  let archetype = 'unknown';
  let legitimacy = 'unknown';

  if (summaryMatch) {
    const block = summaryMatch[1];
    const extract = (key) => {
      const prefix = `${key}:`;
      const lines = block.split('\n');
      for (const line of lines) {
        const trimmed = line.trimStart();
        if (trimmed.startsWith(prefix)) {
          return trimmed.slice(prefix.length).trim();
        }
      }
      return 'unknown';
    };
    company = extract('COMPANY') || company;
    role = extract('ROLE') || role;
    location = extract('LOCATION') || location;
    score = extract('SCORE') || score;
    archetype = extract('ARCHETYPE') || archetype;
    legitimacy = extract('LEGITIMACY') || legitimacy;
  }

  // ---------------------------------------------------------------------------
  // Save report
  // ---------------------------------------------------------------------------
  if (saveReport) {
    let reportSaved = false;
    let reservedNumbers = [];
    try {
      try {
        if (!existsSync(PATHS.reports)) {
          mkdirSync(PATHS.reports, { recursive: true });
        }

        reservedNumbers = await reserveReportNumbers(1, { rootDir: ROOT, reportsDir: PATHS.reports });
        const num = formatReportNumber(reservedNumbers[0]);
        const today = new Date().toISOString().split('T')[0];
        const companySlug = slugifyCompany(company);
        const filename = `${num}-${companySlug}-${today}.md`;
        const reportPath = join(PATHS.reports, filename);
        const trackerPath = join(PATHS.trackerAdditions, `${num}-${companySlug}.tsv`);

        const reportContent = `# Evaluation: ${company} — ${role}

**Date:** ${today}
**Archetype:** ${archetype}
**Score:** ${score}/5
**Legitimacy:** ${legitimacy}
**PDF:** pending
**Tool:** Gemini (${modelName})

---

${evaluationText.replace(/---SCORE_SUMMARY---[\s\S]*?---END_SUMMARY---/, '').trim()}
`;

        writeFileSync(reportPath, reportContent, 'utf-8');
        mkdirSync(PATHS.trackerAdditions, { recursive: true });
        const trackerFields = [
          String(parseInt(num, 10)),
          today,
          tsvSafe(company),
          tsvSafe(role),
          'Evaluated',
          normalizedTrackerScore(score),
          '❌',
          `[${num}](reports/${filename})`,
          'Gemini evaluation',
        ];
        writeFileSync(trackerPath, `${trackerFields.join('\t')}\n`, 'utf-8');
        console.log(`\n✅  Report saved: reports/${filename}`);
        console.log(`📊  Tracker addition saved: batch/tracker-additions/${num}-${companySlug}.tsv`);
        reportSaved = true;
      } catch (err) {
        console.warn(`⚠️   Could not save report: ${err.message}`);
        process.exitCode = 1;
      }

      if (reportSaved) {
        try {
          const mergeOutput = execFileSync(process.execPath, [join(ROOT, 'merge-tracker.mjs')], {
            cwd: ROOT,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          if (mergeOutput.trim()) console.log(mergeOutput.trim());
          console.log('📊  Tracker merged into data/applications.md.');
        } catch (err) {
          console.warn(`⚠️   Report saved, but could not merge tracker addition into data/applications.md: ${err.message}`);
          process.exitCode = 1;
        }
      }
    } finally {
      if (reservedNumbers.length > 0) {
        try {
          await releaseReportNumbers(reservedNumbers, { rootDir: ROOT, reportsDir: PATHS.reports });
        } catch (err) {
          console.warn(`⚠️   Could not release report reservation: ${err.message}`);
        }
      }
    }
  }

  console.log('\n' + '─'.repeat(66));
  console.log(`  Score: ${score}/5  |  Archetype: ${archetype}  |  Legitimacy: ${legitimacy}  |  Location: ${location}`);
  console.log('─'.repeat(66) + '\n');

  console.log(formatBreakdown(tracker, modelName, 'gemini'));

  return { company, role, location, score, archetype, legitimacy, evaluationText, cleanedJdJson };
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}` && process.argv[1].endsWith('gemini-eval.mjs')) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
  ╔══════════════════════════════════════════════════════════════════╗
  ║           career-ops — Gemini Evaluator (free-tier)             ║
  ╚══════════════════════════════════════════════════════════════════╝

    Evaluate a job offer using Google Gemini instead of Claude.

    USAGE
      node gemini-eval.mjs "<JD text>"
      node gemini-eval.mjs --file ./jds/my-job.txt
      node gemini-eval.mjs --model gemini-3.8-flash "<JD text>"

    OPTIONS
      --file <path>    Read JD from a file instead of inline text
      --model <name>   Gemini model to use (default: gemini-3.8-flash)
      --no-save        Do not save report to reports/ directory
      --help           Show this help
  `);
    process.exit(0);
  }

  let jdText = '';
  let modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  let saveReport = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      const filePath = args[++i];
      if (!existsSync(filePath)) {
        console.error(`❌  File not found: ${filePath}`);
        process.exit(1);
      }
      jdText = readFileSync(filePath, 'utf-8').trim();
    } else if (args[i] === '--model' && args[i + 1]) {
      modelName = args[++i];
    } else if (args[i] === '--no-save') {
      saveReport = false;
    } else if (!args[i].startsWith('--')) {
      jdText += (jdText ? '\n' : '') + args[i];
    }
  }

  evaluateJob({ jdText, modelName, saveReport }).catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
