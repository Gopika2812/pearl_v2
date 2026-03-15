import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const superAdminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["SUPER_ADMIN"],
      default: "SUPER_ADMIN",
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
  },
  { timestamps: true }
);

// Hash password before saving (only hash if plaintext)
superAdminSchema.pre("save", async function (next) {
  // Skip if password hasn't changed
  if (!this.isModified("password")) {
    return next();
  }

  // Skip hashing if already hashed (starts with $2b$)
  if (this.password.startsWith("$2b$")) {
    return next();
  }

  // Hash plaintext password
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare passwords
superAdminSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const SuperAdmin = mongoose.model("SuperAdmin", superAdminSchema);
export default SuperAdmin;
