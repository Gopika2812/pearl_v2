import fs from 'fs';

const content = fs.readFileSync('e:/pearl_v2/backend/routes/salesOrderRoutes.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Invoice.') || line.includes('invoices.')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
