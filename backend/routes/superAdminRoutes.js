import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import auth from "../middleware/auth.js";
import rbac from "../middleware/rbac.js";
import Branch from "../models/Branch.js";
import BranchUser from "../models/BranchUser.js";
import PendingRegistration from "../models/PendingRegistration.js";
import SuperAdmin from "../models/SuperAdmin.js";
import {
    sendApprovalEmail
} from "../utils/emailService.js";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import Invoice from "../models/Invoice.js";
import CreditNote from "../models/CreditNote.js";
import DebitNote from "../models/DebitNote.js";
import mongoose from "mongoose";

const router = express.Router();

// ==================== SUPER ADMIN AUTHENTICATION ====================

/**
 * POST: Super Admin Login
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Find super admin
    const superAdmin = await SuperAdmin.findOne({ username });

    if (!superAdmin) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Check if super admin is active
    if (superAdmin.status !== "ACTIVE") {
      return res.status(401).json({
        success: false,
        message: "Super admin account is inactive",
      });
    }

    // Compare password (try bcrypt first, then fallback to plaintext for testing)
    let isPasswordValid = false;
    
    try {
      isPasswordValid = await superAdmin.comparePassword(password);
    } catch (error) {
      console.log("Bcrypt comparison failed, trying plaintext...");
    }
    
    // Fallback: plaintext comparison (for testing with web UI inserted passwords)
    if (!isPasswordValid && superAdmin.password === password) {
      isPasswordValid = true;
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Create JWT token (skip lastLogin update for now to avoid save() hook issues)
    const token = jwt.sign(
      {
        id: superAdmin._id,
        username: superAdmin.username,
        role: "SUPER_ADMIN",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      data: {
        id: superAdmin._id,
        username: superAdmin.username,
        email: superAdmin.email,
        fullName: superAdmin.fullName,
        role: "SUPER_ADMIN",
      },
    });
  } catch (error) {
    console.error("Super Admin Login Error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
});


/**
 * GET: All pending registrations (Super Admin only)
 */
router.get("/pending-registrations", auth, rbac(["SUPER_ADMIN"]), async (req, res) => {
  try {
    const pendingRegs = await PendingRegistration.find({
      status: "PENDING",
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: pendingRegs,
    });
  } catch (error) {
    console.error("Fetch Pending Registrations Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending registrations",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET: All branches (Super Admin only)
 */
router.get("/branches", auth, rbac(["SUPER_ADMIN"]), async (req, res) => {
  try {
    const branches = await Branch.find({}).sort({ isMainBranch: -1, createdAt: 1 });

    res.json({
      success: true,
      data: branches,
    });
  } catch (error) {
    console.error("Fetch Branches Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch branches",
      error: error.message,
    });
  }
});

/**
 * GET: Dashboard Stats (Super Admin only)
 * Calculates total purchase, sales, credit note, and debit note values
 */
router.get("/dashboard-stats", auth, rbac(["SUPER_ADMIN"]), async (req, res) => {
  try {
    const { branchId, startDate, endDate } = req.query;

    const matchPi = {};
    const matchInv = { status: { $nin: ["DRAFT", "CANCELLED"] } }; // ignore ungenerated/cancelled
    const matchCn = { status: { $ne: "Cancelled" } };
    const matchDn = { status: { $ne: "Cancelled" } };

    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
      const bId = new mongoose.Types.ObjectId(branchId);
      matchPi.branchId = bId;
      matchInv.branchId = bId;
      matchCn.branchId = bId;
      matchDn.branchId = bId;
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      matchPi.invoiceDate = { $gte: start, $lte: end };
      matchInv.invoiceDate = { $gte: start, $lte: end };
      matchCn.date = { $gte: start, $lte: end };
      matchDn.date = { $gte: start, $lte: end };
    }

    // Run aggregations in parallel
    const [piResult, invResult, cnResult, dnResult] = await Promise.all([
      PurchaseInvoice.aggregate([
        { $match: matchPi },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } }
      ]),
      Invoice.aggregate([
        { $match: matchInv },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } }
      ]),
      CreditNote.aggregate([
        { $match: matchCn },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } }
      ]),
      DebitNote.aggregate([
        { $match: matchDn },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalPurchase: piResult[0]?.total || 0,
        totalSales: invResult[0]?.total || 0,
        totalCreditNote: cnResult[0]?.total || 0,
        totalDebitNote: dnResult[0]?.total || 0,
      }
    });

  } catch (error) {
    console.error("Fetch Dashboard Stats Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: error.message,
    });
  }
});

/**
 * GET: All registrations (pending + approved + rejected)
 * Allows super admin to view all user registrations for approval and management
 */
router.get("/all-registrations", auth, rbac(["SUPER_ADMIN"]), async (req, res) => {
  try {
    const regs = await PendingRegistration.find({}).sort({ createdAt: -1 });
    res.json({ success: true, data: regs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch registrations", error: error.message });
  }
});

/**
 * GET: Fetch single super admin by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await SuperAdmin.findById(id).select("-password");
    if (!admin) {
      return res.status(404).json({ success: false, message: "Super Admin not found" });
    }
    res.json({ success: true, data: admin });
  } catch (error) {
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
});

/**
 * POST: Approve user registration (Super Admin only)
 */
router.post("/approve-registration/:registrationId", auth, rbac(["SUPER_ADMIN"]), async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { role: roleOverride } = req.body;
    const superAdminId = req.user.id;

    // Find pending registration
    const pendingReg = await PendingRegistration.findById(registrationId);

    if (!pendingReg) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    if (pendingReg.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Registration is not pending",
      });
    }

    // Check if OTP is expired
    if (new Date() > pendingReg.otpExpires) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. User must register again.",
      });
    }

    // Find matching branches by code (comma-separated support)
    const codes = pendingReg.branchCode.split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
    const branches = await Branch.find({ code: { $in: codes } });

    if (branches.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Branch(es) with code(s) "${pendingReg.branchCode}" not found`,
      });
    }

    const primaryBranch = branches[0];
    const allowedBranchIds = branches.map(b => b._id);

    // Determine the final role (use override if provided, else use requested role)
    const finalRole = roleOverride || pendingReg.role;

    // Create new user
    const newUser = new BranchUser({
      name: pendingReg.name,
      username: pendingReg.username,
      password: pendingReg.password,
      email: pendingReg.email,
      branch: primaryBranch._id,
      branchName: primaryBranch.name,
      allowedBranches: allowedBranchIds,
      role: finalRole,
      status: "ACTIVE",
    });

    await newUser.save();

    // Update pending registration
    pendingReg.status = "APPROVED";
    pendingReg.approvedBy = superAdminId;
    await pendingReg.save();

    // Send approval email to user
    try {
      await sendApprovalEmail(pendingReg.email, pendingReg.username);
    } catch (emailError) {
      console.error("Error sending approval email:", emailError);
      // Don't fail the approval if email fails
    }

    res.json({
      success: true,
      message: "Registration approved successfully",
      data: {
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        branch: branches.map(b => b.name).join(", "),
      },
    });
  } catch (error) {
    console.error("Approve Registration Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve registration",
      error: error.message,
    });
  }
});

/**
 * POST: Reject user registration (Super Admin only)
 */
router.post("/reject-registration/:registrationId", auth, rbac(["SUPER_ADMIN"]), async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { reason } = req.body;

    // Find pending registration
    const pendingReg = await PendingRegistration.findById(registrationId);

    if (!pendingReg) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    if (pendingReg.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Registration is not pending",
      });
    }

    // Update pending registration
    pendingReg.status = "REJECTED";
    pendingReg.rejectionReason = reason || "Not specified";
    await pendingReg.save();

    // Send rejection email to user
    try {
      await sendRejectionEmail(pendingReg.email, pendingReg.username, reason);
    } catch (emailError) {
      console.error("Error sending rejection email:", emailError);
    }

    res.json({
      success: true,
      message: "Registration rejected successfully",
    });
  } catch (error) {
    console.error("Reject Registration Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject registration",
      error: error.message,
    });
  }
});

// ==================== SUPER ADMIN USER MANAGEMENT ====================

/**
 * PATCH: Update BranchUser role/credentials (Super Admin only)
 * Allows super admin to change role, password, or other fields for any user
 */
router.patch("/update-user/:userId", auth, rbac(["SUPER_ADMIN"]), async (req, res) => {
  try {
    const { userId } = req.params;
    const update = req.body; // { role, password, ... }
    // If password is present, hash it before update
    if (update.password) {
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(update.password, salt);
    }
    const user = await BranchUser.findByIdAndUpdate(userId, update, { new: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update user", error: error.message });
  }
});

export default router;
