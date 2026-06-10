import "../config/env.js";
import mongoose from "mongoose";
import Product from "../models/Product.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  const branchId = "69cc1d573493c36f8cb7b419"; // branch ID we found
  
  // Find a product or create a temporary one for testing
  let product = await Product.findOne({ branchId });
  if (!product) {
    console.log("No product found in branch, searching generally...");
    product = await Product.findOne({});
  }

  if (!product) {
    console.log("No product at all in DB");
    await mongoose.disconnect();
    return;
  }

  console.log(`Using product: ${product.name} (_id: ${product._id})`);
  console.log("Initial state of batch1:", product.batch1);
  console.log("Initial state of batch2:", product.batch2);

  // Set batch 1 to expire in 3 days, and batch 2 to expire in 10 days
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  
  const tenDaysFromNow = new Date();
  tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);

  product.batch1 = {
    qty: 10,
    expiryDate: threeDaysFromNow,
    mrp: 100
  };
  product.batch2 = {
    qty: 5,
    expiryDate: tenDaysFromNow,
    mrp: 120
  };

  await product.save();
  console.log("Updated product batch1 to expire in 3 days, batch2 in 10 days.");

  // Run the alert logic
  const fiveDaysFromNow = new Date();
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

  const expiringProducts = await Product.find({
    branchId: product.branchId,
    $or: [
      {
        "batch1.qty": { $gt: 0 },
        "batch1.expiryDate": { $ne: null, $lte: fiveDaysFromNow }
      },
      {
        "batch2.qty": { $gt: 0 },
        "batch2.expiryDate": { $ne: null, $lte: fiveDaysFromNow }
      }
    ]
  }).lean();

  console.log(`Found ${expiringProducts.length} expiring products:`);
  expiringProducts.forEach(p => {
    console.log(`- ${p.name}`);
    if (p.batch1 && p.batch1.qty > 0 && p.batch1.expiryDate && new Date(p.batch1.expiryDate) <= fiveDaysFromNow) {
      console.log(`  Batch 1: qty=${p.batch1.qty}, expiryDate=${p.batch1.expiryDate}`);
    }
    if (p.batch2 && p.batch2.qty > 0 && p.batch2.expiryDate && new Date(p.batch2.expiryDate) <= fiveDaysFromNow) {
      console.log(`  Batch 2: qty=${p.batch2.qty}, expiryDate=${p.batch2.expiryDate}`);
    }
  });

  await mongoose.disconnect();
}

run().catch(console.error);
