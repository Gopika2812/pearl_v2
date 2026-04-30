import fs from 'fs';
const path = 'E:/pearl_v2/backend/routes/salesOrderRoutes.js';
let content = fs.readFileSync(path, 'utf8');

const target = '    if (fromDate || toDate || !search) {\r\n      const start = fromDate ? new Date(fromDate) : new Date();\r\n      start.setHours(0, 0, 0, 0);\r\n\r\n      const end = toDate ? new Date(toDate) : new Date();\r\n      end.setHours(23, 59, 59, 999);\r\n\r\n      query.orderDate = { $gte: start, $lte: end };\r\n    }';

// Alternative target without \r to be safe
const targetAlt = '    if (fromDate || toDate || !search) {\n      const start = fromDate ? new Date(fromDate) : new Date();\n      start.setHours(0, 0, 0, 0);\n\n      const end = toDate ? new Date(toDate) : new Date();\n      end.setHours(23, 59, 59, 999);\n\n      query.orderDate = { $gte: start, $lte: end };\n    }';

const replacement = `    if (fromDate || toDate) {
      const start = fromDate ? new Date(fromDate) : new Date();
      start.setHours(0, 0, 0, 0);
      const end = toDate ? new Date(toDate) : new Date(start);
      end.setHours(23, 59, 59, 999);
      query.orderDate = { $gte: start, $lte: end };
    } else if (!search) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      query.orderDate = { $gte: start, $lte: end };
    }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content);
    console.log('✅ Successfully patched salesOrderRoutes.js (Target 1)');
} else if (content.includes(targetAlt)) {
    content = content.replace(targetAlt, replacement);
    fs.writeFileSync(path, content);
    console.log('✅ Successfully patched salesOrderRoutes.js (Target Alt)');
} else {
    console.log('❌ Target string not found.');
    // Let's look for a partial match if possible
}
