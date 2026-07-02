require('dotenv').config({path: '../.env'});
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Product = mongoose.model('Product', new mongoose.Schema({}, {strict:false}));
  const p = await Product.findOne({name: /AMUL FRESH CREAM 250ML/i});
  const HARD_ANCHOR_DATE = new Date('2026-03-31T23:59:59.000Z');
  const Invoice = mongoose.model('Invoice', new mongoose.Schema({}, {strict:false}));
  
  const sales = await Invoice.aggregate([
    { $match: { status: { $ne: 'CANCELLED' }, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
    { $unwind: '$items' },
    { $match: { 'items.productId': p._id, 'items.qty': { $gt: 0 } } },
    { $group: { _id: { productId: '$items.productId', batch: '$items.batch' }, totalQty: { $sum: '$items.qty' } } }
  ]);
  console.log('Sales for this product:', JSON.stringify(sales, null, 2));
  process.exit(0);
}
run();
