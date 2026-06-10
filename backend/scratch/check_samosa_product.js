import "../config/env.js";
import mongoose from "mongoose";
import Product from "../models/Product.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");
  
  const product = await Product.findOne({ name: /Chicken Patti Samosa/i });
  if (product) {
    console.log("Product found:", {
      name: product.name,
      _id: product._id,
      branchId: product.branchId,
      totalQty: product.totalQty,
      batch1: product.batch1,
      batch2: product.batch2,
    });
  } else {
    console.log("Product not found");
  }
  
  await mongoose.disconnect();
}

run().catch(console.error);
