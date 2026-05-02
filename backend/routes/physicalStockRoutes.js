import express from "express";
import mongoose from "mongoose";
import PhysicalStockEntry from "../models/PhysicalStockEntry.js";
import PhysicalStockCounter from "../models/PhysicalStockCounter.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Generate next branch-scoped SJ ID atomically
// ─────────────────────────────────────────────────────────────────────────────
async function getNextSjId(branchId) {
  const counter = await PhysicalStockCounter.findOneAndUpdate(
    { branchId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `SJ${String(counter.seq).padStart(3, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/physical-stock/next-id?branchId=...
// ─────────────────────────────────────────────────────────────────────────────
router.get("/next-id", async (req, res) => {
  try {
    const { branchId } = req.query;
    if (!branchId) return res.status(400).json({ success: false, message: "branchId required" });

    const counter = await PhysicalStockCounter.findOne({ branchId });
    const nextSeq = (counter?.seq || 0) + 1;
    res.json({ success: true, nextId: `SJ${String(nextSeq).padStart(3, "0")}` });
  } catch (err) {
    console.error("Next SJ ID error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/physical-stock?branchId=&page=&limit=&fromDate=&toDate=&status=&search=&productGroupId=
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { branchId, page = 1, limit = 50, fromDate, toDate, status, search, productGroupId } = req.query;
    if (!branchId) return res.status(400).json({ success: false, message: "branchId required" });

    const filter = { branchId };

    if (status && status !== "ALL") filter.status = status;
    if (productGroupId && productGroupId !== "ALL") filter.productGroupId = productGroupId;
    if (search) filter.productName = { $regex: search, $options: "i" };

    if (fromDate || toDate) {
      filter.entryDate = {};
      if (fromDate) {
        const d = new Date(fromDate); d.setHours(0, 0, 0, 0);
        filter.entryDate.$gte = d;
      }
      if (toDate) {
        const d = new Date(toDate); d.setHours(23, 59, 59, 999);
        filter.entryDate.$lte = d;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [entries, total] = await Promise.all([
      PhysicalStockEntry.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("productGroupId", "name")
        .lean(),
      PhysicalStockEntry.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: entries,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    });
  } catch (err) {
    console.error("List PSV error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/physical-stock — Create new PSV entry (DRAFT)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const {
      branchId, productGroupId, productGroupName,
      productId, productName,
      systemQty, physicalQty,
      mrp, batch, expiryDate,
      checkedBy,
      userId, username
    } = req.body;

    if (!branchId || !productId) {
      return res.status(400).json({ success: false, message: "branchId and productId are required" });
    }

    const pQty = Number(physicalQty) || 0;
    const sQty = Number(systemQty) || 0;
    const inwardQty  = pQty > sQty ? +(pQty - sQty).toFixed(4) : 0;
    const outwardQty = sQty > pQty ? +(sQty - pQty).toFixed(4) : 0;

    const sjId = await getNextSjId(branchId);

    const entry = new PhysicalStockEntry({
      sjId, branchId,
      productGroupId: productGroupId || null,
      productGroupName: productGroupName || "",
      productId, productName,
      systemQty: sQty, physicalQty: pQty,
      inwardQty, outwardQty,
      mrp: Number(mrp) || 0,
      batch: batch || "",
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      checkedBy: checkedBy || [],
      // Initial edit log entry
      physicalEditLog: [{
        userId, username,
        oldQty: null,
        newQty: pQty,
        editedAt: new Date()
      }],
      status: "DRAFT"
    });

    await entry.save();
    res.json({ success: true, data: entry, message: `PSV Entry ${sjId} created` });
  } catch (err) {
    console.error("Create PSV error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/physical-stock/:id — Edit physical qty / checkedBy (appends to log)
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const { physicalQty, mrp, checkedBy, batch, expiryDate, userId, username } = req.body;

    const entry = await PhysicalStockEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: "Entry not found" });
    if (entry.status === "APPROVED") {
      return res.status(400).json({ success: false, message: "Cannot edit an approved entry" });
    }

    if (physicalQty !== undefined) {
      const oldQty = entry.physicalQty;
      const pQty = Number(physicalQty);
      const sQty = entry.systemQty;

      entry.physicalQty = pQty;
      entry.inwardQty  = pQty > sQty ? +(pQty - sQty).toFixed(4) : 0;
      entry.outwardQty = sQty > pQty ? +(sQty - pQty).toFixed(4) : 0;

      entry.physicalEditLog.push({ userId, username, oldQty, newQty: pQty, editedAt: new Date() });
    }

    if (checkedBy !== undefined) entry.checkedBy = checkedBy;
    if (mrp !== undefined) entry.mrp = Number(mrp) || 0;
    if (batch !== undefined) entry.batch = batch;
    if (expiryDate !== undefined) entry.expiryDate = expiryDate ? new Date(expiryDate) : null;

    await entry.save();
    res.json({ success: true, data: entry, message: "Entry updated" });
  } catch (err) {
    console.error("Edit PSV error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/physical-stock/:id/approve
// Only ADMIN/SUPER_ADMIN should call this.
// The stock adjustment is reflected via the closing-stock formula in productRoutes.js
// (no direct Product.totalQty mutation — fully branch-scoped & formula-based)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/approve", async (req, res) => {
  try {
    const { userId, username, role } = req.body;

    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
      return res.status(403).json({ success: false, message: "Only ADMIN or SUPER_ADMIN can approve PSV entries" });
    }

    const entry = await PhysicalStockEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: "Entry not found" });
    if (entry.status === "APPROVED") {
      return res.status(400).json({ success: false, message: "Already approved" });
    }

    entry.status = "APPROVED";
    entry.adjustmentApplied = true;
    entry.approvedBy = { userId, username, approvedAt: new Date() };

    await entry.save();
    res.json({
      success: true,
      data: entry,
      message: `${entry.sjId} approved — stock adjustment (${entry.inwardQty > 0 ? `+${entry.inwardQty} inward` : `-${entry.outwardQty} outward`}) now active`
    });
  } catch (err) {
    console.error("Approve PSV error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/physical-stock/:id — only DRAFT entries
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const entry = await PhysicalStockEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: "Entry not found" });
    if (entry.status === "APPROVED") {
      return res.status(400).json({ success: false, message: "Cannot delete an approved entry" });
    }
    await entry.deleteOne();
    res.json({ success: true, message: "Entry deleted" });
  } catch (err) {
    console.error("Delete PSV error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
