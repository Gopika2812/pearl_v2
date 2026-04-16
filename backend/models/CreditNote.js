import mongoose from "mongoose";

const creditNoteSchema = new mongoose.Schema(
  {
    creditNoteId: { type: String, required: true },
    
    // Reference to original sales order
    originalSalesOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: false, // Changed from true to allow standalone/migrated returns
    },
    originalInvoiceId: String,
    
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    
    // Customer Info
    customer: {
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: true,
      },
      name: String,
      address: String,
      district: String,
      state: String,
      stateCode: String,
      pincode: String,
      gstin: String,
      closingBalance: Number,
    },
    
    // Seller Details
    seller: {
      name: String,
      address: String,
      state: String,
      pincode: String,
      gstin: String,
      phone: String,
      stateCode: String,
    },
    
    // Returned Items
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: String,
        hsn: String,
        unit: String,
        qty: Number,
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
    
    // Financial Details
    subtotal: Number,
    totalDiscount: Number,
    totalTax: Number,
    grandTotal: Number,
    
    // Sales Personnel (same as original order)
    salesOwner: String,
    salesOwnerId: mongoose.Schema.Types.ObjectId,
    salesMan: mongoose.Schema.Types.ObjectId,
    deliveryMan: mongoose.Schema.Types.ObjectId,
    
    // Financial Year
    financialYear: String,
    
    // Reason for return
    reasonForReturn: String,
    
    // Status
    status: {
      type: String,
      enum: ["Created", "Cancelled"],
      default: "Created",
    },
    date: {
      type: Date,
      default: Date.now,
    },

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

    // PDF URLs from GSTZen
    invoicePdfUrl: String,
    ewayBillPdfUrl: String,
    signedQrCodeImgUrl: String,

    // Transport Details for E-Way Bill
    transportMode: { type: String, default: "1" },
    transportDistance: { type: Number, default: 0 },
    vehicleNo: { type: String, default: "" },
    vehicleType: { type: String, enum: ["REGULAR", "OVERSIZED"], default: "REGULAR" },
    transporterId: { type: String, default: "" },
    transporterName: { type: String, default: "" },
  },
  { timestamps: true }
);

// Branch-specific uniqueness for Credit Note IDs
creditNoteSchema.index({ branchId: 1, creditNoteId: 1 }, { unique: true });


// POST-DELETE HOOK: Reverse the credit note impact
creditNoteSchema.post("findByIdAndDelete", async function(doc) {
  try {
    if (!doc) return;
    
    // Lazy load models
    const Commission = mongoose.model("Commission");
    const Customer = mongoose.model("Customer");
    const SalesOwner = mongoose.model("SalesOwner");
    const SalesMan = mongoose.model("SalesMan");
    const DeliveryMan = mongoose.model("DeliveryMan");
    const Product = mongoose.model("Product");
    
    console.log(`🔄 Reversing credit note: ${doc.creditNoteId}`);
    
    // 1️⃣ RESTORE PRODUCTS TO INVENTORY (undo the return)
    for (const item of doc.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { totalQty: -item.qty } // Remove from stock since we're cancelling the return
      });
    }
    
    // 2️⃣ RESTORE CUSTOMER BALANCE (undo the balance reduction)
    const customerId = doc.customer?.customerId;
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      const customer = await Customer.findById(customerId);
      if (customer) {
        const restoredBalance = customer.closingBalance + doc.grandTotal;
        await Customer.findByIdAndUpdate(customerId, {
          closingBalance: restoredBalance,
          totalBalance: restoredBalance,
        });
        console.log(`✅ Customer balance restored: ₹${restoredBalance}`);
      }
    }
    
    // 3️⃣ RESTORE COMMISSIONS (undo the commission reduction)
    const commission = await Commission.findOne({ salesOrderId: doc.originalSalesOrderId });
    if (commission) {
      if (doc.salesOwnerId && commission.salesOwnerCommissionAmount > commission.salesOwnerCommissionAmount) {
        await SalesOwner.findByIdAndUpdate(doc.salesOwnerId, {
          $inc: { commissionAmount: commission.salesOwnerCommissionAmount }
        });
        console.log(`✅ Sales Owner commission restored`);
      }
      if (doc.salesMan && commission.salesManCommissionAmount > 0) {
        await SalesMan.findByIdAndUpdate(doc.salesMan, {
          $inc: { commissionAmount: commission.salesManCommissionAmount }
        });
        console.log(`✅ Sales Man commission restored`);
      }
      if (doc.deliveryMan && commission.deliveryManCommissionAmount > 0) {
        await DeliveryMan.findByIdAndUpdate(doc.deliveryMan, {
          $inc: { commissionAmount: commission.deliveryManCommissionAmount }
        });
        console.log(`✅ Delivery Man commission restored`);
      }
    }
    
  } catch (error) {
    console.error("❌ Error in credit note delete hook:", error.message);
  }
});

export default mongoose.model("CreditNote", creditNoteSchema);
