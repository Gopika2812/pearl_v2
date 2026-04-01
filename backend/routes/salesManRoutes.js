import express from "express";
import mongoose from "mongoose";
import SalesMan from "../models/SalesMan.js";
import auth from "../middleware/auth.js";
import { createAuditLog } from "../utils/logUtil.js";

const router = express.Router();

// ✅ CREATE Sales Man
router.post("/", auth, async (req, res) => {
  console.log("POST /api/sales-men", req.body);
  try {
    const { name, phone, role, branchId } = req.body;

    if (!name || !phone || !branchId) {
      return res.status(400).json({ message: "Name, phone, and branchId are required" });
    }

    const exists = await SalesMan.findOne({ branchId, name });
    if (exists) {
      return res.status(400).json({ message: "Sales Man already exists in this branch" });
    }

    const salesMan = new SalesMan({
      branchId,
      name,
      phone,
      role: role || "Sales Man",
      isActive: true,
    });

    await salesMan.save();

    // Log the creation
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: req.user.branch || branchId,
      action: "CREATE_SALES_MAN",
      description: `Created Sales Man: ${name} (Role: ${salesMan.role})`,
      targetId: salesMan._id,
      targetModel: "SalesMan",
    });

    res.status(201).json({
      success: true,
      message: "Sales Man created successfully",
      data: salesMan,
    });
  } catch (err) {
    console.error("Create Sales Man Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ GET all Sales Men (filtered by branchId)
router.get("/", async (req, res) => {
  try {
    const { branchId } = req.query;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const salesMen = await SalesMan.find({ branchId, isActive: true }).sort({
      createdAt: -1,
    });
    res.json({
      success: true,
      data: salesMen,
    });
  } catch (err) {
    console.error("Fetch Sales Man Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales men",
      error: err.message,
    });
  }
});

// ✅ UPDATE Sales Man
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Sales Man ID",
      });
    }

    const oldSalesMan = await SalesMan.findById(id);
    if (!oldSalesMan) {
      return res.status(404).json({
        success: false,
        message: "Sales Man not found",
      });
    }

    const updatedSalesMan = await SalesMan.findByIdAndUpdate(
      id,
      {
        name,
        phone,
        role,
        isActive,
      },
      { new: true }
    );

    // Prepare changes for audit log
    const changes = {
      before: {
        name: oldSalesMan.name,
        phone: oldSalesMan.phone,
        role: oldSalesMan.role,
        isActive: oldSalesMan.isActive,
      },
      after: {
        name: updatedSalesMan.name,
        phone: updatedSalesMan.phone,
        role: updatedSalesMan.role,
        isActive: updatedSalesMan.isActive,
      },
    };

    // Log the update
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: req.user.branch || updatedSalesMan.branchId,
      action: "UPDATE_SALES_MAN",
      description: `Updated Sales Man: ${updatedSalesMan.name}`,
      targetId: updatedSalesMan._id,
      targetModel: "SalesMan",
      changes,
    });

    res.json({
      success: true,
      message: "Sales Man updated successfully",
      data: updatedSalesMan,
    });
  } catch (error) {
    console.error("Update Sales Man Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sales man",
      error: error.message,
    });
  }
});

// ✅ DELETE Sales Man
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Sales Man ID",
      });
    }

    const deletedSalesMan = await SalesMan.findByIdAndDelete(id);

    if (!deletedSalesMan) {
      return res.status(404).json({
        success: false,
        message: "Sales Man not found",
      });
    }

    // Log the deletion
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: req.user.branch || deletedSalesMan.branchId,
      action: "DELETE_SALES_MAN",
      description: `Deleted Sales Man: ${deletedSalesMan.name}`,
      targetId: id,
      targetModel: "SalesMan",
    });

    res.json({
      success: true,
      message: "Sales Man deleted successfully",
      data: deletedSalesMan,
    });
  } catch (error) {
    console.error("Delete Sales Man Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete sales man",
      error: error.message,
    });
  }
});

export default router;
