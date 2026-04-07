import express from "express";
import Payment from "../models/Payment.js";
import Vendor from "../models/Vendor.js";
import VoucherType from "../models/VoucherType.js";
import Branch from "../models/Branch.js";
import mongoose from "mongoose";

const router = express.Router();

/**
 * 🏗️ LIVE REPAIR: Drop the legacy global unique index to allow branch-specific numbering
 */
mongoose.connection.on("connected", async () => {
  try {
    const collections = await mongoose.connection.db.listCollections({ name: "payments" }).toArray();
    if (collections.length > 0) {
      const db = mongoose.connection.db;
      const indexes = await db.collection("payments").indexes();
      const hasLegacyIndex = indexes.some(idx => idx.name === "paymentId_1");
      
      if (hasLegacyIndex) {
        await db.collection("payments").dropIndex("paymentId_1");
        console.log("✅ Legacy global Payment index 'paymentId_1' dropped successfully.");
      }
    }
  } catch (err) {
    if (err.codeName !== "IndexNotFound") {
      console.warn("⚠️ Could not drop legacy Payment index:", err.message);
    }
  }
});

// Get Financial Year
const getFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // Financial year starts in April - format: 25-26 (short format)
  if (month >= 4) {
    const shortYear = String(year).slice(-2);
    const shortNextYear = String(year + 1).slice(-2);
    return `${shortYear}-${shortNextYear}`;
  } else {
    const shortYear = String(year - 1).slice(-2);
    const shortCurrentYear = String(year).slice(-2);
    return `${shortYear}-${shortCurrentYear}`;
  }
};

// GET NEXT PAYMENT ID
router.get("/next-id", async (req, res) => {
  try {
    const { branchId } = req.query;
    const currentFY = getFinancialYear();
    
    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    let voucher = await VoucherType.findOne({
      branchId,
      name: "payment",
      orderType: "PM",
    });

    if (!voucher) {
      // Create if doesn't exist
      voucher = await VoucherType.create({
        branchId,
        name: "payment",
        orderType: "PM",
        prefix: "PAY",
        counter: 0,
        financialYear: currentFY,
      });
    }

    // Check if year changed
    if (voucher.financialYear !== currentFY) {
      voucher = await VoucherType.findByIdAndUpdate(
        voucher._id,
        { counter: 0, financialYear: currentFY },
        { new: true }
      );
    }

    const nextNumber = voucher.counter + 1;
    // Standard Format as requested: PAY/001/25-26
    const nextId = `${voucher.prefix}/${String(nextNumber).padStart(3, "0")}/${currentFY}`;
    res.json({ nextId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET ALL PAYMENTS (optionally filtered by branchId and paymentType)
router.get("/", async (req, res) => {
  try {
    const { branchId, paymentType } = req.query;
    const filter = {};
    if (branchId) filter.branchId = branchId;
    if (paymentType) filter.paymentType = paymentType;

    const payments = await Payment.find(filter)
      .populate("vendor.vendorId", "name")
      .populate("purchaseOrder.poId", "invoiceId")
      .sort({ paymentDate: -1 });

    res.json({
      success: true,
      data: payments,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET PAYMENTS FOR SPECIFIC PO
router.get("/po/:poId", async (req, res) => {
  try {
    const { poId } = req.params;

    const payments = await Payment.find({
      "purchaseOrder.poId": poId,
      paymentType: "vendor_payment",
    }).sort({ paymentDate: -1 });

    res.json({
      success: true,
      data: payments || [],
    });
  } catch (err) {
    console.error("Get PO payments error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET PAYMENT BY ID
router.get("/:id", async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("vendor.vendorId")
      .populate("purchaseOrder.poId");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.json({ success: true, data: payment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE PAYMENT
router.post("/", async (req, res) => {
  try {
    const {
      branchId,
      paymentType,
      amount,
      paymentMethod,
      paymentDate,
      vendor,
      purchaseOrder,
      loanDetails,
      expenseDetails,
      description,
      billingPerson,
      referenceNo,
    } = req.body;

    if (!paymentType || !amount || !paymentMethod || !branchId) {
      return res.status(400).json({
        message: "Payment type, amount, payment method, and branchId are required",
      });
    }

    // Get voucher for payment ID (atomic counter increment)
    const currentFY = getFinancialYear();
    
    let voucher = await VoucherType.findOne({
      branchId,
      name: "payment",
      orderType: "PM",
    });

    // Create voucher if it doesn't exist
    if (!voucher) {
      voucher = await VoucherType.create({
        branchId,
        name: "payment",
        orderType: "PM",
        prefix: "PAY",
        counter: 1,
        financialYear: currentFY,
      });
    }

    // Reset counter if financial year changed
    if (voucher.financialYear !== currentFY) {
      voucher = await VoucherType.findByIdAndUpdate(
        voucher._id,
        { counter: 1, financialYear: currentFY },
        { new: true }
      );
    }

    // Atomically increment counter and get the new value
    voucher = await VoucherType.findByIdAndUpdate(
      voucher._id,
      { $inc: { counter: 1 } },
      { new: true }
    );

    // Standard Format as requested: PAY/001/25-26
    const paymentId = `${voucher.prefix}/${String(voucher.counter).padStart(3, "0")}/${currentFY}`;

    // Build description based on payment type
    let finalDescription = description || "";
    if (paymentType === "vendor_payment") {
      finalDescription = `PO: ${purchaseOrder?.invoiceId || "N/A"} - Vendor: ${vendor?.name || "N/A"}`;
    } else if (paymentType === "expense") {
      finalDescription = `${expenseDetails?.type || "Other"}: ${expenseDetails?.description || ""}`;
    } else if (paymentType === "loan_payment") {
      finalDescription = `Loan Payment: ${loanDetails?.bankName || "N/A"}`;
    }

    const payment = new Payment({
      paymentId,
      branchId,
      paymentType,
      amount: Math.round(Number(amount) || 0),
      paymentMethod,
      paymentDate: paymentDate || new Date(),
      vendor: paymentType === "vendor_payment" ? vendor : undefined,
      purchaseOrder: paymentType === "vendor_payment" ? purchaseOrder : undefined,
      loanDetails: paymentType === "loan_payment" ? loanDetails : undefined,
      expenseDetails: paymentType === "expense" ? expenseDetails : undefined,
      description: finalDescription,
      billingPerson,
      referenceNo,
      status: "completed",
    });

    await payment.save();

    // ✅ REDUCE VENDOR CREDIT (for vendor payments — both PO-linked and general)
    if (paymentType === "vendor_payment" && vendor) {
      try {
        const vendorId = vendor.vendorId || null;
        if (vendorId) {
          const vendorRecord = await Vendor.findById(vendorId);
          if (vendorRecord) {
            const paidAmount = Math.round(Number(amount) || 0);
            const currentCredit = vendorRecord.credit || 0;
            const newCredit = Math.max(0, currentCredit - paidAmount);
            await Vendor.findByIdAndUpdate(vendorId, { credit: newCredit }, { new: true });
            console.log(`✅ Vendor "${vendorRecord.name}" credit reduced: ₹${currentCredit} → ₹${newCredit}`);
          }
        }
      } catch (err) {
        console.warn(`⚠️ Failed to update vendor credit:`, err.message);
      }
    }

    res.status(201).json({
      success: true,
      data: payment,
      message: "Payment recorded successfully",
    });
  } catch (err) {
    console.error("Create payment error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// UPDATE PAYMENT
router.put("/:id", async (req, res) => {
  try {
    const updates = req.body;

    // Round numeric fields if provided
    if (updates.amount !== undefined) {
      updates.amount = Math.round(Number(updates.amount));
    }

    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.json({ success: true, data: payment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE PAYMENT
router.delete("/:id", async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.json({ success: true, message: "Payment deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET PAYMENT SUMMARY (by type)
router.get("/summary/by-type", async (req, res) => {
  try {
    const summary = await Payment.aggregate([
      {
        $group: {
          _id: "$paymentType",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
