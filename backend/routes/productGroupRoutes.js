import express from "express";
import mongoose from "mongoose";
import ProductGroup from "../models/ProductGroup.js";
import VoucherType from "../models/VoucherType.js";

const router = express.Router();

// 🔹 CREATE Product Group
router.post("/", async (req, res) => {
  try {
    const { name, voucherId } = req.body;

    if (!name || !voucherId) {
      return res.status(400).json({ message: "Name and Voucher ID required" });
    }

    // 🔒 Prevent CastError
    if (!mongoose.Types.ObjectId.isValid(voucherId)) {
      return res.status(400).json({ message: "Invalid Voucher ID format" });
    }

    const voucher = await VoucherType.findById(voucherId);
    if (!voucher) {
      return res.status(400).json({ message: "Invalid Voucher Type" });
    }

    const exists = await ProductGroup.findOne({
      name: name.trim(),
      voucherType: voucherId,
    });

    if (exists) {
      return res
        .status(400)
        .json({ message: "Product Group already exists" });
    }

    const group = new ProductGroup({
      name: name.trim(),
      voucherType: voucherId,
    });

    await group.save();

    const populated = await ProductGroup.findById(group._id).populate(
      "voucherType",
      "name prefix"
    );

    return res.status(201).json(populated);
  } catch (err) {
    console.error("Product Group save error:", err);
    return res.status(500).json({ message: err.message });
  }
});

// 🔹 GET ALL Product Groups (with Voucher info)
router.get("/", async (req, res) => {
  try {
    const groups = await ProductGroup.find()
      .populate("voucherType", "name prefix")
      .sort({ createdAt: -1 });

    return res.json(groups);
  } catch (err) {
    console.error("Product Group fetch error:", err);
    return res.status(500).json({ message: err.message });
  }
});

export default router;
