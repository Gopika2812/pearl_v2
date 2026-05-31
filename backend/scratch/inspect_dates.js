import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

import Invoice from "../models/Invoice.js";

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const latestInvoices = await Invoice.find({ status: { $in: ["FINALIZED", "PRINTED", "SENT"] } })
    .sort({ createdAt: -1 })
    .limit(1);

  if (latestInvoices.length === 0) {
    console.log("No finalized invoices found");
    await mongoose.disconnect();
    return;
  }

  const branchId = latestInvoices[0].branchId;
  console.log("Using branchId:", branchId);

  // Exact aggregation from the history endpoint
  const aggregation = [
    { $match: { branchId: new mongoose.Types.ObjectId(branchId), status: { $in: ["FINALIZED", "PRINTED", "SENT"] } } },
    { $unwind: "$items" },
    {
      $project: {
        date: "$invoiceDate",
        createdAt: 1,
        invoiceNumber: 1,
        voucherType: 1,
        customerName: "$customer.name",
        productName: "$items.name",
        qty: "$items.qty",
        sellingPrice: "$items.sellingPrice"
      }
    },
    { $limit: 2 }
  ];

  const results = await Invoice.aggregate(aggregation);
  console.log("\n--- AGGREGATION RESULTS ---");
  results.forEach((res, i) => {
    console.log(`${i+1}. Number: ${res.invoiceNumber}`);
    console.log(`   date (invoiceDate): ${res.date}`);
    console.log(`   createdAt: ${res.createdAt}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
