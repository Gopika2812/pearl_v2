import mongoose from "mongoose";
import dotenv from "dotenv";
import AuditLog from "../models/AuditLog.js";

dotenv.config();

async function check() {
  try {
    const uri = process.env.MONGO_URI || "mongodb://localhost:27017/pearls_erp";
    await mongoose.connect(uri);
    
    console.log("🔍 Checking UPDATE_SALES_ORDER logs...");
    const newestUpdate = await AuditLog.findOne({ action: "UPDATE_SALES_ORDER" })
      .sort({ createdAt: -1 })
      .lean();
    console.log("🆕 Newest UPDATE_SALES_ORDER Date:", newestUpdate?.createdAt);
    console.log("🆕 Newest UPDATE_SALES_ORDER User:", newestUpdate?.username);

    const countAll = await AuditLog.countDocuments({ action: "UPDATE_SALES_ORDER" });
    console.log("📊 Total UPDATE_SALES_ORDER logs:", countAll);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
