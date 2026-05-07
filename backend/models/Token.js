import mongoose from "mongoose";

const tokenSchema = new mongoose.Schema(
  {
    tokenId: { type: String, required: true },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    
    // Creator Info
    createdBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "BranchUser" },
      name: String,
      username: String,
    },
    
    // Assigned Person Info
    assignedTo: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "BranchUser" },
      name: String,
      username: String,
    },
    
    // Customer Info
    customer: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
      name: String,
    },
    
    // Token message replaces product list
    message: { type: String, required: true },
    
    status: {
      type: String,
      enum: ["OPEN", "TAKEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "OPEN",
    },
    
    takenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BranchUser",
    },
    
    takenAt: Date,
    inProgressAt: Date,
    finishedAt: Date,
    salesOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesOrder",
    },
  },
  { timestamps: true }
);

// Indexes for performance
tokenSchema.index({ branchId: 1, createdAt: -1 });
tokenSchema.index({ status: 1, branchId: 1 });
tokenSchema.index({ tokenId: 1, branchId: 1 }, { unique: true });

const Token = mongoose.models.Token || mongoose.model("Token", tokenSchema);
export default Token;
