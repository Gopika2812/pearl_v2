import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Invoice = mongoose.connection.db.collection('invoices');

  const invoices = await Invoice.find({
    invoiceNumber: { $regex: 'Z-1SI/(1005|1006|1007|1008)' }
  }).toArray();

  console.log('--- Matching Invoices ---');
  invoices.forEach(inv => {
    console.log({
      invoiceNumber: inv.invoiceNumber,
      salesOrderId: inv.salesOrderId,
      status: inv.status,
      createdAt: inv.createdAt,
      grandTotal: inv.grandTotal
    });
  });

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
