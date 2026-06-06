import fs from 'fs';

const content = fs.readFileSync('e:/pearl_v2/backend/routes/invoiceRoutes.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('invoiceNumber') && (line.includes('=') || line.includes(':'))) {
    console.log(`${idx + 1}: ${line}`);
  }
});
