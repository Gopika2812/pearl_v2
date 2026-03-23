import express from "express";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();

// GET all audit logs for super admin (with enhanced filters)
router.get("/", async (req, res) => {
  try {
    const { branchId, userId, action, username, startDate, endDate, page = 1, limit = 50 } = req.query;

    const query = {};
    if (branchId) query.branchId = branchId;
    if (userId) query.user = userId;
    if (action) query.action = action;

    // Username search (case-insensitive partial match)
    if (username) {
      query.username = { $regex: username, $options: "i" };
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        // Include the entire end day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await AuditLog.find(query)
      .populate("branchId", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching audit logs:", error);
    res.status(500).json({ success: false, message: "Failed to fetch audit logs" });
  }
});

// POST - Create an audit log entry directly (used by frontend for client-side events)
router.post("/", async (req, res) => {
  try {
    const { userId, userModel, username, branchId, action, description, targetId, targetModel, changes } = req.body;

    if (!userId || !username || !action || !description) {
      return res.status(400).json({ success: false, message: "userId, username, action, and description are required" });
    }

    const log = new AuditLog({
      user: userId,
      userModel: userModel || "BranchUser",
      username,
      branchId,
      action,
      description,
      targetId,
      targetModel,
      changes,
    });

    await log.save();
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    console.error("❌ Error creating audit log:", error);
    res.status(500).json({ success: false, message: "Failed to create audit log" });
  }
});

export default router;
