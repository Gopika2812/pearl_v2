import mongoose from "mongoose";

const deliveryManSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    role: { type: String, default: "Delivery Man" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("DeliveryMan", deliveryManSchema);
