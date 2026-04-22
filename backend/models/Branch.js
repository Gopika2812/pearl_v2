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
    city: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      default: "Tamil Nadu",
      trim: true,
    },
    stateCode: {
      type: String,
      default: "33", // 33 = Tamil Nadu
      trim: true,
      // Common state codes: 33=TN, 32=Karnataka, 29=Maharashtra, 27=Telangana, etc.
    },
    pincode: {
      type: String,
      default: "",
      trim: true,
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
    gstin: {
      type: String,
      default: "",
      trim: true,
    },
    gpayNo: {
      type: String,
      default: "",
      trim: true,
    },
    upiId: {
      type: String,
      default: "",
      trim: true,
    },
    gstzenClientId: {
      type: String,
      default: "",
      trim: true,
    },
    gstzenClientSecret: {
      type: String,
      default: "",
      trim: true,
    },
    tokenBlockTime: {
      type: Number,
      default: 120, // Default 120 minutes (2 hours)
    },

  },
  { timestamps: true }
);

const Branch = mongoose.model("Branch", branchSchema);

export default Branch;
