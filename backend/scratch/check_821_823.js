import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const SalesOrder = mongoose.connection.db.collection('salesorders');
  const Invoice = mongoose.connection.db.collection('invoices');

  const sos = await SalesOrder.find({
    invoiceId: { $regex: 'GEKPSO/(820|821|822|823|824)' }
  }).toArray();
  
  console.log('--- Matching Sales Orders ---');
  sos.forEach(so => {
    console.log({
      _id: so._id,
      invoiceId: so.invoiceId,
      salesInvoiceId: so.salesInvoiceId,
      invoiceGenerated: so.invoiceGenerated,
      status: so.status,
      orderDate: so.orderDate,
      createdAt: so.createdAt,
      grandTotal: so.grandTotal
    });
  });

  const invoices = await Invoice.find({
    invoiceNumber: { $regex: 'GEKPSI/(820|821|822|823|824)' }
  }).toArray();

  console.log('\n--- Matching Invoices ---');
  invoices.forEach(inv => {
    console.log({
      _id: inv._id,
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
