import mongoose from "mongoose";

const bankTransferSchema = new mongoose.Schema(
  {
    transferId: {
      type: String, // e.g., BT-TS-001-0001
      required: true,
      unique: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    receiptIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryReceipt",
    }],
    receiptNumbers: [String], // e.g., ["DR-TS-001-0008", "DR-TS-001-0009"]
    bankName: {
      type: String,
      enum: ["ICICI Bank", "State Bank"],
      required: true,
    },
    totalCollected: {
      type: Number,
      default: 0,
    },
    totalExpense: {
      type: Number,
      default: 0,
    },
    netAmount: {
      type: Number,
      default: 0, // auto-computed: totalCollected - totalExpense
    },
    totalTransferred: {
      type: Number,
      required: true, // user-entered: actual amount deposited to bank
    },
    transferredBy: {
      type: String,
      required: true,
    },
    transferredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("BankTransfer", bankTransferSchema);
