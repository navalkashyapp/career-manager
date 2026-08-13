import { exec } from 'child_process';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { GEMINI_MODELS } from './src/config/gemini';
import { OrchestratorAgent } from './src/agents/OrchestratorAgent';
import { MatchScorerAgent } from './src/lib/agents/MatchScorerAgent';
import { CVTailorAgent } from './src/lib/agents/CVTailorAgent';
import { InterviewCoachAgent } from './src/lib/agents/InterviewCoachAgent';
import { JobScraperService } from './src/lib/services/JobScraperService';
import { PdfGeneratorService } from './src/lib/services/PdfGeneratorService';
import { LocalConnectorService } from './src/lib/services/LocalConnectorService';
import * as fs from 'fs';
import { z } from 'zod';
import { OutreachAgent } from './src/lib/agents/OutreachAgent';
import { careerOpsRouter } from './src/lib/api/careerOpsRouter';

const timeoutMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout: The LLM took too long to respond.' });
    }
  });
  next();
};

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(timeoutMiddleware);
  
  // Mount the new career-ops router
  app.use('/api/career-ops', careerOpsRouter);

  // Validation Schemas
  const JobPayloadSchema = z.object({
    jdText: z.string().min(10),
    profileData: z.any().optional(),
    messageType: z.string().optional()
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
      const response = await ai.models.generateContent({
        model: GEMINI_MODELS.FLASH,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/gemini/draft-outreach', async (req, res) => {
    try {
      const validated = JobPayloadSchema.parse(req.body);
      const agent = new OutreachAgent(ai);
      const result = await agent.draft(validated);
      res.json(result);
    } catch (error: any) {
      console.error(error);
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
      const response = await ai.models.generateContent({
        model: GEMINI_MODELS.FLASH,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/gemini/prep-interview', async (req, res) => {
    try {
      const { jdText, companyName } = req.body;
      const prompt = `
You are an expert technical interview coach. Analyze this Job Description for ${companyName}:
${jdText}

Generate a tailored list of potential system design questions and behavioral prompts based on the JD and company domain.
Return the result as a JSON object with this structure:
{
  "systemDesignQuestions": [{"question": "string", "focusAreas": ["string"]}],
  "behavioralPrompts": [{"prompt": "string", "whyTheyAskThis": "string"}]
}
      `;
      const response = await ai.models.generateContent({
        model: GEMINI_MODELS.FLASH,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error(error);
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
      const response = await ai.models.generateContent({
        model: GEMINI_MODELS.FLASH,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });


  app.post('/api/gemini/career-ops', async (req, res) => {
    try {
      const { action } = req.body;
      const orchestrator = new OrchestratorAgent(ai);
      
      const result = await orchestrator.handleAction(action, req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Career ops orchestrator error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/career-ops/score-match', async (req, res) => {
    try {
      const agent = new MatchScorerAgent(ai);
      let jobDesc = req.body.jobDescription;
      
      // If the job description is a URL (e.g. LinkedIn link), scrape it first
      if (jobDesc && (jobDesc.startsWith('http') || jobDesc.startsWith('www.'))) {
        try {
          const url = jobDesc.startsWith('http') ? jobDesc : `https://${jobDesc}`;
          jobDesc = await JobScraperService.scrapeJobPosting(url);
          console.log(`Successfully scraped job description from ${url}`);
        } catch (scrapeErr) {
          console.warn(`Failed to scrape URL, falling back to raw URL string: `, scrapeErr);
        }
      }
      
      const payload = { ...req.body, jobDescription: jobDesc };
      const result = await agent.evaluate(payload);
      res.json(result);
    } catch (error: any) {
      console.error('MatchScorer error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/career-ops/tailor-cv', async (req, res) => {
    try {
      const agent = new CVTailorAgent(ai);
      const result = await agent.tailor(req.body);
      res.json(result);
    } catch (error: any) {
      console.error('CVTailor error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/career-ops/prep-interview', async (req, res) => {
    try {
      const agent = new InterviewCoachAgent(ai);
      const result = await agent.prep(req.body);
      res.json(result);
    } catch (error: any) {
      console.error('InterviewCoach error:', error);
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
      LocalConnectorService.runAutomatedSearch(keywords, profileData, ai).catch(err => {
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
      
      const response = await ai.models.generateContent({
        model: GEMINI_MODELS.PRO,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      
      res.json(JSON.parse(response.text || '{}'));
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
      
      const response = await ai.models.generateContent({
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
      
      const response = await ai.models.generateContent({
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
