import mongoose from "mongoose";

const deliveryManSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, default: "Delivery Man" },
    commissionAmount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Create composite unique index: branchId + name
deliveryManSchema.index({ branchId: 1, name: 1 }, { unique: true });

export default mongoose.model("DeliveryMan", deliveryManSchema);
