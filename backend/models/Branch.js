import mongoose from "mongoose";

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    location: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "",
    },
    manager: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    logo: {
      type: String,
      default: null,
    },
    color: {
      type: String,
      default: "#1e7a96",
    },
    isMainBranch: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Branch = mongoose.model("Branch", branchSchema);

export default Branch;
