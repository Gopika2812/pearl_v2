import mongoose from 'mongoose';
import dotenv from 'dotenv';
import DeliveryReceipt from './backend/models/DeliveryReceipt.js';

dotenv.config({ path: './backend/.env' });

async function checkReceipts() {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      console.error("MONGO_URI not found");
      process.exit(1);
    }
    await mongoose.connect(uri);
    const receipts = await DeliveryReceipt.find().sort({ createdAt: -1 }).limit(10).lean();
    console.log(`Found ${receipts.length} delivery receipts:`);
    receipts.forEach(r => {
      console.log(`- Receipt ID: ${r.receiptId}`);
      console.log(`  Date: ${r.date}`);
      console.log(`  Delivery Person: ${r.deliveryPerson}`);
      console.log(`  Collections (${r.collections.length}):`, JSON.stringify(r.collections, null, 2));
      console.log(`  Expenses:`, JSON.stringify(r.expenses));
      console.log(`  NetAmount: ${r.netAmount}`);
      console.log(`  Created At: ${r.createdAt}`);
    });
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkReceipts();
