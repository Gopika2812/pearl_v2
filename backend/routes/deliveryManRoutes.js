import express from "express";
import mongoose from "mongoose";
import DeliveryMan from "../models/DeliveryMan.js";

const router = express.Router();

// ✅ CREATE Delivery Man
router.post("/", async (req, res) => {
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
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Delivery Man ID",
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

    if (!updatedDeliveryMan) {
      return res.status(404).json({
        success: false,
        message: "Delivery Man not found",
      });
    }

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
router.delete("/:id", async (req, res) => {
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
