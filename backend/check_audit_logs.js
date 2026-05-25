import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not found!");
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const AuditLog = mongoose.connection.db.collection("auditlogs");

  console.log("Searching for CUSTOMER_FINANCIAL_UPDATE audit logs...");
  const logs = await AuditLog.find({
    action: "CUSTOMER_FINANCIAL_UPDATE"
  }).sort({ createdAt: -1 }).toArray();

  console.log(`\nFound ${logs.length} financial update logs!`);

  if (logs.length > 0) {
    console.log("\nHere are the most recent manual financial changes detected:");
    logs.slice(0, 20).forEach((log, idx) => {
      console.log(`[${idx + 1}] Date: ${log.createdAt}`);
      console.log(`    Description: ${log.description}`);
      console.log(`    Changes:`, JSON.stringify(log.changes || {}, null, 2));
      console.log("-".repeat(50));
    });
  } else {
    console.log("No CUSTOMER_FINANCIAL_UPDATE logs found.");
  }

  await mongoose.disconnect();
}

run().catch(console.error);
