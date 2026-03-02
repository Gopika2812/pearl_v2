import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    gstin: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Create composite unique index: branchId + name
vendorSchema.index({ branchId: 1, name: 1 }, { unique: true });

export default mongoose.model("Vendor", vendorSchema);
