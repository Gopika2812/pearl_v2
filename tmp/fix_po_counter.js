import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('MONGO_URI not found'); process.exit(1); }

const voucherTypeSchema = new mongoose.Schema({}, { strict: false });
const purchaseOrderSchema = new mongoose.Schema({}, { strict: false });

const VoucherType = mongoose.model('VoucherType', voucherTypeSchema, 'vouchertypes');
const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema, 'purchaseorders');

async function fixCounter() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected');

  // Find all PO vouchers
  const poVouchers = await VoucherType.find({ orderType: 'PO' }).lean();
  console.log(`\nFound ${poVouchers.length} PO voucher(s)`);

  for (const voucher of poVouchers) {
    console.log(`\n--- Fixing: ${voucher.prefix} (current counter: ${voucher.counter}) ---`);

    // Find the highest existing invoiceId number for this prefix
    const regex = new RegExp(`^${voucher.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\d+/`);
    const existingOrders = await PurchaseOrder.find({ invoiceId: regex }).lean();

    if (existingOrders.length === 0) {
      console.log(`  No existing orders found for prefix ${voucher.prefix}. Counter stays at ${voucher.counter}`);
      continue;
    }

    // Extract the highest number
    let maxNum = 0;
    for (const order of existingOrders) {
      const parts = order.invoiceId.split('/');
      const num = parseInt(parts[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }

    const nextCounter = maxNum + 1;
    console.log(`  Highest existing PO number: ${maxNum}`);
    console.log(`  Setting counter to: ${nextCounter}`);

    await VoucherType.findByIdAndUpdate(voucher._id, { counter: nextCounter });
    console.log(`  ✅ Counter updated to ${nextCounter} for ${voucher.prefix}`);
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

fixCounter().catch(err => { console.error(err); process.exit(1); });
