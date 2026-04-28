import mongoose from "mongoose";
import dotenv from "dotenv";

import Product from "./models/Product.js";
import PurchaseOrder from "./models/PurchaseOrder.js";
import SalesOrder from "./models/SalesOrder.js";
import DebitNote from "./models/DebitNote.js";
import CreditNote from "./models/CreditNote.js";

dotenv.config();

const HARD_ANCHOR_DATE = new Date("2026-03-31T23:59:59Z");

async function fixInventoryAnchors() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const products = await Product.find({}).lean();
    console.log(`Found ${products.length} products to evaluate.`);

    let fixedCount = 0;

    for (const product of products) {
      const pid = product._id;
      const branchOid = product.branchId;

      // Use exactly the same logic as the fully patched stock-journal
      const [purchases, sales, debitNotes, creditNotes] = await Promise.all([
        PurchaseOrder.aggregate([
          { $match: { branchId: branchOid, status: { $in: ["RECEIVED", "PARTIALLY_RETURNED", "FULLY_RETURNED", "INVOICED"] }, date: { $gt: HARD_ANCHOR_DATE } } },
          { $unwind: "$items" },
          { $match: { "items.productId": pid } },
          { $group: { _id: null, total: { $sum: "$items.qty" } } }
        ]),
        SalesOrder.aggregate([
          { $match: { branchId: branchOid, invoiceGenerated: true, status: { $ne: "CANCELLED" }, orderDate: { $gt: HARD_ANCHOR_DATE } } },
          { $addFields: { effectiveItems: { $cond: [ { $gt: [ { $size: { $ifNull: ["$invoiceItems", []] } }, 0 ] }, "$invoiceItems", "$items" ] } } },
          { $unwind: "$effectiveItems" },
          { $match: { "effectiveItems.productId": pid } },
          { $group: { _id: null, total: { $sum: "$effectiveItems.qty" } } }
        ]),
        DebitNote.aggregate([
          { $match: { branchId: branchOid, status: "Created", date: { $gt: HARD_ANCHOR_DATE } } },
          { $unwind: "$items" },
          { $match: { "items.productId": pid } },
          { $group: { _id: null, total: { $sum: { $ifNull: ["$items.qty", "$items.returnedQty", 0] } } } }
        ]),
        CreditNote.aggregate([
          { $match: { branchId: branchOid, status: { $in: ["Created", "confirmed"] }, createdAt: { $gt: HARD_ANCHOR_DATE } } },
          { $addFields: { effectiveDate: { $ifNull: ["$date", "$createdAt"] } } },
          { $unwind: "$items" },
          { $match: { "items.productId": pid } },
          { $group: { _id: null, total: { $sum: "$items.qty" } } }
        ])
      ]);

      const tIn = (purchases[0]?.total || 0) + (creditNotes[0]?.total || 0);
      const tOut = (sales[0]?.total || 0) + (debitNotes[0]?.total || 0);

      const currentAvailable = (product.openingQty || 0) + tIn - tOut;
      const currentTotal = product.totalQty || 0;

      if (currentAvailable !== currentTotal) {
        console.log(`Mismatch found for ${product.name} (ID: ${pid}): DB Total: ${currentTotal}, Live: ${currentAvailable}, OpeningQty: ${product.openingQty}`);
        
        const correctedOpeningQty = currentTotal - tIn + tOut;
        
        await Product.findByIdAndUpdate(pid, {
            $set: { 
                openingQty: correctedOpeningQty,
                manualOpeningDate: HARD_ANCHOR_DATE
            }
        });
        
        console.log(` -> Fixed! New openingQty: ${correctedOpeningQty}`);
        fixedCount++;
      }
    }

    console.log(`\nFinished! Fixed ${fixedCount} out of ${products.length} products.`);
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixInventoryAnchors();
