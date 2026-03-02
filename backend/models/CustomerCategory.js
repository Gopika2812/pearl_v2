import mongoose from "mongoose";

const CustomerCategorySchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

// Create composite unique index: branchId + name
CustomerCategorySchema.index({ branchId: 1, name: 1 }, { unique: true });

export default mongoose.model("CustomerCategory", CustomerCategorySchema);
