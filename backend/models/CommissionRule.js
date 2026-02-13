import mongoose from "mongoose";

const commissionRuleSchema = new mongoose.Schema(
  {
    roleType: {
      type: String,
      enum: ["SalesOwner", "SalesMan", "DeliveryMan"],
      required: true,
    },
    personId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    personName: String,
    
    minimumOrderValue: {
      type: Number,
      required: true,
      default: 0,
    },
    commissionPercentage: {
      type: Number,
      required: true,
      default: 0,
    },
    effectiveFrom: {
      type: Date,
      default: () => new Date(),
    },
    
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("CommissionRule", commissionRuleSchema);
