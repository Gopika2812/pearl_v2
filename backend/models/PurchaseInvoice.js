import mongoose from "mongoose";

const purchaseInvoiceSchema = new mongoose.Schema(
  {
    // Basic Info
    purchaseInvoiceId: { type: String, required: true }, // uniqueness enforced per-branch via compound index
    invoiceDate: { type: Date, default: Date.now },
    financialYear: String,

    // Reference to original Purchase Order
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
    },

    // Branch & Warehouse
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    warehouse: String,

    // Vendor Details (Copied from PO)
    vendor: { type: String, required: true },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },

    // Invoice Items (FINALIZED)
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        productGroup: String,
        hsn: String,
        qty: Number,
        purchasePrice: Number,
        sellingPrice: Number,
        discountPercent: { type: Number, default: 0 },
        discountAmount: { type: Number, default: 0 },
        gst: Number,
        cgst: Number,
        sgst: Number,
        igst: Number,
        rowPrice: Number, // Pre-tax
        total: Number,    // Post-tax
      },
    ],

    // Totals
    subtotal: Number,
    totalTax: Number,
    extraExpenses: [
      {
        expenseName: String,
        amount: Number, // Support incoming PO field
        basePrice: Number,
        gst: Number, // Support incoming PO field
        gstPercent: { type: Number, default: 0 },
        gstAmount: { type: Number, default: 0 },
        totalPrice: Number,
      },
    ],
    extraExpenseAmount: { type: Number, default: 0 },
    grandTotal: Number,

    // Metadata
    voucherType: String,
    notes: String,
    
    // Auth
    createdBy: String,
    
    // Request metadata (for later re-edits on PI)
    editRequestStatus: { 
      type: String, 
      enum: ["NONE", "PENDING", "APPROVED", "REJECTED"], 
      default: "NONE" 
    },
    cancelRequestStatus: { 
      type: String, 
      enum: ["NONE", "PENDING", "APPROVED", "REJECTED"], 
      default: "NONE" 
    },
  },
  { timestamps: true }
);

// Compound unique index: same PI number allowed across branches, not within the same branch
purchaseInvoiceSchema.index({ branchId: 1, purchaseInvoiceId: 1 }, { unique: true });

export default mongoose.model("PurchaseInvoice", purchaseInvoiceSchema);
