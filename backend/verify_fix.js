import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "./models/Product.js";

dotenv.config({ path: "./.env" });

async function verifyDuplicate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB.");

    const branchId = "69cb755611501727ed6ec9cb"; // From user's error log
    const name = "Bv-cm-Csp-Blue 200 Gm";

    // Simulate the check we added to the route
    const existingProduct = await Product.findOne({
      branchId,
      name: { $regex: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
    });

    if (existingProduct) {
      console.log(`✅ SUCCESS: Product "${name}" correctly identified as existing in branch ${branchId}`);
    } else {
      console.log(`❌ FAILURE: Product "${name}" NOT found even though it caused a duplicate error previously.`);
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

verifyDuplicate();
