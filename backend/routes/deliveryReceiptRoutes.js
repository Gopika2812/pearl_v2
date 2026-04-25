import express from "express";
import mongoose from "mongoose";
import DeliveryReceipt from "../models/DeliveryReceipt.js";
import Branch from "../models/Branch.js";
import auth from "../middleware/auth.js";
import { createAuditLog } from "../utils/logUtil.js";

const router = express.Router();

router.use((req, res, next) => {
  console.log(`📡 [DeliveryReceipts Router] ${req.method} ${req.url}`);
  next();
});

// Helper to generate Receipt ID
const generateReceiptId = async (branchId) => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new Error("Invalid Branch ID for receipt generation");
  }

  const branch = await Branch.findById(branchId);
  const branchCode = branch?.code || "BR";
  const prefix = `DR-${branchCode}-`;
  
  // Find the last receipt for this branch to get the highest number
  const lastReceipt = await DeliveryReceipt.findOne({
    branchId: new mongoose.Types.ObjectId(branchId),
    receiptId: { $regex: `^${prefix}` }
  }).sort({ receiptId: -1 });

  let nextNum = 1;
  if (lastReceipt && lastReceipt.receiptId) {
    const parts = lastReceipt.receiptId.split("-");
    const lastNum = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }
  
  return `${prefix}${nextNum.toString().padStart(4, "0")}`;
};

// GET all delivery receipts for a branch
router.get("/", auth, async (req, res) => {
  try {
    console.log("🔍 GET /delivery-receipts query:", req.query);
    const { branchId, fromDate, toDate, deliveryPerson, receiptId } = req.query;
    
    // Inferred branchId from user if not provided
    const activeBranchId = branchId || req.user.branchId;

    if (!activeBranchId) {
      return res.status(400).json({ success: false, message: "Branch ID is required" });
    }

    const query = { branchId: activeBranchId };

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      start.setHours(0,0,0,0);
      const end = new Date(toDate);
      end.setHours(23,59,59,999);
      query.date = { $gte: start, $lte: end };
    }

    if (deliveryPerson) {
      query.deliveryPerson = new RegExp(deliveryPerson, "i");
    }

    if (receiptId) {
      query.receiptId = new RegExp(receiptId, "i");
    }

    const receipts = await DeliveryReceipt.find(query).sort({ date: -1 });
    res.json({ success: true, data: receipts });
  } catch (error) {
    console.error("Error fetching delivery receipts:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST - Create a new delivery receipt (Batch)
router.post("/", auth, async (req, res) => {
  try {
    const { 
      branchId, 
      date, 
      deliveryPerson, 
      collections, 
      expenses, 
      createdBy 
    } = req.body;

    const activeBranchId = branchId || req.user.branchId;

    if (!activeBranchId || !deliveryPerson) {
      return res.status(400).json({ success: false, message: "Missing required fields (branchId or deliveryPerson)" });
    }

    const totalCollected = (collections || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalExpense = (expenses || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const netAmount = totalCollected - totalExpense;

    const receiptId = await generateReceiptId(activeBranchId);

    const newReceipt = new DeliveryReceipt({
      branchId: activeBranchId,
      receiptId,
      date: date || new Date(),
      deliveryPerson,
      collections: collections || [],
      expenses: expenses || [],
      totalCollected,
      totalExpense,
      netAmount,
      createdBy,
    });

    await newReceipt.save();

    await createAuditLog({
      userId: req.user.id,
      username: createdBy,
      branchId,
      action: "CREATE_DELIVERY_RECEIPT",
      description: `Created Delivery Receipt ${receiptId} for ${deliveryPerson}. Net: ₹${netAmount}`,
      targetId: newReceipt._id,
      targetModel: "DeliveryReceipt",
    });

    res.json({ success: true, data: newReceipt });
  } catch (error) {
    console.error("❌ Error creating delivery receipt:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Internal server error",
      details: error.name === "ValidationError" ? error.errors : null
    });
  }
});

// DELETE - Remove a delivery receipt
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const receipt = await DeliveryReceipt.findByIdAndDelete(id);
    if (!receipt) {
      return res.status(404).json({ success: false, message: "Receipt not found" });
    }

    await createAuditLog({
      userId: req.user.id,
      username: req.user.username,
      branchId: receipt.branchId,
      action: "DELETE_DELIVERY_RECEIPT",
      description: `Deleted Delivery Receipt ${receipt.receiptId}.`,
      targetId: id,
      targetModel: "DeliveryReceipt",
    });

    res.json({ success: true, message: "Receipt deleted successfully" });
  } catch (error) {
    console.error("Error deleting delivery receipt:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
