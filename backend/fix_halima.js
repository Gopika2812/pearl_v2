import mongoose from "mongoose";
import dotenv from "dotenv";
import Customer from "./models/Customer.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  let VendorModel;
  try {
    VendorModel = (await import("./models/Vendor.js")).default;
  } catch (e) {
    VendorModel = (await import("./models/Supplier.js")).default;
  }

  const customerId = "69cd9a61966cc2e49aa57e65"; // HALIMA STORES
  const oldVendorId = "6a183dc3b11223ea0d57bd2f"; // HALIMA STOR
  const newEmptyVendorId = "6a31123b5251ead7e7582673"; // HALIMA STORES (empty)

  console.log("Fixing HALIMA issue...");

  // 1. Update the Customer to link to the correct old Vendor
  await Customer.findByIdAndUpdate(customerId, { linkedVendorId: oldVendorId });
  console.log("✅ Customer linked to correct Vendor with purchase history.");

  // 2. Delete the newly created empty Vendor FIRST to avoid duplicate name error
  await VendorModel.findByIdAndDelete(newEmptyVendorId);
  console.log("✅ Deleted the empty, automatically created Vendor profile.");

  // 3. Rename the old Vendor to match the Customer name exactly
  await VendorModel.findByIdAndUpdate(oldVendorId, { name: "HALIMA STORES" });
  console.log("✅ Correct Vendor renamed to 'HALIMA STORES' to match Customer.");

  process.exit(0);
}

run().catch(console.error);
