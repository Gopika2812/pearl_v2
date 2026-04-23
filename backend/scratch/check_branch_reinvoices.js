import mongoose from "mongoose";
import dotenv from "dotenv";
import AuditLog from "../models/AuditLog.js";
import Branch from "../models/Branch.js";

dotenv.config();

async function check() {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    
    console.log("🔍 Checking Branch distribution for RE_INVOICE_SO after April 9...");
    const logs = await AuditLog.find({
      action: "RE_INVOICE_SO",
      createdAt: { $gte: new Date("2026-04-10") }
    }).populate("branchId", "name").lean();

    const branches = {};
    logs.forEach(l => {
      const bName = l.branchId?.name || "Unknown Branch";
      branches[bName] = (branches[bName] || 0) + 1;
    });

    console.log("📊 Re-Invoices per Branch (since April 10):");
    console.log(JSON.stringify(branches, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
