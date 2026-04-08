import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Receipt from './models/Receipt.js';
import Payment from './models/Payment.js';
import DebitNote from './models/DebitNote.js';
import CreditNote from './models/CreditNote.js';
import VoucherType from './models/VoucherType.js';

dotenv.config();

async function checkCounters() {
  try {
    console.log('--- Starting Counter Analysis ---');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    const branchId = '69cb755611501727ed6ec9cb'; // From user error
    console.log('--- Branch:', branchId, '---');

    const collections = [
      { name: 'Receipt', model: Receipt, idField: 'receiptId' },
      { name: 'Payment', model: Payment, idField: 'paymentId' },
      { name: 'DebitNote', model: DebitNote, idField: 'debitNoteId' },
      { name: 'CreditNote', model: CreditNote, idField: 'creditNoteId' }
    ];

    for (const item of collections) {
      const docs = await item.model.find({ branchId }).select(item.idField).lean();
      
      const ids = docs.map(d => {
        const val = d[item.idField];
        if (!val) return 0;
        const match = val.match(/\/(\d+)\//);
        return match ? parseInt(match[1]) : 0;
      });

      const maxIdInDb = Math.max(0, ...ids);
      console.log(`\nMax ${item.name} ID in DB:`, maxIdInDb);

      // Check current counter in VoucherType
      const orderTypeMap = {
        'Receipt': 'REC',
        'Payment': 'PM',
        'DebitNote': 'DN',
        'CreditNote': 'CN'
      };

      const voucher = await VoucherType.findOne({
        branchId,
        orderType: orderTypeMap[item.name]
      });

      if (voucher) {
        console.log(`Current VoucherType Counter for ${item.name}:`, voucher.counter);
        if (voucher.counter <= maxIdInDb) {
          console.warn(`🚨 WARNING: Counter for ${item.name} (${voucher.counter}) is behind DB (${maxIdInDb})!`);
        } else {
          console.log(`✅ Counter for ${item.name} is OK.`);
        }
      } else {
        console.log(`VoucherType record for ${item.name} not found.`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkCounters();
