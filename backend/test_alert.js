import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp?retryWrites=true&w=majority";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to DB");
  
  const Product = mongoose.model("Product", new mongoose.Schema({}, { strict: false }));
  
  const products = await Product.find({ name: /MORDE COCOA POWDER 2010 2KG/i });
  console.log(`Found ${products.length} products:`);
  products.forEach(p => {
    console.log(`Name: ${p.name}`);
    console.log(`branchId: ${p.branchId}`);
    console.log(`restockingConfig:`, p.restockingConfig);
  });
  
  await mongoose.disconnect();
}

run().catch(console.error);
