import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "./models/Product.js";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to DB");
  
  const product = await Product.findOne({ name: /MORDE COCOA POWDER 2010 2KG/i });
  if (!product) {
    console.log("Product not found");
    return;
  }
  
  console.log("Before update:", product.restockingConfig);
  
  product.restockingConfig = {
    ...product.restockingConfig,
    showAlert: true
  };
  product.markModified("restockingConfig");
  
  await product.save();
  
  const updated = await Product.findById(product._id);
  console.log("After update:", updated.restockingConfig);
  
  await mongoose.disconnect();
}

run().catch(console.error);
