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

// GET ALL PAYMENTS (REFINED WITH PAGINATION & FILTERS)
router.get("/", async (req, res) => {
  try {
    const { 
      branchId, 
      paymentType, 
      page = 1, 
      limit = 50, 
      search = "", 
      startDate, 
      endDate 
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (branchId) filter.branchId = branchId;
    if (paymentType) filter.paymentType = paymentType;

    // Search filter
    if (search) {
      filter.$or = [
        { paymentId: { $regex: search, $options: "i" } },
        { "vendor.name": { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { referenceNo: { $regex: search, $options: "i" } }
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.paymentDate.$lte = end;
      }
    }

    const total = await Payment.countDocuments(filter);
    const payments = await Payment.find(filter)
      .populate("vendor.vendorId", "name")
      .populate("purchaseOrder.poId", "invoiceId")
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.json({
      success: true,
      data: payments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
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

    // 🛡️ SELF-HEALING: Check if this ID already exists
    let candidatePaymentId = `${voucher.prefix}/${String(voucher.counter).padStart(3, "0")}/${currentFY}`;
    const exists = await Payment.findOne({ branchId, paymentId: candidatePaymentId });

    if (exists) {
      console.warn(`🚨 Duplicate Payment ID detected: ${candidatePaymentId}. Auto-healing...`);
      const latestPayments = await Payment.find({ 
        branchId, 
        paymentId: new RegExp(`^${voucher.prefix}/`),
        // Filter by FY to be safe if records exist across years with same prefix
        paymentId: new RegExp(`/${currentFY}$`)
      }).select("paymentId").lean();

      const sequenceNumbers = latestPayments.map(p => {
        const match = p.paymentId.match(/\/(\d+)\//);
        return match ? parseInt(match[1]) : 0;
      });

      const maxSeq = Math.max(0, ...sequenceNumbers);
      voucher = await VoucherType.findByIdAndUpdate(
        voucher._id, 
        { counter: maxSeq + 1 }, 
        { new: true }
      );
      candidatePaymentId = `${voucher.prefix}/${String(voucher.counter).padStart(3, "0")}/${currentFY}`;
    }

    const paymentId = candidatePaymentId;

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

// RETURN PAYMENT
router.post("/:id/return", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { returnNarration, returnBank } = req.body;
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.isReturned) {
      throw new Error("Payment is already returned");
    }

    // 1. Mark as returned
    payment.isReturned = true;
    payment.status = "returned";
    payment.returnDate = new Date();
    payment.returnNarration = returnNarration;
    payment.returnBank = returnBank;
    await payment.save({ session });

    // 2. Increase Vendor Credit (Reverse the payment impact)
    if (payment.paymentType === "vendor_payment" && payment.vendor?.vendorId) {
      const vendorRecord = await Vendor.findById(payment.vendor.vendorId);
      if (vendorRecord) {
        const returnedAmount = payment.amount;
        vendorRecord.credit = (vendorRecord.credit || 0) + returnedAmount;
        await vendorRecord.save({ session });
        console.log(`✅ Vendor "${vendorRecord.name}" credit restored (Return): ₹${returnedAmount}`);
      }
    }

    await session.commitTransaction();
    res.json({ success: true, message: "Payment returned successfully", data: payment });
  } catch (err) {
    await session.abortTransaction();
    console.error("Payment return error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
});

export default router;
