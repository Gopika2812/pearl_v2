import express from "express";
import SpottedCustomerLedger from "../models/SpottedCustomerLedger.js";
import mongoose from "mongoose";

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
    const { search, sortField, sortOrder, fromDate, toDate } = req.query;

    let query = { branchId: new mongoose.Types.ObjectId(branchId) };

    if (fromDate || toDate) {
      query.dateTime = {};
      if (fromDate) query.dateTime.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.dateTime.$lte = end;
      }
    }

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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Calculate totals for the filtered query (all pages)
    const totals = await SpottedCustomerLedger.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalCash: { $sum: "$cashAmount" },
          totalUpi: { $sum: "$upiAmount" }
        }
      }
    ]);

    const globalTotals = totals.length > 0 ? totals[0] : { totalCash: 0, totalUpi: 0 };

    const totalRecords = await SpottedCustomerLedger.countDocuments(query);
    const records = await SpottedCustomerLedger.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    res.status(200).json({ 
      success: true, 
      data: records,
      totals: globalTotals,
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        limit
      }
    });
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
