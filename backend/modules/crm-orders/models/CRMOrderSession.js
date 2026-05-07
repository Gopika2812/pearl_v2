import mongoose from "mongoose";

const crmOrderSessionSchema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: String,
    qty: Number,
    sellingPrice: Number,
    gst: Number,
    total: Number
  }],
  notes: { type: String },
  status: { type: String, enum: ["PENDING", "SHARED", "CONFIRMED", "EXPIRED"], default: "PENDING" },
  createdBy: { type: String },
  salesOrderRef: { type: mongoose.Schema.Types.ObjectId, ref: "SalesOrder" }
}, { timestamps: true });

export default mongoose.model("CRMOrderSession", crmOrderSessionSchema);
