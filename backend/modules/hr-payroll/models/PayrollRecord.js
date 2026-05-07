import mongoose from "mongoose";

const payrollRecordSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BranchUser",
      required: true,
    },
    month: {
      type: String, // format: "YYYY-MM"
      required: true,
    },
    grossSalary: {
      type: Number,
      required: true,
    },
    basicSalary: {
      type: Number,
      required: true,
    },
    overtimePay: {
      type: Number,
      default: 0,
    },
    bonus: {
      type: Number,
      default: 0,
    },
    deductions: {
      type: Number,
      default: 0,
    },
    lateHoursDeduction: {
      type: Number,
      default: 0,
    },
    extraLeaveDeduction: {
      type: Number,
      default: 0,
    },
    manualBonus: {
      type: Number,
      default: 0,
    },
    manualFine: {
      type: Number,
      default: 0,
    },
    netSalary: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Paid"],
      default: "Pending",
    },
    paymentDate: {
      type: Date,
    },
    zohoExpenseId: {
      type: String,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
  },
  { timestamps: true }
);

// Unique payroll per employee per month
payrollRecordSchema.index({ employeeId: 1, month: 1 }, { unique: true });

const PayrollRecord = mongoose.model("PayrollRecord", payrollRecordSchema);
export default PayrollRecord;
