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
console.log(`Scanning ${files.length} files...`);

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Find if it has <FaCheck (case sensitive, as a React component)
  // Or is using FaCheck in other JSX/JS contexts (excluding importing it)
  // Let's search for actual usage in JSX or expressions: e.g. <FaCheck, {FaCheck, FaCheck } etc.
  const hasUsage = /<FaCheck\b/.test(content) || /{FaCheck\b/.test(content) || /:\s*FaCheck\b/.test(content);
  
  if (hasUsage) {
    // Check if it imports FaCheck from react-icons/fa (allowing newlines)
    const importRegex = /import\s+{[^}]*\bFaCheck\b[^}]*}\s+from\s+['"]react-icons\/fa['"]/s;
    const isImported = importRegex.test(content);

    if (!isImported) {
      console.log(`❌ FILE: ${file} uses FaCheck but does NOT import it!`);
    } else {
      console.log(`✅ FILE: ${file} uses FaCheck and imports it.`);
    }
  }
});
