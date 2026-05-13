import mongoose from "mongoose";

const spottedCustomerLedgerSchema = new mongoose.Schema(
  {
    salesInvoiceNumber: { type: String, required: true },
    name: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    billInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: true,
    },
    grandTotal: { type: Number, required: true },
    cashAmount: { type: Number, default: 0 },
    upiAmount: { type: Number, default: 0 },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    collectedByUsername: { type: String },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    dateTime: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

spottedCustomerLedgerSchema.index({ branchId: 1, dateTime: -1 });
spottedCustomerLedgerSchema.index({ salesInvoiceNumber: 1 });

export default mongoose.model("SpottedCustomerLedger", spottedCustomerLedgerSchema);
