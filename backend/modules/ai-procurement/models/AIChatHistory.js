import mongoose from "mongoose";

const AIChatHistorySchema = new mongoose.Schema(
  {
    superAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdmin",
      required: true,
    },
    query: {
      type: String,
      required: true,
    },
    response: {
      type: String,
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: false,
    },
  },
  { timestamps: true }
);

// Indexes for fast retrieval
AIChatHistorySchema.index({ superAdminId: 1, createdAt: -1 });

export default mongoose.model("AIChatHistory", AIChatHistorySchema);
