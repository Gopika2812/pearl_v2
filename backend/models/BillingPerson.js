import mongoose from "mongoose";

const billingPersonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    designation: { type: String, enum: ["Billing", "Agent"], required: true },
  },
  { timestamps: true }
);

const BillingPerson = mongoose.model("BillingPerson", billingPersonSchema);

export default BillingPerson;
