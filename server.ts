import { exec, execFile } from 'child_process';
import { promisify } from 'util';
// removed local promisify
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { GEMINI_MODELS } from './src/config/gemini';
import { OrchestratorAgent } from './src/agents';
import { JobScraperService } from './src/lib/services/JobScraperService';
import { PdfGeneratorService } from './src/lib/services/PdfGeneratorService';
import { LocalConnectorService } from './src/lib/services/LocalConnectorService';
import { AgyCliService } from './src/lib/services/AgyCliService';
import * as fs from 'fs';
import { z } from 'zod';
import { careerOpsRouter } from './src/lib/api/careerOpsRouter';
import { callGeminiApi } from './src/lib/utils/geminiClient';

function safeParseJSON(text: string) {
  if (!text) return {};
  text = text.trim();
  const jsonMatch = text.match(/```(?:json)?\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch (e) {}
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (e) {}
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    return {};
  }
}

const timeoutMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  res.setTimeout(600000, () => {
    if (!res.headersSent) {
      res.status(503).send('Request timed out. Please try again.');
    }
  });
  next();
};

dotenv.config();

const apiKey =
  process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_2 || '';
const ai = new GoogleGenAI({ apiKey });

async function startServer() {
  const app = express();

  // Trust proxy for Cloudflare / reverse proxy real IP resolution
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    req.url = req.url.replace(/\/\/+/g, '/');
    next();
  });

  const allowedOrigins = [
    'https://career-manager-8037a.firebaseapp.com',
    'https://mycareer-manager.web.app',
    'http://localhost:5173',
    'http://localhost:3000',
    ...(process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((s: string) => s.trim())
      : []),
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          origin.endsWith('.trycloudflare.com') ||
          origin.endsWith('.ngrok-free.dev') ||
          origin.endsWith('.ngrok-free.app') ||
          origin.endsWith('.ngrok.app') ||
          origin.endsWith('.ngrok.io')
        ) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'ngrok-skip-browser-warning',
        'X-Requested-With',
        'Accept',
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    }),
  );

  const PORT = 3000;

  // Payload limits to prevent JSON memory exhaustion
  app.use(express.json({ limit: '500kb' }));
  app.use(express.urlencoded({ limit: '500kb', extended: true }));
  app.use(timeoutMiddleware);

  // Rate Limiting: General API Limiter (300 requests per 15 mins per IP)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
  });
  app.use('/api', apiLimiter);

  // Rate Limiting: Stricter AI Limiter (30 heavy requests per 15 mins per IP)
  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many AI evaluation requests, please try again in a few minutes.' },
  });
  app.use('/api/career-ops/evaluate', aiLimiter);
  app.use('/api/career-ops/evaluate-url', aiLimiter);
  app.use('/api/career-ops/tailor-stream', aiLimiter);
  app.use('/api/career-ops/run', aiLimiter);
  app.use('/api/gemini', aiLimiter);

  // Mount the new career-ops router
  app.use('/api/career-ops', careerOpsRouter);

  // Validation Schemas
  const JobPayloadSchema = z.object({
    jdText: z.string().min(10),
    profileData: z.any().optional(),
    messageType: z.string().optional(),
  });

  // API Routes
  app.post('/api/gemini/tailor-resume', async (req, res) => {
    try {
      const { jdText, profileData } = req.body;
      const prompt = `
You are an expert executive career strategist and technical resume writer.
Analyze this Job Description: ${jdText}
And this Candidate Profile: ${JSON.stringify(profileData)}

Generate a customized markdown resume optimized for this exact JD, pulling relevant bullets from the Candidate Profile.
Emphasize relevant metrics and key terms. Use standard professional markdown formatting.
Also, provide an ATS Match Score (0-100) and a brief list of missing keywords.

Return the result as a JSON object with this structure:
{
  "resumeMarkdown": "string",
  "matchScore": number,
  "missingKeywords": ["string", "string"]
}
      `;
      const response = await callGeminiApi({
        model: GEMINI_MODELS.FLASH,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      res.json(safeParseJSON(response.text || ''));
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/gemini/draft-outreach', async (req, res) => {
    try {
      const validated = JobPayloadSchema.parse(req.body);
      const orchestrator = new OrchestratorAgent(ai, { debug: true });
      const p = validated.profileData || {};
      const userProfile = {
        fullName: p.name || p.fullName || 'Candidate',
        headline: p.headline || p.targetLevel || '',
        voiceSample: p.voiceSample || '',
        location: p.location || '',
        email: p.email || '',
        phone: p.phone || '',
      };
      const masterCvMarkdown =
        p.masterCvMarkdown ||
        p.resumeText ||
        (typeof p === 'string' ? p : JSON.stringify(p, null, 2));
      const channel = validated.messageType?.toLowerCase().includes('linkedin')
        ? 'linkedin-connection-note'
        : 'cold-email';

      const draft = (await orchestrator.handleAction('draft_outreach', {
        userProfile,
        masterCvMarkdown,
        jobDescription: validated.jdText,
        recipient: { name: 'Hiring Manager', role: 'Hiring Manager', company: 'Target Company' },
        channel,
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
      console.error('[server:draft-outreach] Error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/gemini/analyze-jd', async (req, res) => {
    try {
      const { jdText } = req.body;
      const prompt = `
Analyze this Job Description for a TPM or engineering leadership role:
${jdText}

Extract the required technical skills, key leadership principles, implicit architecture domain knowledge, and potential red flags.
Return the result as a JSON object with this structure:
{
  "technicalSkills": ["string"],
  "leadershipPrinciples": ["string"],
  "domainKnowledge": ["string"],
  "redFlags": ["string"]
}
      `;
      const response = await callGeminiApi({
        model: GEMINI_MODELS.FLASH,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      res.json(safeParseJSON(response.text || ''));
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/gemini/prep-interview', async (req, res) => {
    try {
      const { jdText, companyName, profileData } = req.body;
      const orchestrator = new OrchestratorAgent(ai, { debug: true });
      const p = profileData || {};
      const userProfile = {
        fullName: p.name || p.fullName || 'Candidate',
        headline: p.headline || p.targetLevel || '',
        voiceSample: p.voiceSample || '',
        location: p.location || '',
        email: p.email || '',
        phone: p.phone || '',
      };
      const masterCvMarkdown =
        p.masterCvMarkdown ||
        p.resumeText ||
        (typeof p === 'string' ? p : JSON.stringify(p, null, 2));

      const plan = (await orchestrator.handleAction('interview_prep_plan', {
        userProfile,
        masterCvMarkdown,
        jobDescription: jdText || '',
        daysAvailable: 7,
      })) as any;

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
      console.error('[server:prep-interview] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/gemini/summarize-email', async (req, res) => {
    try {
      const { emailContent } = req.body;
      const prompt = `
You are an expert technical assistant. Analyze this email thread between a candidate and a recruiter:
${emailContent}

Summarize the thread into key action items for the candidate. Return the result as a JSON object with this structure:
{
  "summary": "string",
  "actionItems": ["string"]
}
      `;
      const response = await callGeminiApi({
        model: GEMINI_MODELS.FLASH,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      res.json(safeParseJSON(response.text || ''));
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/gemini/agy-proxy', async (req, res) => {
    try {
      const { prompt } = req.body;
      console.log('\n=== AGY PROXY REQUEST ===\n', prompt, '\n=========================\n');
      const text = await AgyCliService.executePrompt(prompt);
      console.log('\n=== AGY PROXY RESPONSE ===\n', text, '\n==========================\n');
      res.json({ text });
    } catch (error: any) {
      console.error('AGY CLI Proxy error:', error, error.stderr);
      res.status(500).json({ error: error.message, stderr: error.stderr });
    }
  });

  app.post('/api/gemini/career-ops', async (req, res) => {
    try {
      const { action } = req.body;
      const orchestrator = new OrchestratorAgent(ai, { debug: true });

      const result = await orchestrator.handleAction(action, req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Career ops orchestrator error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/career-ops/scrape-job', async (req, res) => {
    try {
      const { url } = req.body;
      const text = await JobScraperService.scrapeJobPosting(url);
      res.json({ text });
    } catch (error: any) {
      console.error('JobScraper error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/career-ops/generate-pdf', async (req, res) => {
    try {
      const { html } = req.body;
      const pdfBuffer = await PdfGeneratorService.generatePdf(html);
      res.setHeader('Content-Type', 'application/pdf');
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('PdfGenerator error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/career-ops/trigger-connector', async (req, res) => {
    try {
      const { keywords, profileData } = req.body;
      if (!keywords || !profileData) {
        return res.status(400).json({ error: 'Missing keywords or profileData' });
      }

      // Start in background so we don't block the request
      LocalConnectorService.runAutomatedSearch(keywords, profileData, ai).catch((err) => {
        console.error('LocalConnectorService background error:', err);
      });

      res.json({ message: 'Automated job search started successfully in the background.' });
    } catch (error: any) {
      console.error('Trigger connector error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/career-ops/local-jobs', async (req, res) => {
    try {
      const storePath = path.join(process.cwd(), 'src', 'store', 'local-jobs.json');
      if (fs.existsSync(storePath)) {
        const fileContent = fs.readFileSync(storePath, 'utf-8');
        res.json(fileContent ? JSON.parse(fileContent) : []);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      console.error('Get local jobs error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/gemini/parse-linkedin', async (req, res) => {
    try {
      const { linkedinData } = req.body;
      const prompt = `You are an expert executive career strategist and parser. Parse the following raw LinkedIn profile text (or PDF extract) into a structured JSON profile that matches this exact schema:
      
      {
        "fullName": "string",
        "targetTitle": "string (derive from headline or most recent role)",
        "location": "string",
        "preferredCompensation": "string (guess or put TBD)",
        "linkedinUrl": "string (if found in text, else empty)",
        "portfolioUrl": "string",
        "careerHistory": [
          {
            "id": "string (generate unique id like 'job-1')",
            "company": "string",
            "title": "string",
            "dates": "string",
            "location": "string",
            "bullets": ["string"]
          }
        ],
        "coreSkills": {
          "cloudInfrastructure": ["string"],
          "programmingLanguages": ["string"],
          "frameworks": ["string"],
          "certifications": ["string"],
          "programMethodologies": ["string"]
        },
        "projects": [
          {
            "id": "string",
            "title": "string",
            "problem": "string",
            "architecture": "string",
            "impact": "string",
            "teamSize": "string",
            "scaleMetrics": "string"
          }
        ]
      }
      
      Raw LinkedIn Data: ${linkedinData}
      `;

      const response = await callGeminiApi({
        model: GEMINI_MODELS.PRO,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      res.json(safeParseJSON(response.text || ''));
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/gemini/career-coach', async (req, res) => {
    try {
      const { message, chatHistory, summary, profileData, applications } = req.body;

      const prompt = `You are a Career Coach AI. You have access to the user's master profile data and pending applications.
      Profile: ${JSON.stringify(profileData)}
      Applications: ${JSON.stringify(applications)}
      Previous summary: ${summary || 'None'}
      
      Chat History:
      ${chatHistory.map((m: any) => `${m.role}: ${m.content}`).join('\n')}
      
      User: ${message}
      
      Provide helpful, real-time advice based on their profile and applications.
      `;

      const response = await callGeminiApi({
        model: GEMINI_MODELS.PRO,
        contents: prompt,
      });

      res.json({ reply: response.text });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/gemini/summarize-chat', async (req, res) => {
    try {
      const { chatHistory, previousSummary } = req.body;
      const prompt = `Summarize this career coaching chat history into a concise ongoing context for future sessions.
      Previous Summary: ${previousSummary || 'None'}
      Recent Chat:
      ${chatHistory.map((m: any) => `${m.role}: ${m.content}`).join('\n')}
      
      Provide a brief summary of the key takeaways and current state of the user's career coaching session.`;

      const response = await callGeminiApi({
        model: GEMINI_MODELS.PRO,
        contents: prompt,
      });

      res.json({ summary: response.text });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/career-ops/run', (req, res) => {
    const { script, args } = req.body;
    const allowedScripts = ['doctor', 'gemini:eval', 'scan:full'];

    if (!allowedScripts.includes(script)) {
      return res.status(400).json({ error: 'Script not allowed' });
    }

    const command = `cd src/career-ops && npm run ${script} -- ${args || ''}`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Career ops execution error:', error);
        return res.status(500).json({ error: error.message, stderr, stdout });
      }
      res.json({ stdout, stderr });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Slowloris & Edge Proxy Timeout Protection
  server.headersTimeout = 10000; // 10s: drop slowloris header stalls
  server.requestTimeout = 600000; // 10m: allow full streaming evaluation jobs
  server.keepAliveTimeout = 65000; // 65s: keep-alive matching Cloudflare edge defaults
}

startServer();
