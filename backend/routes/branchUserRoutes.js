import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createAuditLog } from "../utils/logUtil.js";
import Branch from "../models/Branch.js";
import BranchUser from "../models/BranchUser.js";
import PendingRegistration from "../models/PendingRegistration.js";
import SuperAdmin from "../models/SuperAdmin.js";
import { sendOTPEmail } from "../utils/emailService.js";
import auth from "../middleware/auth.js";

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

    // Find branch
    const branch = await Branch.findOne({ code: branchCode.toUpperCase() });
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: `Branch code "${branchCode}" not found`,
      });
    }

    // Create NEW PendingRegistration (this is where we now start the workflow)
    const newPending = new PendingRegistration({
      name,
      username,
      email,
      password, // Password will be hashed by pre-save hook on BranchUser later, or we can hash it here
      branchCode: branchCode.toUpperCase(),
      role: role,
      status: "PENDING",
      otp: generateOTP(), // Required by schema
      otpExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours for admin
    });

    await newPending.save();

    console.log(`⏳ User "${username}" registration requested (PENDING APPROVAL)`);

    res.status(201).json({
      success: true,
      message: "Registration request sent! Please wait for Super Admin approval before you can login.",
      data: {
        registrationId: newPending._id,
        username: newPending.username,
        status: "PENDING",
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

    // Update pending registration as "VERIFIED" (but still not active user)
    pendingReg.status = "PENDING"; // Keep it pending for admin approval
    await pendingReg.save();

    console.log(`✅ OTP Verified for "${pendingReg.username}". Awaiting Admin Approval.`);

    res.status(200).json({
      success: true,
      message: "OTP verified successfully! Your account is now awaiting Super Admin approval.",
      data: {
        registrationId: pendingReg._id,
        username: pendingReg.username,
        status: "PENDING",
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
        allowedPages: user.allowedPages || [],
        fieldPermissions: user.fieldPermissions || {},
        actionPermissions: user.actionPermissions || {},
        allowedVoucherTypes: user.allowedVoucherTypes || [],
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Log successful login
    await createAuditLog({
      userId: user._id,
      username: user.username,
      branchId: user.branch._id,
      action: "LOGIN",
      description: `User ${user.username} logged in to branch ${user.branch.name || user.branch.location || "Branch"}`,
    });

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
        allowedPages: user.allowedPages || [],
        fieldPermissions: user.fieldPermissions || {},
        actionPermissions: user.actionPermissions || {},
        allowedVoucherTypes: user.allowedVoucherTypes || [],
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

// GET: Fetch users (optionally filter by username)
router.get("/", auth, async (req, res) => {
  try {
    const { username } = req.query;
    let query = {};
    if (username) {
      query.username = username.toLowerCase();
    }

    const users = await BranchUser.find(query)
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
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const oldUser = await BranchUser.findById(id);
    if (!oldUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updateData = {};
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (req.body.allowedPages !== undefined) updateData.allowedPages = req.body.allowedPages;
    if (req.body.fieldPermissions !== undefined) updateData.fieldPermissions = req.body.fieldPermissions;
    if (req.body.actionPermissions !== undefined) updateData.actionPermissions = req.body.actionPermissions;
    if (req.body.allowedVoucherTypes !== undefined) updateData.allowedVoucherTypes = req.body.allowedVoucherTypes;
    if (req.body.allowedQuickLinks !== undefined) updateData.allowedQuickLinks = req.body.allowedQuickLinks;

    const user = await BranchUser.findByIdAndUpdate(id, updateData, {
      new: true,
    }).select("-password");

    // Log the update
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: req.user.branch || user.branch,
      action: "UPDATE_USER",
      description: `Updated user: ${user.username}`,
      targetId: id,
      targetModel: "BranchUser",
      changes: {
        before: {
          email: oldUser.email,
          role: oldUser.role,
          status: oldUser.status,
          allowedPages: oldUser.allowedPages,
          allowedQuickLinks: oldUser.allowedQuickLinks
        },
        after: {
          email: user.email,
          role: user.role,
          status: user.status,
          allowedPages: user.allowedPages,
          allowedQuickLinks: user.allowedQuickLinks
        }
      }
    });

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
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== "SUPER_ADMIN" && req.user.id !== id) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

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

    // Log the deletion
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: req.user.branch || user.branch,
      action: "DELETE_USER",
      description: `Deleted user: ${user.username}`,
      targetId: id,
      targetModel: "BranchUser"
    });

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
