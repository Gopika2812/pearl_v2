import mongoose from "mongoose";

const voucherTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    orderType: {
      type: String,
      required: true,
      enum: ["SO", "PO"],
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

voucherTypeSchema.index({ name: 1, orderType: 1 }, { unique: true });
export default mongoose.model("VoucherType", voucherTypeSchema);
