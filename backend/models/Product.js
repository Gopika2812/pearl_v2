import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    productGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductGroup",
      required: false,
      default: null,
    },
    productCategories: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "ProductCategory",
      default: [],
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: false,
      default: null,
    },
    name: { type: String, required: true },
    perQty: { type: Number, required: true },
    units: { type: String, required: true },
    totalQty: { type: Number, default: 0 },
    totalQtyUnit: { type: String, default: "" }, // Unit for total quantity
    purchasingPrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    lockedPrice: { type: Number, default: 0 },
    mrp: { type: Number, default: 0 }, // Maximum Retail Price
    margin: { type: Number, default: 0 },
    marginPercentage: { type: Number, default: 0 }, // Margin as percentage for group calculations
    hsnCode: {
      type: String,
      required: true,
      trim: true
    },
    hsn: { type: String, default: "" }, // Alias for hsnCode
    gst: { type: Number, default: 0 },
    adminMargin: { type: Number, default: 0 }, // Additional margin for Sales Order override
    image: { type: String, default: null }, // Product image URL
    reorderLevel: { type: Number, default: 10 }, // Alert threshold for reordering
    reorderQty: { type: Number, default: 20 }, // Quantity to order when threshold reached
    leadTime: { type: Number, default: 7 }, // Days to receive the order
    checkPeriod: { type: String, default: "MONTHLY" }, // How often to check stock (DAILY, WEEKLY, MONTHLY, QUARTERLY)
    lastChecked: { type: Date, default: null }, // Last time stock was reviewed
    nextCheckDate: { type: Date, default: null }, // Next scheduled check date

    // Restocking Configuration
    preferredVendor: { type: String, default: "" }, // Vendor name to auto-order from
    minStockQty: { type: Number, default: 10 }, // Minimum stock to maintain
    maxStockQty: { type: Number, default: 50 }, // Maximum stock quantity
    restockingDays: {
      type: [String],
      enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
      default: [],
    }, // Days when restocking is done

    // Smart Restocking Configuration based on sales analytics
    restockingConfig: {
      salesPeriodDays: { type: Number, default: 7 }, // Number of days to analyze sales
      sellingQtyInPeriod: { type: Number, default: 0 }, // Auto-calculated: qty sold in period
      threshold: { type: Number, default: null }, // Manual override for reorder threshold
      restockingQty: { type: Number, default: null }, // Manual override for restocking quantity
    },
    // Unit Conversion Configuration
    unitConversion: {
      value: { type: Number, default: 1 },
      unit: { type: String, default: "" },
      altValue: { type: Number, default: 1 },
      altUnit: { type: String, default: "" }
    },

    // 📅 Snapshot / Audit tracking
    openingQty: { type: Number, default: 0 },
    manualOpeningDate: { type: Date, default: null },

    // 📈 Price History Timeline
    priceHistory: [{
      oldPurchasingPrice: Number,
      newPurchasingPrice: Number,
      oldSellingPrice: Number,
      newSellingPrice: Number,
      effectiveDate: { type: Date, default: Date.now },
      sourceVoucher: String, // PI Number
      type: { type: String, enum: ['INCREASE', 'DECREASE', 'INITIAL'] },
      note: String
    }]
  },
  { timestamps: true }
);

// Auto-calculate margin before saving
productSchema.pre("save", function () {
  const isNew = this.isNew;
  const pPriceChanged = this.isModified("purchasingPrice");
  const sPriceChanged = this.isModified("sellingPrice");
  const marginChanged = this.isModified("margin");
  const marginPctChanged = this.isModified("marginPercentage");

  // PRIORITY 1: Explicit Marginal Percentage Change
  if (marginPctChanged && this.marginPercentage > 0) {
    this.marginPercentage = Math.round(this.marginPercentage * 100) / 100;
    this.sellingPrice = Math.round(((this.purchasingPrice || 0) + ((this.purchasingPrice || 0) * this.marginPercentage / 100)) * 100) / 100;
    this.margin = Math.round((this.sellingPrice - (this.purchasingPrice || 0)) * 100) / 100;
  }
  // PRIORITY 2: Explicit Margin Amount Change
  else if (marginChanged) {
    this.margin = Math.round(this.margin * 100) / 100;
    this.sellingPrice = Math.round(((this.purchasingPrice || 0) + this.margin) * 100) / 100;
    if (this.purchasingPrice > 0) {
      this.marginPercentage = Math.round((this.margin / this.purchasingPrice) * 100 * 100) / 100;
    }
  }
  // PRIORITY 3: Only Purchasing Price changed (Maintain Absolute Margin Amount)
  else if (!isNew && pPriceChanged && !sPriceChanged) {
    // If we have an existing margin, maintain it
    if (this.margin !== undefined && this.margin !== null) {
      this.sellingPrice = Math.round(((this.purchasingPrice || 0) + this.margin) * 100) / 100;
      if (this.purchasingPrice > 0) {
        this.marginPercentage = Math.round((this.margin / this.purchasingPrice) * 100 * 100) / 100;
      }
      console.log(`🛡️ Product Sync: [${this.name}] cost updated. Maintained ₹${this.margin} margin. New sellingPrice: ₹${this.sellingPrice}`);
    } else {
      // Fallback
      this.margin = Math.round(((this.sellingPrice || 0) - (this.purchasingPrice || 0)) * 100) / 100;
      if (this.purchasingPrice > 0) {
        this.marginPercentage = Math.round((this.margin / this.purchasingPrice) * 100 * 100) / 100;
      }
    }
  }
  // PRIORITY 4: Only Selling Price changed (Recalculate Margin)
  else if (sPriceChanged && !pPriceChanged) {
    this.margin = Math.round(((this.sellingPrice || 0) - (this.purchasingPrice || 0)) * 100) / 100;
    if (this.purchasingPrice > 0) {
      this.marginPercentage = Math.round((this.margin / this.purchasingPrice) * 100 * 100) / 100;
    }
  }
  // DEFAULT: Sync values
  else {
    this.margin = Math.round(((this.sellingPrice || 0) - (this.purchasingPrice || 0)) * 100) / 100;
    if (this.purchasingPrice > 0) {
      this.marginPercentage = Math.round((this.margin / this.purchasingPrice) * 100 * 100) / 100;
    }
  }

  // Set hsn as alias for hsnCode
  if (!this.hsn && this.hsnCode) {
    this.hsn = this.hsnCode;
  }
});

// Create composite unique index: branchId + name
productSchema.index({ branchId: 1, name: 1 }, { unique: true });

// Performance Indexes
productSchema.index({ branchId: 1, productGroup: 1 });
productSchema.index({ branchId: 1, productCategories: 1 });
productSchema.index({ branchId: 1, totalQty: -1 });

// Auto-calculate margin on update operations
productSchema.pre(["findOneAndUpdate", "findByIdAndUpdate"], async function () {
  const update = this.getUpdate();
  const filter = this.getFilter();

  const pUpdated = update.purchasingPrice !== undefined;
  const sUpdated = update.sellingPrice !== undefined;
  const mUpdated = update.margin !== undefined;
  const mpUpdated = update.marginPercentage !== undefined;

  // PRIORITY 1: Explicit Margin Update (Percentage or Amount)
  if (mpUpdated && update.marginPercentage > 0) {
    update.marginPercentage = Math.round(update.marginPercentage * 100) / 100;
    const pPrice = pUpdated ? update.purchasingPrice : (await this.model.findById(filter._id))?.purchasingPrice || 0;
    update.sellingPrice = Math.round((pPrice + (pPrice * update.marginPercentage / 100)) * 100) / 100;
    update.margin = Math.round((update.sellingPrice - pPrice) * 100) / 100;
  }
  else if (mUpdated) {
    update.margin = Math.round(update.margin * 100) / 100;
    const pPrice = pUpdated ? update.purchasingPrice : (await this.model.findById(filter._id))?.purchasingPrice || 0;
    update.sellingPrice = Math.round((pPrice + update.margin) * 100) / 100;
    if (pPrice > 0) {
      update.marginPercentage = Math.round((update.margin / pPrice) * 100 * 100) / 100;
    }
  }
  // PRIORITY 2: Only Purchase Price updated (Maintain Absolute Margin Amount)
  else if (pUpdated && !sUpdated) {
    try {
      const current = await this.model.findById(filter._id);
      if (current && current.margin !== undefined) {
        const targetMargin = current.margin;
        update.sellingPrice = Math.round((update.purchasingPrice + targetMargin) * 100) / 100;
        update.margin = targetMargin;
        if (update.purchasingPrice > 0) {
          update.marginPercentage = Math.round((targetMargin / update.purchasingPrice) * 100 * 100) / 100;
        }
        console.log(`🛡️ Product Sync (Update): [${current.name}] P: ₹${update.purchasingPrice}, New S: ₹${update.sellingPrice} (Keep M: ₹${targetMargin})`);
      }
    } catch (err) {
      console.warn("Pricing Sync Error:", err.message);
    }
  }
  // PRIORITY 3: Only Selling Price updated (Recalculate Margin)
  else if (sUpdated && !pUpdated) {
    try {
      const current = await this.model.findById(filter._id);
      const pPrice = current?.purchasingPrice || 0;
      update.margin = Math.round((update.sellingPrice - pPrice) * 100) / 100;
      if (pPrice > 0) {
        update.marginPercentage = Math.round((update.margin / pPrice) * 100 * 100) / 100;
      }
    } catch (err) {
      console.warn("Pricing Sync Error:", err.message);
    }
  }
  // DEFAULT: Recalculate margins if both updated or unknown state
  else if (pUpdated && sUpdated) {
    update.margin = Math.round((update.sellingPrice - update.purchasingPrice) * 100) / 100;
    if (update.purchasingPrice > 0) {
      update.marginPercentage = Math.round((update.margin / update.purchasingPrice) * 100 * 100) / 100;
    }
  }

});

// 🔄 CASCADING PRICE SYNC: Update Customer Locked Prices when Product Cost changes
productSchema.post("save", async function() {
  if (this.isModified("purchasingPrice")) {
    try {
       const CustomerLockedPrice = mongoose.model("CustomerLockedPrice");
       const lockedPrices = await CustomerLockedPrice.find({ productId: this._id });
       
       const bulkOps = lockedPrices.map(lp => {
         const newLockedPrice = Math.round((this.purchasingPrice + (lp.margin || 0)) * 100) / 100;
         return {
           updateOne: {
             filter: { _id: lp._id },
             update: { $set: { lockedPrice: newLockedPrice, purchasingPrice: this.purchasingPrice } }
           }
         };
       });

       if (bulkOps.length > 0) {
         await CustomerLockedPrice.bulkWrite(bulkOps);
         console.log(`📡 Dynamic Pricing: Synced ${bulkOps.length} customer locked prices for product [${this.name}]`);
       }
    } catch (err) {
       console.error("Cascading Pricing Error:", err.message);
    }
  }
});

productSchema.post(["findOneAndUpdate", "findByIdAndUpdate"], async function (doc) {
  if (doc) {
    // Note: In some mongoose versions, we skip if no price change. 
    // But to be safe, we re-fetch the update object if possible or just check the doc.
    // For simplicity and stability, we use the doc's current state.
    try {
       const CustomerLockedPrice = mongoose.model("CustomerLockedPrice");
       const lockedPrices = await CustomerLockedPrice.find({ productId: doc._id });
       
       const bulkOps = lockedPrices.map(lp => {
         const newLockedPrice = Math.round((doc.purchasingPrice + (lp.margin || 0)) * 100) / 100;
         return {
           updateOne: {
             filter: { _id: lp._id },
             update: { $set: { lockedPrice: newLockedPrice, purchasingPrice: doc.purchasingPrice } }
           }
         };
       });

       if (bulkOps.length > 0) {
         await CustomerLockedPrice.bulkWrite(bulkOps);
         console.log(`📡 Dynamic Pricing (Query): Synced ${bulkOps.length} customer locked prices for product [${doc.name}]`);
       }
    } catch (err) {
       console.error("Cascading Pricing (Query) Error:", err.message);
    }
  }
});

const Product = mongoose.model("Product", productSchema);

export default Product;
