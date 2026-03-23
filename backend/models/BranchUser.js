import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const branchUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    email: {
      type: String,
      default: "",
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    branchName: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["ADMIN", "MANAGER", "STAFF", "SALES_OWNER", "SALESMAN", "DELIVERY_MAN"],
      default: "STAFF",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    allowedPages: {
      type: [String],
      default: [],
    },
    fieldPermissions: {
      type: Map,
      of: Boolean,
      default: {},
    },
    actionPermissions: {
      type: Map,
      of: Boolean,
      default: {},
    },
    allowedVoucherTypes: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "VoucherType",
      default: [],
    },
  },
  { timestamps: true }
);

// Hash password before saving
branchUserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// Method to compare password
branchUserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const BranchUser = mongoose.model("BranchUser", branchUserSchema);

export default BranchUser;
