import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    productGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductGroup",
      required: true,
    },
    name: { type: String, required: true },
    perQty: { type: Number, required: true },
    units: { type: String, required: true }, 
    totalQty: { type: Number, default: 0 }, 
    purchasingPrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    hsnCode: { type: String, required: true },
    gst: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-calculate margin before saving
productSchema.pre("save", function () {
  this.margin = (this.sellingPrice || 0) - (this.purchasingPrice || 0);
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

