import mongoose from "mongoose";
import dotenv from "dotenv";
import AuditLog from "../models/AuditLog.js";

dotenv.config();

async function check() {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    
    console.log("🔍 Checking Log Counts for April 21, 22, and 23...");
    
    const count21 = await AuditLog.countDocuments({ createdAt: { $gte: new Date('2026-04-21'), $lt: new Date('2026-04-22') } });
    const count22 = await AuditLog.countDocuments({ createdAt: { $gte: new Date('2026-04-22'), $lt: new Date('2026-04-23') } });
    const countToday = await AuditLog.countDocuments({ createdAt: { $gte: new Date('2026-04-23') } });

    console.log(`- April 21: ${count21} logs`);
    console.log(`- April 22: ${count22} logs`);
    console.log(`- Today (April 23): ${countToday} logs`);

    // Check action distribution for April 22/23
    const actions = await AuditLog.aggregate([
      { $match: { createdAt: { $gte: new Date('2026-04-22') } } },
      { $group: { _id: "$action", count: { $sum: 1 } } }
    ]);
    console.log("\n📊 Action Distribution (April 22-23):");
    console.log(JSON.stringify(actions, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
