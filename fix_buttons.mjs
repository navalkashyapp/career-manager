import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const replacements = [
  { from: /bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-medium text-slate-900 dark:text-white/g, to: 'bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-medium text-white' },
  { from: /bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-medium text-white/g, to: 'bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-medium text-white' }, // self identity just in case
  { from: /bg-indigo-500 hover:bg-indigo-600 text-slate-900 dark:text-white/g, to: 'bg-indigo-500 hover:bg-indigo-600 text-white' },
  { from: /bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500\/50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-slate-900 dark:text-white/g, to: 'bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white' },
  { from: /bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-medium text-slate-900 dark:text-white/g, to: 'bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-medium text-white' }
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
    console.log(`Updated button in ${file}`);
  }
});
