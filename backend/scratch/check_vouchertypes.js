import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const VoucherType = mongoose.connection.db.collection('vouchertypes');
  const vouchers = await VoucherType.find({}).toArray();
  console.log('--- Voucher Types ---');
  vouchers.forEach(v => {
    console.log({
      _id: v._id,
      name: v.name,
      prefix: v.prefix,
      counter: v.counter,
      branchId: v.branchId
    });
  });
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
