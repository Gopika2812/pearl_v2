import fs from 'fs';

let code = fs.readFileSync('e:/pearl_v2/backend/routes/productRoutes.js', 'utf8');

// Replace "INVOICED" with array
code = code.replace(/status:\s*"INVOICED"/g, 'status: { $in: ["RECEIVED", "PARTIALLY_RETURNED", "FULLY_RETURNED", "INVOICED"] }');
code = code.replace(/status:\s*'INVOICED'/g, 'status: { $in: ["RECEIVED", "PARTIALLY_RETURNED", "FULLY_RETURNED", "INVOICED"] }');

// Replace existing arrays
code = code.replace(/status:\s*{\s*\$in:\s*\["RECEIVED",\s*"PARTIALLY_RETURNED",\s*"INVOICED"\]\s*}/g, 'status: { $in: ["RECEIVED", "PARTIALLY_RETURNED", "FULLY_RETURNED", "INVOICED"] }');

fs.writeFileSync('e:/pearl_v2/backend/routes/productRoutes.js', code);
console.log('Fixed productRoutes.js');
