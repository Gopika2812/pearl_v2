import express from "express";
import Warehouse from "../models/Warehouse.js";

const router = express.Router();

/**
 * POST: Add Warehouse
 */
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Warehouse name is required",
      });
    }

    const exists = await Warehouse.findOne({ name: name.trim() });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Warehouse already exists",
      });
    }

    const warehouse = new Warehouse({
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
 * GET: Fetch All Warehouses
 */
router.get("/", async (req, res) => {
  try {
    const warehouses = await Warehouse.find().sort({ createdAt: -1 });

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

export default router;
