import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    groupId: { type: String, required: true },
    unit: { type: String, required: true },
    hsncode: { type: String, required: true },

    availableQty: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },

    purchasePrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

export default Product;

