import express from "express";
import SpottedCustomerLedger from "../models/SpottedCustomerLedger.js";

const router = express.Router();

// Check if a payment exists for a specific order
router.get("/check/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const record = await SpottedCustomerLedger.findOne({ billInvoice: orderId });
    res.status(200).json({ success: true, isPaid: !!record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all spotted customer ledger records for a branch
router.get("/:branchId", async (req, res) => {
  try {
    const { branchId } = req.params;
    const { search, sortField, sortOrder } = req.query;

    let query = { branchId };

    if (search) {
      query.$or = [
        { salesInvoiceNumber: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }

    let sort = {};
    if (sortField) {
      sort[sortField] = sortOrder === "desc" ? -1 : 1;
    } else {
      sort = { dateTime: -1 };
    }

    const records = await SpottedCustomerLedger.find(query).sort(sort);
    res.status(200).json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create a new record
router.post("/", async (req, res) => {
  try {
    const newRecord = new SpottedCustomerLedger(req.body);
    await newRecord.save();
    res.status(201).json({ success: true, data: newRecord });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
