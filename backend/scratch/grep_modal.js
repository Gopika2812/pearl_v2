import fs from 'fs';

const content = fs.readFileSync('e:/pearl_v2/src/components/InvoiceGeneratorModal.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('useSoNumber') || line.includes('invoiceType') || line.includes('finalize')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
