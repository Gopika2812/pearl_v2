import express from "express";
import mongoose from "mongoose";
import PriceRequest from "../models/PriceRequest.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// POST: Create a price request (Staff)
router.post("/", auth, async (req, res) => {
  try {
    const { productId, productName, originalPrice, requestedPrice } = req.body;

    if (!productId || !productName) {
      return res.status(400).json({ success: false, message: "Product details missing." });
    }

    // Check if there is already an active (PENDING or recently APPROVED) request
    const existing = await PriceRequest.findOne({
      staffId: req.user.id,
      productId,
      status: { $in: ["PENDING", "APPROVED"] },
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) } // Within last 30 mins
    }).sort({ createdAt: -1 });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: existing.status === "APPROVED" ? "Request already approved." : "Request already pending approval.",
        data: existing,
      });
    }


    const newRequest = new PriceRequest({
      branchId: req.user.branch,
      staffId: req.user.id,
      staffName: req.user.username,
      productId,
      productName,
      originalPrice,
      requestedPrice,
      status: "PENDING",
    });

    await newRequest.save();

    res.status(201).json({
      success: true,
      message: "Price unlock request sent to Admin.",
      data: newRequest,
    });
  } catch (error) {
    console.error("Price Request Error:", error);
    res.status(500).json({ success: false, message: "Failed to send request." });
  }
});

// GET: All requests for a branch (Admin)
router.get("/branch/:branchId", auth, async (req, res) => {
  try {
    const { branchId } = req.params;

    if (req.user.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    const requests = await PriceRequest.find({
      branchId,
      status: "PENDING",
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch requests." });
  }
});

// PATCH: Approve/Reject request (Admin)
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // APPROVED or REJECTED

    if (req.user.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    const update = {
      status,
      approvedBy: req.user.id,
      approvedAt: status === "APPROVED" ? new Date() : null,
    };

    const request = await PriceRequest.findByIdAndUpdate(id, update, { new: true });

    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found." });
    }

    res.json({ success: true, message: `Request ${status.toLowerCase()}`, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: "Update failed." });
  }
});

// GET: Check status of current pending request (Staff Polling - Secure via Token)
router.get("/my-status/:productId", auth, async (req, res) => {
  try {
    const { productId } = req.params;

    // Use current user ID from the token (req.user.id)
    const request = await PriceRequest.findOne({
      staffId: req.user.id,
      productId,
    }).sort({ createdAt: -1 });

    if (!request) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: "Check failed." });
  }
});


export default router;
