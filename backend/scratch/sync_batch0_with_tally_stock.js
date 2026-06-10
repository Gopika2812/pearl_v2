import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// Register the models
import "../models/ProductGroup.js";
import "../models/Product.js";
import "../models/PurchaseOrder.js";
import "../models/PurchaseInvoice.js";
import "../models/Invoice.js";
import "../models/DebitNote.js";
import "../models/CreditNote.js";
import "../models/PhysicalStockEntry.js";

const connStr = process.env.MONGO_URI || "mongodb://localhost:27017/pearl-erp";
const HARD_ANCHOR_DATE = new Date("2026-03-31T23:59:59.000Z");

async function run() {
  console.log("Connecting to database...");
  await mongoose.connect(connStr);
  
  const Product = mongoose.model("Product");
  const PurchaseInvoice = mongoose.model("PurchaseInvoice");
  const Invoice = mongoose.model("Invoice");
  const DebitNote = mongoose.model("DebitNote");
  const CreditNote = mongoose.model("CreditNote");
  const PhysicalStockEntry = mongoose.model("PhysicalStockEntry");

  console.log("Fetching all products...");
  const products = await Product.find({}).lean();
  const productIds = products.map(p => p._id);
  console.log(`Found ${products.length} products to reconcile.`);

  console.log("Aggregating all transaction movements...");
  const [purchases, sales, debitNotes, creditNotes, psvTotals] = await Promise.all([
    PurchaseInvoice.aggregate([
      { $match: { invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", totalQty: { $sum: "$items.qty" } } }
    ]),
    Invoice.aggregate([
      { $match: { status: { $ne: "CANCELLED" }, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
      { $unwind: "$items" },
      { $match: { "items.qty": { $gt: 0 } } },
      { $group: { _id: "$items.productId", totalQty: { $sum: "$items.qty" } } }
    ]),
    DebitNote.aggregate([
      { $match: { status: { $ne: "Cancelled" }, date: { $gt: HARD_ANCHOR_DATE } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", totalQty: { $sum: { $ifNull: ["$items.qty", "$items.returnedQty", 0] } } } }
    ]),
    CreditNote.aggregate([
      { $match: { status: { $ne: "Cancelled" } } },
      { $addFields: { effectiveDate: { $ifNull: ["$date", "$createdAt"] } } },
      { $match: { effectiveDate: { $gt: HARD_ANCHOR_DATE } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", totalQty: { $sum: { $ifNull: ["$items.qty", "$items.returnedQty", 0] } } } }
    ]),
    PhysicalStockEntry.aggregate([
      { $match: { status: "APPROVED" } },
      {
        $group: {
          _id: "$productId",
          inwardQty: { $sum: "$inwardQty" },
          outwardQty: { $sum: "$outwardQty" }
        }
      }
    ])
  ]);

  const purchaseMapTotal = new Map(purchases.map(p => [p._id.toString(), p.totalQty]));
  const salesMapTotal = new Map(sales.map(s => [s._id.toString(), s.totalQty]));
  const dnMapTotal = new Map(debitNotes.map(dn => [dn._id.toString(), dn.totalQty]));
  const cnMapTotal = new Map(creditNotes.map(cn => [cn._id.toString(), cn.totalQty]));
  const psvMapTotal = new Map(psvTotals.map(psv => [psv._id.toString(), psv]));

  console.log("Preparing bulk update operations...");
  const bulkOps = [];

  for (const p of products) {
    const pid = p._id.toString();
    const pQty = purchaseMapTotal.get(pid) || 0;
    const sQty = salesMapTotal.get(pid) || 0;
    const dnQty = dnMapTotal.get(pid) || 0;
    const cnQty = cnMapTotal.get(pid) || 0;
    const psv = psvMapTotal.get(pid) || { inwardQty: 0, outwardQty: 0 };

    // Dynamically calculate dynamic current closing stock
    const totalClosingQty = (p.openingQty || 0) + pQty + cnQty + psv.inwardQty - sQty - dnQty - psv.outwardQty;
    const finalQty = Math.max(0, totalClosingQty);

    // Filter and update existing batches array
    const originalBatches = p.batches || [];
    
    // Sum qty of all batches that are NOT Batch 0
    const newerBatchesQty = originalBatches
      .filter(b => b.batchNo !== "0")
      .reduce((sum, b) => sum + (b.qty || 0), 0);

    const batch0ClosingQty = Math.max(0, finalQty - newerBatchesQty);

    // Build the updated batches list
    const updatedBatches = [];
    
    // 1. Add Batch 0 with correct recalculated qty and blank metadata
    updatedBatches.push({
      batchNo: "0",
      qty: batch0ClosingQty,
      expiryDate: null,
      mrp: 0,
      manufacturingDate: null
    });

    // 2. Add other batches (Batch 1, Batch 2 etc.) exactly as they were
    originalBatches.forEach(b => {
      if (b.batchNo !== "0") {
        updatedBatches.push(b);
      }
    });

    bulkOps.push({
      updateOne: {
        filter: { _id: p._id },
        update: {
          $set: {
            batches: updatedBatches,
            totalQty: finalQty,
            "batch1.qty": batch0ClosingQty,
            "batch1.expiryDate": null,
            "batch1.mrp": 0,
            "batch1.manufacturingDate": null
          }
        }
      }
    });
  }

  console.log(`Running bulk write for ${bulkOps.length} products...`);
  if (bulkOps.length > 0) {
    const writeResult = await Product.bulkWrite(bulkOps);
    console.log(`Successfully synced ${writeResult.modifiedCount} products batch stock.`);
  }

  await mongoose.connection.close();
  console.log("Database connection closed.");
}

run().catch(console.error);
