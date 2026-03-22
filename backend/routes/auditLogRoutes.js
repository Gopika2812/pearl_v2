import express from "express";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();

// GET all audit logs for super admin
router.get("/", async (req, res) => {
  try {
    const { branchId, userId, action, page = 1, limit = 50 } = req.query;

    const query = {};
    if (branchId) query.branchId = branchId;
    if (userId) query.user = userId;
    if (action) query.action = action;

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
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching audit logs:", error);
    res.status(500).json({ success: false, message: "Failed to fetch audit logs" });
  }
});

export default router;
