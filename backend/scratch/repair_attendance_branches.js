import mongoose from 'mongoose';
import Attendance from '../modules/hr-payroll/models/Attendance.js';
import BranchUser from '../models/BranchUser.js';
import '../config/env.js';

async function repairData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("📡 Connected to DB for repair...");

    const logs = await Attendance.find({});
    console.log(`🔍 Found ${logs.length} records to verify.`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const log of logs) {
      const employee = await BranchUser.findById(log.employeeId);
      // The field in BranchUser is 'branch', not 'branchId'
      if (employee && employee.branch) {
        await Attendance.updateOne(
          { _id: log._id },
          { $set: { branch: employee.branch } }
        );
        fixedCount++;
      } else {
        skippedCount++;
        console.warn(`⚠️ Could not find branch for employee ${log.employeeId}`);
      }
    }

    console.log(`✅ Final Results:`);
    console.log(`   - Synced: ${fixedCount} records`);
    console.log(`   - Unresolved: ${skippedCount}`);
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Repair failed:", err);
    process.exit(1);
  }
}

repairData();
