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
    name: { type: String, required: true },
    perQty: { type: Number, required: true },
    units: { type: String, required: true }, 
    totalQty: { type: Number, default: 0 },
    purchasingPrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    mrp: { type: Number, default: 0 }, // Maximum Retail Price
    margin: { type: Number, default: 0 },
    marginPercentage: { type: Number, default: 0 }, // Margin as percentage for group calculations
    hsnCode: { type: String, required: true },
    hsn: { type: String, default: "" }, // Alias for hsnCode
    gst: { type: Number, default: 0 },
    image: { type: String, default: null }, // Product image URL
    reorderLevel: { type: Number, default: 10 }, // Alert threshold for reordering
    reorderQty: { type: Number, default: 20 }, // Quantity to order when threshold reached
    leadTime: { type: Number, default: 7 }, // Days to receive the order
    checkPeriod: { type: String, default: "MONTHLY" }, // How often to check stock (DAILY, WEEKLY, MONTHLY, QUARTERLY)
    lastChecked: { type: Date, default: null }, // Last time stock was reviewed
    nextCheckDate: { type: Date, default: null }, // Next scheduled check date
  },
  { timestamps: true }
);

// Auto-calculate margin before saving
productSchema.pre("save", function () {
  // If marginPercentage is explicitly set, use it to calculate sellingPrice
  if (this.marginPercentage !== undefined && this.marginPercentage > 0 && this.purchasingPrice !== undefined) {
    this.marginPercentage = Math.round(this.marginPercentage * 100) / 100;
    this.sellingPrice = Math.round((this.purchasingPrice || 0) + ((this.purchasingPrice || 0) * this.marginPercentage / 100));
    this.margin = Math.round(this.sellingPrice - (this.purchasingPrice || 0));
  }
  // If margin is explicitly set, use it to calculate sellingPrice
  else if (this.margin !== undefined && this.margin !== null && this.purchasingPrice !== undefined) {
    this.margin = Math.round(this.margin);
    this.sellingPrice = Math.round((this.purchasingPrice || 0) + this.margin);
    // Calculate marginPercentage from margin
    if (this.purchasingPrice > 0) {
      this.marginPercentage = Math.round((this.margin / this.purchasingPrice) * 100 * 100) / 100;
    }
  } else {
    // Otherwise, calculate margin from selling price
    this.margin = Math.round((this.sellingPrice || 0) - (this.purchasingPrice || 0));
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

// Auto-calculate margin on findByIdAndUpdate
productSchema.pre("findByIdAndUpdate", async function (next) {
  const update = this.getUpdate();
  
  // If marginPercentage is being updated, calculate sellingPrice from it
  if (update.marginPercentage !== undefined && update.marginPercentage > 0) {
    update.marginPercentage = Math.round(update.marginPercentage * 100) / 100;
    const purchasingPrice = update.purchasingPrice !== undefined 
      ? update.purchasingPrice 
      : (await this.model.findById(this.getFilter()._id))?.purchasingPrice || 0;
    update.sellingPrice = Math.round(purchasingPrice + (purchasingPrice * update.marginPercentage / 100));
    update.margin = Math.round(update.sellingPrice - purchasingPrice);
  }
  // If margin is being updated, calculate sellingPrice from it
  else if (update.margin !== undefined && update.margin !== null && update.purchasingPrice !== undefined) {
    update.margin = Math.round(update.margin);
    update.sellingPrice = Math.round(update.purchasingPrice + update.margin);
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
        update.sellingPrice = Math.round(update.purchasingPrice + currentProduct.margin);
      }
    } catch (err) {
      console.warn("Could not fetch current product for margin calculation:", err.message);
    }
  }
  // If both sellingPrice and purchasingPrice changed, recalculate margin
  else if (update.sellingPrice !== undefined && update.purchasingPrice !== undefined) {
    update.margin = Math.round(update.sellingPrice - update.purchasingPrice);
    if (update.purchasingPrice > 0) {
      update.marginPercentage = Math.round((update.margin / update.purchasingPrice) * 100 * 100) / 100;
    }
  }
  // If only sellingPrice changed, recalculate margin using current purchasing price
  else if (update.sellingPrice !== undefined && update.purchasingPrice === undefined) {
    try {
      const currentProduct = await this.model.findById(this.getFilter()._id);
      if (currentProduct && currentProduct.purchasingPrice !== undefined) {
        update.margin = Math.round(update.sellingPrice - currentProduct.purchasingPrice);
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

