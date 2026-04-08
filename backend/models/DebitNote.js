import mongoose from "mongoose";

const debitNoteSchema = new mongoose.Schema(
  {
    debitNoteId: { type: String, required: true },
    
    // Reference to original purchase order or invoice
    originalPurchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: false,
    },
    originalInvoiceId: String,
    
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    
    // Vendor Info
    vendor: {
      vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
        required: true,
      },
      name: String,
    },
    
    // Returned Items
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: String,
        qty: Number,
        purchasePrice: Number,
        discountType: String,
        discountPercent: Number,
        discountAmount: Number,
        gst: Number,
        cgst: Number,
        sgst: Number,
        igst: Number,
        taxableAmount: Number,
        total: Number,
      },
    ],
    
    // Financial Details
    subtotal: Number,
    totalDiscount: Number,
    totalTax: Number,
    grandTotal: Number,
    
    // Financial Year
    financialYear: String,
    
    // Reason for return
    reasonForReturn: String,
    
    // Status
    status: {
      type: String,
      enum: ["Created", "Cancelled"],
      default: "Created",
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Branch-specific uniqueness for Debit Note IDs
debitNoteSchema.index({ branchId: 1, debitNoteId: 1 }, { unique: true });

export default mongoose.model("DebitNote", debitNoteSchema);
