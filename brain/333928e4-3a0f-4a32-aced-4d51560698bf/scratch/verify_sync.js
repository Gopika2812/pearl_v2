
import mongoose from "mongoose";
import Product from "../../backend/models/Product.js";
import CustomerLockedPrice from "../../backend/models/CustomerLockedPrice.js";
import dotenv from "dotenv";

dotenv.config({ path: "../../backend/.env" });

async function verifyPricingSync() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const branchId = new mongoose.Types.ObjectId();
    const customerId = new mongoose.Types.ObjectId();

    // 1. Create a Product
    const product = new Product({
      name: "Sync Test Product " + Date.now(),
      branchId,
      units: "pcs",
      purchasingPrice: 100,
      sellingPrice: 150, // Margin is 50
      hsnCode: "TEST"
    });
    await product.save();
    console.log(`Created Product: ${product.name}, Cost: ${product.purchasingPrice}, Margin: ${product.margin}`);

    // 2. Create a Locked Price
    const lockedPrice = new CustomerLockedPrice({
      branchId,
      customerId,
      productId: product._id,
      lockedPrice: 120, // Margin relative to 100 cost is 20
      purchasingPrice: 100,
      margin: 20
    });
    await lockedPrice.save();
    console.log(`Created Locked Price: ${lockedPrice.lockedPrice}, Stored Margin: ${lockedPrice.margin}`);

    // 3. Update Product Cost
    console.log("Increasing Product Cost to 110...");
    product.purchasingPrice = 110;
    await product.save();

    // 4. Verify Locked Price Sync
    const updatedLP = await CustomerLockedPrice.findById(lockedPrice._id);
    console.log(`Updated Locked Price: ${updatedLP.lockedPrice}`);
    
    if (updatedLP.lockedPrice === 130) {
      console.log("✅ SUCCESS: Locked Price auto-adjusted to 130 (110 cost + 20 margin)");
    } else {
      console.log(`❌ FAILURE: Locked Price is ${updatedLP.lockedPrice}, expected 130`);
    }

    // Cleanup
    await Product.findByIdAndDelete(product._id);
    await CustomerLockedPrice.findByIdAndDelete(lockedPrice._id);
    await mongoose.disconnect();
  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  }
}

verifyPricingSync();
