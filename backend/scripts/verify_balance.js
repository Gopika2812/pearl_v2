import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Receipt from '../models/Receipt.js';
import Customer from '../models/Customer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const MASTER_ID = '69dcbb75c21f8963ebb2b706';
  const customer = await Customer.findById(MASTER_ID).lean();
  const receipts = await Receipt.find({ "customer.customerId": MASTER_ID }).lean();
  
  const totalReceiptsAmount = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  
  console.log({
    customerName: customer.name,
    customerCredit: customer.credit,
    customerDebit: customer.debit,
    customerClosingBalance: customer.closingBalance,
    totalReceiptsAmount,
    receiptCount: receipts.length,
    receipts: receipts.map(r => ({ id: r.receiptId, amount: r.amount, notes: r.notes }))
  });
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
