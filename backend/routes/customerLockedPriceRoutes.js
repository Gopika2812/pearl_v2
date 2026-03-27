import mongoose from "mongoose";
import express from "express";
import CustomerLockedPrice from "../models/CustomerLockedPrice.js";

const router = express.Router();

/**
 * POST: Save or Update Customer Locked Price
 */
router.post("/", async (req, res) => {
  try {
    const { branchId, customerId, productId, lockedPrice } = req.body;

    if (!branchId || !customerId || !productId || lockedPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: "branchId, customerId, productId, and lockedPrice are required",
      });
    }

    // Upsert: update existing or create new
    const result = await CustomerLockedPrice.findOneAndUpdate(
      { branchId, customerId, productId },
      { lockedPrice },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      data: result,
      message: "Customer locked price saved successfully",
    });
  } catch (error) {
    console.error("Save Customer Locked Price Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save customer locked price",
      error: error.message,
    });
  }
});

/**
 * GET: Fetch All Customer Locked Prices for a Branch
 */
router.get("/branch/:branchId", async (req, res) => {
  try {
    const { branchId } = req.params;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "branchId is required",
      });
    }

    const lockedPrices = await CustomerLockedPrice.find({ 
        branchId: new mongoose.Types.ObjectId(branchId) 
      })
      .populate("customerId", "name")
      .populate("productId", "name purchasingPrice sellingPrice")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: lockedPrices,
    });
  } catch (error) {
    console.error("Fetch Branch Locked Prices Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch branch locked prices",
      error: error.message,
    });
  }
});

/**
 * GET: Fetch Customer Locked Price
 */
router.get("/:customerId/:productId", async (req, res) => {
  try {
    const { customerId, productId } = req.params;
    const { branchId } = req.query;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "branchId is required",
      });
    }

    const lockedPriceEntry = await CustomerLockedPrice.findOne({
      branchId: new mongoose.Types.ObjectId(branchId),
      customerId,
      productId,
    });

    if (!lockedPriceEntry) {
      return res.status(404).json({
        success: false,
        message: "No locked price found for this customer and product",
      });
    }

    res.status(200).json({
      success: true,
      data: lockedPriceEntry,
    });
  } catch (error) {
    console.error("Fetch Customer Locked Price Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer locked price",
      error: error.message,
    });
  }
});

/**
 * DELETE: Remove Customer Locked Price
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await CustomerLockedPrice.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    res.status(200).json({ success: true, message: "Locked price removed" });
  } catch (error) {
    console.error("Delete Locked Price Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete" });
  }
});

export default router;
