import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const replacements = [
  { from: /bg-white dark:bg-\[\#1E293B\]\/50/g, to: 'bg-white/50 dark:bg-[#1E293B]/50' },
  { from: /bg-white dark:bg-\[\#1E293B\]\/80/g, to: 'bg-white/80 dark:bg-[#1E293B]/80' },
  { from: /bg-slate-100 dark:bg-\[\#0F172A\]\/50/g, to: 'bg-slate-100/50 dark:bg-[#0F172A]/50' },
  { from: /bg-slate-100 dark:bg-\[\#0F172A\]\/30/g, to: 'bg-slate-100/50 dark:bg-[#0F172A]/30' },
  { from: /bg-slate-50 dark:bg-\[\#0B0F17\]\/50/g, to: 'bg-slate-50/50 dark:bg-[#0B0F17]/50' },
  { from: /bg-slate-50 dark:bg-\[\#0B0F17\]\/30/g, to: 'bg-slate-50/50 dark:bg-[#0B0F17]/30' },
  { from: /border-transparent hover:border-slate-200 dark:border-\[\#334155\]/g, to: 'border-transparent hover:border-slate-200 dark:hover:border-[#334155]' }, // Fix hover
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
    console.log(`Updated opacity in ${file}`);
  }
});

console.log(`Updated ${changedFiles} files with opacity/hover fixes.`);
