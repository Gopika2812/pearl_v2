import mongoose from "mongoose";

const OtherTransactionSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ["PAYMENT", "RECEIPT"],
      required: true,
    },
    ledgerGroup: {
      type: String,
      required: true,
      enum: [
        "Fixed Assets",
        "Current Assets",
        "Indirect Expenses",
        "Direct Expenses",
        "Loans & Liabilities",
        "Capital Account",
      ],
    },
    ledgerName: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    gst: {
      type: Number,
      default: 0,
    },
    note: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BranchUser",
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Search index
OtherTransactionSchema.index({ branchId: 1, type: 1, date: -1 });

const OtherTransaction = mongoose.model("OtherTransaction", OtherTransactionSchema);
export default OtherTransaction;
