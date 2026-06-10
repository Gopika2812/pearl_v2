import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const SalesOrder = mongoose.connection.db.collection('salesorders');
  const Invoice = mongoose.connection.db.collection('invoices');
  const AuditLog = mongoose.connection.db.collection('auditlogs');

  console.log('--- Sales Orders ---');
  const sos = await SalesOrder.find({
    invoiceId: { $regex: 'Z-1SO/(1002|1003|1004|1005|1006|1007|1008)' }
  }).toArray();
  sos.forEach(so => {
    console.log({
      invoiceId: so.invoiceId,
      salesInvoiceId: so.salesInvoiceId,
      status: so.status,
      createdAt: so.createdAt
    });
  });

  console.log('\n--- Invoices ---');
  const invoices = await Invoice.find({
    invoiceNumber: { $regex: 'Z-1SI/(1002|1003|1004|1005|1006|1007|1008)' }
  }).toArray();
  invoices.forEach(inv => {
    console.log({
      invoiceNumber: inv.invoiceNumber,
      salesOrderId: inv.salesOrderId,
      status: inv.status,
      createdAt: inv.createdAt
    });
  });

  console.log('\n--- Audit Logs ---');
  const logs = await AuditLog.find({
    $or: [
      { description: { $regex: 'Z-1SO/1005' } },
      { description: { $regex: 'Z-1SI/1005' } },
      { description: { $regex: 'Z-1SI/1006' } }
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
