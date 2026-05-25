import fs from 'fs';
import path from 'path';

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files);
    } else if (name.endsWith('.js') || name.endsWith('.jsx')) {
      files.push(name);
    }
  }
  return files;
}

const files = getFiles('./src');

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('FaCheck')) {
    // Let's count how many times \bFaCheck\b occurs in the file
    const matches = content.match(/\bFaCheck\b/g) || [];
    const importMatch = content.match(/import\s+{[^}]*\bFaCheck\b[^}]*}\s+from\s+['"]react-icons\/fa['"]/s);
    console.log(`FILE: ${file} | Matches: ${matches.length} | Imported: ${!!importMatch}`);
  }
});
