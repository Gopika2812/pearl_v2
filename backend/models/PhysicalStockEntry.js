import mongoose from "mongoose";

const physicalEditLogSchema = new mongoose.Schema({
  userId:    { type: String },
  username:  { type: String },
  oldQty:    { type: Number },
  newQty:    { type: Number },
  editedAt:  { type: Date, default: Date.now }
}, { _id: false });

const checkedBySchema = new mongoose.Schema({
  userId:    { type: String },
  username:  { type: String },
  checkedAt: { type: Date, default: Date.now }
}, { _id: false });

const physicalStockEntrySchema = new mongoose.Schema({
  // Branch-scoped sequential ID: SJ001, SJ002... per branch
  sjId:              { type: String, required: true },
  branchId:          { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },

  entryDate:         { type: Date, default: Date.now },

  productGroupId:    { type: mongoose.Schema.Types.ObjectId, ref: "ProductGroup" },
  productGroupName:  { type: String },
  productId:         { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  productName:       { type: String, required: true },

  // Stock quantities
  systemQty:         { type: Number, default: 0 },   // Snapshot of closing qty at time of entry
  physicalQty:       { type: Number, default: 0 },   // What was counted physically

  // Auto-calculated on save
  inwardQty:         { type: Number, default: 0 },   // physicalQty > systemQty  → physical - system
  outwardQty:        { type: Number, default: 0 },   // systemQty > physicalQty  → system - physical

  // Optional fields
  batch:             { type: String, default: "" },
  expiryDate:        { type: Date },

  // Multiple users who checked/verified this count
  checkedBy:         [checkedBySchema],

  // Full edit history of physical qty changes
  physicalEditLog:   [physicalEditLogSchema],

  // Approval
  status:            { type: String, enum: ["DRAFT", "APPROVED"], default: "DRAFT" },
  approvedBy:        {
    userId:    { type: String },
    username:  { type: String },
    approvedAt: { type: Date }
  },
  adjustmentApplied: { type: Boolean, default: false },

}, { timestamps: true });

// Compound unique index: one SJ ID per branch
physicalStockEntrySchema.index({ branchId: 1, sjId: 1 }, { unique: true });

// Index for stock summary integration
physicalStockEntrySchema.index({ branchId: 1, productId: 1, status: 1 });

const PhysicalStockEntry = mongoose.model("PhysicalStockEntry", physicalStockEntrySchema);
export default PhysicalStockEntry;
