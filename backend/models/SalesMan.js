import mongoose from "mongoose";

const salesManSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, default: "Sales Man" },
    commissionAmount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Create composite unique index: branchId + name
salesManSchema.index({ branchId: 1, name: 1 }, { unique: true });

export default mongoose.model("SalesMan", salesManSchema);
