import express from "express";
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
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
