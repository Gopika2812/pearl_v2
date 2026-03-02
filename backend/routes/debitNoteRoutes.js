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
  return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
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

    const nextId = `DN/${String(voucher.counter + 1).padStart(3, "0")}/${currentFY}`;
    res.json({ nextId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET ALL DEBIT NOTES
router.get("/", async (req, res) => {
  try {
    const debitNotes = await DebitNote.find()
      .populate("vendor.vendorId", "name")
      .populate("originalPurchaseOrderId", "invoiceId")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: debitNotes,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    } = req.body;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    // Get the original PO
    const originalPO = await PurchaseOrder.findById(originalPurchaseOrderId);
    if (!originalPO) {
      return res.status(404).json({ message: "Purchase Order not found" });
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

    // Use the incremented counter - 1 (since we just incremented)
    const counter = voucher.counter;
    const debitNoteId = `DN/${String(counter).padStart(3, "0")}/${currentFY}`;

    // Calculate totals
    let subtotal = 0;
    let totalTax = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (product) {
        item.name = product.name;
        item.total = item.returnedQty * item.purchasePrice;
        subtotal += item.total;
        totalTax += (item.total * product.gst) / 100 || 0;
      }
    }

    const debitNote = new DebitNote({
      debitNoteId,
      branchId,
      originalPurchaseOrderId,
      originalInvoiceId: originalPO.invoiceId,
      vendor: {
        name: vendor?.name || originalPO.vendor || "Unknown",
      },
      items,
      subtotal: Math.round(subtotal),
      totalTax: Math.round(totalTax),
      grandTotal: Math.round(subtotal + totalTax),
      reason,
      status: "confirmed",
    });

    await debitNote.save();

    // ✅ REDUCE PRODUCT INVENTORY BASED ON RETURNED QTY
    for (const item of items) {
      try {
        const product = await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { totalQty: -item.returnedQty } },
          { new: true }
        );
        if (product) {
          console.log(
            `✅ Product "${product.name}" inventory reduced: -${item.returnedQty} units (New total: ${product.totalQty})`
          );
        }
      } catch (err) {
        console.error(`⚠️ Failed to update product ${item.productId}:`, err.message);
      }
    }

    // ✅ UPDATE ORIGINAL PO ITEMS QTY AND STATUS
    let poStatus = originalPO.status;
    let totalOriginalQty = 0;
    let totalReturnedQty = 0;

    // Ensure items array exists and is iterable
    const poItems = Array.isArray(originalPO.items) ? originalPO.items : [];

    for (const poItem of poItems) {
      totalOriginalQty += poItem.qty || 0;
    }

    // Update each PO item with returned qty
    for (const returnedItem of items) {
      totalReturnedQty += returnedItem.returnedQty;
      
      // Find matching item in PO and reduce its quantity
      const poItemIndex = poItems.findIndex(pi => 
        pi.productId?.toString() === returnedItem.productId?.toString()
      );
      
      if (poItemIndex !== -1) {
        poItems[poItemIndex].qty = Math.max(0, (poItems[poItemIndex].qty || 0) - returnedItem.returnedQty);
        console.log(`📦 PO Item "${returnedItem.name}" quantity updated: -${returnedItem.returnedQty} (New qty: ${poItems[poItemIndex].qty})`);
      }
    }

    if (totalReturnedQty >= totalOriginalQty) {
      poStatus = "FULLY_RETURNED";
    } else if (totalReturnedQty > 0) {
      poStatus = "PARTIALLY_RETURNED";
    }

    // Update PO with new items and status
    await PurchaseOrder.findByIdAndUpdate(
      originalPurchaseOrderId,
      { 
        items: poItems,
        status: poStatus 
      }
    );
    
    console.log(`✅ PO status updated to: ${poStatus}`);

    // ✅ REDUCE VENDOR AP (ACCOUNTS PAYABLE) BALANCE
    if (originalPO.vendor && originalPO.vendor.id) {
      try {
        const vendor = await Vendor.findById(originalPO.vendor.id);
        if (vendor) {
          const grandTotal = debitNote.grandTotal || 0;
          const newClosingBalance = Math.max(0, (vendor.closingBalance || 0) - grandTotal);
          await Vendor.findByIdAndUpdate(
            originalPO.vendor.id,
            { closingBalance: newClosingBalance },
            { new: true }
          );
          console.log(`✅ Vendor AP balance reduced: -₹${grandTotal}, New balance: ₹${newClosingBalance}`);
        }
      } catch (err) {
        console.warn(`⚠️ Failed to update vendor balance:`, err.message);
      }
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
    for (const item of debitNote.items) {
      try {
        const product = await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { totalQty: item.returnedQty } },
          { new: true }
        );
        if (product) {
          console.log(
            `✅ Product "${product.name}" inventory restored: +${item.returnedQty} units`
          );
        }
      } catch (err) {
        console.error(`⚠️ Failed to restore product ${item.productId}:`, err.message);
      }
    }

    res.json({ success: true, message: "Debit note deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
