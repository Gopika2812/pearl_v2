import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "./models/Product.js";

dotenv.config({ path: ".env" });

async function debug() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected successfully!");

  const products = await Product.find({ name: /CHIC.*PERI|PERI.*CHIC/i });
  console.log(`Found ${products.length} matching products:`);
  products.forEach(p => {
    console.log(`- ID: ${p._id}, Name: "${p.name}", Branch ID: ${p.branchId}`);
  });

  await mongoose.disconnect();
}

debug().catch(err => {
  console.error(err);
  process.exit(1);
});
