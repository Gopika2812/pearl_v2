import express from "express";
import mongoose from "mongoose";
import FollowUp from "../models/FollowUp.js";
import { getISTStartOfDay, getISTEndOfDay } from "../utils/dateUtils.js";

const router = express.Router();

// POST a new follow-up
router.post("/", async (req, res) => {
  try {
    const { 
      branchId, customerId, followUpBy, 
      closingBalance, creditLimit, creditLimitDays, 
      result, remarks, nextFollowUpDate, riskStatus 
    } = req.body;

    // Mark previous PENDING reminders for this customer as COMPLETED
    await FollowUp.updateMany(
      { customerId, branchId, status: "PENDING" },
      { $set: { status: "COMPLETED" } }
    );

    // If a next follow-up date is set, this record itself serves as a reminder "anchor"
    const status = nextFollowUpDate ? "PENDING" : "COMPLETED";

    const followUp = new FollowUp({
      branchId,
      customerId,
      followUpBy,
      closingBalance,
      creditLimit,
      creditLimitDays,
      result,
      remarks,
      nextFollowUpDate,
      riskStatus: riskStatus || "safe_zone",
      status
    });

    await followUp.save();

    // 🛡️ UPDATE CUSTOMER RISK ZONE
    if (riskStatus) {
      const Customer = mongoose.model("Customer");
      await Customer.findByIdAndUpdate(customerId, {
        $set: { riskStatus: riskStatus }
      });
    }

    res.status(201).json({ success: true, data: followUp });
  } catch (error) {
    console.error("FollowUp Create Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET follow-ups with filters
router.get("/", async (req, res) => {
  try {
    const { branchId, fromDate, toDate, customerId } = req.query;
    
    let query = {};
    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
      query.branchId = new mongoose.Types.ObjectId(branchId);
    }
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      query.customerId = new mongoose.Types.ObjectId(customerId);
    }

    if (fromDate || toDate) {
      const start = fromDate ? getISTStartOfDay(fromDate) : getISTStartOfDay();
      const end = toDate ? getISTEndOfDay(toDate) : getISTEndOfDay();
      query.createdAt = { $gte: start, $lte: end };
    }

    const records = await FollowUp.find(query)
      .populate({
        path: "customerId",
        select: "name whatsapp whatsapp2 phone customerCategory customerCategories",
        populate: [
          { path: "customerCategory", select: "name" },
          { path: "customerCategories", select: "name" }
        ]
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: records });
  } catch (error) {
    console.error("FollowUp Fetch Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET Reminders (Due Today)
router.get("/reminders", async (req, res) => {
  try {
    const { branchId } = req.query;
    const now = new Date();
    
    // Reminders are those where nextFollowUpDate is today (IST) or in the past but not completed
    const startOfToday = getISTStartOfDay();
    const endOfToday = getISTEndOfDay();

    const reminders = await FollowUp.find({
      branchId,
      nextFollowUpDate: { $lte: endOfToday }, // Due today or earlier
      status: "PENDING" // This would require a workflow to mark them done, but for now we follow nextFollowUpDate
    }).populate("customerId", "name whatsapp");

    res.json({ success: true, data: reminders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
