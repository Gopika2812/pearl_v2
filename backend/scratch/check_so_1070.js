import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const SalesOrder = mongoose.connection.db.collection('salesorders');
  
  const so = await SalesOrder.findOne({ invoiceId: 'Z-2SO/1070/26-27' });
  console.log('--- Sales Order Z-2SO/1070/26-27 ---');
  console.log(so);
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
