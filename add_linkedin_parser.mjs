import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'server.ts');
let content = fs.readFileSync(filePath, 'utf8');

const newRoute = `
  app.post('/api/gemini/parse-linkedin', async (req, res) => {
    try {
      const { linkedinData } = req.body;
      const prompt = \`You are an expert executive career strategist and parser. Parse the following raw LinkedIn profile text (or PDF extract) into a structured JSON profile that matches this exact schema:
      
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
      
      Raw LinkedIn Data: \${linkedinData}
      \`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
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
`;

if (!content.includes('/api/gemini/parse-linkedin')) {
  content = content.replace('  app.post(\'/api/career-ops/run\'', newRoute + '\n  app.post(\'/api/career-ops/run\'');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Added /api/gemini/parse-linkedin endpoint');
} else {
  console.log('Endpoint already exists');
}
