import mongoose from "mongoose";
import dotenv from "dotenv";
import Invoice from "./backend/models/Invoice.js";
import VoucherType from "./backend/models/VoucherType.js";

console.log("🚦 Verification sequence started...");
dotenv.config({ path: "./backend/.env" });

async function verifyFix() {
  try {
    console.log("🔗 Attempting to connect to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const branchId = new mongoose.Types.ObjectId("69cb755611501727ed6ec9cb"); // Using the ID from the error
    const prefix = "Z-2SI";
    const fy = "26-27";

    console.log(`🔍 Checking invoices with prefix ${prefix} for branch ${branchId}`);

    // Simulate the check logic
    const existingInvoices = await Invoice.find({
      branchId: branchId,
      invoiceNumber: new RegExp(`^${prefix}/`),
      financialYear: fy
    }).select('invoiceNumber').lean();

    let highestNumInDB = 0;
    existingInvoices.forEach(inv => {
      const parts = inv.invoiceNumber.split('/');
      if (parts.length >= 2) {
        const num = parseInt(parts[1]);
        if (!isNaN(num) && num > highestNumInDB) {
          highestNumInDB = num;
        }
      }
    });

    console.log(`📊 Absolute Highest Number in DB: ${highestNumInDB}`);

    // Fetch the voucher
    const voucher = await VoucherType.findOne({
      branchId,
      prefix: prefix,
      orderType: "SI",
      financialYear: fy
    });

    if (voucher) {
      console.log(`📑 Voucher Counter (Current): ${voucher.counter}`);
      const nextNum = Math.max(voucher.counter, highestNumInDB + 1);
      console.log(`🚀 Next Number to be assigned: ${nextNum}`);
      
      if (nextNum > voucher.counter) {
        console.log("⚠️ Counter was lagging! Fix will succeed by using next sequential number.");
      } else {
        console.log("✅ Counter is already ahead of DB.");
      }
    } else {
      console.log("❌ Voucher not found for this prefix.");
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Verification failed:", err);
    process.exit(1);
  }
}

verifyFix();
