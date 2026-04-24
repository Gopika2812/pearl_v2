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

    // Global search (Username or Description)
    if (username) {
      query.$or = [
        { username: { $regex: username, $options: "i" } },
        { description: { $regex: username, $options: "i" } }
      ];
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
      .populate("branchId")
      .sort({ createdAt: -1, _id: -1 })
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

import SalesOrder from "../models/SalesOrder.js";
import Invoice from "../models/Invoice.js";
import BranchUser from "../models/BranchUser.js";
import SuperAdmin from "../models/SuperAdmin.js";

// POST - Sync historical data to audit logs (Deeper Versioned Sync)
router.post("/sync-historical", async (req, res) => {
  try {
    console.log("🚀 Starting Deep Versioned Audit Log Sync...");
    
    // 1. Pre-fetch existing logs to prevent duplicates
    // We'll use a unique key: targetId_action_version (if we can infer version from description)
    const existingLogs = await AuditLog.find(
      { action: { $in: ["CREATE_SO", "INVOICE_SO", "RE_INVOICE_SO", "UPDATE_SALES_ORDER"] } },
      { targetId: 1, action: 1, description: 1 }
    ).lean();
    
    const existingMap = new Set(existingLogs.map(l => `${l.targetId?.toString()}_${l.action}_${l.description}`));

    // 2. Users Map
    const branchUsers = await BranchUser.find({}, { name: 1, username: 1, _id: 1 }).lean();
    const superAdmins = await SuperAdmin.find({}, { fullName: 1, username: 1, _id: 1 }).lean();
    
    const findUser = (name) => {
      if (!name) return null;
      const lowerName = name.toLowerCase();
      const bu = branchUsers.find(u => u.name?.toLowerCase() === lowerName || u.username?.toLowerCase() === lowerName);
      if (bu) return { id: bu._id, model: "BranchUser", username: bu.username };
      const sa = superAdmins.find(u => u.fullName?.toLowerCase() === lowerName || u.username?.toLowerCase() === lowerName);
      if (sa) return { id: sa._id, model: "SuperAdmin", username: sa.username };
      return null;
    };

    const newLogs = [];

    // 3. Process Sales Orders & their full Edit History
    const allOrders = await SalesOrder.find().lean();
    for (const so of allOrders) {
      // A. Create the initial "CREATE_SO" log if missing
      const createDesc = `Historical: Created Sales Order: ${so.invoiceId} for ${so.customer?.name || "Customer"}. Total: ₹${so.grandTotal}`;
      
      const hasCreateLog = existingLogs.some(l => {
        if (l.action !== "CREATE_SO") return false;
        return l.targetId?.toString() === so._id.toString() && l.description === createDesc;
      });

      if (!hasCreateLog) {
        let creator = findUser(so.billingPerson);
        // Fallback: If billingPerson name is not a user, just use the first available SuperAdmin for the log record but keep the username
        const userId = creator?.id || (superAdmins[0]?._id); 
        const userModel = creator?.model || "SuperAdmin";
        
        newLogs.push({
          user: userId,
          userModel: userModel,
          username: so.billingPerson || "System",
          branchId: so.branchId,
          action: "CREATE_SO",
          description: createDesc,
          targetId: so._id,
          targetModel: "SalesOrder",
          createdAt: so.createdAt,
        });
      }

      if (so.editHistory && so.editHistory.length > 0) {
        for (const history of so.editHistory) {
          let action = "UPDATE_SALES_ORDER";
          if (history.editType === "INVOICED") {
            action = (history.version > 1) ? "RE_INVOICE_SO" : "INVOICE_SO";
          }
          if (history.editType === "RE_INVOICED" || history.editType === "RE_EDIT_STARTED" || history.editType === "PRE_INVOICE_EDIT") {
            action = "RE_INVOICE_SO";
          }

          const historyDate = history.editedAt || so.updatedAt || new Date();
          const historyDateStr = new Date(historyDate).toISOString().split('T')[0];

          // 1. Check if ANY log exists for this specific history version
          const existingLog = existingLogs.find(l => 
            l.targetId?.toString() === so._id.toString() && 
            (l.description.includes(`Total: ₹${history.grandTotal}`) || l.description.includes(`V${history.version}`) || l.description.includes(so.invoiceId)) &&
            new Date(l.createdAt).toISOString().split('T')[0] === historyDateStr
          );

          if (existingLog) {
            // If the log exists but has the WRONG action, we update it!
            if (existingLog.action !== action) {
              await AuditLog.findByIdAndUpdate(existingLog._id, { action });
              syncCount++;
            }
          } else {
            // Create new log if missing
            const editorName = history.editedBy || so.billingPerson || "System";
            let editor = findUser(editorName);
            const userId = editor?.id || (superAdmins[0]?._id);
            const userModel = editor?.model || "SuperAdmin";

            newLogs.push({
              user: userId,
              userModel: userModel,
              username: editorName,
              branchId: so.branchId,
              action,
              description: `Historical: ${history.note || `Version ${history.version} (${history.editType})`}. Total: ₹${history.grandTotal}`,
              targetId: so._id,
              targetModel: "SalesOrder",
              createdAt: historyDate,
            });
          }
        }
      }
    }

    // 4. Bulk Insert
    if (newLogs.length > 0) {
      await AuditLog.insertMany(newLogs, { ordered: false });
    }

    console.log(`✅ Deep Sync Complete. Created ${newLogs.length} versioned logs.`);
    res.json({ success: true, message: `Deep Sync Successful! Successfully recovered ${newLogs.length} historical version logs (V1, V2, etc.).` });
  } catch (error) {
    console.error("❌ Deep Sync failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
