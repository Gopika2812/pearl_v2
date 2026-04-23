import mongoose from "mongoose";
import dotenv from "dotenv";
import SalesOrder from "../models/SalesOrder.js";
import AuditLog from "../models/AuditLog.js";

dotenv.config();

async function check() {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    
    const orderId = "CSSO/649/26-27";
    const so = await SalesOrder.findOne({ invoiceId: orderId }).lean();
    
    if (!so) {
      console.log(`❌ Could not find order ${orderId}`);
      process.exit(0);
    }

    console.log(`🔍 Checking logs for Order: ${orderId} (ID: ${so._id})`);
    const logs = await AuditLog.find({ targetId: so._id }).sort({ createdAt: -1 }).lean();

    console.log(`📊 Found ${logs.length} audit logs for this order.`);
    logs.forEach(l => {
      console.log(`Action: ${l.action} | Date: ${l.createdAt} | Desc: ${l.description}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
