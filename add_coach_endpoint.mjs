import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'server.ts');
let content = fs.readFileSync(filePath, 'utf8');

const newRoute = `
  app.post('/api/gemini/career-coach', async (req, res) => {
    try {
      const { message, chatHistory, summary, profileData, applications } = req.body;
      
      const prompt = \`You are a Career Coach AI. You have access to the user's master profile data and pending applications.
      Profile: \${JSON.stringify(profileData)}
      Applications: \${JSON.stringify(applications)}
      Previous summary: \${summary || 'None'}
      
      Chat History:
      \${chatHistory.map((m: any) => \`\${m.role}: \${m.content}\`).join('\\n')}
      
      User: \${message}
      
      Provide helpful, real-time advice based on their profile and applications.
      \`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
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
      const prompt = \`Summarize this career coaching chat history into a concise ongoing context for future sessions.
      Previous Summary: \${previousSummary || 'None'}
      Recent Chat:
      \${chatHistory.map((m: any) => \`\${m.role}: \${m.content}\`).join('\\n')}
      
      Provide a brief summary of the key takeaways and current state of the user's career coaching session.\`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
      });
      
      res.json({ summary: response.text });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });
`;

if (!content.includes('/api/gemini/career-coach')) {
  content = content.replace('  app.post(\'/api/career-ops/run\'', newRoute + '\n  app.post(\'/api/career-ops/run\'');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Added /api/gemini/career-coach endpoint');
} else {
  console.log('Endpoint already exists');
}
