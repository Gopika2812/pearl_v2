import express from "express";
import DeliveryReceipt from "../models/DeliveryReceipt.js";
import auth from "../middleware/auth.js";
import { createAuditLog } from "../utils/logUtil.js";

const router = express.Router();

// GET all delivery receipts for a branch
router.get("/", auth, async (req, res) => {
  try {
    const { branchId, fromDate, toDate, deliveryPerson } = req.query;
    if (!branchId) {
      return res.status(400).json({ success: false, message: "Branch ID is required" });
    }

    const query = { branchId };

    if (fromDate && toDate) {
      query.date = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    }

    if (deliveryPerson) {
      query.deliveryPerson = new RegExp(deliveryPerson, "i");
    }

    const receipts = await DeliveryReceipt.find(query).sort({ date: -1 }).populate("customer.customerId");
    res.json({ success: true, data: receipts });
  } catch (error) {
    console.error("Error fetching delivery receipts:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST - Create a new delivery receipt
router.post("/", auth, async (req, res) => {
  try {
    const { 
      branchId, 
      date, 
      deliveryPerson, 
      customer, 
      collectedAmount, 
      expenseAmount, 
      expenseNote, 
      createdBy 
    } = req.body;

    const netAmount = (Number(collectedAmount) || 0) - (Number(expenseAmount) || 0);

    const newReceipt = new DeliveryReceipt({
      branchId,
      date: date || new Date(),
      deliveryPerson,
      customer,
      collectedAmount: Number(collectedAmount) || 0,
      expenseAmount: Number(expenseAmount) || 0,
      expenseNote,
      netAmount,
      createdBy,
    });

    await newReceipt.save();

    await createAuditLog({
      userId: req.user.id,
      username: createdBy,
      branchId,
      action: "CREATE_DELIVERY_RECEIPT",
      description: `Created Delivery Receipt for ${customer?.name || "N/A"}. Net: ₹${netAmount}`,
      targetId: newReceipt._id,
      targetModel: "DeliveryReceipt",
    });

    res.json({ success: true, data: newReceipt });
  } catch (error) {
    console.error("Error creating delivery receipt:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
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
      description: `Deleted Delivery Receipt for ${receipt.customer?.name || "N/A"}.`,
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
