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
  this.margin = (this.sellingPrice || 0) - (this.purchasingPrice || 0);
  // Set hsn as alias for hsnCode
  if (!this.hsn && this.hsnCode) {
    this.hsn = this.hsnCode;
  }
});


// Auto-calculate margin on findByIdAndUpdate
productSchema.pre("findByIdAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.sellingPrice || update.purchasingPrice) {
    const selling = update.sellingPrice || this._conditions.sellingPrice;
    const purchasing = update.purchasingPrice || this._conditions.purchasingPrice;
    if (selling !== undefined && purchasing !== undefined) {
      update.margin = selling - purchasing;
    }
  }
  next();
});

const Product = mongoose.model("Product", productSchema);

export default Product;

