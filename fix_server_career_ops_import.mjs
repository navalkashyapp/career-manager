import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'server.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace('  import { exec } from \'child_process\';\n  \n  app.post(\'/api/career-ops/run\'', '  app.post(\'/api/career-ops/run\'');

if (!content.includes('import { exec } from \'child_process\';')) {
  content = "import { exec } from 'child_process';\n" + content;
}

fs.writeFileSync(filePath, content, 'utf8');
