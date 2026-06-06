import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AuditLog from '../models/AuditLog.js'; // wait, is the audit log model named AuditLog? Let's check in models directory.
// Let's import it dynamically if we don't know the exact path.

dotenv.config({ path: './.env' });

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Let's query recent audit logs related to VoucherType or containing "Voucher" or "counter" or "GESI"
    // Since AuditLog model might be registered, let's find it.
    const AuditLog = mongoose.model('AuditLog');
    const logs = await AuditLog.find({
      $or: [
        { description: /Voucher/i },
        { description: /counter/i },
        { description: /GESI/i },
        { action: /Voucher/i }
      ]
    }).sort({ createdAt: -1 }).limit(20);

    console.log("\n--- Recent Counter/Voucher Audit Logs ---");
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
