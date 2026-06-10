import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const SalesOrder = mongoose.connection.db.collection('salesorders');
  const Invoice = mongoose.connection.db.collection('invoices');
  const AuditLog = mongoose.connection.db.collection('auditlogs');

  console.log('--- Sales Orders matching 1070 ---');
  const sos = await SalesOrder.find({
    invoiceId: { $regex: '1070' }
  }).toArray();
  sos.forEach(so => {
    console.log({
      invoiceId: so.invoiceId,
      salesInvoiceId: so.salesInvoiceId,
      status: so.status,
      createdAt: so.createdAt,
      customerName: so.customerName
    });
  });

  console.log('\n--- Invoices matching 1070 ---');
  const invoices = await Invoice.find({
    invoiceNumber: { $regex: '1070' }
  }).toArray();
  invoices.forEach(inv => {
    console.log({
      invoiceNumber: inv.invoiceNumber,
      salesOrderId: inv.salesOrderId,
      status: inv.status,
      createdAt: inv.createdAt
    });
  });

  console.log('\n--- Audit Logs matching 1070 ---');
  const logs = await AuditLog.find({
    $or: [
      { description: { $regex: '1070' } },
      { description: { $regex: '1070' } }
    ]
  }).sort({ createdAt: 1 }).toArray();
  logs.forEach(log => {
    console.log(`${log.createdAt.toISOString()} - ${log.username} - ${log.action} - ${log.description}`);
  });

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
