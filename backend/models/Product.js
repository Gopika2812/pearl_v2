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
  // If marginPercentage is explicitly set, use it to calculate sellingPrice
  if (this.marginPercentage !== undefined && this.marginPercentage > 0 && this.purchasingPrice !== undefined) {
    this.marginPercentage = Math.round(this.marginPercentage * 100) / 100;
    this.sellingPrice = Math.round(((this.purchasingPrice || 0) + ((this.purchasingPrice || 0) * this.marginPercentage / 100)) * 100) / 100;
    this.margin = Math.round((this.sellingPrice - (this.purchasingPrice || 0)) * 100) / 100;
  }
  // If margin is explicitly set, use it to calculate sellingPrice
  else if (this.margin !== undefined && this.margin !== null && this.purchasingPrice !== undefined) {
    this.margin = Math.round(this.margin * 100) / 100;
    this.sellingPrice = Math.round(((this.purchasingPrice || 0) + this.margin) * 100) / 100;
    // Calculate marginPercentage from margin
    if (this.purchasingPrice > 0) {
      this.marginPercentage = Math.round((this.margin / this.purchasingPrice) * 100 * 100) / 100;
    }
  } else {
    // Otherwise, calculate margin from selling price
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

// Auto-calculate margin on findByIdAndUpdate
productSchema.pre("findByIdAndUpdate", async function (next) {
  const update = this.getUpdate();

  // If marginPercentage is being updated, calculate sellingPrice from it
  if (update.marginPercentage !== undefined && update.marginPercentage > 0) {
    update.marginPercentage = Math.round(update.marginPercentage * 100) / 100;
    const purchasingPrice = update.purchasingPrice !== undefined
      ? update.purchasingPrice
      : (await this.model.findById(this.getFilter()._id))?.purchasingPrice || 0;
    update.sellingPrice = Math.round((purchasingPrice + (purchasingPrice * update.marginPercentage / 100)) * 100) / 100;
    update.margin = Math.round((update.sellingPrice - purchasingPrice) * 100) / 100;
  }
  // If margin is being updated, calculate sellingPrice from it
  else if (update.margin !== undefined && update.margin !== null && update.purchasingPrice !== undefined) {
    update.margin = Math.round(update.margin * 100) / 100;
    update.sellingPrice = Math.round((update.purchasingPrice + update.margin) * 100) / 100;
    if (update.purchasingPrice > 0) {
      update.marginPercentage = Math.round((update.margin / update.purchasingPrice) * 100 * 100) / 100;
    }
  }
  // If ONLY purchasingPrice is being updated, fetch current margin and calculate new sellingPrice
  else if (update.purchasingPrice !== undefined && update.sellingPrice === undefined && update.margin === undefined && update.marginPercentage === undefined) {
    try {
      const currentProduct = await this.model.findById(this.getFilter()._id);
      if (currentProduct && currentProduct.margin !== undefined) {
        // Keep existing margin, calculate selling price: purchasingPrice + margin
        update.sellingPrice = Math.round((update.purchasingPrice + currentProduct.margin) * 100) / 100;
      }
    } catch (err) {
      console.warn("Could not fetch current product for margin calculation:", err.message);
    }
  }
  // If both sellingPrice and purchasingPrice changed, recalculate margin
  else if (update.sellingPrice !== undefined && update.purchasingPrice !== undefined) {
    update.margin = Math.round((update.sellingPrice - update.purchasingPrice) * 100) / 100;
    if (update.purchasingPrice > 0) {
      update.marginPercentage = Math.round((update.margin / update.purchasingPrice) * 100 * 100) / 100;
    }
  }
  // If only sellingPrice changed, recalculate margin using current purchasing price
  else if (update.sellingPrice !== undefined && update.purchasingPrice === undefined) {
    try {
      const currentProduct = await this.model.findById(this.getFilter()._id);
      if (currentProduct && currentProduct.purchasingPrice !== undefined) {
        update.margin = Math.round((update.sellingPrice - currentProduct.purchasingPrice) * 100) / 100;
        if (currentProduct.purchasingPrice > 0) {
          update.marginPercentage = Math.round((update.margin / currentProduct.purchasingPrice) * 100 * 100) / 100;
        }
      }
    } catch (err) {
      console.warn("Could not fetch current product for margin calculation:", err.message);
    }
  }
  next();
});

const Product = mongoose.model("Product", productSchema);

export default Product;

