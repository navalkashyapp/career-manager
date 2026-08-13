import express from 'express';
import { evaluateJob } from '../../../career-ops/gemini-eval.mjs';
import { COMMANDS as tracker } from '../../../career-ops/tracker.mjs';
import { DataParserService } from '../services/DataParserService';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { OutreachAgent } from '../agents/OutreachAgent';
import { z } from 'zod';
import { execFile } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execFileAsync = util.promisify(execFile);

export const careerOpsRouter = express.Router();
const dataParser = new DataParserService(path.resolve(__dirname, '../../../career-ops'));
const careerOpsPath = path.resolve(__dirname, '../../../career-ops');

// ---------------------------------------------------------------------------
// REST Endpoint: Tracker Query
// ---------------------------------------------------------------------------
careerOpsRouter.get('/tracker', async (req, res) => {
  try {
    const { stdout } = await execFileAsync(process.execPath, ['tracker.mjs', 'query', '--json'], { cwd: careerOpsPath });
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
      gapAnalysis: []
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
        const parts = line.split('|').map(p => p.trim());
        if (parts[1] === id) { // # column is usually index 1
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
const OutreachSchema = z.object({
  jdText: z.string(),
  profileData: z.any(),
  messageType: z.string()
});

careerOpsRouter.post('/outreach-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const payload = OutreachSchema.parse(req.body);
    sendEvent('progress', { phase: 'Analyzing Job Description...', percentage: 20 });

    // Simulate streaming phases
    setTimeout(() => sendEvent('progress', { phase: 'Matching Candidate Profile...', percentage: 50 }), 1500);
    setTimeout(() => sendEvent('progress', { phase: 'Drafting Outreach...', percentage: 80 }), 3000);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const agent = new OutreachAgent(ai);
    const result = await agent.draft(payload);

    sendEvent('progress', { phase: 'Complete', percentage: 100 });
    sendEvent('result', result);
    res.end();

  } catch (error: any) {
    sendEvent('error', { message: error.message });
    res.end();
  }
});

// ---------------------------------------------------------------------------
// SSE Endpoint: Long-running AI Job Evaluation
// ---------------------------------------------------------------------------
const EvaluateSchema = z.object({
  jdText: z.string().optional(),
  url: z.string().url().optional(),
  modelName: z.string().optional()
});

careerOpsRouter.post('/evaluate-stream', async (req, res) => {
  // Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { jdText, modelName } = EvaluateSchema.parse(req.body);

    sendEvent('progress', { phase: 'Initializing evaluation...', percentage: 10 });

    // Simulate streaming phases (since evaluateJob doesn't natively yield progress)
    const phases = ['Analyzing Job Description...', 'Matching Profile...', 'Drafting Report...'];
    let phaseIndex = 0;
    const interval = setInterval(() => {
      if (phaseIndex < phases.length) {
        sendEvent('progress', { phase: phases[phaseIndex], percentage: 20 + phaseIndex * 20 });
        phaseIndex++;
      }
    }, 2000);

    // Call the newly exported `evaluateJob` function
    const result = await evaluateJob({ jdText, modelName, saveReport: true });

    clearInterval(interval);
    sendEvent('progress', { phase: 'Complete', percentage: 100 });
    sendEvent('result', result);
    res.end();

  } catch (error: any) {
    sendEvent('error', { message: error.message });
    res.end();
  }
});

careerOpsRouter.post('/evaluate-url-stream', async (req, res) => {
  // Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { url, modelName } = EvaluateSchema.parse(req.body);
    if (!url) {
      throw new Error("URL is required for this endpoint");
    }

    sendEvent('progress', { phase: 'Scraping Job Description from URL...', percentage: 10 });

    const { JobScraperService } = await import('../services/JobScraperService.js');
    const scrapedText = await JobScraperService.scrapeJobPosting(url);

    if (!scrapedText || scrapedText.length < 50) {
      throw new Error("Failed to extract sufficient text from the provided URL.");
    }

    sendEvent('progress', { phase: 'Initializing evaluation...', percentage: 30 });

    // Simulate streaming phases for evaluation
    const phases = ['Analyzing Job Description...', 'Matching Profile...', 'Drafting Report...'];
    let phaseIndex = 0;
    const interval = setInterval(() => {
      if (phaseIndex < phases.length) {
        sendEvent('progress', { phase: phases[phaseIndex], percentage: 40 + phaseIndex * 15 });
        phaseIndex++;
      }
    }, 2000);

    // Call evaluateJob
    const result = await evaluateJob({ jdText: scrapedText, modelName, saveReport: true });

    clearInterval(interval);

    // Sync the DB to reflect the new row
    sendEvent('progress', { phase: 'Syncing Tracker Database...', percentage: 95 });
    await execFileAsync(process.execPath, ['tracker.mjs', 'sync'], { cwd: careerOpsPath });

    sendEvent('progress', { phase: 'Complete', percentage: 100 });
    sendEvent('result', result);
    res.end();

  } catch (error: any) {
    sendEvent('error', { message: error.message });
    res.end();
  }
});

// ---------------------------------------------------------------------------
// SSE Endpoint: Long-running AI Tailor Resume
// ---------------------------------------------------------------------------
const TailorSchema = z.object({
  jdText: z.string(),
  profileData: z.any()
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
    sendEvent('progress', { phase: 'Analyzing Job Description...', percentage: 10 });

    // Simulate streaming phases
    setTimeout(() => sendEvent('progress', { phase: 'Identifying Key Skills...', percentage: 40 }), 1500);
    setTimeout(() => sendEvent('progress', { phase: 'Rewriting Resume Bullets...', percentage: 70 }), 3000);
    setTimeout(() => sendEvent('progress', { phase: 'Finalizing formatting...', percentage: 90 }), 4500);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    // Quick inline tailor generation
    const prompt = `
You are an expert technical recruiter.
Job Description: ${payload.jdText}
Profile Data: ${JSON.stringify(payload.profileData)}

Rewrite the candidate's profile to better match the job description.
Return a JSON object with:
{
  "tailoredSummary": "A tailored professional summary",
  "keySkills": ["skill 1", "skill 2", "skill 3"]
}
`;
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const result = JSON.parse(response.text || '{}');

    setTimeout(() => {
      sendEvent('progress', { phase: 'Complete', percentage: 100 });
      sendEvent('result', result);
      res.end();
    }, 6000);

  } catch (error: any) {
    sendEvent('error', { message: error.message });
    res.end();
  }
});
