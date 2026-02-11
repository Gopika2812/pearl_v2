import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    // Basic Details
    name: { type: String, required: true },
    whatsapp: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    district: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    country: { type: String, default: "India" },
    gstin: { type: String, default: "" },
    
    closingBalance: { type: Number, default: 0 },
    margin: { type: Number, default: 0 }, // Can be positive or negative
    salesOwner: { type: String, default: "" },

    // Bank Details
    accountHolder: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    branch: { type: String, default: "" },
    upi: { type: String, default: "" },
  },
  { timestamps: true }
);

const Customer = mongoose.model("Customer", customerSchema);
export default Customer;
