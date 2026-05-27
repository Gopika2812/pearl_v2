import mongoose from "mongoose";

const AIRecommendationSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    vendorName: {
      type: String,
      default: "",
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: false,
    },
    suggestedQty: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      default: "units",
    },
    costPrice: {
      type: Number,
      default: 0,
    },
    gst: {
      type: Number,
      default: 0,
    },
    reorderDate: {
      type: Date,
      required: true,
    },
    expectedReceivingDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "DISCARDED"],
      default: "PENDING",
    },
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: false,
    },
    purchaseOrderNumber: {
      type: String,
      required: false,
    },
    reason: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Indexes
AIRecommendationSchema.index({ branchId: 1, status: 1 });
AIRecommendationSchema.index({ productId: 1, status: 1 });

export default mongoose.model("AIRecommendation", AIRecommendationSchema);
