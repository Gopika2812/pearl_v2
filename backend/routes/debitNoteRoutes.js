import express from "express";
import DebitNote from "../models/DebitNote.js";
import Product from "../models/Product.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import Vendor from "../models/Vendor.js";
import VoucherType from "../models/VoucherType.js";
import GLService from "../utils/glService.js";

const router = express.Router();

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

// GET NEXT DEBIT NOTE ID
router.get("/next-id", async (req, res) => {
  try {
    const { branchId } = req.query;
    const currentFY = getFinancialYear();
    
    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    let voucher = await VoucherType.findOne({
      branchId,
      name: "debit_note",
      orderType: "DN",
    });

    if (!voucher) {
      // Create if doesn't exist
      voucher = await VoucherType.create({
        branchId,
        name: "debit_note",
        orderType: "DN",
        prefix: "DN",
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

    const nextId = `debitnote${String(voucher.counter + 1).padStart(3, "0")}/${currentFY}`;
    res.json({ nextId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET ALL DEBIT NOTES (strictly filtered by branchId)
router.get("/", async (req, res) => {
  try {
    const { branchId } = req.query;
    if (!branchId || branchId === "undefined") {
      return res.status(400).json({ success: false, message: "Valid branchId is required" });
    }

    // ⚡ LIVE REPAIR: Find any notes for this branch's vendors that are missing branchId
    const legacyNotes = await DebitNote.find({ 
      branchId: { $exists: false },
      "vendor.vendorId": { $exists: true }
    });
    
    if (legacyNotes.length > 0) {
      console.log(`🔧 Migrating ${legacyNotes.length} legacy debit notes...`);
      for (const dn of legacyNotes) {
        const vendor = await Vendor.findById(dn.vendor.vendorId);
        if (vendor && vendor.branchId) {
          await DebitNote.findByIdAndUpdate(dn._id, { branchId: vendor.branchId });
        }
      }
    }

    const debitNotes = await DebitNote.find({ branchId })
      .populate("vendor.vendorId", "name")
      .populate("originalPurchaseOrderId", "invoiceId")
      .sort({ createdAt: -1 });

    // 🔥 PERFORMANCE FIX: Removed the heavy financial-reconstruction loop.
    // This was checking/saving every record on every fetch, which is very slow.
    
    let finalNotes = debitNotes;
    if (legacyNotes.length > 0) {
        // Re-fetch to get fresh data after legacy branch repairs
        finalNotes = await DebitNote.find({ branchId })
          .populate("vendor.vendorId", "name")
          .populate("originalPurchaseOrderId", "invoiceId")
          .sort({ createdAt: -1 });
    }

    res.json({
      success: true,
      data: finalNotes,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch debit notes", error: err.message });
  }
});

// GET DEBIT NOTE BY ID
router.get("/:id", async (req, res) => {
  try {
    const debitNote = await DebitNote.findById(req.params.id)
      .populate("vendor.vendorId")
      .populate("originalPurchaseOrderId");

    if (!debitNote) {
      return res.status(404).json({ message: "Debit note not found" });
    }

    res.json({ success: true, data: debitNote });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE DEBIT NOTE
router.post("/", async (req, res) => {
  try {
    const {
      branchId,
      originalPurchaseOrderId,
      vendor,
      items,
      reason,
      isGeneralAdjustment, // true for general/migrated debit notes
      manualGrandTotal,    // used when isGeneralAdjustment is true
    } = req.body;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    // Get the original PO only if ID is provided
    let originalPO = null;
    if (originalPurchaseOrderId) {
      originalPO = await PurchaseOrder.findById(originalPurchaseOrderId);
      if (!originalPO) {
        return res.status(404).json({ message: "Purchase Order not found" });
      }
    }

    // Get voucher for debit note ID (atomic counter increment)
    const currentFY = getFinancialYear();
    
    let voucher = await VoucherType.findOne({
      branchId,
      name: "debit_note",
      orderType: "DN",
    });

    // Create voucher if it doesn't exist
    if (!voucher) {
      voucher = await VoucherType.create({
        branchId,
        name: "debit_note",
        orderType: "DN",
        prefix: "DN",
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
    let candidateDNId = `DN/${String(voucher.counter).padStart(3, "0")}/${currentFY}`;
    const exists = await DebitNote.findOne({ branchId, debitNoteId: candidateDNId });

    if (exists) {
      console.warn(`🚨 Duplicate Debit Note ID detected: ${candidateDNId}. Auto-healing...`);
      const latestDNs = await DebitNote.find({ 
        branchId, 
        debitNoteId: new RegExp(`^DN/`)
      }).select("debitNoteId").lean();

      const sequenceNumbers = latestDNs.map(dn => {
        const match = dn.debitNoteId.match(/\/(\d+)\//);
        return match ? parseInt(match[1]) : 0;
      });

      const maxSeq = Math.max(0, ...sequenceNumbers);
      voucher = await VoucherType.findByIdAndUpdate(
        voucher._id, 
        { counter: maxSeq + 1 }, 
        { new: true }
      );
      candidateDNId = `DN/${String(voucher.counter).padStart(3, "0")}/${currentFY}`;
    }

    const debitNoteId = candidateDNId;

    // Calculate totals - support both general (manual) and invoice-based
    let subtotal = 0;
    let totalTax = 0;

    if (isGeneralAdjustment && manualGrandTotal) {
      // General debit note: use the manually specified amount
      subtotal = manualGrandTotal;
      totalTax = 0;
    } else {
      // Invoice-linked: calculate from items
      for (const item of items) {
        const qty = item.returnedQty || item.qty || 1;
        const price = item.purchasePrice || 0;
        const disc = item.discountPercent || 0;
        
        const itemBase = qty * price;
        const taxable = itemBase * (1 - disc / 100);
        
        subtotal += taxable;
        
        // Use gst from item directly if product lookup fails
        let gstRate = item.gst || 0;
        try {
          if (item.productId && item.productId !== "000000000000000000000000") {
            const product = await Product.findById(item.productId);
            if (product) {
              item.name = product.name;
              gstRate = product.gst || 0;
            }
          } else {
            item.name = item.name || "General Return";
          }
        } catch (e) { /* ignore */ }

        item.discountPercent = disc;
        item.taxableAmount = taxable;
        const itemTax = (taxable * gstRate) / 100;
        item.total = Math.round(taxable + itemTax);
        totalTax += itemTax;
      }
    }

    const finalGrandTotal = Math.round(subtotal + totalTax);

    // ⚡ FIX: Map returnedQty to qty for database compatibility
    const mappedItems = items.map(item => ({
      ...item,
      qty: item.returnedQty || item.qty || 0
    }));

    const debitNote = new DebitNote({
      debitNoteId,
      branchId,
      originalPurchaseOrderId: originalPO?._id || null,
      originalInvoiceId: originalPO?.vendorBillNo || originalPO?.invoiceId || "STANDALONE",
      originalInvoiceDate: originalPO?.vendorDate || originalPO?.date || null,
      vendor: {
        vendorId: vendor?.vendorId || null,
        name: vendor?.name || originalPO?.vendor || "Unknown",
      },
      items: mappedItems,
      subtotal: Math.round(subtotal),
      totalTax: Math.round(totalTax),
      grandTotal: finalGrandTotal,
      reason: reason || "General Adjustment",
      status: "Created",
    });

    await debitNote.save();

    // ✅ SKIP INVENTORY & PO UPDATES for general adjustments
    if (!isGeneralAdjustment && originalPO) {
      // Reduce product inventory
      for (const item of mappedItems) {
        try {
          if (item.productId && item.productId !== "000000000000000000000000") {
            const product = await Product.findByIdAndUpdate(
              item.productId,
              { $inc: { totalQty: -item.qty } },
              { new: true }
            );
            if (product) console.log(`✅ Inventory reduced: ${product.name} -${item.qty}`);
          }
        } catch (err) {
          console.error(`⚠️ Failed to update product inventory:`, err.message);
        }
      }
    }

    // ✅ UPDATE ORIGINAL PO ITEMS QTY AND STATUS (only for invoice-linked debit notes)
    if (originalPO) {
      let poStatus = originalPO.status;
      let totalOriginalQty = 0;
      let totalReturnedQty = 0;

      const poItems = Array.isArray(originalPO.items) ? originalPO.items : [];

      for (const poItem of poItems) {
        totalOriginalQty += poItem.qty || 0;
      }

      for (const returnedItem of items) {
        totalReturnedQty += returnedItem.returnedQty;
      }

      if (totalReturnedQty >= totalOriginalQty) {
        poStatus = "FULLY_RETURNED";
      } else if (totalReturnedQty > 0) {
        poStatus = "PARTIALLY_RETURNED";
      }

      await PurchaseOrder.findByIdAndUpdate(
        originalPO._id,
        { status: poStatus }
      );
      console.log(`✅ PO status updated to: ${poStatus}`);
    }

    // ✅ REDUCE VENDOR CREDIT / INCREASE VENDOR DEBIT
    // Find the vendor to update balance
    try {
      let vendorRecord = null;
      if (vendor?.vendorId) {
        vendorRecord = await Vendor.findById(vendor.vendorId);
      } else if (originalPO?.vendor) {
        vendorRecord = await Vendor.findOneAndUpdate(
          { name: originalPO.vendor, branchId },
          {},
          { new: true }
        );
      }
      if (vendorRecord) {
        const returnAmount = debitNote.grandTotal || 0;
        const currentCredit = vendorRecord.credit || 0;
        if (returnAmount <= currentCredit) {
          // Deduct from credit only
          await Vendor.findByIdAndUpdate(vendorRecord._id, { credit: currentCredit - returnAmount });
          console.log(`✅ Vendor credit reduced by ₹${returnAmount}: ₹${currentCredit} → ₹${currentCredit - returnAmount}`);
        } else {
          // Credit hits zero, remainder goes to debit
          const remainder = returnAmount - currentCredit;
          const currentDebit = vendorRecord.debit || 0;
          await Vendor.findByIdAndUpdate(vendorRecord._id, { credit: 0, debit: currentDebit + remainder });
          console.log(`✅ Vendor credit zeroed, debit increased by ₹${remainder}`);
        }
      }
    } catch (err) {
      console.warn(`⚠️ Failed to update vendor balance after debit note:`, err.message);
    }

    // ✅ POST JOURNAL ENTRY to GL
    try {
      const journalEntry = await GLService.postDebitNoteJE(debitNote);
      console.log(`✅ GL Entry posted: ${journalEntry.jeId}`);
    } catch (glError) {
      console.warn("⚠️ GL posting failed (non-blocking):", glError.message);
      // Don't fail the DN creation if GL posting fails
    }

    res.status(201).json({
      success: true,
      data: debitNote,
      message: "Debit note created successfully",
    });
  } catch (err) {
    console.error("Create debit note error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// UPDATE DEBIT NOTE
router.put("/:id", async (req, res) => {
  try {
    const debitNote = await DebitNote.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!debitNote) {
      return res.status(404).json({ message: "Debit note not found" });
    }

    res.json({ success: true, data: debitNote });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE DEBIT NOTE
router.delete("/:id", async (req, res) => {
  try {
    const debitNote = await DebitNote.findByIdAndDelete(req.params.id);

    if (!debitNote) {
      return res.status(404).json({ message: "Debit note not found" });
    }

    // ✅ RESTORE PRODUCT INVENTORY
    if (debitNote.items && debitNote.items.length > 0) {
      for (const item of debitNote.items) {
        try {
          if (item.productId && item.productId !== "000000000000000000000000") {
            const product = await Product.findByIdAndUpdate(
              item.productId,
              { $inc: { totalQty: item.returnedQty || item.qty } },
              { new: true }
            );
            if (product) console.log(`✅ Inventory restored: ${product.name} +${item.returnedQty || item.qty}`);
          }
        } catch (err) {
          console.error(`⚠️ Failed to restore product inventory:`, err.message);
        }
      }
    }

    // ✅ RESTORE VENDOR BALANCE
    try {
      const vendorRecord = await Vendor.findById(debitNote.vendor.vendorId);
      if (vendorRecord) {
        const returnAmount = debitNote.grandTotal || 0;
        const currentDebit = vendorRecord.debit || 0;
        const currentCredit = vendorRecord.credit || 0;
        let remainder = returnAmount;
        let newDebit = currentDebit;
        let newCredit = currentCredit;

        if (currentDebit > 0) {
          const reduction = Math.min(currentDebit, remainder);
          newDebit -= reduction;
          remainder -= reduction;
        }

        if (remainder > 0) {
          newCredit += remainder;
        }

        await Vendor.findByIdAndUpdate(vendorRecord._id, { debit: newDebit, credit: newCredit });
        console.log(`✅ Vendor balance restored: Credit ₹${newCredit}, Debit ₹${newDebit}`);
      }
    } catch (err) {
      console.error(`⚠️ Failed to restore vendor balance:`, err.message);
    }

    res.json({ success: true, message: "Debit note deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
