import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// Register the models
import "../models/Product.js";
import "../models/PurchaseOrder.js";

const connStr = process.env.MONGO_URI || "mongodb://localhost:27017/pearl-erp";

async function run() {
  await mongoose.connect(connStr);
  
  const Product = mongoose.model("Product");
  const PurchaseOrder = mongoose.model("PurchaseOrder");

  // 1. Fetch product using regex
  const product = await Product.findOne({ name: /Chicken Nuggets/i }).lean();
  console.log("Product Database Record:");
  console.log(JSON.stringify(product, null, 2));

  if (product) {
    // 2. Fetch purchase orders containing this product
    const POs = await PurchaseOrder.find({
      status: { $ne: "CANCELLED" },
      "items.productId": product._id
    }).select("invoiceId items date").lean();

    console.log("\nAssociated Purchase Orders:");
    POs.forEach(po => {
      console.log(`PO ID: ${po.invoiceId}, Date: ${po.date}`);
      po.items.forEach(item => {
        if (item.productId.toString() === product._id.toString()) {
          console.log(`  - Qty: ${item.qty}, Batch: ${item.batch}, Price: ${item.price}`);
        }
      });
    });
  } else {
    console.log("No product found matching 'Chicken Nuggets' regex.");
  }

  await mongoose.connection.close();
}

run().catch(console.error);
