import mongoose from "mongoose";

const ProductGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    voucherType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VoucherType",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("ProductGroup", ProductGroupSchema);
