import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not found in environment!");
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const Customer = mongoose.connection.db.collection("customers");
  const AuditLog = mongoose.connection.db.collection("auditlogs");

  // Fetch customer by name
  const halima = await Customer.findOne({ name: { $regex: /halima/i } });
  console.log("\n--- HALIMA RECORD ---");
  console.log(JSON.stringify(halima, null, 2));

  // Let's also look at the latest CUSTOMER_BULK_UPLOAD audit log to see what it reports
  const latestLogs = await AuditLog.find({ action: "CUSTOMER_BULK_UPLOAD" }).sort({ createdAt: -1 }).limit(3).toArray();
  console.log("\n--- LATEST BULK UPLOAD AUDIT LOGS ---");
  console.log(JSON.stringify(latestLogs, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
