import mongoose from "mongoose";

const followUpSchema = new mongoose.Schema(
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
    followUpBy: { 
      type: String, 
      required: true 
    },
    // Snapshot fields at time of follow-up
    closingBalance: { type: Number, default: 0 },
    creditLimit: { type: Number, default: 0 },
    creditLimitDays: { type: Number, default: 0 },

    result: {
      type: String,
      required: true,
      enum: [
        "Paid",
        "Promised",
        "Part Payment Promised",
        "Already Paid – Entry Pending",
        "No Response",
        "Call Later",
        "Document Needed",
        "Billing Dispute",
        "Approval Pending",
        "Long Pending",
        "Not Committed",
        "others"
      ],
    },
    remarks: { type: String, default: "" },
    nextFollowUpDate: { type: Date }, // Combined date and time
    
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED"],
      default: "COMPLETED"
    }
  },
  { timestamps: true }
);

// Indexes for performance
followUpSchema.index({ branchId: 1, createdAt: -1 });
followUpSchema.index({ customerId: 1, createdAt: -1 });
followUpSchema.index({ nextFollowUpDate: 1 });

const FollowUp = mongoose.model("FollowUp", followUpSchema);
export default FollowUp;
