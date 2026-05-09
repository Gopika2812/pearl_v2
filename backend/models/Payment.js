import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },

    // Payment Type: vendor, expense, or loan
    paymentType: {
      type: String,
      enum: ["vendor_payment", "expense", "loan_payment"],
      required: true,
    },

    // For Vendor Payments
    vendor: {
      vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
      },
      name: String,
    },

    // Reference to PO (optional, for PO-linked vendor payments)
    purchaseOrder: {
      poId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PurchaseOrder",
      },
      invoiceId: String,
    },

    // For Loan Payments
    loanDetails: {
      bankName: String,
      loanAmount: Number,
      loanDate: Date,
    },

    // For Expense Payments
    expenseDetails: {
      type: {
        type: String,
        enum: ["salary", "rent", "electricity", "other"],
      },
      description: String,
      personName: String, // For salary payments
    },

    // Payment Info
    amount: {
      type: Number,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "check", "bank_transfer", "credit", "other"],
      required: true,
    },

    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    referenceNo: String, // Check number, bank reference, etc.

    // Description/Notes
    description: String,

    billingPerson: String,

    // Status
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "returned"],
      default: "completed",
    },

    isReturned: {
      type: Boolean,
      default: false
    },
    returnDate: Date,
    returnNarration: String,
    returnBank: {
      type: String,
      enum: ["ICICI", "STATE_BANK", "CASH", "OTHER"]
    },

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

// Performance Indexes
paymentSchema.index({ branchId: 1, paymentId: 1 }, { unique: true });
paymentSchema.index({ branchId: 1, paymentDate: -1 });
paymentSchema.index({ "vendor.vendorId": 1, paymentDate: -1 });

export default mongoose.model("Payment", paymentSchema);
