import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "./models/Product.js";
import PurchaseOrder from "./models/PurchaseOrder.js";
import PurchaseInvoice from "./models/PurchaseInvoice.js";

dotenv.config({ path: ".env" });

async function debug() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected successfully!");

  // Find product
  const product = await Product.findOne({ name: /CHIC PERI PERI KURKURAE/i });
  if (!product) {
    console.log("Product not found!");
    process.exit(1);
  }

  // Find PO
  const po = await PurchaseOrder.findOne({ "items.productId": product._id });
  if (po) {
    console.log("\n=== PO Document branchId Type Check ===");
    console.log("po.branchId value:", po.branchId);
    console.log("po.branchId type:", typeof po.branchId);
    console.log("Is po.branchId an ObjectId?:", po.branchId instanceof mongoose.Types.ObjectId);
    console.log("po.branchId constructor name:", po.branchId?.constructor?.name);
  }

  // Find PI
  const pi = await PurchaseInvoice.findOne({ "items.productId": product._id });
  if (pi) {
    console.log("\n=== PI Document branchId Type Check ===");
    console.log("pi.branchId value:", pi.branchId);
    console.log("pi.branchId type:", typeof pi.branchId);
    console.log("Is pi.branchId an ObjectId?:", pi.branchId instanceof mongoose.Types.ObjectId);
    console.log("pi.branchId constructor name:", pi.branchId?.constructor?.name);
  }

  await mongoose.disconnect();
}

debug().catch(err => {
  console.error(err);
  process.exit(1);
});
