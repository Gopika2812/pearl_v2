import mongoose from "mongoose";
import dotenv from "dotenv";
import Customer from "./models/Customer.js";
import AuditLog from "./models/AuditLog.js";

dotenv.config();

const recoverBalances = async () => {
  try {
    console.log("Connecting to Database...");
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log("Connected.\n");

    // Get the timestamp for roughly 12 hours ago
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - 12);

    // Find all financial update logs in the last 12 hours
    const logs = await AuditLog.find({
      action: "CUSTOMER_FINANCIAL_UPDATE",
      createdAt: { $gte: hoursAgo }
    }).sort({ createdAt: 1 }).lean();

    if (logs.length === 0) {
      console.log("✅ No accidental balance changes detected in the last 12 hours.");
      process.exit(0);
    }

    console.log(`⚠️ Found ${logs.length} customer financial updates in the last 12 hours.\n`);

    // Track latest "before" state to restore
    const restoreMap = new Map();

    for (const log of logs) {
      const customerId = log.targetId.toString();
      
      // We only care about the very first state (the original balance before any changes today)
      if (!restoreMap.has(customerId)) {
        restoreMap.set(customerId, {
          name: log.description.split(".")[0].replace("Financial details updated for ", ""),
          before: log.changes.before,
          after: log.changes.after
        });
      }
    }

    console.log("--- THE FOLLOWING CUSTOMER BALANCES WERE MODIFIED TODAY ---");
    let count = 0;
    
    for (const [customerId, data] of restoreMap.entries()) {
      const { before, after } = data;
      
      // Check if it was accidentally wiped to 0
      if (before.openingBalance !== 0 && after.openingBalance === 0) {
        console.log(`\n❌ AFFECTED CUSTOMER: ${data.name}`);
        console.log(`   Original Opening Balance: ₹${before.openingBalance}   (Overwritten to: ₹${after.openingBalance})`);
        console.log(`   Original Debit: ₹${before.debit}   (Overwritten to: ₹${after.debit})`);
        console.log(`   Original Credit: ₹${before.credit}   (Overwritten to: ₹${after.credit})`);
        
        // REVERT THE BALANCE
        await Customer.findByIdAndUpdate(customerId, {
          openingBalance: before.openingBalance,
          debit: before.debit,
          credit: before.credit
        });
        
        console.log(`   ✅ SUCCESSFULLY REVERTED ${data.name} TO ORIGINAL BALANCES.`);
        count++;
      }
    }

    if (count === 0) {
      console.log("\n✅ No balances were accidentally overwritten to 0 today.");
    } else {
      console.log(`\n🎉 Success! Safely recovered original balances for ${count} customers.`);
    }

    process.exit(0);
  } catch (err) {
    console.error("\n❌ Error running recovery script:", err);
    process.exit(1);
  }
};

recoverBalances();
