import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import SalesOrder from '../models/SalesOrder.js';
import Invoice from '../models/Invoice.js';
import Receipt from '../models/Receipt.js';
import CreditNote from '../models/CreditNote.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const MISSING_ID = '69cc826d90a268b9a0b7bb77';
  
  const soCount = await SalesOrder.countDocuments({ "customer.customerId": MISSING_ID });
  const invCount = await Invoice.countDocuments({ "customer.customerId": MISSING_ID });
  const rcpCount = await Receipt.countDocuments({ "customer.customerId": MISSING_ID });
  const cnCount = await CreditNote.countDocuments({ "customer.customerId": MISSING_ID });

  console.log({
    soCount,
    invCount,
    rcpCount,
    cnCount
  });
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
