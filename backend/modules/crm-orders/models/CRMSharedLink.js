import mongoose from "mongoose";

const crmSharedLinkSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "CRMOrderSession", required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date },
  isUsed: { type: Boolean, default: false },
  viewCount: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model("CRMSharedLink", crmSharedLinkSchema);
