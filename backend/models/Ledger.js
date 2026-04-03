import mongoose from "mongoose";

const LedgerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerGroup",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    gst: {
      type: Number,
      default: 0,
    },
    gstin: {
      type: String,
      trim: true,
    },
    hsn: {
      type: String,
      trim: true,
    },
    openingDebit: {
      type: Number,
      default: 0,
    },
    openingCredit: {
      type: Number,
      default: 0,
    },
    currentBalance: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    registrationType: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
      default: "India",
    },
    pan: {
      type: String,
      trim: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
    },
    isActive: {

      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Ensure name is unique per branch
LedgerSchema.index({ branchId: 1, name: 1 }, { unique: true });

const Ledger = mongoose.model("Ledger", LedgerSchema);
export default Ledger;
