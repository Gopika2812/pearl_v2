import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// Register the models
import "../models/Branch.js";
import "../models/Product.js";

const connStr = process.env.MONGO_URI || "mongodb://localhost:27017/pearl-erp";

async function run() {
  await mongoose.connect(connStr);
  
  const Product = mongoose.model("Product");
  const Branch = mongoose.model("Branch");

  const products = await Product.find({ name: "A Alphonsa Mango 5Lit" }).lean();
  console.log(`Found ${products.length} products with name 'A Alphonsa Mango 5Lit'`);

  for (const p of products) {
    const branch = await Branch.findById(p.branchId).select("name").lean();
    console.log(`\nProduct ID: ${p._id}`);
    console.log(`Branch: ${branch ? branch.name : p.branchId}`);
    console.log(`totalQty: ${p.totalQty}`);
    console.log(`batches:`, JSON.stringify(p.batches, null, 2));
  }

  await mongoose.connection.close();
}

run().catch(console.error);
