import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    // Basic Details
    name: { type: String, required: true },
    whatsapp: { type: String, required: true },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    district: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },

    // Bank Details
    accountHolder: { type: String, required: true },
    accountNumber: { type: String, required: true },   // ✅ ADDED
    ifsc: { type: String, required: true },
    branch: { type: String, required: true },
    upi: { type: String, default: "" },
  },
  { timestamps: true }
);

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;
