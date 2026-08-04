import mongoose from "mongoose";
import dotenv from "dotenv";
import Attendance from "../modules/hr-payroll/models/Attendance.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/pearl_erp";

async function repairAttendanceHours() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");

    const records = await Attendance.find({
      presentTime: { $ne: null },
      leaveTime: { $ne: null }
    });

    console.log(`Found ${records.length} attendance records with both presentTime & leaveTime.`);

    let updatedCount = 0;
    for (const record of records) {
      const ms = Math.max(0, new Date(record.leaveTime) - new Date(record.presentTime));
      const calcHours = Number((ms / (1000 * 60 * 60)).toFixed(2));
      const calcOT = calcHours > 9 ? Number((calcHours - 9).toFixed(2)) : 0;

      if (!record.workingHours || record.workingHours === 0 || record.workingHours !== calcHours) {
        record.workingHours = calcHours;
        record.overtimeHours = calcOT;
        await record.save();
        updatedCount++;
        console.log(`Updated Attendance ID ${record._id}: ${calcHours} Hrs (+${calcOT} OT)`);
      }
    }

    console.log(`Finished repairing ${updatedCount} attendance records.`);
    process.exit(0);
  } catch (err) {
    console.error("Error repairing attendance records:", err);
    process.exit(1);
  }
}

repairAttendanceHours();
