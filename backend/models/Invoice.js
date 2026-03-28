import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    // Basic Info
    invoiceNumber: { type: String, required: true, unique: true },
    invoiceDate: { type: Date, default: Date.now },
    financialYear: String,

    // Reference to Sales Order
    salesOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: true,
    },

    // Branch & Warehouse
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    warehouse: String,
    billingPerson: String,
    deliveryPerson: String,

    // Customer Details
    customer: {
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
      },
      name: String,
      whatsapp: String,
      address: String,
      district: String,
      state: String,
      pincode: String,
    },

    // Seller Details
    seller: {
      name: String,
      address: String,
      state: String,
      pincode: String,
      gstin: String,
      phone: String,
      gpayNo: String,
      stateCode: String,
    },

    // Invoice Items (CONFIRMED QUANTITIES)
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        hsn: String,
        qty: Number, // CONFIRMED/BILLED QTY
        sellingPrice: Number,
        discountType: String,
        discountPercent: Number,
        discountAmount: Number,
        gst: Number,
        cgst: Number,
        sgst: Number,
        igst: Number,
        total: Number,
      },
    ],

    // Back Order Items (QUANTITIES NOT BILLED)
    backOrderItems: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        hsn: String,
        qty: Number, // BACK ORDER QTY
        sellingPrice: Number,
        gst: Number,
      },
    ],

    // Sample Items
    sampleItems: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        hsn: String,
        qty: Number,
        sellingPrice: Number,
      },
    ],

    // Totals
    subtotal: Number,
    totalDiscount: Number, // Sum of item discounts
    commonDiscount: { type: Number, default: 0 }, // Bill level discount
    totalTax: {
      cgst: Number,
      sgst: Number,
      igst: Number,
      total: Number,
    },
    transportCharge: Number,
    extraExpenses: [
      {
        expenseName: String,
        basePrice: Number,
        gstPercent: { type: Number, default: 0 },
        gstAmount: { type: Number, default: 0 },
        totalPrice: Number, // Inclusive of GST
      },
    ],
    extraExpenseAmount: { type: Number, default: 0 },
    grandTotal: Number,

    // Closing Balance
    openingBalance: Number,
    closingBalance: Number,
    balanceType: String, // "Dr" or "Cr"

    // Notes & Invoice Info
    invoiceNotes: String,
    invoiceType: {
      type: String,
      enum: ["ORDER_DETAILS", "TAX_INVOICE", "BACK_ORDER"],
      default: "ORDER_DETAILS",
    },

    // Status
    status: {
      type: String,
      enum: ["DRAFT", "FINALIZED", "PRINTED", "SENT"],
      default: "DRAFT",
    },

    // Generate Options
    generatedBy: String,
    printCount: { type: Number, default: 0 },
    whatsappSent: { type: Boolean, default: false },
    whatsappSentAt: Date,
    whatsappCount: { type: Number, default: 0 },

    // E-Invoice & E-Way Bill Details
    einvoiceStatus: {
      type: String,
      enum: ["NOT_GENERATED", "GENERATED", "CANCELLED", "FAILED"],
      default: "NOT_GENERATED",
    },
    irn: String,
    ackNo: String,
    ackDate: String,
    qrCodeUrl: String,
    signedInvoice: String,
    signedQrCode: String,
    
    ewayBillNo: String,
    ewayBillDate: String,
    ewayBillValidUntil: String,
  },
  { timestamps: true }
);

export default mongoose.model("Invoice", invoiceSchema);
