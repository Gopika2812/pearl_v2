import "../config/env.js";
import mongoose from "mongoose";
import Product from "../models/Product.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");
  
  const product = await Product.findOne({ name: "VLF LJS Chicken Patti Samosa (1*25)" }).lean();
  console.log("Samosa Product Document:", JSON.stringify(product, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
