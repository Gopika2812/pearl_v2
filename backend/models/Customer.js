import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    // Basic Details
    name: { type: String, required: true, index: true },
    whatsapp: { type: String, default: "", index: true },
    email: { type: String, default: "", index: true },
    address: { type: String, default: "" },
    district: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "India" },
    pincode: { type: String, default: "" },
    
    // Tax & Registration
    registrationType: { type: String, enum: ["regular", "unregistered"], default: "regular" },
    gstin: { type: String, default: "" },
    
    // Multiple Categories and Groups
    customerCategories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "CustomerCategory" }
    ],
    customerGroups: [
      { type: mongoose.Schema.Types.ObjectId, ref: "CustomerGroup" }
    ],
    
    // Business Details
    margin: { type: Number, default: 0 }, // Can be positive or negative
    credit: { type: Number, default: 0 },
    debit: { type: Number, default: 0 },
    salesOwner: { type: mongoose.Schema.Types.ObjectId, ref: "SalesOwner", default: null, index: true },
    
    // Legacy field - kept for backward compatibility
    closingBalance: { type: Number, default: 0 },
    customerCategory: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerCategory", default: null },
    customerGroup: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerGroup", default: null },

    // Bank Details
    accountHolder: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    branch: { type: String, default: "" },
    upi: { type: String, default: "" },
  },
  { timestamps: true }
);

// Create composite unique index: branchId + name
customerSchema.index({ branchId: 1, name: 1 }, { unique: true });

const Customer = mongoose.model("Customer", customerSchema);
export default Customer;
