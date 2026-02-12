import express from "express";
import VoucherType from "../models/VoucherType.js";
import { getFinancialYear } from "../utils/financialYear.js";

const router = express.Router();

/**
 * GET all voucher types
 */
router.get("/", async (req, res) => {
  try {
    const vouchers = await VoucherType.find().sort({ createdAt: -1 });
    res.json(vouchers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * CREATE new voucher type  ✅ THIS IS WHAT YOUR MODAL CALLS
 */
router.post("/", async (req, res) => {
  console.log("POST /api/voucher-types", req.body);

  try {
    let { name, orderType } = req.body;

    if (!name || !orderType) {
      return res
        .status(400)
        .json({ message: "Name and orderType are required" });
    }

    name = name.trim().toLowerCase();
    orderType = orderType.trim().toUpperCase(); // SO | PO

    const fy = getFinancialYear();

    const prefix = `${name.replace(/\s+/g, "")}${orderType}`.toUpperCase();

    const voucher = new VoucherType({
      name,
      orderType,
      prefix,
      counter: 1,
      financialYear: fy,
    });

    const saved = await voucher.save();
    return res.status(201).json(saved);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: "Voucher type already exists for this order type" });
    }

    return res.status(500).json({ message: err.message });
  }
});


/**
 * PREVIEW next invoice number
 */
router.post("/generate", async (req, res) => {
  try {
    let { name, orderType } = req.body;

    if (!name || !orderType) {
      return res
        .status(400)
        .json({ message: "name and orderType are required" });
    }

    name = name.trim().toLowerCase();
    orderType = orderType.trim().toUpperCase();

    const voucher = await VoucherType.findOne({ name, orderType });

    if (!voucher) {
      return res.status(404).json({ message: "Voucher type not found" });
    }

    const fy = getFinancialYear();
    const counter = voucher.financialYear === fy ? voucher.counter : 1;

    const invoiceNo = `${voucher.prefix}/${String(counter).padStart(
      3,
      "0"
    )}/${fy}`;

    res.json({ invoiceNo });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * UPDATE voucher type
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const voucher = await VoucherType.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!voucher) {
      return res.status(404).json({ message: "Voucher type not found" });
    }

    res.json(voucher);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE voucher type
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const voucher = await VoucherType.findByIdAndDelete(id);

    if (!voucher) {
      return res.status(404).json({ message: "Voucher type not found" });
    }

    res.json({ message: "Voucher type deleted successfully", data: voucher });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
