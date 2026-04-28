import fs from 'fs';

let code = fs.readFileSync('e:/pearl_v2/backend/routes/productRoutes.js', 'utf8');

// The regex matches invoiceGenerated: true and optionally other things, and adds status check
code = code.replace(/invoiceGenerated:\s*true/g, 'invoiceGenerated: true, status: { $ne: "CANCELLED" }');

// Clean up any double additions
code = code.replace(/invoiceGenerated: true, status: { \$ne: "CANCELLED" }, status: { \$ne: "CANCELLED" }/g, 'invoiceGenerated: true, status: { $ne: "CANCELLED" }');

fs.writeFileSync('e:/pearl_v2/backend/routes/productRoutes.js', code);
console.log('Fixed SalesOrder CANCELLED bug in productRoutes.js');
