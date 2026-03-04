import mongoose from "mongoose";

const RestockingEntrySchema = new mongoose.Schema(
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
    productName: String,
    currentQty: Number, // Current stock when restocking was triggered
    minStockQty: Number, // Minimum threshold
    maxStockQty: Number, // Maximum threshold
    restockingQty: Number, // Quantity to restock (maxStockQty - currentQty)
    
    // Vendor Info
    vendor: String,
    purchasingPrice: Number,
    
    // Purchase Order Generated
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      default: null,
    },
    purchaseOrderNumber: String,
    
    // Status
    status: {
      type: String,
      enum: ["INITIATED", "PO_CREATED", "RECEIVED", "CANCELLED"],
      default: "INITIATED",
    },
    
    // Metadata
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date, default: null },
    notes: String,
  },
  { timestamps: true }
);

// Index for quick lookup
RestockingEntrySchema.index({ branchId: 1, productId: 1 });
RestockingEntrySchema.index({ branchId: 1, status: 1 });

export default mongoose.model("RestockingEntry", RestockingEntrySchema);
