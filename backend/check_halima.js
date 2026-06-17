import mongoose from "mongoose";
import dotenv from "dotenv";
import Customer from "./models/Customer.js";
import Vendor from "./models/Vendor.js"; // Might be named Supplier or Vendor, checking both

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const customers = await Customer.find({ name: { $regex: /HALIMA/i } });
  console.log("Customers:");
  customers.forEach(c => console.log(`- ${c.name} (ID: ${c._id}, LinkedVendor: ${c.linkedVendorId})`));

  let VendorModel;
  try {
    VendorModel = (await import("./models/Vendor.js")).default;
  } catch (e) {
    VendorModel = (await import("./models/Supplier.js")).default;
  }
  
  const vendors = await VendorModel.find({ name: { $regex: /HALIMA/i } });
  console.log("\nVendors/Suppliers:");
  vendors.forEach(v => console.log(`- ${v.name} (ID: ${v._id})`));

  process.exit(0);
}

run().catch(console.error);
