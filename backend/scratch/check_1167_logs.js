import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const AuditLog = mongoose.model('AuditLog');
    const logs = await AuditLog.find({
      description: { $regex: /1167|1168/ }
    }).sort({ createdAt: 1 });

    console.log("\n--- Audit Logs for 1167 and 1168 ---");
    logs.forEach(l => {
      console.log(`[${l.createdAt}] Action: ${l.action}, User: ${l.username}, Description: ${l.description}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
