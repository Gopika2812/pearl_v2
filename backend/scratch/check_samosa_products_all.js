import "../config/env.js";
import mongoose from "mongoose";
import Product from "../models/Product.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");
  
  const products = await Product.find({ name: /Chicken Patti Samosa/i }).lean();
  console.log(`Found ${products.length} products total:`);
  products.forEach(p => {
    console.log({
      name: p.name,
      _id: p._id,
      branchId: p.branchId,
      totalQty: p.totalQty,
      batch1: p.batch1,
      batch2: p.batch2,
    });
  });
  
  await mongoose.disconnect();
}

run().catch(console.error);
