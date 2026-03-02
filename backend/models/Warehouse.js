import mongoose from "mongoose";

const warehouseSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

// Create composite unique index: branchId + name
warehouseSchema.index({ branchId: 1, name: 1 }, { unique: true });

const Warehouse = mongoose.model("Warehouse", warehouseSchema);
export default Warehouse;
