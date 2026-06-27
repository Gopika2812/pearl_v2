const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/pearls_erp');
  
  const po = await mongoose.connection.collection('purchaseorders').find({ invoiceId: 'GPOPO/002/26-27' }).toArray();
  console.log('POs:', JSON.stringify(po, null, 2));

  const voucher = await mongoose.connection.collection('vouchertypes').find({ orderType: 'PO' }).toArray();
  console.log('Vouchers:', JSON.stringify(voucher, null, 2));
  
  mongoose.disconnect();
}

run();
