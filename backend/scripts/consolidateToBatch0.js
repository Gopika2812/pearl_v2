import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

import "../models/ProductGroup.js";
import "../models/Product.js";
import "../models/PurchaseOrder.js";
import "../models/PurchaseInvoice.js";
import "../models/Invoice.js";
import "../models/DebitNote.js";
import "../models/CreditNote.js";
import "../models/PhysicalStockEntry.js";

const connStr = process.env.MONGO_URI || "mongodb://localhost:27017/pearl-erp";

async function run() {
  await mongoose.connect(connStr);
  console.log("Connected to DB for Hard Reset to Batch 0.");

  const Product = mongoose.model("Product");
  const PurchaseInvoice = mongoose.model("PurchaseInvoice");
  const Invoice = mongoose.model("Invoice");
  const DebitNote = mongoose.model("DebitNote");
  const CreditNote = mongoose.model("CreditNote");
  const PhysicalStockEntry = mongoose.model("PhysicalStockEntry");

  const HARD_ANCHOR_DATE = new Date("2026-03-31T23:59:59.000Z");

  const products = await Product.find({}).lean();
  const productIds = products.map(p => p._id);

  console.log(`Found ${products.length} products to consolidate.`);

  // 1. Calculate overall totals (ignoring historical batch identifiers)
  const [purchases, sales, debitNotes, creditNotes, psvTotals] = await Promise.all([
    PurchaseInvoice.aggregate([
      { $match: { invoiceDate: { $gt: HARD_ANCHOR_DATE }, status: { $ne: "CANCELLED" } } },
      { $unwind: "$items" },
      { $match: { "items.productId": { $in: productIds } } },
      { $group: { _id: "$items.productId", totalQty: { $sum: "$items.qty" } } }
    ]),
    Invoice.aggregate([
      { $match: { status: { $ne: "CANCELLED" }, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
      { $unwind: "$items" },
      { $match: { "items.productId": { $in: productIds }, "items.qty": { $gt: 0 } } },
      { $group: { _id: "$items.productId", totalQty: { $sum: "$items.qty" } } }
    ]),
    DebitNote.aggregate([
      { $match: { status: { $ne: "Cancelled" }, date: { $gt: HARD_ANCHOR_DATE } } },
      { $unwind: "$items" },
      { $match: { "items.productId": { $in: productIds } } },
      { $group: { _id: "$items.productId", totalQty: { $sum: { $ifNull: ["$items.qty", "$items.returnedQty", 0] } } } }
    ]),
    CreditNote.aggregate([
      { $match: { status: { $in: ["Created", "confirmed", "Approved"] } } },
      { $addFields: { effectiveDate: { $ifNull: ["$date", "$createdAt"] } } },
      { $match: { effectiveDate: { $gt: HARD_ANCHOR_DATE } } },
      { $unwind: "$items" },
      { $match: { "items.productId": { $in: productIds } } },
      { $group: { _id: "$items.productId", totalQty: { $sum: { $ifNull: ["$items.qty", "$items.returnedQty", 0] } } } }
    ]),
    PhysicalStockEntry.aggregate([
      { $match: { status: "APPROVED", productId: { $in: productIds } } },
      {
        $addFields: {
          effectiveDate: { $ifNull: ["$entryDate", "$createdAt"] }
        }
      },
      { $match: { effectiveDate: { $gt: HARD_ANCHOR_DATE } } },
      {
        $group: {
          _id: "$productId",
          inwardQty: { $sum: "$inwardQty" },
          outwardQty: { $sum: "$outwardQty" }
        }
      }
    ])
  ]);

  const pMap = {};
  const sMap = {};
  const dnMap = {};
  const cnMap = {};
  const psvMap = {};

  purchases.forEach(p => pMap[p._id.toString()] = p.totalQty);
  sales.forEach(s => sMap[s._id.toString()] = s.totalQty);
  debitNotes.forEach(d => dnMap[d._id.toString()] = d.totalQty);
  creditNotes.forEach(c => cnMap[c._id.toString()] = c.totalQty);
  psvTotals.forEach(psv => psvMap[psv._id.toString()] = psv);

  // 2. Overwrite all historical transaction items to be batch "0"
  // This ensures that future runs of syncBatchStockFixed.js won't recreate "Batch 1" from the past.
  console.log("Rewriting historical transaction batches to Batch 0...");

  async function updateBatches(Model) {
    const docs = await Model.find({ "items.productId": { $exists: true } });
    let updatedCount = 0;
    for (const doc of docs) {
      let changed = false;
      if (Array.isArray(doc.items)) {
        doc.items.forEach(item => {
          if (item.productId && item.batch !== "0") {
            item.batch = "0";
            changed = true;
          }
        });
      }
      if (changed) {
        await doc.save({ validateBeforeSave: false }); // Skip validation just in case
        updatedCount++;
      }
    }
    console.log(`Updated ${updatedCount} documents in ${Model.modelName}`);
  }

  await updateBatches(PurchaseInvoice);
  await updateBatches(Invoice);
  await updateBatches(DebitNote);
  await updateBatches(CreditNote);

  // Update PSV batches directly
  const psvRes = await PhysicalStockEntry.updateMany(
    { batch: { $ne: "0" } },
    { $set: { batch: "0" } }
  );
  console.log(`Updated ${psvRes.modifiedCount} PhysicalStockEntry documents`);


  // 3. Update Product Documents
  console.log("Consolidating product batches...");
  let count = 0;
  for (const p of products) {
    const pid = p._id.toString();
    
    const openingQty = Number(p.openingQty || 0);
    const pQty = pMap[pid] || 0;
    const sQty = sMap[pid] || 0;
    const dnQty = dnMap[pid] || 0;
    const cnQty = cnMap[pid] || 0;
    const psv = psvMap[pid] || { inwardQty: 0, outwardQty: 0 };
    
    // Mathematical true total
    let closingStock = openingQty + pQty + cnQty + psv.inwardQty - sQty - dnQty - psv.outwardQty;
    // Fix potential float precision issues
    closingStock = Math.round(closingStock * 100) / 100;

    // Create a single clean Batch 0
    const finalBatches = [{
      batchNo: "0",
      qty: closingStock,
      expiryDate: p.batch1?.expiryDate || null,
      mrp: p.batch1?.mrp || 0,
      manufacturingDate: p.batch1?.manufacturingDate || null
    }];

    await Product.updateOne({ _id: p._id }, {
      $set: {
        batches: finalBatches,
        totalQty: closingStock,
        "batch1.qty": closingStock
      }
    });
    count++;
  }

  console.log(`Successfully consolidated batches for ${count} products.`);
  console.log("Hard Reset to Batch 0 Complete!");
  await mongoose.connection.close();
}

run().catch(console.error);
