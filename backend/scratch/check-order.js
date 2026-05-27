import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import SalesOrder from "../models/SalesOrder.js";

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");
  const orders = await SalesOrder.find().sort({ createdAt: -1 }).limit(10).lean();
  console.log(`Found ${orders.length} orders.`);
  orders.forEach(o => {
    console.log(`InvoiceId: ${o.invoiceId} | Status: ${o.status} | isOnlineOrder: ${o.isOnlineOrder} | invoiceGenerated: ${o.invoiceGenerated} | Customer: ${o.customer?.name} | CreatedAt: ${o.createdAt}`);
  });
  await mongoose.disconnect();
}

check().catch(console.error);
