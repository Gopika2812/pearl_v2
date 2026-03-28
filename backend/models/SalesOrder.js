import mongoose from "mongoose";

const salesOrderSchema = new mongoose.Schema(
  {
    invoiceId: { type: String, required: true, unique: true },

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
      pincode: String,
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
        isNegativeStockBilled: { type: Boolean, default: false }
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
    invoiceGrandTotal: Number,

    // Invoice balance (opening and closing balance when invoice is confirmed)
    invoiceOpeningBalance: Number,
    invoiceClosingBalance: Number,

    subtotal: Number,
    totalDiscount: Number, // Deprecated or kept for sum of item discounts
    commonDiscount: { type: Number, default: 0 },
    totalTax: Number,
    transportCharge: Number,
    grandTotal: Number,
    customerMargin: Number,
    marginAmount: Number,
    grandTotalWithMargin: Number,

    // Extra Expenses for Sales Order
    extraExpenses: [
      {
        expenseName: String,
        totalPrice: Number, // Flat amount
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
    isReEdited: {
      type: Boolean,
      default: false, // Flag for labeling as "RE-EDIT ORIGINAL"
    },

  },
  { timestamps: true }
);

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
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      const customer = await Customer.findById(customerId);
      if (customer) {
        // If invoice was generated, we must revert both debit and closingBalance
        // In this system, they are kept equal for invoiced orders
        const amountToRevert = doc.invoiceGrandTotal || orderValue;
        const newBalance = Math.round((customer.closingBalance || 0) - amountToRevert);
        
        await Customer.findByIdAndUpdate(customerId, {
          debit: newBalance,
          closingBalance: newBalance,
          totalBalance: newBalance,
        });
        console.log(`✅ Customer ${customer.name} balance reverted: -₹${amountToRevert}. New: ₹${newBalance}`);
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

export default mongoose.model("SalesOrder", salesOrderSchema);
