import mongoose from "mongoose";
import dotenv from "dotenv";
import SalesOrder from "../models/SalesOrder.js";
import AuditLog from "../models/AuditLog.js";

dotenv.config(); // Loads backend/.env

async function check() {
  try {
    const uri = process.env.MONGO_URI || "mongodb://localhost:27017/pearls_erp";
    await mongoose.connect(uri);
    console.log("✅ Connected to DB");

    const newestSO = await SalesOrder.findOne().sort({ createdAt: -1 }).lean();
    console.log("🆕 Newest Sales Order Date:", newestSO?.createdAt);
    console.log("🆕 Newest Sales Order ID:", newestSO?.invoiceId);

    const newestLog = await AuditLog.findOne({ action: { $in: ["CREATE_SO", "INVOICE_SO"] } })
      .sort({ createdAt: -1 })
      .lean();
    console.log("🆕 Newest Audit Log (SO/SI) Date:", newestLog?.createdAt);
    console.log("🆕 Newest Audit Log Action:", newestLog?.action);

    const todayCount = await SalesOrder.countDocuments({
      createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
    });
    console.log("📊 Sales Orders Created Today:", todayCount);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
