import mongoose from "mongoose";

const AILearnedFactSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    fact: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["PROCUREMENT", "GENERAL"],
      default: "GENERAL",
    },
  },
  { timestamps: true }
);

export default mongoose.model("AILearnedFact", AILearnedFactSchema);
