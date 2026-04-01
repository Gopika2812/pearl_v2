import mongoose from "mongoose";

const LedgerGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nature: {
      type: String,
      enum: ["Asset", "Liability", "Income", "Expense"],
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Ensure name is unique per branch
LedgerGroupSchema.index({ branchId: 1, name: 1 }, { unique: true });

const LedgerGroup = mongoose.model("LedgerGroup", LedgerGroupSchema);
export default LedgerGroup;
