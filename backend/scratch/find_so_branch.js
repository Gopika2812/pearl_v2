import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SalesOrder from '../models/SalesOrder.js';

dotenv.config({ path: './.env' });

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const order = await SalesOrder.findOne({ invoiceId: 'GESO/1183/26-27' });
    if (order) {
      console.log(`Found GESO/1183: BranchId is ${order.branchId}`);
    } else {
      console.log("GESO/1183/26-27 not found");
      const anyOrder = await SalesOrder.findOne({ invoiceId: { $regex: /GESO/ } });
      if (anyOrder) {
        console.log(`Found a GESO order: ${anyOrder.invoiceId}, BranchId: ${anyOrder.branchId}`);
      } else {
        console.log("No GESO order found at all");
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
