import mongoose from "mongoose";

export async function fixProductBatches() {
  try {
    const Product = mongoose.model("Product");
    // Find products where batches is empty, null, or undefined
    const products = await Product.find({
      $or: [
        { batches: { $exists: false } },
        { batches: null },
        { batches: { $size: 0 } }
      ]
    }).select("_id batch1 batch2").lean();

    if (products.length === 0) {
      console.log("✔️ [SELF-HEALING] All products have batches initialized.");
      return;
    }

    console.log(`[SELF-HEALING] Found ${products.length} products needing batch initialization. Running bulk write...`);

    const bulkOps = [];
    for (const product of products) {
      const batches = [];
      
      // Sync legacy batch1 to Batch 0
      if (product.batch1) {
        batches.push({
          batchNo: "0",
          qty: product.batch1.qty || 0,
          expiryDate: product.batch1.expiryDate || null,
          mrp: product.batch1.mrp || 0
        });
      }

      const totalQty = batches.reduce((sum, b) => sum + (b.qty || 0), 0);

      bulkOps.push({
        updateOne: {
          filter: { _id: product._id },
          update: {
            $set: {
              batches: batches,
              totalQty: totalQty
            }
          }
        }
      });
    }

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
    }

    console.log(`[SELF-HEALING] Successfully initialized dynamic batches for ${products.length} products via bulk write.`);
  } catch (err) {
    console.error("❌ [SELF-HEALING] Error fixing product batches:", err.message);
  }
}
