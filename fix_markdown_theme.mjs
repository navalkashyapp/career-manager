import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/components/resume/ResumeStudio.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the prose divs
content = content.replace(/bg-white text-slate-900 prose prose-sm/g, 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white prose prose-sm dark:prose-invert');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed markdown themes');
