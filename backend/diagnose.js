import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

const MONGO_URI = process.env.MONGO_URI;

const auditLogSchema = new mongoose.Schema({}, { strict: false, collection: "auditlogs" });
const AuditLog = mongoose.model("AuditLog", auditLogSchema);

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    
    // Find customer update logs
    console.log("--- CUSTOMER UPDATE LOGS ---");
    const logs = await AuditLog.find({
      $or: [
        { action: /CUSTOMER/i },
        { targetModel: "Customer" }
      ]
    }).sort({ createdAt: -1 }).limit(50).lean();

    logs.forEach(log => {
      console.log(`[${log.createdAt.toISOString()}] User: ${log.username} | Action: ${log.action} | Target: ${log.targetId} | Desc: ${log.description}`);
      if (log.changes) {
        console.log("Changes:", JSON.stringify(log.changes, null, 2));
      }
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
