import express from "express";
import Warehouse from "../models/Warehouse.js";

const router = express.Router();

/**
 * POST: Add Warehouse
 */
router.post("/", async (req, res) => {
  try {
    const { name, branchId } = req.body;

    if (!name || !name.trim() || !branchId) {
      return res.status(400).json({
        success: false,
        message: "Warehouse name and branchId are required",
      });
    }

    const exists = await Warehouse.findOne({ branchId, name: name.trim() });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Warehouse already exists in this branch",
      });
    }

    const warehouse = new Warehouse({
      branchId,
      name: name.trim(),
    });

    const saved = await warehouse.save();

    res.status(201).json({
      success: true,
      message: "Warehouse saved successfully",
      data: saved,
    });
  } catch (error) {
    console.error("Warehouse save error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save warehouse",
      error: error.message,
    });
  }
});

/**
 * GET: Fetch All Warehouses (filtered by branchId)
 */
router.get("/", async (req, res) => {
  try {
    const { branchId } = req.query;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "branchId is required",
      });
    }

    const warehouses = await Warehouse.find({ branchId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: warehouses,
    });
  } catch (error) {
    console.error("Warehouse fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch warehouses",
      error: error.message,
    });
  }
});

/**
 * PUT: Update Warehouse
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const warehouse = await Warehouse.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    res.json({
      success: true,
      message: "Warehouse updated successfully",
      data: warehouse,
    });
  } catch (error) {
    console.error("Warehouse update error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update warehouse",
      error: error.message,
    });
  }
});

/**
 * DELETE: Delete Warehouse
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const warehouse = await Warehouse.findByIdAndDelete(id);

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    res.json({
      success: true,
      message: "Warehouse deleted successfully",
      data: warehouse,
    });
  } catch (error) {
    console.error("Warehouse delete error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete warehouse",
      error: error.message,
    });
  }
});

export default router;
