import fs from 'fs';
const path = 'E:/pearl_v2/backend/routes/salesOrderRoutes.js';
let content = fs.readFileSync(path, 'utf8');

const target = 'const amountToRevert = salesOrder.lastInvoicedGrandTotal || salesOrder.invoiceGrandTotal || 0;';
const replacement = 'const amountToRevert = (salesOrder.invoiceGenerated || salesOrder.status === "INVOICED") ? (salesOrder.lastInvoicedGrandTotal || salesOrder.invoiceGrandTotal || 0) : 0;';

if (content.includes(target)) {
    content = content.split(target).join(replacement);
    fs.writeFileSync(path, content);
    console.log('✅ Successfully patched salesOrderRoutes.js');
} else {
    console.log('❌ Target string not found.');
}
