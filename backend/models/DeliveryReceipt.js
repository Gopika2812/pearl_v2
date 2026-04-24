import mongoose from "mongoose";

const deliveryReceiptSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    deliveryPerson: {
      type: String, // Can be name or ObjectId string
      required: true,
    },
    customer: {
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
      },
      name: String,
    },
    collectedAmount: {
      type: Number,
      default: 0,
    },
    expenseAmount: {
      type: Number,
      default: 0,
    },
    expenseNote: {
      type: String,
      default: "",
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
