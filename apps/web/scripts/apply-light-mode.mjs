import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.tsx') || dirFile.endsWith('.ts')) {
        filelist.push(dirFile);
      }
    }
  });
  return filelist;
}

const srcDir = path.join(__dirname, '..', 'src');
const files = walkSync(srcDir);

let modifiedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Replace text-white with text-brand-text
  content = content.replace(/\btext-white\b/g, 'text-brand-text');
  
  // Replace slate texts for better contrast in light mode
  content = content.replace(/\btext-slate-400\b/g, 'text-slate-600');
  content = content.replace(/\btext-slate-300\b/g, 'text-slate-700');
  
  // Fix background panels that were hardcoded dark
  content = content.replace(/\bbg-slate-900\/50\b/g, 'bg-brand-surface');
  content = content.replace(/\bbg-slate-900\b/g, 'bg-brand-surface');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
  }
});

console.log(`Updated ${modifiedCount} files for light mode contrast.`);
