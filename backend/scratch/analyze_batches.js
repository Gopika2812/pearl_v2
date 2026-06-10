import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// Register the schemas
import "../models/Product.js";
import "../models/PurchaseOrder.js";
// Let's check if SalesOrder model exists
try {
  await import("../models/SalesOrder.js");
} catch (e) {
  // Ignore if not found
}

const connStr = process.env.MONGO_URI || "mongodb://localhost:27017/pearl-erp";

async function run() {
  await mongoose.connect(connStr);
  
  const Product = mongoose.model("Product");
  const PurchaseOrder = mongoose.model("PurchaseOrder");
  let SalesOrder;
  try {
    SalesOrder = mongoose.model("SalesOrder");
  } catch (e) {}

  const countWithBatch2Stock = await Product.countDocuments({ "batch2.qty": { $gt: 0 } });
  const countWithBatch2InArray = await Product.countDocuments({ "batches.batchNo": "2" });
  
  // Count POs using batch 2
  const poCount = await PurchaseOrder.countDocuments({ "items.batch": "2" });
  
  let soCount = 0;
  if (SalesOrder) {
    soCount = await SalesOrder.countDocuments({ "items.batch": "2" });
  }

  console.log("Products with legacy batch2 qty > 0:", countWithBatch2Stock);
  console.log("Products with Batch 2 in batches array:", countWithBatch2InArray);
  console.log("Purchase Orders using Batch 2:", poCount);
  console.log("Sales Orders using Batch 2:", soCount);

  await mongoose.connection.close();
}

run().catch(console.error);
