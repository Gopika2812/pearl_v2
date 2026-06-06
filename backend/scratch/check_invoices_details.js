import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Invoice = mongoose.connection.db.collection('invoices');
  
  const allInvoices = await Invoice.find({
    invoiceNumber: /^GESI\//
  }).toArray();
  
  // Sort them numerically by the invoice number part
  // e.g. GESI/1164/26-27 -> 1164
  allInvoices.sort((a, b) => {
    const numA = parseInt(a.invoiceNumber.split('/')[1]) || 0;
    const numB = parseInt(b.invoiceNumber.split('/')[1]) || 0;
    return numA - numB;
  });
  
  console.log(`Found ${allInvoices.length} GESI invoices. Listing recent ones:`);
  
  // Let's print the last 30 invoices
  const start = Math.max(0, allInvoices.length - 40);
  for (let i = start; i < allInvoices.length; i++) {
    const inv = allInvoices[i];
    console.log(`${inv.invoiceNumber} | status: ${inv.status} | createdAt: ${inv.createdAt.toISOString()} | id: ${inv._id}`);
  }
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
