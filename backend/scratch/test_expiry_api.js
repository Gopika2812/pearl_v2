import "../config/env.js";
import mongoose from "mongoose";
import Product from "../models/Product.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");
  
  const branchId = "69cc1d573493c36f8cb7b419";
  
  const fiveDaysFromNow = new Date();
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
  
  console.log("Current time:", new Date());
  console.log("fiveDaysFromNow limit:", fiveDaysFromNow);

  // Find products where batch1 or batch2 has quantity > 0 and expiryDate is <= fiveDaysFromNow
  const products = await Product.find({
    branchId,
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

  console.log(`Found ${products.length} products with Mongo query`);

  const alerts = [];
  products.forEach(p => {
    if (p.batch1 && p.batch1.qty > 0 && p.batch1.expiryDate && new Date(p.batch1.expiryDate) <= fiveDaysFromNow) {
      alerts.push({
        productId: p._id,
        name: p.name,
        batch: "1",
        qty: p.batch1.qty,
        expiryDate: p.batch1.expiryDate,
        mrp: p.batch1.mrp
      });
    }
    if (p.batch2 && p.batch2.qty > 0 && p.batch2.expiryDate && new Date(p.batch2.expiryDate) <= fiveDaysFromNow) {
      alerts.push({
        productId: p._id,
        name: p.name,
        batch: "2",
        qty: p.batch2.qty,
        expiryDate: p.batch2.expiryDate,
        mrp: p.batch2.mrp
      });
    }
  });

  console.log("Alerts:", JSON.stringify(alerts, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
