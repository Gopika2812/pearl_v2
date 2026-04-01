import express from "express";
import ExtraExpenseMaster from "../models/ExtraExpenseMaster.js";

const router = express.Router();

// Get all extra expense names for a branch
router.get("/:branchId", async (req, res) => {
  const { branchId } = req.params;

  try {
    const expenses = await ExtraExpenseMaster.find({ branchId }).sort({ name: 1 });
    res.status(200).json({ success: true, data: expenses });
  } catch (error) {
    console.error("❌ Error fetching extra expense names:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save a new extra expense name
router.post("/", async (req, res) => {
  const { branchId, name } = req.body;

  if (!branchId || !name) {
    return res.status(400).json({ success: false, message: "Branch ID and Name are required" });
  }

  try {
    // Perform an upsert to prevent duplicates
    const expense = await ExtraExpenseMaster.findOneAndUpdate(
      { branchId, name: name.trim() },
      { branchId, name: name.trim() },
      { upsert: true, new: true }
    );

    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    console.error("❌ Error saving extra expense name:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
