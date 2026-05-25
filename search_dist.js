import fs from 'fs';
import path from 'path';

function getFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files);
    } else if (name.endsWith('.js')) {
      files.push(name);
    }
  }
  return files;
}

const files = getFiles('./dist');
console.log(`Checking ${files.length} build files...`);

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('FaCheck')) {
    console.log(`Found 'FaCheck' in build file: ${file}`);
    // Find context of 'FaCheck'
    let idx = content.indexOf('FaCheck');
    while (idx !== -1) {
      console.log(`Context: ${content.substring(idx - 100, idx + 100)}`);
      idx = content.indexOf('FaCheck', idx + 1);
    }
  }
});
