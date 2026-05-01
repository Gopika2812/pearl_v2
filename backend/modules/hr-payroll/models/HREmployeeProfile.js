import mongoose from "mongoose";

const hrEmployeeProfileSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BranchUser",
      required: true,
      unique: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    employeeCode: {
      type: String, // format: "001", "002"
      required: true,
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index to ensure employeeCode is unique per branch
hrEmployeeProfileSchema.index({ branch: 1, employeeCode: 1 }, { unique: true });

const HREmployeeProfile = mongoose.model("HREmployeeProfile", hrEmployeeProfileSchema);
export default HREmployeeProfile;
