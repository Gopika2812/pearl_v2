import mongoose from "mongoose";

const commissionSchema = new mongoose.Schema(
  {
    salesOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: true,
    },
    
    // Sales Owner Commission
    salesOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesOwner",
    },
    salesOwnerName: String,
    salesOwnerCommissionPercentage: Number,
    salesOwnerCommissionAmount: Number,
    
    // Sales Man Commission
    salesManId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesMan",
    },
    salesManName: String,
    salesManCommissionPercentage: Number,
    salesManCommissionAmount: Number,
    
    // Delivery Man Commission
    deliveryManId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryMan",
    },
    deliveryManName: String,
    deliveryManCommissionPercentage: Number,
    deliveryManCommissionAmount: Number,
    
    // Order Details
    orderValue: Number,
    invoiceId: String,
    
    totalCommission: Number,
  },
  { timestamps: true }
);

export default mongoose.model("Commission", commissionSchema);
