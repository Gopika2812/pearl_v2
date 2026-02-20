import express from "express";
import DebitNote from "../models/DebitNote.js";
import Product from "../models/Product.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import VoucherType from "../models/VoucherType.js";

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
    const voucher = await VoucherType.findOne({
      name: "debit_note",
      orderType: "DN",
    });

    if (!voucher) {
      return res.status(404).json({ message: "Debit Note voucher type not found" });
    }

    const currentFY = getFinancialYear();
    let counter = voucher.counter || 1;

    if (voucher.financialYear !== currentFY) {
      counter = 1;
    }

    const nextId = `${voucher.prefix}/${String(counter).padStart(3, "0")}/${currentFY}`;
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
      originalPurchaseOrderId,
      vendor,
      items,
      reason,
    } = req.body;

    // Get the original PO
    const originalPO = await PurchaseOrder.findById(originalPurchaseOrderId);
    if (!originalPO) {
      return res.status(404).json({ message: "Purchase Order not found" });
    }

    // Get voucher for debit note ID
    const voucher = await VoucherType.findOne({
      name: "debit_note",
      orderType: "DN",
    });

    const currentFY = getFinancialYear();
    let counter = voucher?.counter || 1;

    if (voucher?.financialYear !== currentFY) {
      counter = 1;
    }

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
      originalPurchaseOrderId,
      originalInvoiceId: originalPO.invoiceId,
      vendor: {
        name: vendor?.name || originalPO.vendor || "Unknown",
      },
      items,
      subtotal,
      totalTax,
      grandTotal: subtotal + totalTax,
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

    // ✅ UPDATE ORIGINAL PO STATUS IF FULLY RETURNED
    let poStatus = originalPO.status;
    let totalOriginalQty = 0;
    let totalReturnedQty = 0;

    for (const poItem of originalPO.items) {
      totalOriginalQty += poItem.qty;
    }

    for (const item of items) {
      totalReturnedQty += item.returnedQty;
    }

    if (totalReturnedQty >= totalOriginalQty) {
      poStatus = "FULLY_RETURNED";
    } else if (totalReturnedQty > 0) {
      poStatus = "PARTIALLY_RETURNED";
    }

    await PurchaseOrder.findByIdAndUpdate(
      originalPurchaseOrderId,
      { status: poStatus }
    );

    // Update voucher counter
    if (voucher) {
      await VoucherType.findByIdAndUpdate(voucher._id, {
        counter: counter + 1,
        financialYear: currentFY,
      });
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
