import mongoose from "mongoose";

const priceRequestSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BranchUser",
      required: true,
    },
    staffName: String,
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: String,
    originalPrice: Number,
    requestedPrice: Number, // Optional, if they want to suggest a price
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BranchUser",
    },
    approvedAt: Date,
  },
  { timestamps: true }
);

// Auto-expire requests after 30 minutes if not handled
priceRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1800 });

const PriceRequest = mongoose.model("PriceRequest", priceRequestSchema);

export default PriceRequest;
