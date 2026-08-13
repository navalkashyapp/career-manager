import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'server.ts');
let content = fs.readFileSync(filePath, 'utf8');

const newRoute = `
  app.post('/api/gemini/career-ops', async (req, res) => {
    try {
      const { action, userProfile, masterCvMarkdown, jobDescription, jobDescriptions, companyName, interviewFocus, emailType } = req.body;
      
      let prompt = '';
      let schemaDescription = '';
      
      switch (action) {
        case 'evaluate_job':
          prompt = 'Score this job against the user profile.\\nUserProfile: ' + JSON.stringify(userProfile) + '\\nJobDescription: ' + jobDescription;
          schemaDescription = '{ "overallScore": 0.0, "grades": { "skillAlignment": "A", "cultureFit": "A", "compensationMatching": "A", "growthPotential": "A" }, "gapAnalysis": ["string"], "verdict": "string" }';
          break;
        case 'tailor_resume':
          prompt = 'Tailor the users masterCvMarkdown to the job description without fabricating facts. If a critical skill is missing, highlight it strictly in the gapAnalysis array (but output schema only has keywordsTargeted and changesMade, so adapt appropriately).\\nMasterCV: ' + masterCvMarkdown + '\\nJobDescription: ' + jobDescription;
          schemaDescription = '{ "tailoredCvMarkdown": "string", "keywordsTargeted": ["string"], "changesMade": ["string"] }';
          break;
        case 'parse_job_page':
          prompt = 'Extract raw metadata from this scraped job page DOM snippet.\\nDOM Snippet: ' + jobDescription;
          schemaDescription = '{ "companyName": "string", "roleTitle": "string", "location": "string", "salaryRange": "string", "strictRequirements": ["string"] }';
          break;
        case 'batch_evaluate_jobs':
          prompt = 'Evaluate an array of multiple job descriptions at once.\\nUserProfile: ' + JSON.stringify(userProfile) + '\\nJobs: ' + JSON.stringify(jobDescriptions);
          schemaDescription = '{ "batchEvaluations": [ { "jobIndex": 0, "companyName": "string", "roleTitle": "string", "overallScore": 0.0, "primaryGap": "string" } ] }';
          break;
        case 'interview_prep_plan':
          prompt = 'Create an interview prep plan for this job.\\nJobDescription: ' + jobDescription;
          schemaDescription = '{ "timeBlockedAgenda": [ { "day": "string", "focusTopic": "string", "suggestedResources": ["string"] } ] }';
          break;
        case 'interview_prep_mock':
          prompt = 'Simulate an interview question for this job. Focus: ' + interviewFocus + '\\nJobDescription: ' + jobDescription;
          schemaDescription = '{ "question": "string", "focusArea": "string" }';
          break;
        case 'interview_prep_debrief':
          prompt = 'Debrief an interview simulation. Provide gaps and profile updates.';
          schemaDescription = '{ "detectedGaps": ["string"], "profileUpdates": ["string"] }';
          break;
        case 'draft_outreach':
          prompt = 'Draft three distinct high-conversion outreach iterations for this job.\\nUserProfile: ' + JSON.stringify(userProfile) + '\\nJobDescription: ' + jobDescription;
          schemaDescription = '{ "outreachTemplates": [ { "variant": "Short & Direct", "subject": "string", "body": "string" }, { "variant": "Value-Add / Referral", "subject": "string", "body": "string" }, { "variant": "Casual Peer Connection", "subject": "string", "body": "string" } ] }';
          break;
        default:
          return res.status(400).json({ error: 'Invalid action' });
      }

      const fullPrompt = prompt + '\\n\\nReturn ONLY valid JSON matching this exact schema:\\n' + schemaDescription + '\\nDo not include markdown blocks.';

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: fullPrompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error('Career ops error:', error);
      res.status(500).json({ error: error.message });
    }
  });
`;

content = content.replace('  // Vite middleware for development', newRoute + '\n  // Vite middleware for development');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Added career ops endpoint');
