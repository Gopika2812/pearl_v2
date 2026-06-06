import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Invoice from '../models/Invoice.js';

dotenv.config({ path: './.env' });

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const inv1165 = await Invoice.findOne({ invoiceNumber: 'GESI/1165/26-27' });
    console.log("GESI 1165:", inv1165 ? `Found! Status: ${inv1165.status}` : "Not found");

    const inv1166 = await Invoice.findOne({ invoiceNumber: 'GESI/1166/26-27' });
    console.log("GESI 1166:", inv1166 ? `Found! Status: ${inv1166.status}` : "Not found");

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
