import mongoose from "mongoose";

const deliveryReceiptSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    receiptId: {
      type: String, // e.g., DR-20260425-001
      required: true,
      unique: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    deliveryPerson: {
      type: String, 
      required: true,
    },
    collections: [
      {
        customer: {
          customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
          name: String,
        },
        amount: { type: Number, default: 0 },
        paymentMode: { type: String, enum: ["CASH", "UPI"], default: "CASH" },
      }
    ],
    expenses: [
      {
        amount: { type: Number, default: 0 },
        note: { type: String, default: "" },
      }
    ],
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
      default: 0,
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("DeliveryReceipt", deliveryReceiptSchema);
