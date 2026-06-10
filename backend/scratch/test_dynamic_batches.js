import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';
import CustomerLockedPrice from '../models/CustomerLockedPrice.js';
dotenv.config();

async function run() {
  console.log("Connecting to Mongo...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.");

  try {
    // 1. Find or create a test product
    let product = await Product.findOne({ name: "TEST-BATCH-PRODUCT" });
    if (!product) {
      console.log("Creating test product...");
      product = new Product({
        name: "TEST-BATCH-PRODUCT",
        perQty: 1,
        units: "Pcs",
        branchId: new mongoose.Types.ObjectId(),
        hsnCode: "123456",
        purchasingPrice: 100,
        sellingPrice: 150
      });
      await product.save();
    }

    console.log("Initial state of batches:", product.batches);
    console.log("Initial state of legacy batch1 (linked to Batch 0):", product.batch1);
    console.log("Initial state of legacy batch2:", product.batch2);
    console.log("Initial state of totalQty:", product.totalQty);

    // 2. Add stock to dynamic Batch 0
    console.log("\nAdding 10 to Batch 0...");
    product.updateBatchStock("0", 10, new Date(), 200);
    await product.save();
    console.log("Post Batch 0 save, totalQty:", product.totalQty);
    console.log("Batch 0 info in batches array:", product.batches.find(b => b.batchNo === "0"));
    console.log("Batch 1 legacy info (should be synced with Batch 0):", product.batch1);

    // 3. Add stock to dynamic Batch 3 (New dynamic batch)
    console.log("\nAdding 25 to Batch 3...");
    product.updateBatchStock("3", 25, new Date(), 220);
    await product.save();
    console.log("Post Batch 3 save, totalQty:", product.totalQty);
    console.log("Batch 3 info in batches array:", product.batches.find(b => b.batchNo === "3"));
    console.log("Batch 1 legacy info (should still be synced with Batch 0):", product.batch1);
    console.log("Batch 2 legacy info:", product.batch2);

    // 4. Deduct stock from Batch 3
    console.log("\nDeducting 5 from Batch 3...");
    product.updateBatchStock("3", -5);
    await product.save();
    console.log("Post Batch 3 deduction, totalQty:", product.totalQty);
    console.log("Batch 3 info in batches array:", product.batches.find(b => b.batchNo === "3"));

    // Clean up
    console.log("\nCleaning up test product...");
    await Product.deleteOne({ _id: product._id });
    console.log("Test product cleaned up successfully!");

  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
