import mongoose from "mongoose";

const salesOwnerSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, default: "Sales Owner" },
    commissionAmount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Create composite unique index: branchId + name
salesOwnerSchema.index({ branchId: 1, name: 1 }, { unique: true });

export default mongoose.model("SalesOwner", salesOwnerSchema);
