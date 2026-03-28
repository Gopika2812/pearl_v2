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

  hsn: String,

  gst: Number,
  cgst: Number,
  sgst: Number,
  igst: Boolean,

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
      unique: true,
    },

    voucherType: String,
    financialYear: String,

    vendor: String,
    warehouse: String,

    items: [PurchaseItemSchema],

    subtotal: Number,
    totalTax: Number,
    extraExpenses: [
      {
        expenseName: String,
        amount: Number,
        gst: Number,
        totalPrice: Number,
      },
    ],
    extraExpenseAmount: { type: Number, default: 0 },
    grandTotal: Number,

    billingPerson: String,
    agent: String,

    status: {
      type: String,
      enum: ["DRAFT", "PLACED", "INVOICED"],
      default: "PLACED",
    },

    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);
export default mongoose.model("PurchaseOrder", PurchaseOrderSchema);
