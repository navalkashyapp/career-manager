import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const replacements = [
  { from: /(?<!dark:)bg-\[\#0B0F17\]/g, to: 'bg-slate-50 dark:bg-[#0B0F17]' },
  { from: /(?<!dark:)bg-\[\#1E293B\]/g, to: 'bg-white dark:bg-[#1E293B]' },
  { from: /(?<!dark:)bg-\[\#0F172A\]/g, to: 'bg-slate-100 dark:bg-[#0F172A]' },
  { from: /(?<!dark:)border-\[\#334155\]/g, to: 'border-slate-200 dark:border-[#334155]' },
  { from: /(?<!dark:)border-\[\#1E293B\]/g, to: 'border-slate-200 dark:border-[#1E293B]' },
  { from: /(?<!dark:)text-white/g, to: 'text-slate-900 dark:text-white' },
  { from: /(?<!dark:)text-slate-200/g, to: 'text-slate-700 dark:text-slate-200' },
  { from: /(?<!dark:)text-slate-300/g, to: 'text-slate-600 dark:text-slate-300' },
  { from: /(?<!dark:)text-slate-400/g, to: 'text-slate-500 dark:text-slate-400' },
  { from: /(?<!dark:)bg-slate-800/g, to: 'bg-slate-100 dark:bg-slate-800' },
  { from: /(?<!dark:)border-slate-700/g, to: 'border-slate-300 dark:border-slate-700' },
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
    console.log(`Updated ${file}`);
  }
});

console.log(`Updated ${changedFiles} files.`);
