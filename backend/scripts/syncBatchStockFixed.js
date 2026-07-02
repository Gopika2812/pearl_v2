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
  console.log("Connected to DB for Stock Sync.");

  const Product = mongoose.model("Product");
  const PurchaseInvoice = mongoose.model("PurchaseInvoice");
  const Invoice = mongoose.model("Invoice");
  const DebitNote = mongoose.model("DebitNote");
  const CreditNote = mongoose.model("CreditNote");
  const PhysicalStockEntry = mongoose.model("PhysicalStockEntry");

  const HARD_ANCHOR_DATE = new Date("2026-03-31T23:59:59.000Z");

  const products = await Product.find({}).lean();
  const productIds = products.map(p => p._id);

  console.log(`Found ${products.length} products to sync.`);

  const [purchases, sales, debitNotes, creditNotes, psvTotals] = await Promise.all([
    PurchaseInvoice.aggregate([
      { $match: { invoiceDate: { $gt: HARD_ANCHOR_DATE }, status: { $ne: "CANCELLED" } } },
      { $unwind: "$items" },
      { $match: { "items.productId": { $in: productIds } } },
      { $group: { _id: { productId: "$items.productId", batch: "$items.batch" }, totalQty: { $sum: "$items.qty" } } }
    ]),
    Invoice.aggregate([
      { $match: { status: { $ne: "CANCELLED" }, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
      { $unwind: "$items" },
      { $match: { "items.productId": { $in: productIds }, "items.qty": { $gt: 0 } } },
      { $group: { _id: { productId: "$items.productId", batch: "$items.batch" }, totalQty: { $sum: "$items.qty" } } }
    ]),
    DebitNote.aggregate([
      { $match: { status: { $ne: "Cancelled" }, date: { $gt: HARD_ANCHOR_DATE } } },
      { $unwind: "$items" },
      { $match: { "items.productId": { $in: productIds } } },
      { $group: { _id: { productId: "$items.productId", batch: "$items.batch" }, totalQty: { $sum: { $ifNull: ["$items.qty", "$items.returnedQty", 0] } } } }
    ]),
    CreditNote.aggregate([
      { $match: { status: { $in: ["Created", "confirmed", "Approved"] } } },
      { $addFields: { effectiveDate: { $ifNull: ["$date", "$createdAt"] } } },
      { $match: { effectiveDate: { $gt: HARD_ANCHOR_DATE } } },
      { $unwind: "$items" },
      { $match: { "items.productId": { $in: productIds } } },
      { $group: { _id: { productId: "$items.productId", batch: "$items.batch" }, totalQty: { $sum: { $ifNull: ["$items.qty", "$items.returnedQty", 0] } } } }
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
          _id: { productId: "$productId", batch: "$batch" },
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

  const makeKey = (pid, batch) => `${pid.toString()}_${batch || "1"}`;

  purchases.forEach(p => pMap[makeKey(p._id.productId, p._id.batch)] = p.totalQty);
  sales.forEach(s => sMap[makeKey(s._id.productId, s._id.batch)] = s.totalQty);
  debitNotes.forEach(d => dnMap[makeKey(d._id.productId, d._id.batch)] = d.totalQty);
  creditNotes.forEach(c => cnMap[makeKey(c._id.productId, c._id.batch)] = c.totalQty);
  psvTotals.forEach(psv => psvMap[makeKey(psv._id.productId, psv._id.batch)] = psv);

  for (const p of products) {
    const pid = p._id.toString();
    
    const newBatches = {};
    const openingQty = p.openingQty || 0;
    newBatches["0"] = { qty: openingQty, expiryDate: p.batch1?.expiryDate || null, mrp: p.batch1?.mrp || 0, manufacturingDate: p.batch1?.manufacturingDate || null };

    const allTransactionBatches = new Set();
    [purchases, sales, debitNotes, creditNotes, psvTotals].forEach(arr => {
      arr.forEach(doc => {
        if (doc._id.productId.toString() === pid) {
          allTransactionBatches.add(doc._id.batch || "1");
        }
      });
    });

    (p.batches || []).forEach(b => {
      if (!newBatches[String(b.batchNo)]) {
        newBatches[String(b.batchNo)] = { qty: 0, expiryDate: b.expiryDate, mrp: b.mrp, manufacturingDate: b.manufacturingDate };
      }
    });

    for (const batch of allTransactionBatches) {
      if (!newBatches[batch]) {
        newBatches[batch] = { qty: 0, expiryDate: null, mrp: 0, manufacturingDate: null };
      }
      
      const key = makeKey(pid, batch);
      const pQty = pMap[key] || 0;
      const sQty = sMap[key] || 0;
      const dnQty = dnMap[key] || 0;
      const cnQty = cnMap[key] || 0;
      const psv = psvMap[key] || { inwardQty: 0, outwardQty: 0 };
      
      let closing = pQty + cnQty + psv.inwardQty - sQty - dnQty - psv.outwardQty;
      newBatches[batch].qty += closing; 
    }

    const finalBatches = Object.entries(newBatches).map(([batchNo, data]) => ({
      batchNo,
      qty: data.qty,
      expiryDate: data.expiryDate,
      mrp: data.mrp,
      manufacturingDate: data.manufacturingDate
    }));

    const finalTotalQty = finalBatches.reduce((acc, b) => acc + b.qty, 0);

    await Product.updateOne({ _id: p._id }, {
      $set: {
        batches: finalBatches,
        totalQty: finalTotalQty,
        "batch1.qty": newBatches["0"]?.qty || 0
      }
    });
  }

  console.log("Fixed Sync Complete.");
  await mongoose.connection.close();
}

run().catch(console.error);
