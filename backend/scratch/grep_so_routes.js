import fs from 'fs';

const content = fs.readFileSync('e:/pearl_v2/backend/routes/salesOrderRoutes.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('VoucherType') || line.includes('counter') || line.includes('generate-invoice')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
