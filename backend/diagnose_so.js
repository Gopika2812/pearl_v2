import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const SalesOrderSchema = new mongoose.Schema({}, { strict: false });
const SalesOrder = mongoose.model('SalesOrder', SalesOrderSchema);

async function check() {
  try {
    console.log('Connecting to:', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    const count = await SalesOrder.countDocuments();
    console.log('Total Sales Orders:', count);

    const latest = await SalesOrder.find().sort({ createdAt: -1 }).limit(5);
    console.log('Latest 5 orders:');
    latest.forEach(o => {
      console.log(`- ID: ${o.invoiceId}, Date: ${o.orderDate}, Branch: ${o.branchId}, Status: ${o.status}`);
    });

    const branches = await SalesOrder.distinct('branchId');
    console.log('Unique Branch IDs in SO:', branches);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
