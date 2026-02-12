import mongoose from "mongoose";

const salesManSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    role: { type: String, default: "Sales Man" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("SalesMan", salesManSchema);
