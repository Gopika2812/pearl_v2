import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Branch from "../models/Branch.js";
import BranchUser from "../models/BranchUser.js";
import PendingRegistration from "../models/PendingRegistration.js";
import SuperAdmin from "../models/SuperAdmin.js";
import { sendOTPEmail } from "../utils/emailService.js";

const router = express.Router();

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// POST: Register new user for a branch (with OTP approval)
router.post("/register", async (req, res) => {
  try {
    const { name, username, email, password, confirmPassword, branchCode, role } = req.body;

    // Validation
    if (!name || !username || !email || !password || !confirmPassword || !branchCode || !role) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Check if username already exists
    const existingUser = await BranchUser.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
      });
    }

    // Check if pending registration already exists
    const existingPending = await PendingRegistration.findOne({
      username,
      status: "PENDING",
    });
    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: "Registration already pending approval",
      });
    }

    // Verify branch exists with the code
    const branch = await Branch.findOne({ code: branchCode.toUpperCase() });
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: `Branch code "${branchCode}" not found`,
      });
    }

    // Get Super Admin email
    const superAdmin = await SuperAdmin.findOne({ role: "SUPER_ADMIN" });
    if (!superAdmin) {
      return res.status(500).json({
        success: false,
        message: "Super admin not configured",
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Create pending registration
    const pendingReg = new PendingRegistration({
      name,
      username,
      email,
      password, // Will be hashed before creating actual user
      branchCode: branchCode.toUpperCase(),
      role,
      otp,
      otpExpires,
      status: "PENDING",
    });

    await pendingReg.save();

    // Send OTP email to super admin (non-blocking - don't delete if fails)
    try {
      await sendOTPEmail("gopika.p2812@gmail.com", username, otp, branchCode, role, email);
      console.log("✅ OTP email sent successfully");
    } catch (emailError) {
      console.error("⚠️  Email failed but registration saved:", emailError.text || emailError.message);
    }

    res.status(201).json({
      success: true,
      message: "Registration submitted! OTP sent to super admin.",
      data: {
        registrationId: pendingReg._id,
        username: pendingReg.username,
        email: pendingReg.email,
        message: "Please wait for super admin approval",
      },
    });
  } catch (error) {
    console.error("Register User Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to register user",
      error: error.message,
    });
  }
});

// POST: Verify OTP and create user
router.post("/verify-otp", async (req, res) => {
  try {
    const { registrationId, otp } = req.body;

    if (!registrationId || !otp) {
      return res.status(400).json({
        success: false,
        message: "Registration ID and OTP are required",
      });
    }

    // Find pending registration
    const pendingReg = await PendingRegistration.findById(registrationId);

    if (!pendingReg) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    // Check if OTP is expired
    if (new Date() > pendingReg.otpExpires) {
      await PendingRegistration.deleteOne({ _id: registrationId });
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please register again.",
      });
    }

    // Verify OTP
    if (pendingReg.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Find branch
    const branch = await Branch.findOne({ code: pendingReg.branchCode });
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    // Create new BranchUser
    const newUser = new BranchUser({
      name: pendingReg.name,
      username: pendingReg.username,
      email: pendingReg.email,
      password: pendingReg.password,
      role: pendingReg.role,
      branch: branch._id,
      status: "ACTIVE",
    });

    // Save user (password will be hashed by pre-save hook)
    await newUser.save();

    // Delete pending registration
    await PendingRegistration.deleteOne({ _id: registrationId });

    console.log(`✅ User "${pendingReg.username}" created successfully from registration`);

    res.status(201).json({
      success: true,
      message: "Registration confirmed! You can now login.",
      data: {
        userId: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      error: error.message,
    });
  }
});

// POST: Login user
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Find user
    const user = await BranchUser.findOne({ username }).populate("branch");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Check if user is active
    if (user.status !== "ACTIVE") {
      return res.status(401).json({
        success: false,
        message: "User account is inactive",
      });
    }

    // Check if branch is active
    if (user.branch.status !== "ACTIVE") {
      return res.status(401).json({
        success: false,
        message: "Branch is inactive",
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Create JWT token
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        branch: user.branch._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        branchId: user.branch._id,
        branch: {
          _id: user.branch._id,
          name: user.branch.name,
          code: user.branch.code,
          location: user.branch.location,
        },
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
});

// GET: Fetch all users for a branch
router.get("/branch/:branchId", async (req, res) => {
  try {
    const { branchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    const users = await BranchUser.find({ branch: branchId })
      .select("-password")
      .populate("branch", "name code location");

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Fetch Users Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
});

// GET: Fetch single user
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await BranchUser.findById(id)
      .select("-password")
      .populate("branch");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Fetch User Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: error.message,
    });
  }
});

// PUT: Update user
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const updateData = {};
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;

    const user = await BranchUser.findByIdAndUpdate(id, updateData, {
      new: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Update User Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
});

// DELETE: Delete user
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await BranchUser.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete User Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
});

export default router;
