const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Replace main wrapper classes padding
      // Usually "min-h-screen bg-gray-50 pt-20 md:pt-16 md:pl-64"
      // Change md:pl-64 to md:pl-20
      content = content.replace(/md:pl-64/g, 'md:pl-20');
      
      // Change md:pt-16 to md:pt-4 to account for collapsed topbar
      content = content.replace(/md:pt-16/g, 'md:pt-4');
      
      fs.writeFileSync(fullPath, content);
      console.log(`Updated ${fullPath}`);
    }
  }
}

replaceInDir(path.join(__dirname, 'src/pages'));
replaceInDir(path.join(__dirname, 'src/components'));
