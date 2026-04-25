import mongoose from "mongoose";

const receiptSchema = new mongoose.Schema(
  {
    receiptId: { type: String, required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: false },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "BranchUser", required: false },

    // Reference to original sales order (Optional for general debit receipts)
    // For multiple bills, we use relatedOrders array
    originalSalesOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: false,
    },
    originalInvoiceId: { type: String, required: false },

    // 🔥 NEW: For single receipt covering multiple bills
    relatedOrders: [
      {
        salesOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesOrder" },
        invoiceId: String,
        amount: Number,
      }
    ],

    // Customer Info
    customer: {
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: true,
      },
      name: String,
    },

    // Payment Details
    amount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "CHEQUE", "BANK_TRANSFER", "UPI", "CREDIT_CARD", "DEBIT_CARD", "OTHER", "BOUNCED", "CREDIT"],
      default: "CASH",
    },
    reference: String, // Cheque number, transaction ID, etc.
    notes: String,

    // Status
    status: {
      type: String,
      enum: ["confirmed", "cancelled", "bounced"],
      default: "confirmed",
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BranchUser",
      required: false,
    },
    cancelReason: {
      type: String,
      required: false,
    },

    // Financial Year
    financialYear: String,
  },
  { timestamps: true }
);

// Create composite unique index: branchId + receiptId (Allows duplicates across branches, global uniqueness for (branch + ID))
receiptSchema.index({ branchId: 1, receiptId: 1 }, { unique: true });

// ⚡ PERFORMANCE INDEXES
receiptSchema.index({ branchId: 1, createdAt: -1 });
receiptSchema.index({ originalSalesOrderId: 1, status: 1 });
receiptSchema.index({ "customer.customerId": 1, createdAt: -1 });

const Receipt = mongoose.model("Receipt", receiptSchema);
export default Receipt;
