import mongoose from "mongoose";

const salesOwnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    role: { type: String, default: "Sales Owner" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("SalesOwner", salesOwnerSchema);
