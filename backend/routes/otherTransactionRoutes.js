import express from "express";
import OtherTransaction from "../models/OtherTransaction.js";
import { createAuditLog } from "../utils/logUtil.js";
import Ledger from "../models/Ledger.js";
import LedgerGroup from "../models/LedgerGroup.js";
import mongoose from "mongoose";


const router = express.Router();

// Financial Year Helper
const getFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 4) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
};

// GET ALL OTHER TRANSACTIONS FOR A BRANCH
router.get("/", async (req, res) => {
  try {
    const { branchId, type } = req.query;
    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const query = { branchId: new mongoose.Types.ObjectId(branchId) };
    if (type) {
      query.type = type.toUpperCase();
    }

    const transactions = await OtherTransaction.find(query).sort({ date: -1 });
    res.json(transactions);
  } catch (err) {
    console.error("Get Other Transactions error:", err);
    res.status(500).json({ message: err.message });
  }
});

// CREATE NEW OTHER TRANSACTION
router.post("/", async (req, res) => {
  try {
    const { branchId, type, ledgerGroup, ledgerName, amount, gst, note, recordedBy, paymentMode } = req.body;

    if (!branchId || !type || !ledgerGroup || !ledgerName || amount === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const currentFY = getFinancialYear();
    
    // Generate a robust unique ID by finding the max existing number
    const prefix = type.toUpperCase() === "PAYMENT" ? "OTH-PAY" : "OTH-REC";
    const lastTransaction = await OtherTransaction.findOne({ 
      branchId, 
      type: type.toUpperCase(),
      transactionId: new RegExp(`^${prefix}/`)
    }).sort({ transactionId: -1 });

    let nextNumber = 1;
    if (lastTransaction && lastTransaction.transactionId) {
      const parts = lastTransaction.transactionId.split('/');
      if (parts.length >= 2) {
        const lastNum = parseInt(parts[1]);
        if (!isNaN(lastNum)) nextNumber = lastNum + 1;
      }
    }
    const transactionId = `${prefix}/${String(nextNumber).padStart(4, "0")}/${currentFY}`;

    const newTransaction = new OtherTransaction({
      branchId,
      transactionId,
      type: type.toUpperCase(),
      ledgerGroup,
      ledgerName,
      amount: Number(amount),
      gst: Number(gst || 0),
      paymentMode: paymentMode || "CASH",
      note,
      recordedBy,
    });

    await newTransaction.save();

    // 📊 SYNC WITH LEDGER SYSTEM
    try {
      // 1. Find or Create Ledger Group
      // Determine nature based on transaction type if not provided
      const nature = type.toUpperCase() === "PAYMENT" ? "Expense" : "Income";
      
      const group = await LedgerGroup.findOneAndUpdate(
        { branchId, name: ledgerGroup },
        { $setOnInsert: { nature } },
        { upsert: true, new: true }
      );

      // 2. Find or Create Ledger
      const amountNum = Number(amount);
      const balanceChange = type.toUpperCase() === "PAYMENT" ? -amountNum : amountNum;

      await Ledger.findOneAndUpdate(
        { branchId, name: ledgerName, groupId: group._id },
        { $inc: { currentBalance: balanceChange } },
        { upsert: true }
      );
      
      console.log(`✅ Ledger "${ledgerName}" updated with ₹${balanceChange}`);
    } catch (ledgerError) {
      console.error("Error syncing with ledger system:", ledgerError);
      // We don't fail the transaction if ledger sync fails, but we log it
    }


    // CREATE AUDIT LOG
    await createAuditLog({
      userId: req.body.userId || "System",
      username: req.body.username || req.body.recordedBy || "System",
      branchId: branchId,
      action: `OTHER_${type.toUpperCase()}`,
      description: `${type} of ₹${amount} (${paymentMode || "CASH"}) recorded for ${ledgerName} (${ledgerGroup})`,
      targetId: newTransaction._id,
      targetModel: "OtherTransaction",
    });

    res.status(201).json({
      message: `${type} recorded successfully`,
      transaction: newTransaction,
    });
  } catch (err) {
    console.error("Create Other Transaction error:", err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE TRANSACTION
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await OtherTransaction.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    res.json({ message: "Transaction deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
