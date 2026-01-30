import express from "express";
import Customer from "../models/Customer.js";

const router = express.Router();

/**
 * POST: Add New Customer
 */
router.post("/", async (req, res) => {
  try {
    const {
      name,
      whatsapp,
      email,
      address,
      district,
      state,
      pincode,
      accountHolder,
      accountNumber,   // ✅ ADDED
      ifsc,
      branch,
      upi,
    } = req.body;

    // Basic validation
    if (!name || !whatsapp || !accountHolder || !accountNumber || !ifsc || !branch) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    // Optional: prevent duplicate WhatsApp
    const existing = await Customer.findOne({ whatsapp });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Customer already exists with this WhatsApp number",
      });
    }

    const customer = new Customer({
      name,
      whatsapp,
      email,
      address,
      district,
      state,
      pincode,
      accountHolder,
      accountNumber,   // ✅ ADDED
      ifsc,
      branch,
      upi,
    });

    const savedCustomer = await customer.save();

    res.status(201).json({
      success: true,
      message: "Customer saved successfully",
      data: savedCustomer,
    });
  } catch (error) {
    console.error("Save Customer Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save customer",
      error: error.message,
    });
  }
});

/**
 * GET: Fetch All Customers
 */
router.get("/", async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error("Fetch Customer Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message,
    });
  }
});

/**
 * DELETE: Remove Customer (optional)
 */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Customer.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.error("Delete Customer Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete customer",
      error: error.message,
    });
  }
});

export default router;
