import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const AuditLogSchema = new mongoose.Schema({}, { strict: false });
const AuditLog = mongoose.model("AuditLog", AuditLogSchema);

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected!");

  // Search for CHANGE_SO_DATE audit logs
  const logs = await AuditLog.find({ action: "CHANGE_SO_DATE" }).sort({ createdAt: -1 }).lean();
  console.log("CHANGE_SO_DATE audit logs:", JSON.stringify(logs, null, 2));

  // Also check if there are any cancelled orders that have been recently cancelled
  // meaning any order cancelled today
  const SalesOrderSchema2 = new mongoose.Schema({}, { strict: false });
  const SalesOrder2 = mongoose.model("SalesOrder2", SalesOrderSchema2, "salesorders");
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const cancelledToday = await SalesOrder2.find({
    status: "CANCELLED",
    updatedAt: { $gte: today }
  }).sort({ updatedAt: -1 }).select("invoiceId status cancelNarration updatedAt createdAt").lean();
  
  console.log("Orders cancelled today:", JSON.stringify(cancelledToday, null, 2));

  await mongoose.disconnect();
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
