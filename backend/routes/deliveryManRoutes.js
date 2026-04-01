import express from "express";
import mongoose from "mongoose";
import DeliveryMan from "../models/DeliveryMan.js";
import auth from "../middleware/auth.js";
import { createAuditLog } from "../utils/logUtil.js";

const router = express.Router();

// ✅ CREATE Delivery Man
router.post("/", auth, async (req, res) => {
  console.log("POST /api/delivery-men", req.body);
  try {
    const { name, phone, role, branchId } = req.body;

    if (!name || !phone || !branchId) {
      return res.status(400).json({ message: "Name, phone, and branchId are required" });
    }

    const exists = await DeliveryMan.findOne({ branchId, name });
    if (exists) {
      return res.status(400).json({ message: "Delivery Man already exists in this branch" });
    }

    const deliveryMan = new DeliveryMan({
      branchId,
      name,
      phone,
      role: role || "Delivery Man",
      isActive: true,
    });

    await deliveryMan.save();

    // Log the creation
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: req.user.branch || branchId,
      action: "CREATE_DELIVERY_MAN",
      description: `Created Delivery Man: ${name} (Role: ${deliveryMan.role})`,
      targetId: deliveryMan._id,
      targetModel: "DeliveryMan",
    });

    res.status(201).json({
      success: true,
      message: "Delivery Man created successfully",
      data: deliveryMan,
    });
  } catch (err) {
    console.error("Create Delivery Man Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ GET all Delivery Men (filtered by branchId)
router.get("/", async (req, res) => {
  try {
    const { branchId } = req.query;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const deliveryMen = await DeliveryMan.find({ branchId, isActive: true }).sort({
      createdAt: -1,
    });
    res.json({
      success: true,
      data: deliveryMen,
    });
  } catch (err) {
    console.error("Fetch Delivery Man Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch delivery men",
      error: err.message,
    });
  }
});

// ✅ UPDATE Delivery Man
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Delivery Man ID",
      });
    }

    const oldDeliveryMan = await DeliveryMan.findById(id);
    if (!oldDeliveryMan) {
      return res.status(404).json({
        success: false,
        message: "Delivery Man not found",
      });
    }

    const updatedDeliveryMan = await DeliveryMan.findByIdAndUpdate(
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
        name: oldDeliveryMan.name,
        phone: oldDeliveryMan.phone,
        role: oldDeliveryMan.role,
        isActive: oldDeliveryMan.isActive,
      },
      after: {
        name: updatedDeliveryMan.name,
        phone: updatedDeliveryMan.phone,
        role: updatedDeliveryMan.role,
        isActive: updatedDeliveryMan.isActive,
      },
    };

    // Log the update
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: req.user.branch || updatedDeliveryMan.branchId,
      action: "UPDATE_DELIVERY_MAN",
      description: `Updated Delivery Man: ${updatedDeliveryMan.name}`,
      targetId: updatedDeliveryMan._id,
      targetModel: "DeliveryMan",
      changes,
    });

    res.json({
      success: true,
      message: "Delivery Man updated successfully",
      data: updatedDeliveryMan,
    });
  } catch (error) {
    console.error("Update Delivery Man Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update delivery man",
      error: error.message,
    });
  }
});

// ✅ DELETE Delivery Man
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Delivery Man ID",
      });
    }

    const deletedDeliveryMan = await DeliveryMan.findByIdAndDelete(id);

    if (!deletedDeliveryMan) {
      return res.status(404).json({
        success: false,
        message: "Delivery Man not found",
      });
    }

    // Log the deletion
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: req.user.branch || deletedDeliveryMan.branchId,
      action: "DELETE_DELIVERY_MAN",
      description: `Deleted Delivery Man: ${deletedDeliveryMan.name}`,
      targetId: id,
      targetModel: "DeliveryMan",
    });

    res.json({
      success: true,
      message: "Delivery Man deleted successfully",
      data: deletedDeliveryMan,
    });
  } catch (error) {
    console.error("Delete Delivery Man Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete delivery man",
      error: error.message,
    });
  }
});

export default router;
