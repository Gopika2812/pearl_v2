import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// Register schemas
import "../models/Product.js";
import "../models/PurchaseOrder.js";

const connStr = process.env.MONGO_URI || "mongodb://localhost:27017/pearl-erp";

async function run() {
  await mongoose.connect(connStr);
  
  const Product = mongoose.model("Product");
  const PurchaseOrder = mongoose.model("PurchaseOrder");

  console.log("Starting batch database cleanup...");

  // 1. Fetch all products
  const products = await Product.find({}).select("_id name batches batch2").lean();
  console.log(`Fetched ${products.length} products to check.`);

  // 2. Fetch all PO items to see which batches are actually used in transactions
  const POs = await PurchaseOrder.find({ status: { $ne: "CANCELLED" } }).select("items").lean();
  const activeBatchesMap = {}; // productId -> Set of batch numbers used in POs
  
  POs.forEach(po => {
    (po.items || []).forEach(item => {
      if (item.productId && item.batch) {
        const prodId = item.productId.toString();
        if (!activeBatchesMap[prodId]) {
          activeBatchesMap[prodId] = new Set();
        }
        activeBatchesMap[prodId].add(String(item.batch));
      }
    });
  });

  const bulkOps = [];
  let updatedCount = 0;

  for (const product of products) {
    if (!product.batches || product.batches.length === 0) continue;

    const prodIdStr = product._id.toString();
    const usedBatches = activeBatchesMap[prodIdStr] || new Set();

    // Filter the batches array
    const filteredBatches = product.batches.filter(b => {
      const batchNoStr = String(b.batchNo);
      // Always keep Batch 0
      if (batchNoStr === "0") return true;

      // Keep batch if it has actual quantity > 0
      if ((b.qty || 0) > 0) return true;

      // Keep batch if it has been used in a Purchase Order
      if (usedBatches.has(batchNoStr)) return true;

      // Otherwise, remove it (it's an empty, unused auto-initialized batch)
      return false;
    });

    // If the batches array changed, update the product
    if (filteredBatches.length !== product.batches.length) {
      const totalQty = filteredBatches.reduce((sum, b) => sum + (b.qty || 0), 0);
      
      bulkOps.push({
        updateOne: {
          filter: { _id: product._id },
          update: {
            $set: {
              batches: filteredBatches,
              totalQty: totalQty
            }
          }
        }
      });
      updatedCount++;
    }
  }

  console.log(`Prepared ${bulkOps.length} update operations.`);

  if (bulkOps.length > 0) {
    const result = await Product.bulkWrite(bulkOps);
    console.log(`Successfully cleaned up batches for ${result.modifiedCount} products.`);
  } else {
    console.log("No cleanup operations needed.");
  }

  await mongoose.connection.close();
}

run().catch(console.error);
