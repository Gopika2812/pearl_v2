import mongoose from "mongoose";

const overrideRequestSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    customerName: String,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "requestedByModel",
      required: true,
    },
    requestedByModel: {
      type: String,
      enum: ["BranchUser", "SuperAdmin"],
      default: "BranchUser"
    },
    requiresSuperAdmin: {
      type: Boolean,
      default: false
    },
    requestType: {
      type: String,
      enum: ["CREDIT_LIMIT", "CREDIT_DAYS"],
      required: true,
    },
    reason: String,
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "approvedByModel",
    },
    approvedByModel: {
      type: String,
      enum: ["BranchUser", "SuperAdmin"],
    },
    requestedValue: {
      type: Number, // The new limit or days being requested
    },
    approvalToken: {
      type: String, // Unique token to allow the SO creation once
    },
  },
  { timestamps: true }
);

const OverrideRequest = mongoose.model("OverrideRequest", overrideRequestSchema);
export default OverrideRequest;
