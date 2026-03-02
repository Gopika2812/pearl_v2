import mongoose from "mongoose";

const ProductGroupSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// Create composite unique index: branchId + name
ProductGroupSchema.index({ branchId: 1, name: 1 }, { unique: true });

export default mongoose.model("ProductGroup", ProductGroupSchema);
