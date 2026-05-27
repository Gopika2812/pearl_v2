import mongoose from "mongoose";

const PurchaseItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: String,
  productGroup: String,

  qty: Number,
  purchasePrice: Number,
  sellingPrice: Number,
  rowPrice: Number,
  discountPercent: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  taxableAmount: Number,
  rowTax: Number,

  hsn: String,

  gst: Number,
  cgst: Number,
  sgst: Number,
  igst: Number,
  unit: { type: String, default: "" },
  altQty: { type: Number, default: 0 },
  altUnit: { type: String, default: "" },
  total: Number,
});

const PurchaseOrderSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    invoiceId: {
      type: String,
      required: true,
      // NOTE: uniqueness enforced per-branch via compound index below
    },
    purchaseInvoiceId: { type: String },
    vendorBillNo: { type: String },
    vendorDate: { type: Date },

    voucherType: String,
    financialYear: String,

    vendor: String,
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    warehouse: String,

    items: [PurchaseItemSchema],

    subtotal: Number,
    totalTax: Number,
    extraExpenses: [
      {
        expenseName: String,
        amount: Number, // Legacy, kept for compatibility
        basePrice: Number, // New, matching PI/SO
        gst: Number, // Legacy
        gstPercent: { type: Number, default: 0 }, // New
        gstAmount: { type: Number, default: 0 }, // New
        totalPrice: Number,
      },
    ],
    extraExpenseAmount: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    grandTotal: Number,

    billingPerson: String,
    agent: String,

    status: {
      type: String,
      enum: ["DRAFT", "PLACED", "INVOICED", "CANCELLED"],
      default: "PLACED",
    },

    date: {
      type: Date,
      default: Date.now,
    },

    // EDIT HISTORY - stores a snapshot at each stage
    editHistory: [
      {
        version: Number,
        editType: {
          type: String,
          enum: ["CREATED", "PRE_INVOICE_EDIT", "INVOICED", "RE_EDIT_STARTED", "RE_INVOICED", "CANCELLED", "GENERAL_EDIT"],
        },
        items: [PurchaseItemSchema],
        subtotal: Number,
        totalTax: Number,
        totalDiscount: { type: Number, default: 0 },
        grandTotal: Number,
        editedAt: { type: Date, default: Date.now },
        editedBy: String,
        note: String, // e.g. "PI/001 updated", "Stock delta: +5"
      },
    ],

    // Snapshot of the items AT THE TIME OF LAST INVOICING
    // Used for delta calculation on re-invoice
    lastInvoicedItems: [PurchaseItemSchema],
    lastInvoicedGrandTotal: Number,

    // ADMIN REQUEST FIELDS (FOR INVOICED ORDERS)
    editRequestStatus: {
      type: String,
      enum: ["NONE", "PENDING", "APPROVED", "REJECTED"],
      default: "NONE",
    },
    editRequestBy: String,
    editRequestAt: Date,

    cancelRequestStatus: {
      type: String,
      enum: ["NONE", "PENDING", "APPROVED", "REJECTED"],
      default: "NONE",
    },
    cancelRequestBy: String,
    cancelRequestAt: Date,
  },
  { timestamps: true }
);

// Compound unique index: same invoiceId is allowed across branches, but not within the same branch
PurchaseOrderSchema.index({ branchId: 1, invoiceId: 1 }, { unique: true });
PurchaseOrderSchema.index({ createdAt: -1 });
PurchaseOrderSchema.index({ branchId: 1, createdAt: -1 });

export default mongoose.model("PurchaseOrder", PurchaseOrderSchema);
