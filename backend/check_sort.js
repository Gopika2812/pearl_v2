import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Customer from "./models/Customer.js";
import Invoice from "./models/Invoice.js";
import Receipt from "./models/Receipt.js";

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const branchId = "69cb755611501727ed6ec9cb";

  // Simulate sortBy = "receiptAge", sortOrder = "desc"
  const sortBy = "receiptAge";
  const sortOrder = "desc";

  const isInvoiceAgeSort = sortBy === "invoiceAge";
  const isReceiptAgeSort = sortBy === "age" || sortBy === "receiptAge";

  const pipeline = [
    { $match: { branchId: new mongoose.Types.ObjectId(branchId) } }
  ];

  if (isInvoiceAgeSort) {
    pipeline.push(
      {
        $lookup: {
          from: "invoices",
          let: { cId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$customer.customerId", "$$cId"] }, status: { $in: ["FINALIZED", "PRINTED", "SENT"] } } },
            { $sort: { invoiceDate: -1 } },
            { $limit: 1 }
          ],
          as: "lastInv"
        }
      },
      { $unwind: { path: "$lastInv", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          lastInvoiceDate: "$lastInv.invoiceDate",
          lastInvoiceNumber: "$lastInv.invoiceNumber",
          hasInvoiceDate: {
            $cond: {
              if: { $eq: [{ $ifNull: ["$lastInv.invoiceDate", null] }, null] },
              then: 0,
              else: 1
            }
          }
        }
      }
    );
  }

  if (isReceiptAgeSort) {
    pipeline.push(
      {
        $lookup: {
          from: "receipts",
          let: { cId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$customer.customerId", "$$cId"] }, status: "confirmed" } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: "lastRec"
        }
      },
      { $unwind: { path: "$lastRec", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          lastReceiptDate: "$lastRec.createdAt",
          hasReceiptDate: {
            $cond: {
              if: { $eq: [{ $ifNull: ["$lastRec.createdAt", null] }, null] },
              then: 0,
              else: 1
            }
          }
        }
      }
    );
  }

  const sort = {};
  const order = sortOrder === "desc" ? -1 : 1;

  switch (sortBy) {
    case "invoiceAge":
      sort.hasInvoiceDate = -1;
      sort.lastInvoiceDate = -order;
      break;
    case "age":
    case "receiptAge":
      sort.hasReceiptDate = -1;
      sort.lastReceiptDate = -order;
      break;
    default:
      sort[sortBy] = order;
  }

  console.log("Sort Aggregation:", sort);
  pipeline.push({ $sort: sort });
  pipeline.push({ $limit: 10 });

  const results = await Customer.aggregate(pipeline);
  console.log("\n--- AGGREGATION SORT RESULTS (TOP 10) ---");
  results.forEach((c, idx) => {
    console.log(`${idx + 1}. Name: ${c.name}`);
    console.log(`   Last Invoice Date: ${c.lastInvoiceDate}`);
    console.log(`   Last Receipt Date: ${c.lastReceiptDate}`);
    console.log(`   hasReceiptDate: ${c.hasReceiptDate}`);
    console.log(`   CreatedAt: ${c.createdAt}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
