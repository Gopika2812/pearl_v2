import mongoose from "mongoose";

const salesOrderSchema = new mongoose.Schema(
  {
    invoiceId: { type: String, required: true, unique: true },

    voucherType: { type: String, required: true }, // zone1
    orderType: { type: String, default: "SO" },

    warehouse: String,
    billingPerson: String,
    agent: String,

    customer: {
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: true,
      },

      name: String,
      whatsapp: String,
      address: String,
      district: String,
      state: String,
      pincode: String,
    },


    items: [
      {
        name: String,
        hsn: String,
        qty: Number,
        sellingPrice: Number,

        discountType: {
          type: String,
          enum: ["PERCENT", "AMOUNT"],
        },
        discountPercent: Number,
        discountAmount: Number,

        gst: Number,
        cgst: Number,
        sgst: Number,
        igst: Number,

        total: Number,
      },
    ],

    subtotal: Number,
    totalDiscount: Number,
    totalTax: Number,
    transportCharge: Number,
    grandTotal: Number,

    ewayEnabled: Boolean,
    ewayDetails: Object,

    financialYear: String,
  },
  { timestamps: true }
);

export default mongoose.model("SalesOrder", salesOrderSchema);
