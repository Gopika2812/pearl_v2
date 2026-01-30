import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    groupId: { type: String, required: true },
    unit: { type: String, required: true },   // "250 grm"
    hsncode: {type: String, required: true}
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
