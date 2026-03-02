import express from "express";
import mongoose from "mongoose";
import SalesOwner from "../models/SalesOwner.js";

const router = express.Router();

// ✅ CREATE Sales Owner
router.post("/", async (req, res) => {
  console.log("POST /api/sales-owners", req.body);
  try {
    const { name, phone, role, branchId } = req.body;

    if (!name || !phone || !branchId) {
      return res.status(400).json({ message: "Name, phone, and branchId are required" });
    }

    const exists = await SalesOwner.findOne({ branchId, name });
    if (exists) {
      return res.status(400).json({ message: "Sales Owner already exists in this branch" });
    }

    const salesOwner = new SalesOwner({
      branchId,
      name,
      phone,
      role: role || "Sales Owner",
      isActive: true,
    });

    await salesOwner.save();
    res.status(201).json({
      success: true,
      message: "Sales Owner created successfully",
      data: salesOwner,
    });
  } catch (err) {
    console.error("Create Sales Owner Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ GET all Sales Owners (filtered by branchId)
router.get("/", async (req, res) => {
  try {
    const { branchId } = req.query;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const salesOwners = await SalesOwner.find({ branchId, isActive: true }).sort({
      createdAt: -1,
    });
    res.json({
      success: true,
      data: salesOwners,
    });
  } catch (err) {
    console.error("Fetch Sales Owner Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales owners",
      error: err.message,
    });
  }
});

// ✅ UPDATE Sales Owner
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Sales Owner ID",
      });
    }

    const updatedSalesOwner = await SalesOwner.findByIdAndUpdate(
      id,
      {
        name,
        phone,
        role,
        isActive,
      },
      { new: true }
    );

    if (!updatedSalesOwner) {
      return res.status(404).json({
        success: false,
        message: "Sales Owner not found",
      });
    }

    res.json({
      success: true,
      message: "Sales Owner updated successfully",
      data: updatedSalesOwner,
    });
  } catch (error) {
    console.error("Update Sales Owner Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sales owner",
      error: error.message,
    });
  }
});

// ✅ DELETE Sales Owner
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Sales Owner ID",
      });
    }

    const deletedSalesOwner = await SalesOwner.findByIdAndDelete(id);

    if (!deletedSalesOwner) {
      return res.status(404).json({
        success: false,
        message: "Sales Owner not found",
      });
    }

    res.json({
      success: true,
      message: "Sales Owner deleted successfully",
      data: deletedSalesOwner,
    });
  } catch (error) {
    console.error("Delete Sales Owner Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete sales owner",
      error: error.message,
    });
  }
});

export default router;
