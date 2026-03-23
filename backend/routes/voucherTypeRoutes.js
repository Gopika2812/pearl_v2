import express from "express";
import VoucherType from "../models/VoucherType.js";
import { getFinancialYear } from "../utils/financialYear.js";

const router = express.Router();

/**
 * GET all voucher types (filtered by branchId)
 */
router.get("/", async (req, res) => {
  try {
    const { branchId } = req.query;
    
    if (!branchId) {
      return res.status(400).json({ success: false, message: "branchId is required" });
    }

    const vouchers = await VoucherType.find({ branchId }).sort({ createdAt: -1 });
    res.json({ success: true, data: vouchers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET voucher types by branchId (RESTful style)
 */
router.get("/branch/:branchId", async (req, res) => {
  try {
    const { branchId } = req.params;
    
    if (!branchId) {
      return res.status(400).json({ success: false, message: "branchId is required" });
    }

    const vouchers = await VoucherType.find({ branchId }).sort({ createdAt: -1 });
    res.json({ success: true, data: vouchers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * CREATE new voucher type  ✅ THIS IS WHAT YOUR MODAL CALLS
 */
router.post("/", async (req, res) => {
  console.log("POST /api/voucher-types", req.body);

  try {
    let { name, orderType, branchId } = req.body;

    if (!name || !orderType || !branchId) {
      return res
        .status(400)
        .json({ message: "Name, orderType, and branchId are required" });
    }

    name = name.trim().toLowerCase();
    orderType = orderType.trim().toUpperCase(); // SO | PO

    const fy = getFinancialYear();

    const prefix = `${name.replace(/\s+/g, "")}${orderType}`.toUpperCase();

    const voucher = new VoucherType({
      branchId,
      name,
      orderType,
      prefix,
      counter: 1,
      financialYear: fy,
    });

    const saved = await voucher.save();
    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Voucher type already exists for this order type in this branch" });
    }

    return res.status(500).json({ success: false, message: err.message });
  }
});


/**
 * PREVIEW next invoice number
 */
router.post("/generate", async (req, res) => {
  try {
    let { name, orderType, branchId } = req.body;

    if (!name || !orderType || !branchId) {
      return res
        .status(400)
        .json({ message: "name, orderType, and branchId are required" });
    }

    name = name.trim().toLowerCase();
    orderType = orderType.trim().toUpperCase();

    const voucher = await VoucherType.findOne({ branchId, name, orderType });

    if (!voucher) {
      return res.status(404).json({ message: "Voucher type not found" });
    }

    const fy = getFinancialYear();
    const counter = voucher.financialYear === fy ? voucher.counter : 1;

    const invoiceNo = `${voucher.prefix}/${String(counter).padStart(
      3,
      "0"
    )}/${fy}`;

    res.json({ success: true, invoiceNo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * UPDATE voucher type
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Round numeric fields if provided
    if (updates.counter !== undefined) {
      updates.counter = Math.round(Number(updates.counter));
    }

    const voucher = await VoucherType.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!voucher) {
      return res.status(404).json({ success: false, message: "Voucher type not found" });
    }

    res.json({ success: true, data: voucher });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
      return res.status(404).json({ success: false, message: "Voucher type not found" });
    }

    res.json({ success: true, message: "Voucher type deleted successfully", data: voucher });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
