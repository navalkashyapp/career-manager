import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const replacements = [
  { from: /hover:bg-slate-100 dark:bg-\[\#0F172A\]/g, to: 'hover:bg-slate-200 dark:hover:bg-[#0F172A]' },
  { from: /hover:bg-\[\#334155\]/g, to: 'hover:bg-slate-200 dark:hover:bg-[#334155]' },
  { from: /hover:text-white/g, to: 'hover:text-slate-900 dark:hover:text-white' },
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));

let changedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;
  
  replacements.forEach(({ from, to }) => {
    newContent = newContent.replace(from, to);
  });
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    changedFiles++;
    console.log(`Updated hover in ${file}`);
  }
});
