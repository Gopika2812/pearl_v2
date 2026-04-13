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
    stateName: { type: String },
    gstRegistrationType: { type: String, enum: ["Regular", "Unregistered/Consumer"], default: "Regular" },
    gstin: { type: String },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    openingBalance: { type: Number, default: 0 },
    manualOpeningDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Create composite unique index: branchId + name
vendorSchema.index({ branchId: 1, name: 1 }, { unique: true });

export default mongoose.model("Vendor", vendorSchema);
