import mongoose from 'mongoose';
import moment from 'moment-timezone';
import dotenv from 'dotenv';
import '../models/PurchaseInvoice.js';

dotenv.config();
const MONGODB_URI = process.env.MONGO_URI;

async function checkPI() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to DB');

  const IST = "Asia/Kolkata";
  const startDate = moment.tz(`2026-04-01`, "YYYY-MM-DD", IST).startOf("month").toDate();
  const endDate = moment.tz(`2026-04-01`, "YYYY-MM-DD", IST).endOf("month").toDate();

  console.log('Range:', startDate, 'to', endDate);

  const PurchaseInvoice = mongoose.model('PurchaseInvoice');
  const count = await PurchaseInvoice.countDocuments({
    invoiceDate: { $gte: startDate, $lte: endDate },
    status: { $ne: 'CANCELLED' }
  });

  console.log('Total Purchase Invoices:', count);

  const samples = await PurchaseInvoice.find({
    invoiceDate: { $gte: startDate, $lte: endDate },
    status: { $ne: 'CANCELLED' }
  }).limit(5).lean();

  samples.forEach(pi => {
    console.log(`PI: ${pi.purchaseInvoiceId}, Subtotal: ${pi.subtotal}, Tax: ${pi.totalTax}, Items: ${pi.items?.length}`);
    if (pi.items && pi.items.length > 0) {
       console.log('Item 1 Tax:', pi.items[0].cgst, pi.items[0].sgst, pi.items[0].igst);
    }
  });

  await mongoose.disconnect();
}

checkPI().catch(console.error);
