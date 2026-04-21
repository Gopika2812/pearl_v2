import mongoose from "mongoose";

const customerLockedPriceSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    lockedPrice: {
      type: Number,
      required: true,
    },
    purchasingPrice: {
      type: Number,
      default: 0,
    },
    margin: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Unique index for the combination of branching, customer, and product
customerLockedPriceSchema.index({ branchId: 1, customerId: 1, productId: 1 }, { unique: true });

const CustomerLockedPrice = mongoose.model("CustomerLockedPrice", customerLockedPriceSchema);

export default CustomerLockedPrice;
