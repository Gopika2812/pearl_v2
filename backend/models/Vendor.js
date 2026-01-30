import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    gstin: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Vendor", vendorSchema);
