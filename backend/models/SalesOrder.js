import mongoose from "mongoose";

const salesOrderSchema = new mongoose.Schema(
  {
    invoiceId: { type: String, required: true }, // unique index handled per-branch

    voucherType: { type: String, required: true }, // zone1
    orderType: { type: String, default: "SO" },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

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
      stateCode: String, // ✨ NEW: State code for E-Invoice (33=TN, 32=KA, etc.)
      pincode: String,
      gstin: String, // ✨ NEW: Customer GSTIN for E-Invoice
      customerGroup: String, // ✨ NEW: Group name (e.g. Platinum, Gold, Local)
    },


    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: String,
        hsn: String,
        qty: Number,
        unit: { type: String, default: "" },
        altQty: { type: Number, default: 0 },
        altUnit: { type: String, default: "" },
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
        isNegativeStockBilled: { type: Boolean, default: false },
        originalQty: { type: Number, default: 0 },
        confirmedQty: { type: Number, default: 0 },
        backOrderQty: { type: Number, default: 0 }
      },
    ],

    sampleItems: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: String,
        hsn: String,
        qty: Number,
        unit: { type: String, default: "" },
        altQty: { type: Number, default: 0 },
        altUnit: { type: String, default: "" },
        sellingPrice: Number,
        isSample: {
          type: Boolean,
          default: true,
        },
      },
    ],

    // Invoice items (edited items for the actual invoice)
    invoiceItems: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: String,
        hsn: String,
        qty: Number,
        unit: { type: String, default: "" },
        altQty: { type: Number, default: 0 },
        altUnit: { type: String, default: "" },
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
        originalQty: { type: Number, default: 0 },
        confirmedQty: { type: Number, default: 0 },
        backOrderQty: { type: Number, default: 0 }
      },
    ],

    // Invoice sample items
    invoiceSampleItems: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: String,
        hsn: String,
        qty: Number,
        unit: { type: String, default: "" },
        altQty: { type: Number, default: 0 },
        altUnit: { type: String, default: "" },
        sellingPrice: Number,
        isSample: {
          type: Boolean,
          default: true,
        },
      },
    ],

    // Invoice totals (when items are edited)
    invoiceSubtotal: Number,
    invoiceTotalDiscount: Number,
    invoiceTotalTax: Number,
    invoiceTransportCharge: Number,
    invoiceCommonDiscount: { type: Number, default: 0 },
    invoiceGrandTotal: Number,

    // Invoice balance (opening and closing balance when invoice is confirmed)
    invoiceOpeningBalance: Number,
    invoiceClosingBalance: Number,

    subtotal: Number,
    totalDiscount: Number, // Deprecated or kept for sum of item discounts
    commonDiscount: { type: Number, default: 0 },
    totalTax: Number,
    transportCharge: Number,
    transportGstPercent: { type: Number, default: 0 },
    transportGstAmount: { type: Number, default: 0 },
    grandTotal: Number,
    customerMargin: Number,
    marginAmount: Number,
    grandTotalWithMargin: Number,
    roundOff: { type: Number, default: 0 },

    // Extra Expenses for Sales Order
    extraExpenses: [
      {
        expenseName: String,
        basePrice: Number,
        gstPercent: { type: Number, default: 0 },
        gstAmount: { type: Number, default: 0 },
        totalPrice: Number, // Inclusive of GST
      },
    ],
    extraExpenseAmount: {
      type: Number,
      default: 0, // Total of all extra expenses
    },

    ewayEnabled: Boolean,
    ewayDetails: Object,

    salesOwner: String,
    salesMan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesMan",
    },
    deliveryMan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryMan",
    },

    financialYear: String,
    openingBalance: {
      type: Number,
      required: true,
    },

    closingBalance: {
      type: Number,
      required: true,
    },

    balanceType: {
      type: String,
      enum: ["Dr", "Cr"],
      default: "Dr",
    },

    invoiceGenerated: {
      type: Boolean,
      default: false,
    },

    recordType: {
      type: String,
      enum: ["SALES ORDER", "SALES INVOICE"],
      default: "SALES ORDER",
    },

    status: {
      type: String,
      enum: ["DRAFT", "PLACED", "INVOICED", "CANCELLED"],
      default: "PLACED",
    },

    // DELTA & HISTORY TRACKING
    lastInvoicedItems: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        hsn: String,
        qty: Number,
        unit: { type: String, default: "" },
        altQty: { type: Number, default: 0 },
        altUnit: { type: String, default: "" },
        sellingPrice: Number,
        discountType: { type: String, default: "PERCENT" },
        discountPercent: { type: Number, default: 0 },
        discountAmount: { type: Number, default: 0 },
        gst: { type: Number, default: 0 },
        cgst: { type: Number, default: 0 },
        sgst: { type: Number, default: 0 },
        igst: { type: Number, default: 0 },
        total: Number,
        originalQty: { type: Number, default: 0 },
        confirmedQty: { type: Number, default: 0 },
        backOrderQty: { type: Number, default: 0 }
      },
    ],
    lastInvoicedGrandTotal: Number,
    lastInvoicedCustomerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },

    editHistory: [
      {
        version: Number,
        editType: {
          type: String,
          enum: ["CREATED", "PRE_INVOICE_EDIT", "INVOICED", "RE_EDIT_STARTED", "RE_INVOICED", "CANCELLED", "GENERAL_EDIT", "INVOICE_CANCELLED"],
        },
        items: Array,
        subtotal: Number,
        totalTax: Object,
        grandTotal: Number,
        editedAt: { type: Date, default: Date.now },
        editedBy: String, // ✨ NEW: Track who made this edit
        note: String,
      },
    ],

    isClaim: {
      type: Boolean,
      default: false,
    },

    // RE-EDIT REQUEST FIELDS
    reEditRequestStatus: {
      type: String,
      enum: ["NONE", "PENDING", "APPROVED", "REJECTED"],
      default: "NONE",
    },
    reEditRequestBy: String,
    reEditRequestAt: Date,

    // CANCEL REQUEST FIELDS
    cancelRequestStatus: {
      type: String,
      enum: ["NONE", "PENDING", "APPROVED", "REJECTED"],
      default: "NONE",
    },
    cancelRequestBy: String,
    cancelRequestAt: Date,

    isReEdited: {
      type: Boolean,
      default: false, // Flag for labeling as "RE-EDIT ORIGINAL"
    },
    
    salesInvoiceId: { type: String }, // Links to separate Invoice document (SI/xxx)
    printCount: { type: Number, default: 0 }, // Tracks number of times the invoice was printed
    orderDate: { type: Date, default: Date.now },

    spottedCustomerName: String,
    spottedPhoneNumber: String,
  },
  { timestamps: true }
);

// Performance Indexes
salesOrderSchema.index({ branchId: 1, createdAt: -1 });
salesOrderSchema.index({ branchId: 1, orderDate: -1 });
salesOrderSchema.index({ branchId: 1, "customer.customerId": 1 });
salesOrderSchema.index({ status: 1, branchId: 1 });
salesOrderSchema.index({ invoiceId: 1, branchId: 1 });

/**
 * Helper function to revert all financial and inventory impacts when a Sales Order is deleted
 */
async function revertOrderEffects(doc) {
  try {
    if (!doc) return;
    
    // Lazy load models to avoid circular dependencies
    const Customer = mongoose.model("Customer");
    const Commission = mongoose.model("Commission");
    const SalesOwner = mongoose.model("SalesOwner");
    const SalesMan = mongoose.model("SalesMan");
    const DeliveryMan = mongoose.model("DeliveryMan");
    const Product = mongoose.model("Product");
    
    const orderValue = doc.grandTotalWithMargin || doc.grandTotal || 0;
    const customerId = doc.customer?.customerId;
    
    console.log(`🗑️ Reverting sales order effects: Invoice ${doc.invoiceId}`);
    
    // 1️⃣ REVERT CUSTOMER BALANCE (Debit and Closing Balance)
    const targetCustomerId = doc.lastInvoicedCustomerId || doc.customer?.customerId;
    if (targetCustomerId && mongoose.Types.ObjectId.isValid(targetCustomerId)) {
      const customer = await Customer.findById(targetCustomerId);
      if (customer) {
        // We MUST revert the exact amount that was last applied to the ledger
        const amountToRevert = doc.lastInvoicedGrandTotal || doc.invoiceGrandTotal || 0;
        
        if (amountToRevert > 0) {
          let remainingToRevert = amountToRevert;
          let newDebit = customer.debit || 0;
          let newCredit = customer.credit || 0;

          if (newDebit >= remainingToRevert) {
            newDebit -= remainingToRevert;
          } else {
            remainingToRevert -= newDebit;
            newDebit = 0;
            newCredit += remainingToRevert;
          }

          await Customer.findByIdAndUpdate(targetCustomerId, {
            debit: Math.round(newDebit),
            credit: Math.round(newCredit),
            $inc: { closingBalance: -amountToRevert, totalBalance: -amountToRevert },
          });
          console.log(`✅ Customer ${customer.name} balance reverted: -₹${amountToRevert}.`);
        }
      }
    }
    
    // 2️⃣ RESTORE PRODUCT STOCK (Only if invoice was generated)
    if (doc.invoiceGenerated) {
      console.log("📦 Restoring product stock...");
      const itemsToRestore = (doc.invoiceItems && doc.invoiceItems.length > 0) ? doc.invoiceItems : doc.items;
      const samplesToRestore = (doc.invoiceSampleItems && doc.invoiceSampleItems.length > 0) ? doc.invoiceSampleItems : doc.sampleItems;
      
      const allItems = [...(itemsToRestore || []), ...(samplesToRestore || [])];
      
      for (const item of allItems) {
        if (item.productId && item.qty > 0) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { totalQty: item.qty }
          });
          console.log(`✅ Stock restored for ${item.name || 'Product'}: +${item.qty}`);
        }
      }
    }
    
    // 3️⃣ REVERT COMMISSIONS
    const commission = await Commission.findOne({ salesOrderId: doc._id });
    if (commission) {
      // Revert Sales Owner Commission
      if (commission.salesOwnerId && commission.salesOwnerCommissionAmount > 0) {
        await SalesOwner.findByIdAndUpdate(commission.salesOwnerId, {
          $inc: { commissionAmount: -commission.salesOwnerCommissionAmount }
        });
        console.log(`✅ Sales Owner commission reverted: -₹${commission.salesOwnerCommissionAmount}`);
      }
      
      // Revert Sales Man Commission
      if (commission.salesManId && commission.salesManCommissionAmount > 0) {
        await SalesMan.findByIdAndUpdate(commission.salesManId, {
          $inc: { commissionAmount: -commission.salesManCommissionAmount }
        });
        console.log(`✅ Sales Man commission reverted: -₹${commission.salesManCommissionAmount}`);
      }
      
      // Revert Delivery Man Commission
      if (commission.deliveryManId && commission.deliveryManCommissionAmount > 0) {
        await DeliveryMan.findByIdAndUpdate(commission.deliveryManId, {
          $inc: { commissionAmount: -commission.deliveryManCommissionAmount }
        });
        console.log(`✅ Delivery Man commission reverted: -₹${commission.deliveryManCommissionAmount}`);
      }
      
      // Delete Commission Record
      await Commission.deleteOne({ salesOrderId: doc._id });
      console.log(`✅ Commission record deleted`);
    }
    
  } catch (error) {
    console.error("❌ Error reverting order effects:", error.message);
  }
}

salesOrderSchema.post("deleteOne", { document: true }, async function(doc) {
  await revertOrderEffects(doc);
});

salesOrderSchema.post("findOneAndDelete", async function(doc) {
  await revertOrderEffects(doc);
});

salesOrderSchema.post("findByIdAndDelete", async function(doc) {
  await revertOrderEffects(doc);
});

// Compound unique index: same Invoice number allowed across branches, not within the same branch
salesOrderSchema.index({ branchId: 1, invoiceId: 1 }, { unique: true });

export default mongoose.model("SalesOrder", salesOrderSchema);
