import mongoose from "mongoose";

const pendingRegistrationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    branchCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["ADMIN", "MANAGER", "SALES_OWNER", "SALESMAN", "DELIVERY_MAN"],
      required: true,
    },
    otp: {
      type: String,
      required: true,
    },
    otpExpires: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdmin",
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Index to auto-delete expired OTP records
pendingRegistrationSchema.index({ otpExpires: 1 }, { expireAfterSeconds: 0 });

const PendingRegistration = mongoose.model(
  "PendingRegistration",
  pendingRegistrationSchema
);
export default PendingRegistration;
