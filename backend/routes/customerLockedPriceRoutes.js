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
      branchId,
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

export default router;
