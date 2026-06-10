import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const VoucherType = mongoose.connection.db.collection('vouchertypes');
  const vouchers = await VoucherType.find({ prefix: /^Z-/ }).toArray();
  console.log('--- Z- Voucher Types ---');
  console.log(vouchers);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
