import mongoose from "mongoose";

const extraExpenseMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
  },
  { timestamps: true }
);

// Unique index: same name allowed across branches, not within the same branch
extraExpenseMasterSchema.index({ branchId: 1, name: 1 }, { unique: true });

export default mongoose.model("ExtraExpenseMaster", extraExpenseMasterSchema);
