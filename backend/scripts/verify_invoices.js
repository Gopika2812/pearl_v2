import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const MASTER_ID = '69dcbb75c21f8963ebb2b706';
  const customer = await Customer.findById(MASTER_ID).lean();
  const invoices = await Invoice.find({ "customer.customerId": MASTER_ID }).lean();
  
  const totalInvoicesAmount = invoices.reduce((sum, i) => sum + (i.grandTotal || 0), 0);
  
  console.log({
    customerName: customer.name,
    customerDebit: customer.debit,
    totalInvoicesAmount,
    invoiceCount: invoices.length,
    invoices: invoices.map(i => ({ id: i.invoiceNumber, amount: i.grandTotal, date: i.invoiceDate }))
  });
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
