import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Invoice from '../models/Invoice.js';
import Receipt from '../models/Receipt.js';
import Customer from '../models/Customer.js';
import CreditNote from '../models/CreditNote.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const MASTER_ID = '69dcbb75c21f8963ebb2b706';
  
  const invoices = await Invoice.find({ "customer.customerId": MASTER_ID, status: "FINALIZED" }).lean();
  const receipts = await Receipt.find({ "customer.customerId": MASTER_ID, status: "confirmed" }).lean();
  const receiptsBounced = await Receipt.find({ "customer.customerId": MASTER_ID, status: "bounced" }).lean();
  const cns = await CreditNote.find({ "customer.customerId": MASTER_ID, status: "Created" }).lean();
  
  const totalDebit = invoices.reduce((sum, i) => sum + (i.grandTotal || 0), 0) + 
                     receiptsBounced.reduce((sum, r) => sum + (r.amount || 0), 0);
                     
  const totalCredit = receipts.reduce((sum, r) => sum + (r.amount || 0), 0) + 
                      cns.reduce((sum, cn) => sum + (cn.grandTotal || 0), 0);
  
  const closingBalance = totalDebit - totalCredit;

  console.log('Reconciling balances for Master Customer:');
  console.log(`- Calculated Total Debit: ₹${totalDebit}`);
  console.log(`- Calculated Total Credit: ₹${totalCredit}`);
  console.log(`- Calculated Closing Balance: ₹${closingBalance}`);

  await Customer.findByIdAndUpdate(MASTER_ID, {
    $set: {
      debit: totalDebit,
      credit: totalCredit,
      totalBalance: closingBalance,
      closingBalance: closingBalance
    }
  });

  console.log('✅ Master customer balances successfully reconciled with all document records.');
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
