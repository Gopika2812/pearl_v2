import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// Register the models
import "../models/Product.js";

const connStr = process.env.MONGO_URI || "mongodb://localhost:27017/pearl-erp";

async function run() {
  await mongoose.connect(connStr);
  
  const Product = mongoose.model("Product");

  const product = await Product.findOne({ name: /SCHEZWAN DIP/i }).lean();
  console.log("Product Database Record:");
  console.log(JSON.stringify(product, null, 2));

  await mongoose.connection.close();
}

run().catch(console.error);
