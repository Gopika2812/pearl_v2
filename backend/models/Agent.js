import mongoose from "mongoose";

const agentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Agent", agentSchema);
