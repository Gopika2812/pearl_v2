import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    // Basic Details
    name: { type: String, required: true, index: true },
    whatsapp: { type: String, default: "", index: true },
    email: { type: String, default: "", index: true },
    address: { type: String, default: "" },
    district: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    country: { type: String, default: "India" },
    gstin: { type: String, default: "" },
    
    closingBalance: { type: Number, default: 0 },
    margin: { type: Number, default: 0 }, // Can be positive or negative
    salesOwner: { type: mongoose.Schema.Types.ObjectId, ref: "SalesOwner", default: null, index: true },

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
