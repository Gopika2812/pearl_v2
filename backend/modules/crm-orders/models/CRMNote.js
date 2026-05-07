import mongoose from "mongoose";

const crmNoteSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "CRMOrderSession", required: true },
  note: { type: String, required: true },
  showToCustomer: { type: Boolean, default: true },
  createdBy: { type: String },
}, { timestamps: true });

export default mongoose.model("CRMNote", crmNoteSchema);
