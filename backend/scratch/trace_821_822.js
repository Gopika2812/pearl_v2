import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const SalesOrder = mongoose.connection.db.collection('salesorders');
  const AuditLog = mongoose.connection.db.collection('auditlogs');

  const so821 = await SalesOrder.findOne({ invoiceId: 'GEKPSO/821/26-27' });
  console.log('--- SO 821 ---');
  console.log('salesInvoiceId:', so821.salesInvoiceId);
  console.log('status:', so821.status);
  console.log('editHistory:', so821.editHistory);

  const so822 = await SalesOrder.findOne({ invoiceId: 'GEKPSO/822/26-27' });
  console.log('\n--- SO 822 ---');
  console.log('salesInvoiceId:', so822.salesInvoiceId);
  console.log('status:', so822.status);
  console.log('editHistory:', so822.editHistory);

  const logs = await AuditLog.find({
    description: { $regex: 'GEKPSO/821/26-27|GEKPSO/822/26-27' }
  }).sort({ createdAt: 1 }).toArray();

  console.log('\n--- Trace Logs ---');
  logs.forEach(l => {
    console.log(`${l.createdAt.toISOString()} - ${l.username} - ${l.action} - ${l.description}`);
  });

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
