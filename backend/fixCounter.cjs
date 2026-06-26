const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const VoucherType = mongoose.model('VoucherType', new mongoose.Schema({}, {strict: false}), 'vouchertypes');
  const v = await VoucherType.findOne({ name: 'k', orderType: 'PO' });
  if (v) {
    console.log('Current counter:', v.counter);
    const po = await mongoose.connection.collection('purchaseorders').findOne({ invoiceId: { $regex: 'KPO/050' }});
    if (po) {
      console.log('Found PO 050! Incrementing voucher to 51');
      await VoucherType.updateOne({ _id: v._id }, { $set: { counter: Math.max(v.counter, 51) } });
      console.log('Fixed!');
    } else {
      console.log('PO 050 not found in DB. Doing nothing.');
    }
  } else {
    console.log('Voucher k not found');
  }
  process.exit(0);
}).catch(console.error);
