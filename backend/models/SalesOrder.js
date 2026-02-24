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

    subtotal: Number,
    totalDiscount: Number,
    totalTax: Number,
    transportCharge: Number,
    grandTotal: Number,
    customerMargin: Number,
    marginAmount: Number,
    grandTotalWithMargin: Number,

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

    invoiceNotes: {
      type: String,
      default: "",
    },

    backOrderSummary: {
      type: Array,
      default: [],
    },

  },
  { timestamps: true }
);

salesOrderSchema.post("deleteOne", { document: true }, async function(doc) {
  try {
    if (!doc) return;
    
    // Lazy load models to avoid circular dependencies
    const Commission = mongoose.model("Commission");
    const Customer = mongoose.model("Customer");
    const SalesOwner = mongoose.model("SalesOwner");
    const SalesMan = mongoose.model("SalesMan");
    const DeliveryMan = mongoose.model("DeliveryMan");
    
    const orderValue = doc.grandTotalWithMargin || doc.grandTotal || 0;
    const customerId = doc.customer?.customerId;
    
    console.log(`🗑️ Reverting sales order deletion: Invoice ${doc.invoiceId}`);
    
    // 1️⃣ REVERT CUSTOMER CLOSING BALANCE
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      const customer = await Customer.findById(customerId);
      if (customer) {
        const revertedBalance = customer.closingBalance - orderValue;
        await Customer.findByIdAndUpdate(customerId, {
          closingBalance: revertedBalance,
          totalBalance: revertedBalance,
        });
        console.log(`✅ Customer balance reverted: ₹${revertedBalance}`);
      }
    }
    
    // 2️⃣ REVERT COMMISSIONS FROM SALES PERSONNEL
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
    console.error("❌ Error in post-delete hook:", error.message);
  }
});

salesOrderSchema.post("findByIdAndDelete", async function(doc) {
  try {
    if (!doc) return;
    
    // Lazy load models
    const Commission = mongoose.model("Commission");
    const Customer = mongoose.model("Customer");
    const SalesOwner = mongoose.model("SalesOwner");
    const SalesMan = mongoose.model("SalesMan");
    const DeliveryMan = mongoose.model("DeliveryMan");
    
    const orderValue = doc.grandTotalWithMargin || doc.grandTotal || 0;
    const customerId = doc.customer?.customerId;
    
    console.log(`🗑️ Reverting sales order deletion: Invoice ${doc.invoiceId}`);
    
    // 1️⃣ REVERT CUSTOMER CLOSING BALANCE
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      const customer = await Customer.findById(customerId);
      if (customer) {
        const revertedBalance = customer.closingBalance - orderValue;
        await Customer.findByIdAndUpdate(customerId, {
          closingBalance: revertedBalance,
          totalBalance: revertedBalance,
        });
        console.log(`✅ Customer balance reverted: ₹${revertedBalance}`);
      }
    }
    
    // 2️⃣ REVERT COMMISSIONS FROM SALES PERSONNEL
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
    console.error("❌ Error in findByIdAndDelete post-hook:", error.message);
  }
});

export default mongoose.model("SalesOrder", salesOrderSchema);
