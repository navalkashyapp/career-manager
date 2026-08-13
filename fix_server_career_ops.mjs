import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'server.ts');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('/api/career-ops/run')) {
const newRoute = `
  import { exec } from 'child_process';
  
  app.post('/api/career-ops/run', (req, res) => {
    const { script, args } = req.body;
    const allowedScripts = ['doctor', 'gemini:eval', 'scan:full'];
    
    if (!allowedScripts.includes(script)) {
      return res.status(400).json({ error: 'Script not allowed' });
    }
    
    const command = \`cd src/career-ops && npm run \${script} -- \${args || ''}\`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Career ops execution error:', error);
        return res.status(500).json({ error: error.message, stderr, stdout });
      }
      res.json({ stdout, stderr });
    });
  });
`;

  content = content.replace('  // Vite middleware for development', newRoute + '\n  // Vite middleware for development');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Added career-ops runner endpoint');
}
