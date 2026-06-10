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
    marketCapPrice: { type: Number, default: 0 }, // Market Cap (Approval Rate)
    sellingPrice: { type: Number, default: 0 },
    lockedPrice: { type: Number, default: 0 },
    mrp: { type: Number, default: 0 }, // Maximum Retail Price
    batch1: {
      qty: { type: Number, default: 0 },
      expiryDate: { type: Date, default: null },
      mrp: { type: Number, default: 0 },
      manufacturingDate: { type: Date, default: null }
    },
    batch2: {
      qty: { type: Number, default: 0 },
      expiryDate: { type: Date, default: null },
      mrp: { type: Number, default: 0 },
      manufacturingDate: { type: Date, default: null }
    },
    batches: {
      type: [
        {
          batchNo: { type: String, required: true },
          qty: { type: Number, default: 0 },
          expiryDate: { type: Date, default: null },
          mrp: { type: Number, default: 0 },
          manufacturingDate: { type: Date, default: null }
        }
      ],
      default: []
    },
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
      reorderMode: { type: String, enum: ["HIGH", "LOW"], default: "HIGH" }, // Dynamic comparator mode (HIGH = Math.max, LOW = Math.min)
      reorderQtyMode: { type: String, enum: ["HIGH", "LOW"], default: "HIGH" },
      thresholdMode: { type: String, enum: ["HIGH", "LOW"], default: "HIGH" },
      showAlert: { type: Boolean, default: false }, // User-selected alert status
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
      oldMarketCapPrice: Number,
      newMarketCapPrice: Number,
      oldSellingPrice: Number,
      newSellingPrice: Number,
      oldGst: Number,
      newGst: Number,
      effectiveDate: { type: Date, default: Date.now },
      sourceVoucher: String, // PI Number
      type: { type: String, enum: ['INCREASE', 'DECREASE', 'INITIAL'] },
      note: String
    }]
  },
  { timestamps: true }
);

// Auto-calculate margin and sync total stock before saving
productSchema.pre("save", function () {
  if (!this.batches) {
    this.batches = [];
  }

  // 1. Sync legacy fields (batch1) to batches array if they are modified
  // Map batch1 to batchNo: "0" for existing/opening stock compatibility
  if (this.isModified("batch1.qty") || this.isModified("batch1.expiryDate") || this.isModified("batch1.mrp") || this.isModified("batch1.manufacturingDate")) {
    let b0 = this.batches.find(b => b.batchNo === "0");
    if (!b0) {
      this.batches.push({ batchNo: "0", qty: this.batch1?.qty || 0, expiryDate: this.batch1?.expiryDate || null, mrp: this.batch1?.mrp || 0, manufacturingDate: this.batch1?.manufacturingDate || null });
    } else {
      b0.qty = this.batch1?.qty || 0;
      b0.expiryDate = this.batch1?.expiryDate || null;
      b0.mrp = this.batch1?.mrp || 0;
      b0.manufacturingDate = this.batch1?.manufacturingDate || null;
    }
  }

  // 2. Sync batches array back to legacy fields (batch1) for backwards compatibility
  const b0FromArr = this.batches.find(b => b.batchNo === "0");
  if (b0FromArr) {
    this.batch1 = { qty: b0FromArr.qty, expiryDate: b0FromArr.expiryDate, mrp: b0FromArr.mrp, manufacturingDate: b0FromArr.manufacturingDate };
  }

  // 3. Compute totalQty from all batches
  this.totalQty = this.batches.reduce((sum, b) => sum + (b.qty || 0), 0);

  const isNew = this.isNew;
  const pPriceChanged = this.isModified("purchasingPrice");
  const mcpChanged = this.isModified("marketCapPrice");
  const sPriceChanged = this.isModified("sellingPrice");
  const marginChanged = this.isModified("margin");
  const marginPctChanged = this.isModified("marginPercentage");
  const adminMarginChanged = this.isModified("adminMargin");

  const baseCost = this.marketCapPrice > 0 ? this.marketCapPrice : (this.purchasingPrice || 0);
  const costChanged = pPriceChanged || mcpChanged;

  // PRIORITY 1: Explicit Marginal Percentage Change OR Admin Margin Change
  if ((marginPctChanged && this.marginPercentage > 0) || adminMarginChanged) {
    this.marginPercentage = Math.round((this.marginPercentage || 0) * 100) / 100;
    const adminMarginPct = this.adminMargin || 0;
    const totalMarginPct = this.marginPercentage + adminMarginPct;
    this.sellingPrice = Math.round((baseCost + (baseCost * totalMarginPct / 100)) * 100) / 100;
    this.margin = Math.round((this.sellingPrice - baseCost) * 100) / 100;
  }
  // PRIORITY 2: Explicit Margin Amount Change
  else if (marginChanged) {
    this.margin = Math.round(this.margin * 100) / 100;
    this.sellingPrice = Math.round((baseCost + this.margin) * 100) / 100;
    if (baseCost > 0) {
      const adminMarginPct = this.adminMargin || 0;
      const totalMarginPct = (this.margin / baseCost) * 100;
      this.marginPercentage = Math.round((totalMarginPct - adminMarginPct) * 100) / 100;
    }
  }
  // PRIORITY 3: Only Cost (Purchasing Price or MCP) changed (Maintain Margin Percentage if available)
  else if (!isNew && costChanged && !sPriceChanged) {
    if (this.marginPercentage > 0 || this.adminMargin > 0) {
      const adminMarginPct = this.adminMargin || 0;
      const totalMarginPct = (this.marginPercentage || 0) + adminMarginPct;
      this.sellingPrice = Math.round((baseCost + (baseCost * totalMarginPct / 100)) * 100) / 100;
      this.margin = Math.round((this.sellingPrice - baseCost) * 100) / 100;
    } else if (this.margin !== undefined && this.margin !== null) {
      // Fallback to absolute margin if percentage not set
      this.sellingPrice = Math.round((baseCost + this.margin) * 100) / 100;
      if (baseCost > 0) {
        const adminMarginPct = this.adminMargin || 0;
        const totalMarginPct = (this.margin / baseCost) * 100;
        this.marginPercentage = Math.round((totalMarginPct - adminMarginPct) * 100) / 100;
      }
    }
  }
  // PRIORITY 4: Only Selling Price changed (Recalculate Margin)
  else if (sPriceChanged && !costChanged) {
    this.margin = Math.round(((this.sellingPrice || 0) - baseCost) * 100) / 100;
    if (baseCost > 0) {
      const adminMarginPct = this.adminMargin || 0;
      const totalMarginPct = (this.margin / baseCost) * 100;
      this.marginPercentage = Math.round((totalMarginPct - adminMarginPct) * 100) / 100;
    }
  }
  // DEFAULT: Sync values
  else {
    this.margin = Math.round(((this.sellingPrice || 0) - baseCost) * 100) / 100;
    if (baseCost > 0) {
      const adminMarginPct = this.adminMargin || 0;
      const totalMarginPct = (this.margin / baseCost) * 100;
      this.marginPercentage = Math.round((totalMarginPct - adminMarginPct) * 100) / 100;
    }
  }

  // Set hsn as alias for hsnCode
  if (!this.hsn && this.hsnCode) {
    this.hsn = this.hsnCode;
  }

  // ⚡ CAPTURE MODIFICATION STATE FOR POST-SAVE SYNC
  this._purchasingPriceChanged = pPriceChanged;
  // We use a simple flag. Margin recovery will use the lp.purchasingPrice if available.
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
  const amUpdated = update.adminMargin !== undefined;

  let current;
  const getCurrent = async () => {
    if (!current) current = await this.model.findById(filter._id);
    return current || {};
  };

  // PRIORITY 1: Explicit Margin Update (Percentage or Amount)
  if ((mpUpdated && update.marginPercentage > 0) || amUpdated) {
    const cur = await getCurrent();
    const marginPct = mpUpdated ? update.marginPercentage : (cur.marginPercentage || 0);
    const adminMarginPct = amUpdated ? update.adminMargin : (cur.adminMargin || 0);
    const totalMarginPct = marginPct + adminMarginPct;
    
    if (mpUpdated) update.marginPercentage = Math.round(update.marginPercentage * 100) / 100;
    if (amUpdated) update.adminMargin = Math.round(update.adminMargin * 100) / 100;

    const pPrice = pUpdated ? update.purchasingPrice : (cur.purchasingPrice || 0);
    update.sellingPrice = Math.round((pPrice + (pPrice * totalMarginPct / 100)) * 100) / 100;
    update.margin = Math.round((update.sellingPrice - pPrice) * 100) / 100;
  }
  else if (mUpdated) {
    const cur = await getCurrent();
    update.margin = Math.round(update.margin * 100) / 100;
    const pPrice = pUpdated ? update.purchasingPrice : (cur.purchasingPrice || 0);
    update.sellingPrice = Math.round((pPrice + update.margin) * 100) / 100;
    if (pPrice > 0) {
      const adminMarginPct = amUpdated ? update.adminMargin : (cur.adminMargin || 0);
      const totalMarginPct = (update.margin / pPrice) * 100;
      update.marginPercentage = Math.round((totalMarginPct - adminMarginPct) * 100) / 100;
    }
  }
  // PRIORITY 2: Only Purchase Price updated (Maintain Absolute Margin Amount)
  else if (pUpdated && !sUpdated) {
    try {
      const cur = await getCurrent();
      if (cur.margin !== undefined) {
        const targetMargin = cur.margin;
        update.sellingPrice = Math.round((update.purchasingPrice + targetMargin) * 100) / 100;
        update.margin = targetMargin;
        if (update.purchasingPrice > 0) {
          const adminMarginPct = amUpdated ? update.adminMargin : (cur.adminMargin || 0);
          const totalMarginPct = (targetMargin / update.purchasingPrice) * 100;
          update.marginPercentage = Math.round((totalMarginPct - adminMarginPct) * 100) / 100;
        }
      }
    } catch (err) {
      console.warn("Pricing Sync Error:", err.message);
    }
  }
  // PRIORITY 3: Only Selling Price updated (Recalculate Margin)
  else if (sUpdated && !pUpdated) {
    try {
      const cur = await getCurrent();
      const pPrice = cur.purchasingPrice || 0;
      update.margin = Math.round((update.sellingPrice - pPrice) * 100) / 100;
      if (pPrice > 0) {
        const adminMarginPct = amUpdated ? update.adminMargin : (cur.adminMargin || 0);
        const totalMarginPct = (update.margin / pPrice) * 100;
        update.marginPercentage = Math.round((totalMarginPct - adminMarginPct) * 100) / 100;
      }
    } catch (err) {
      console.warn("Pricing Sync Error:", err.message);
    }
  }
  // DEFAULT: Recalculate margins if both updated or unknown state
  else if (pUpdated && sUpdated) {
    const cur = await getCurrent();
    update.margin = Math.round((update.sellingPrice - update.purchasingPrice) * 100) / 100;
    if (update.purchasingPrice > 0) {
      const adminMarginPct = amUpdated ? update.adminMargin : (cur.adminMargin || 0);
      const totalMarginPct = (update.margin / update.purchasingPrice) * 100;
      update.marginPercentage = Math.round((totalMarginPct - adminMarginPct) * 100) / 100;
    }
  }

});

// 🔄 CASCADING PRICE SYNC: Update Customer Locked Prices when Product Cost changes
productSchema.post("save", async function() {
  if (this._purchasingPriceChanged) {
    try {
       const CustomerLockedPrice = mongoose.models.CustomerLockedPrice || mongoose.model("CustomerLockedPrice");
       const lockedPrices = await CustomerLockedPrice.find({ productId: this._id });
       
       const bulkOps = lockedPrices.map(lp => {
         // 📈 PERCENTAGE SYNC LOGIC:
         let mPct = lp.marginPercentage;
         
         if (mPct === undefined || mPct === null || mPct === 0) {
           const referenceCost = lp.purchasingPrice || this.purchasingPrice;
           const referenceMargin = (lp.margin !== undefined && lp.margin !== null) ? lp.margin : (lp.lockedPrice - referenceCost);
           mPct = referenceCost > 0 ? (referenceMargin / referenceCost) * 100 : 0;
         }

         const newLockedPrice = Math.round((this.purchasingPrice + (this.purchasingPrice * mPct / 100)) * 100) / 100;
         const newAbsoluteMargin = Math.round((newLockedPrice - this.purchasingPrice) * 100) / 100;

         return {
           updateOne: {
             filter: { _id: lp._id },
             update: { 
               $set: { 
                 lockedPrice: newLockedPrice, 
                 purchasingPrice: this.purchasingPrice, 
                 margin: newAbsoluteMargin,
                 marginPercentage: Math.round(mPct * 100) / 100,
                 updatedBy: this._updatedByUser?.username || this._updatedByUser?.name || "System",
                 updatedById: this._updatedByUser?.id || this._updatedByUser?._id || null,
                 updatedByModel: this._updatedByUser?.role === "SUPER_ADMIN" ? "SuperAdmin" : (this._updatedByUser ? "BranchUser" : undefined)
               } 
             }
           }
         };
       });

       if (bulkOps.length > 0) {
         await CustomerLockedPrice.bulkWrite(bulkOps);
         console.log(`📡 [DYNAMIC_PRICING] Synced ${bulkOps.length} customer locked prices for [${this.name}] (New Cost: ₹${this.purchasingPrice})`);
       }
    } catch (err) {
       console.error("❌ [DYNAMIC_PRICING] Cascading Sync Error:", err.message);
    }
  }
});

productSchema.post(["findOneAndUpdate", "findByIdAndUpdate", "save"], async function (doc) {
  if (doc && (doc._purchasingPriceChanged || doc.isModified?.("purchasingPrice"))) {
    try {
       const CustomerLockedPrice = mongoose.models.CustomerLockedPrice || mongoose.model("CustomerLockedPrice");
       const lockedPrices = await CustomerLockedPrice.find({ productId: doc._id });
       
       const bulkOps = lockedPrices.map(lp => {
         // 📈 PERCENTAGE SYNC LOGIC:
         let mPct = lp.marginPercentage;
         
         if (mPct === undefined || mPct === null || mPct === 0) {
           const referenceCost = lp.purchasingPrice || doc.purchasingPrice;
           const referenceMargin = (lp.margin !== undefined && lp.margin !== null) ? lp.margin : (lp.lockedPrice - referenceCost);
           mPct = referenceCost > 0 ? (referenceMargin / referenceCost) * 100 : 0;
         }

         const newLockedPrice = Math.round((doc.purchasingPrice + (doc.purchasingPrice * mPct / 100)) * 100) / 100;
         const newAbsoluteMargin = Math.round((newLockedPrice - doc.purchasingPrice) * 100) / 100;

         return {
           updateOne: {
             filter: { _id: lp._id },
             update: { 
               $set: { 
                 lockedPrice: newLockedPrice, 
                 purchasingPrice: doc.purchasingPrice, 
                 margin: newAbsoluteMargin,
                 marginPercentage: Math.round(mPct * 100) / 100,
                 updatedBy: doc._updatedByUser?.username || doc._updatedByUser?.name || "System",
                 updatedById: doc._updatedByUser?.id || doc._updatedByUser?._id || null,
                 updatedByModel: doc._updatedByUser?.role === "SUPER_ADMIN" ? "SuperAdmin" : (doc._updatedByUser ? "BranchUser" : undefined)
               } 
             }
           }
         };
       });

       if (bulkOps.length > 0) {
         await CustomerLockedPrice.bulkWrite(bulkOps);
         console.log(`📡 [DYNAMIC_PRICING_QUERY] Synced ${bulkOps.length} customer locked prices for [${doc.name}] (New Cost: ₹${doc.purchasingPrice})`);
       }
    } catch (err) {
       console.error("❌ [DYNAMIC_PRICING_QUERY] Cascading Sync Error:", err.message);
    }
  }
});

// Method to update batch stock in a unified way
productSchema.methods.updateBatchStock = function (batchNo, qtyDelta, expiryDate, mrp, manufacturingDate) {
  if (!this.batches) {
    this.batches = [];
  }

  const batchStr = String(batchNo);
  let batch = this.batches.find(b => String(b.batchNo) === batchStr);
  if (!batch) {
    batch = {
      batchNo: batchStr,
      qty: 0,
      expiryDate: null,
      mrp: 0,
      manufacturingDate: null
    };
    this.batches.push(batch);
    batch = this.batches[this.batches.length - 1];
  }

  batch.qty = (batch.qty || 0) + Number(qtyDelta);
  if (expiryDate !== undefined) {
    batch.expiryDate = expiryDate ? new Date(expiryDate) : null;
  }
  if (mrp !== undefined) {
    batch.mrp = Number(mrp) || 0;
  }
  if (manufacturingDate !== undefined) {
    batch.manufacturingDate = manufacturingDate ? new Date(manufacturingDate) : null;
  }

  // Sync legacy fields immediately so it's reflected in save hook
  if (batchStr === "0") {
    this.batch1 = { qty: batch.qty, expiryDate: batch.expiryDate, mrp: batch.mrp, manufacturingDate: batch.manufacturingDate };
    this.markModified("batch1");
  }

  this.totalQty = this.batches.reduce((sum, b) => sum + (b.qty || 0), 0);

  this.markModified("batches");
};

const Product = mongoose.model("Product", productSchema);

export default Product;
