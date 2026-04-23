import express from "express";
import mongoose from "mongoose";
import auth from "../middleware/auth.js";
import Token from "../models/Token.js";
import Branch from "../models/Branch.js";
import { getFinancialYear } from "../utils/financialYear.js";
import { createAuditLog } from "../utils/logUtil.js";

const router = express.Router();
 
// GET all tokens (filtered by branchId query param)
router.get("/", auth, async (req, res) => {
  try {
    const { branchId, status } = req.query;
    if (!branchId) return res.status(400).json({ success: false, message: "branchId is required" });

    let query = { branchId };
    
    // Role-based visibility
    if (req.user.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN") {
      query.$or = [
        { "createdBy.id": req.user.id },
        { "assignedTo.id": req.user.id }
      ];
    }

    if (status && status !== "ALL") {
      query.status = status;
    }

    const tokens = await Token.find(query)
      .populate("assignedTo.id", "fullName username role")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: tokens });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET: Fetch all active tokens for a branch
router.get("/branch/:branchId", auth, async (req, res) => {
  try {
    const { branchId } = req.params;
    const { status } = req.query;

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ success: false, message: "Invalid branch ID" });
    }

    let query = { branchId };
    
    // Day-specific filter if requested
    if (req.query.todayOnly === "true") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      query.createdAt = { $gte: startOfToday };
    }

    // Role-based visibility:
    // ADMIN and SUPER_ADMIN see all. Others see only what they created OR what is assigned to them.
    if (req.user.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN") {
      query.$or = [
        { "createdBy.id": req.user.id },
        { "assignedTo.id": req.user.id }
      ];
    }

    if (status && status !== "ALL") {
      query.status = status;
    } else if (!status) {
      // Default: exclude completed and cancelled unless specified
      query.status = { $in: ["OPEN", "TAKEN", "IN_PROGRESS"] };
    }
    // If status is "ALL", no status filter is applied to the query

    const tokens = await Token.find(query)
      .populate("assignedTo.id", "fullName username role")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: tokens });
  } catch (error) {
    console.error("Fetch Tokens Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch tokens" });
  }
});

// POST: Create a new token
router.post("/", auth, async (req, res) => {
  try {
    const { branchId, assignedTo, customer, message } = req.body;

    if (!branchId || !message) {
      return res.status(400).json({ success: false, message: "Missing required fields (branch or message)" });
    }

    const finalCustomer = customer || { name: "INTERNAL" };
    const finalAssignedTo = assignedTo || { id: null, name: "Unassigned" };
    
    // Set createdBy from authenticated user details
    const finalCreatedBy = {
      id: req.user.id,
      name: req.user.fullName || req.user.username,
      username: req.user.username
    };

    // 1. Get Branch Code for ID generation
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }
    const branchCode = branch.code || "BR";
    const financialYear = getFinancialYear();

    // 2. Sequential ID Logic
    let tokenId;
    let saved = false;
    let retries = 0;

    while (!saved && retries < 5) {
      try {
        const lastToken = await Token.findOne({
          branchId,
          tokenId: new RegExp(`^TOK-${branchCode}-`)
        }).sort({ createdAt: -1 });

        let nextNumber = 1;
        if (lastToken) {
          const parts = lastToken.tokenId.split("-");
          const lastNum = parseInt(parts[2]);
          if (!isNaN(lastNum)) nextNumber = lastNum + 1;
        }

        tokenId = `TOK-${branchCode}-${String(nextNumber).padStart(3, "0")}`;

        const newToken = new Token({
          tokenId,
          branchId,
          createdBy: finalCreatedBy,
          assignedTo: {
            ...finalAssignedTo,
            id: finalAssignedTo.id || undefined
          },
          customer: finalCustomer,
          message,
          status: "OPEN"
        });

        await newToken.save();
        saved = true;
        
        // Log creation
        await createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          branchId,
          action: "CREATE_TOKEN",
          description: `Created token ${tokenId}${finalCustomer.name !== 'INTERNAL' ? ' for customer ' + finalCustomer.name : ' (Internal Task)'}`,
          targetId: newToken._id,
          targetModel: "Token"
        });

        res.status(201).json({ success: true, data: newToken });
      } catch (err) {
        if (err.code === 11000) {
          retries++;
        } else {
          throw err;
        }
      }
    }

    if (!saved) {
      res.status(500).json({ success: false, message: "Failed to generate unique Token ID" });
    }
  } catch (error) {
    console.error("Create Token Error:", error);
    res.status(500).json({ success: false, message: "Failed to create token" });
  }
});

// PATCH: Update token status
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, takenBy, salesOrderId } = req.body;

    const token = await Token.findById(id);
    if (!token) {
      return res.status(404).json({ success: false, message: "Token not found" });
    }

    const oldStatus = token.status;
    token.status = status;

    if (status === "TAKEN" || status === "IN_PROGRESS") {
      token.takenBy = takenBy || req.user.id;
      if (!token.takenAt) token.takenAt = new Date();
      if (status === "IN_PROGRESS" && !token.inProgressAt) token.inProgressAt = new Date();
    }

    if (status === "COMPLETED") {
      token.finishedAt = new Date();
      if (salesOrderId) token.salesOrderId = salesOrderId;
    }

    await token.save();

    // Log status change
    await createAuditLog({
      userId: req.user.id,
      username: req.user.username,
      branchId: token.branchId,
      action: "UPDATE_TOKEN_STATUS",
      description: `Updated token ${token.tokenId} status from ${oldStatus} to ${status}`,
      targetId: token._id,
      targetModel: "Token"
    });

    res.json({ success: true, data: token });
  } catch (error) {
    console.error("Update Token Status Error:", error);
    res.status(500).json({ success: false, message: "Failed to update token status" });
  }
});

// DELETE: Cancel Token
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const token = await Token.findById(id);
    if (!token) {
      return res.status(404).json({ success: false, message: "Token not found" });
    }

    token.status = "CANCELLED";
    await token.save();

    res.json({ success: true, message: "Token cancelled" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to cancel token" });
  }
});

// PATCH: Assign token to someone (Admin only)
router.patch("/:id/assign", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (req.user.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Only admins can assign tokens" });
    }

    const token = await Token.findById(id);
    if (!token) return res.status(404).json({ success: false, message: "Token not found" });

    token.assignedTo = assignedTo;
    await token.save();

    // Log assignment
    await createAuditLog({
      userId: req.user.id,
      username: req.user.username,
      branchId: token.branchId,
      action: "ASSIGN_TOKEN",
      description: `Assigned token ${token.tokenId} to ${assignedTo.name}`,
      targetId: token._id,
      targetModel: "Token"
    });

    res.json({ success: true, data: token });
  } catch (error) {
    console.error("Assign Token Error:", error);
    res.status(500).json({ success: false, message: "Failed to assign token" });
  }
});

// GET: Fetch stats for Super Admin (counts across all branches for today)
router.get("/stats/super-admin", auth, async (req, res) => {
  try {
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Only Super Admins can access global stats" });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayTotal = await Token.countDocuments({
      createdAt: { $gte: startOfToday }
    });

    const todayPending = await Token.countDocuments({
      createdAt: { $gte: startOfToday },
      status: { $in: ["OPEN", "TAKEN", "IN_PROGRESS"] }
    });

    res.json({
      success: true,
      data: {
        todayTotal,
        todayPending
      }
    });
  } catch (error) {
    console.error("Super Admin Stats Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch topbar stats" });
  }
});

// GET: Fetch personalized reminders for Home page (All assigned tokens, active first)
router.get("/reminders/my", auth, async (req, res) => {
  try {
    const tokens = await Token.find({ "assignedTo.id": req.user.id })
      .sort({ createdAt: -1 });

    // Custom sort: Active (OPEN, TAKEN, IN_PROGRESS) first
    const statusPriority = {
      "OPEN": 1,
      "TAKEN": 1,
      "IN_PROGRESS": 1,
      "COMPLETED": 2,
      "CANCELLED": 3
    };

    const sortedTokens = tokens.sort((a, b) => {
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({ success: true, data: sortedTokens });
  } catch (error) {
    console.error("My Token Reminders Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch your token reminders" });
  }
});

export default router;
