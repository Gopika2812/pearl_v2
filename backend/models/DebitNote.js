import mongoose from "mongoose";

const debitNoteItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: String,
  returnedQty: Number,
  purchasePrice: Number,
  total: Number,
});

const debitNoteSchema = new mongoose.Schema(
  {
    debitNoteId: {
      type: String,
      required: true,
      unique: true,
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },

    // Reference to original purchase order (optional)
    originalPurchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
    },
    originalInvoiceId: String,

    // Vendor Info
    vendor: {
      vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
      },
      name: String,
    },

    // Returned Items
    items: [debitNoteItemSchema],

    // Financial Details
    subtotal: Number,
    totalTax: Number,
    grandTotal: Number,

    // Status
    status: {
      type: String,
      enum: ["draft", "confirmed", "partially_returned", "fully_returned"],
      default: "confirmed",
    },

    reason: String,

    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("DebitNote", debitNoteSchema);
