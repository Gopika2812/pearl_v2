import express from "express";
import BillingPerson from "../models/BillingPerson.js";

const router = express.Router();

/**
 * POST: Add Billing Person / Agent
 */
router.post("/", async (req, res) => {
  try {
    const { name, designation } = req.body;

    if (!name || !designation) {
      return res.status(400).json({
        success: false,
        message: "Name and Designation are required",
      });
    }

    // Optional: prevent duplicate name + designation
    const existing = await BillingPerson.findOne({ name, designation });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This person already exists",
      });
    }

    const person = new BillingPerson({ name, designation });
    const savedPerson = await person.save();

    res.status(201).json({
      success: true,
      message: "Billing person saved successfully",
      data: savedPerson,
    });
  } catch (error) {
    console.error("Save Billing Person Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save billing person",
      error: error.message,
    });
  }
});

/**
 * GET: Fetch All Billing Persons
 */
router.get("/", async (req, res) => {
  try {
    const persons = await BillingPerson.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: persons,
    });
  } catch (error) {
    console.error("Fetch Billing Person Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch billing persons",
      error: error.message,
    });
  }
});

/**
 * DELETE: Remove Billing Person (optional)
 */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await BillingPerson.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Billing person not found",
      });
    }

    res.json({
      success: true,
      message: "Billing person deleted successfully",
    });
  } catch (error) {
    console.error("Delete Billing Person Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete billing person",
      error: error.message,
    });
  }
});

export default router;
