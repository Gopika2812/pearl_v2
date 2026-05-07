import mongoose from "mongoose";

const salaryStructureSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BranchUser",
      required: true,
      unique: true,
    },
    basicSalary: {
      type: Number,
      default: 0,
    },
    overtimeRate: {
      type: Number,
      default: 0, // per hour
    },
    bonus: {
      type: Number,
      default: 0,
    },
    deductions: {
      type: Number,
      default: 0,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    shiftStartTime: {
      type: String,
      default: "09:00", // 24hr format
    },
    shiftEndTime: {
      type: String,
      default: "18:00", // 24hr format
    },
    allowedMonthlyLeaves: {
      type: Number,
      default: 0,
    },
    changeHistory: [
      {
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "SuperAdmin" },
        changedByName: String,
        details: String, // e.g., "Basic Salary: 10000 -> 12000"
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const SalaryStructure = mongoose.model("SalaryStructure", salaryStructureSchema);
export default SalaryStructure;
