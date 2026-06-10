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
const branchId = "69cb755611501727ed6ec9cb"; // Pearl Agency branch ID from screenshot

async function run() {
  await mongoose.connect(connStr);
  
  const Product = mongoose.model("Product");
  const PurchaseOrder = mongoose.model("PurchaseOrder");
  const PurchaseInvoice = mongoose.model("PurchaseInvoice");
  const Invoice = mongoose.model("Invoice");
  const DebitNote = mongoose.model("DebitNote");
  const CreditNote = mongoose.model("CreditNote");
  const PhysicalStockEntry = mongoose.model("PhysicalStockEntry");

  const HARD_ANCHOR_DATE = new Date("2026-03-31T23:59:59.000Z");

  console.log("Running simulated batch-inventory calculations...");

  const query = { branchId: new mongoose.Types.ObjectId(branchId), name: /SCHEZWAN DIP/i };
  const products = await Product.find(query).populate("productGroup").lean();
  const productIds = products.map(p => p._id);

  console.log(`Found ${products.length} products matching search.`);

  const [purchases, sales, debitNotes, creditNotes, psvTotals] = await Promise.all([
    PurchaseInvoice.aggregate([
      { $match: { branchId: query.branchId, "items.productId": { $in: productIds }, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
      { $unwind: "$items" },
      { $match: { "items.productId": { $in: productIds } } },
      { $group: { _id: "$items.productId", totalQty: { $sum: "$items.qty" } } }
    ]),
    Invoice.aggregate([
      { $match: { branchId: query.branchId, status: { $ne: "CANCELLED" }, "items.productId": { $in: productIds }, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
      { $unwind: "$items" },
      { $match: { "items.productId": { $in: productIds }, "items.qty": { $gt: 0 } } },
      { $group: { _id: "$items.productId", totalQty: { $sum: "$items.qty" } } }
    ]),
    DebitNote.aggregate([
      { $match: { branchId: query.branchId, status: { $ne: "Cancelled" }, "items.productId": { $in: productIds }, date: { $gt: HARD_ANCHOR_DATE } } },
      { $unwind: "$items" },
      { $match: { "items.productId": { $in: productIds } } },
      { $group: { _id: "$items.productId", totalQty: { $sum: { $ifNull: ["$items.qty", "$items.returnedQty", 0] } } } }
    ]),
    CreditNote.aggregate([
      { $match: { branchId: query.branchId, status: { $ne: "Cancelled" }, "items.productId": { $in: productIds } } },
      { $addFields: { effectiveDate: { $ifNull: ["$date", "$createdAt"] } } },
      { $match: { effectiveDate: { $gt: HARD_ANCHOR_DATE } } },
      { $unwind: "$items" },
      { $match: { "items.productId": { $in: productIds } } },
      { $group: { _id: "$items.productId", totalQty: { $sum: { $ifNull: ["$items.qty", "$items.returnedQty", 0] } } } }
    ]),
    PhysicalStockEntry.aggregate([
      { $match: { branchId: query.branchId, status: "APPROVED", productId: { $in: productIds } } },
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

  products.forEach(p => {
    const pid = p._id.toString();
    const pQty = purchaseMapTotal.get(pid) || 0;
    const sQty = salesMapTotal.get(pid) || 0;
    const dnQty = dnMapTotal.get(pid) || 0;
    const cnQty = cnMapTotal.get(pid) || 0;
    const psv = psvMapTotal.get(pid) || { inwardQty: 0, outwardQty: 0 };

    const totalClosingQty = (p.openingQty || 0) + pQty + cnQty + psv.inwardQty - sQty - dnQty - psv.outwardQty;

    console.log(`Product: ${p.name}`);
    console.log(`  - Opening Qty: ${p.openingQty}`);
    console.log(`  - Purchase Qty (Movements): ${pQty}`);
    console.log(`  - Sales Qty (Movements): ${sQty}`);
    console.log(`  - Dynamic Closing Stock calculation: ${totalClosingQty}`);
  });

  await mongoose.connection.close();
}

run().catch(console.error);
