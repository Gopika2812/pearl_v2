import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    productGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductGroup",
      required: false,
      default: null,
    },
    name: { type: String, required: true },
    perQty: { type: Number, required: true },
    units: { type: String, required: true }, 
    totalQty: { type: Number, default: 0 },
    purchasingPrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    mrp: { type: Number, default: 0 }, // Maximum Retail Price
    margin: { type: Number, default: 0 },
    hsnCode: { type: String, required: true },
    hsn: { type: String, default: "" }, // Alias for hsnCode
    gst: { type: Number, default: 0 },
    image: { type: String, default: null }, // Product image URL
  },
  { timestamps: true }
);

// Auto-calculate margin before saving
productSchema.pre("save", function () {
  // If margin is explicitly set, use it to calculate sellingPrice
  if (this.margin !== undefined && this.margin !== null && this.purchasingPrice !== undefined) {
    this.sellingPrice = (this.purchasingPrice || 0) + this.margin;
  } else {
    // Otherwise, calculate margin from selling price
    this.margin = (this.sellingPrice || 0) - (this.purchasingPrice || 0);
  }
  // Set hsn as alias for hsnCode
  if (!this.hsn && this.hsnCode) {
    this.hsn = this.hsnCode;
  }
});


// Auto-calculate margin on findByIdAndUpdate
productSchema.pre("findByIdAndUpdate", function (next) {
  const update = this.getUpdate();
  
  // If margin is being updated, calculate sellingPrice from it
  if (update.margin !== undefined && update.margin !== null) {
    const purchasing = update.purchasingPrice !== undefined 
      ? update.purchasingPrice 
      : undefined;
    if (purchasing !== undefined) {
      update.sellingPrice = purchasing + update.margin;
    }
  }
  // If sellingPrice or purchasingPrice changed but not margin, recalculate margin
  else if (update.sellingPrice !== undefined || update.purchasingPrice !== undefined) {
    const selling = update.sellingPrice !== undefined ? update.sellingPrice : undefined;
    const purchasing = update.purchasingPrice !== undefined ? update.purchasingPrice : undefined;
    if (selling !== undefined && purchasing !== undefined) {
      update.margin = selling - purchasing;
    }
  }
  next();
});

const Product = mongoose.model("Product", productSchema);

export default Product;

