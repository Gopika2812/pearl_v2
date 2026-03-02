import mongoose from "mongoose";

const voucherTypeSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    name: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    orderType: {
      type: String,
      required: true,
      enum: ["SO", "PO", "DN", "PM"],
    },

    prefix: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    counter: { type: Number, default: 1 },

    financialYear: { type: String, required: true },
  },
  { timestamps: true }
);

// Create composite unique index: branchId + name + orderType (ONLY allows duplicates across branches)
voucherTypeSchema.index({ branchId: 1, name: 1, orderType: 1 }, { unique: true });

const VoucherType = mongoose.model("VoucherType", voucherTypeSchema);
export default VoucherType;
