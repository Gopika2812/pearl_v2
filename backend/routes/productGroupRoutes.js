import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import XLSX from "xlsx";
import ProductGroup from "../models/ProductGroup.js";
import VoucherType from "../models/VoucherType.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  console.log("FILE RECEIVED:", req.file);
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Excel file required" });
    }

    // Read Excel
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let inserted = [];
    let skipped = [];

    for (const row of rows) {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.trim().toLowerCase(),
          String(v).trim(),
        ])
      );

      const name = normalized.name;
      const voucherPrefix = normalized.vouchertype; // ✅ FIX

      if (!name || !voucherPrefix) {
        skipped.push({ row, reason: "Missing fields" });
        continue;
      }

      const voucher = await VoucherType.findOne({ prefix: voucherPrefix });
      if (!voucher) {
        skipped.push({ row, reason: "Invalid voucher type" });
        continue;
      }

      const exists = await ProductGroup.findOne({
        name,
        voucherType: voucher._id,
      });

      if (exists) {
        skipped.push({ row, reason: "Already exists" });
        continue;
      }

      const group = await ProductGroup.create({
        name,
        voucherType: voucher._id,
      });

      inserted.push(group);
    }


    return res.json({
      message: "Bulk upload completed",
      insertedCount: inserted.length,
      skippedCount: skipped.length,
      skipped,
    });
  } catch (err) {
    console.error("Bulk upload error:", err);
    res.status(500).json({ message: err.message });
  }
});

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



