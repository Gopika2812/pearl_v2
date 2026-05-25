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

  // Fetch the latest 10 logs of any action to see what happened recently
  console.log("Fetching the latest 10 audit logs...");
  const logs = await AuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  console.log(`\nFound ${logs.length} recent logs!`);

  logs.forEach((log, idx) => {
    console.log(`[${idx + 1}] Date: ${log.createdAt}`);
    console.log(`    Action: ${log.action}`);
    console.log(`    Description: ${log.description}`);
    if (log.error) {
      console.log(`    Error: ${log.error}`);
    }
    console.log("-".repeat(50));
  });

  await mongoose.disconnect();
}

run().catch(console.error);
