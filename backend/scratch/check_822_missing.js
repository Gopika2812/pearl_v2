import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Invoice = mongoose.connection.db.collection('invoices');
  const AuditLog = mongoose.connection.db.collection('auditlogs');

  const inv = await Invoice.findOne({ invoiceNumber: 'GEKPSI/822/26-27' });
  console.log('Invoice in DB:', inv);

  const logs = await AuditLog.find({
    description: { $regex: '822' }
  }).toArray();
  console.log('Audit logs referencing 822:');
  logs.forEach(l => console.log(l));

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
