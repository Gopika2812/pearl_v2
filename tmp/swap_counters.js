import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './backend/.env' });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI not found in .env');
  process.exit(1);
}

const voucherTypeSchema = new mongoose.Schema({
  name: String,
  orderType: String,
  counter: Number,
  branchId: mongoose.Schema.Types.ObjectId,
}, { strict: false });

const VoucherType = mongoose.model('VoucherType', voucherTypeSchema);

async function swapCounters() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all PO vouchers
    const poVouchers = await VoucherType.find({ orderType: 'PO' });

    for (const poVoucher of poVouchers) {
      // Find matching PI voucher
      const piVoucher = await VoucherType.findOne({
        branchId: poVoucher.branchId,
        name: poVoucher.name,
        orderType: 'PI'
      });

      if (piVoucher) {
        console.log(`\n--- Swapping Counters for ${poVoucher.name} ---`);
        const oldPOCount = poVoucher.counter;
        const oldPICount = piVoucher.counter;

        console.log(`PO Counter (Old): ${oldPOCount} -> (New): ${oldPICount}`);
        console.log(`PI Counter (Old): ${oldPICount} -> (New): ${oldPOCount}`);

        // Swap the counters
        poVoucher.counter = oldPICount;
        piVoucher.counter = oldPOCount;

        await poVoucher.save();
        await piVoucher.save();
        console.log(`✅ Success: Counters swapped for ${poVoucher.name}`);
      } else {
        console.log(`⚠️ Skipping ${poVoucher.name}: No matching PI voucher found.`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

swapCounters();
