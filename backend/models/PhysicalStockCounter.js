import mongoose from "mongoose";

// Atomic per-branch sequential counter for SJ IDs
// branch1 → SJ001, SJ002...   branch2 → SJ001, SJ002...  (completely independent)
const physicalStockCounterSchema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", unique: true, required: true },
  seq:      { type: Number, default: 0 }
});

const PhysicalStockCounter = mongoose.model("PhysicalStockCounter", physicalStockCounterSchema);
export default PhysicalStockCounter;
