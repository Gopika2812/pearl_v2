import express from "express";
import mongoose from "mongoose";
import SalesOrder from "../models/SalesOrder.js";
import VoucherType from "../models/VoucherType.js";
import { getFinancialYear } from "../utils/financialYear.js";

const router = express.Router();

router.get("/preview/:voucherType", async (req, res) => {
  try {
    const { voucherType } = req.params;
    const financialYear = getFinancialYear();

    const voucher = await VoucherType.findOne({
      name: voucherType.toLowerCase(),
      orderType: "SO",
    });

    if (!voucher) {
      return res.status(404).json({ message: "Sales voucher not found" });
    }

    // reset counter for preview if FY changed
    const counter =
      voucher.financialYear === financialYear ? voucher.counter : 1;

    const invoiceId = `${voucher.prefix}/${String(counter).padStart(
      3,
      "0"
    )}/${financialYear}`;

    res.json({ invoiceId });
  } catch (err) {
    console.error("Preview Error:", err);
    res.status(500).json({ message: "Failed to generate preview" });
  }
});


router.post("/", async (req, res) => {
  try {
    const {
      voucherType,
      customer,
      warehouse,
      billingPerson,
      agent,
      items,
      transportCharge,
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
      ewayEnabled,
      ewayDetails,
    } = req.body;

    if (!voucherType || !items?.length) {
      return res.status(400).json({ message: "Invalid sales order data" });
    }

    const financialYear = getFinancialYear();

    // 🔑 Fetch voucher counter for SALES ORDER
    const voucher = await VoucherType.findOne({
      name: voucherType.toLowerCase(),
      orderType: "SO",
    });

    if (!voucher) {
      return res.status(404).json({ message: "Sales voucher not found" });
    }

    // 🔁 Reset counter if FY changed
    if (voucher.financialYear !== financialYear) {
      voucher.counter = 1;
      voucher.financialYear = financialYear;
    }

    const invoiceId = `${voucher.prefix}/${String(voucher.counter).padStart(
      3,
      "0"
    )}/${financialYear}`;

    // 🧾 Save Sales Order
    const salesOrder = new SalesOrder({
      invoiceId,
      voucherType,
      orderType: "SO",
      customer: {
        customerId: customer.id,
        name: customer.name,
        whatsapp: customer.whatsapp,
        address: customer.address,
        district: customer.district,
        state: customer.state,
        pincode: customer.pincode,
      },
      warehouse,
      billingPerson,
      agent,
      items,
      transportCharge,
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
      ewayEnabled,
      ewayDetails,
      financialYear,
    });

    await salesOrder.save();

    // ✅ Increment counter ONLY after save
    voucher.counter += 1;
    await voucher.save();

    res.status(201).json({
      message: "Sales order created successfully",
      invoiceId,
      data: salesOrder,
    });
  } catch (error) {
    console.error("Sales Order Save Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});



router.get("/recent", async (req, res) => {
  try {
    const { customerId, productId, limit = 5 } = req.query;

    const orders = await SalesOrder.find({
      "customer.customerId": new mongoose.Types.ObjectId(customerId),
      "items.productId": new mongoose.Types.ObjectId(productId)
    })
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({ data: orders });
  } catch (err) {
    console.error("Recent orders error:", err);
    res.status(500).json({ message: "Failed to fetch recent orders" });
  }
});



export default router;
