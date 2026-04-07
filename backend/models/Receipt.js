import mongoose from "mongoose";

const receiptSchema = new mongoose.Schema(
  {
    receiptId: { type: String, required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: false },

    // Reference to original sales order (Optional for general debit receipts)
    originalSalesOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: false,
    },
    originalInvoiceId: { type: String, required: false },

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
      enum: ["CASH", "CHEQUE", "BANK_TRANSFER", "UPI", "CREDIT_CARD", "DEBIT_CARD", "OTHER", "BOUNCED"],
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

    // Financial Year
    financialYear: String,
  },
  { timestamps: true }
);

// Create composite unique index: branchId + receiptId (Allows duplicates across branches, global uniqueness for (branch + ID))
receiptSchema.index({ branchId: 1, receiptId: 1 }, { unique: true });

const Receipt = mongoose.model("Receipt", receiptSchema);
export default Receipt;
