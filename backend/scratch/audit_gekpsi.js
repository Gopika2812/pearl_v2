import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const SalesOrder = mongoose.connection.db.collection('salesorders');
  const Invoice = mongoose.connection.db.collection('invoices');
  const AuditLog = mongoose.connection.db.collection('auditlogs');

  console.log('--- ALL GEKPSI INVOICES ---');
  const invoices = await Invoice.find({
    invoiceNumber: { $regex: '^GEKPSI/' }
  }).sort({ invoiceNumber: 1 }).toArray();

  invoices.forEach(inv => {
    console.log({
      invoiceNumber: inv.invoiceNumber,
      salesOrderId: inv.salesOrderId,
      status: inv.status,
      createdAt: inv.createdAt,
      grandTotal: inv.grandTotal
    });
  });

  console.log('\n--- ALL GEKPSO SALES ORDERS ---');
  const sos = await SalesOrder.find({
    invoiceId: { $regex: '^GEKPSO/' }
  }).sort({ invoiceId: 1 }).toArray();

  sos.forEach(so => {
    console.log({
      invoiceId: so.invoiceId,
      salesInvoiceId: so.salesInvoiceId,
      invoiceGenerated: so.invoiceGenerated,
      status: so.status,
      createdAt: so.createdAt,
      grandTotal: so.grandTotal
    });
  });

  console.log('\n--- RECENT AUDIT LOGS FOR GEKP ---');
  const logs = await AuditLog.find({
    $or: [
      { description: { $regex: 'GEKP' } },
      { action: { $regex: 'INVOICE|CANCEL' } }
    ]
  }).sort({ createdAt: -1 }).limit(30).toArray();

  logs.forEach(log => {
    console.log({
      action: log.action,
      description: log.description,
      username: log.username,
      createdAt: log.createdAt
    });
  });

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
