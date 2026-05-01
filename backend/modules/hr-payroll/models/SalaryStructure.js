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
  },
  { timestamps: true }
);

const SalaryStructure = mongoose.model("SalaryStructure", salaryStructureSchema);
export default SalaryStructure;
