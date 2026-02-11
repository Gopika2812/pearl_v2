import express from "express";
import mongoose from "mongoose";
import Vendor from "../models/Vendor.js";

const router = express.Router();

// ✅ CREATE vendor
router.post("/", async (req, res) => {
   console.log("POST /api/vendors", req.body);
  try {
    const { name, phone, email, address, gstin } = req.body;

    const exists = await Vendor.findOne({ name });
    if (exists) {
      return res.status(400).json({ message: "Vendor already exists" });
    }

    const vendor = new Vendor({
      name,
      phone,
      email,
      address,
      gstin,
      isActive: true,
    });

    await vendor.save();
    res.status(201).json(vendor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ GET all vendors
router.get("/", async (req, res) => {
  try {
    const vendors = await Vendor.find({ isActive: true }).sort({
      createdAt: -1,
    });
    res.json({
      success: true,
      data: vendors,
    });
  } catch (err) {
    console.error("Fetch Vendor Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vendors",
      error: err.message,
    });
  }
});

// ✅ UPDATE vendor
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, gstin, isActive } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID",
      });
    }

    const updatedVendor = await Vendor.findByIdAndUpdate(
      id,
      {
        name,
        phone,
        email,
        address,
        gstin,
        isActive,
      },
      { new: true }
    );

    if (!updatedVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.json({
      success: true,
      message: "Vendor updated successfully",
      data: updatedVendor,
    });
  } catch (error) {
    console.error("Update Vendor Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update vendor",
      error: error.message,
    });
  }
});

// ✅ DELETE vendor
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID",
      });
    }

    const deletedVendor = await Vendor.findByIdAndDelete(id);

    if (!deletedVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.json({
      success: true,
      message: "Vendor deleted successfully",
      data: deletedVendor,
    });
  } catch (error) {
    console.error("Delete Vendor Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete vendor",
      error: error.message,
    });
  }
});

export default router;
