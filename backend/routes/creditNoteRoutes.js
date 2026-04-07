import express from "express";
import mongoose from "mongoose";
import Commission from "../models/Commission.js";
import CreditNote from "../models/CreditNote.js";
import Customer from "../models/Customer.js";
import DeliveryMan from "../models/DeliveryMan.js";
import Product from "../models/Product.js";
import SalesMan from "../models/SalesMan.js";
import SalesOrder from "../models/SalesOrder.js";
import SalesOwner from "../models/SalesOwner.js";
import VoucherType from "../models/VoucherType.js";
import { getFinancialYear } from "../utils/financialYear.js";
import GLService from "../utils/glService.js";

import { createAuditLog } from "../utils/logUtil.js";

const router = express.Router();

/**
 * 🛠️ SHARED CN ID GENERATOR
 * Generates an atomic, branch-specific ID using the VoucherType system.
 */
const generateBranchSpecificCNId = async (branchId, financialYear) => {
  // 1. Ensure the voucher entry exists for this branch's Credit Notes
  let voucher = await VoucherType.findOne({
    branchId,
    name: "credit_note",
    orderType: "CN",
  });

  if (!voucher) {
    // 💡 LIVE REPAIR: If this is the first time, find the last CN for this branch to initialize accurately
    const lastCN = await CreditNote.findOne({ branchId, financialYear }).sort({ createdAt: -1 });
    const lastNum = lastCN ? (parseInt(lastCN.creditNoteId.split("/")[1]) || 0) : 0;

    voucher = await VoucherType.create({
      branchId,
      name: "credit_note",
      orderType: "CN",
      prefix: "CN",
      counter: lastNum,
      financialYear,
    });
  }

  // 2. Handle financial year reset
  if (voucher.financialYear !== financialYear) {
    voucher = await VoucherType.findByIdAndUpdate(
      voucher._id,
      { counter: 0, financialYear },
      { new: true }
    );
  }

  // 3. Increment counter atomically
  voucher = await VoucherType.findByIdAndUpdate(
    voucher._id,
    { $inc: { counter: 1 } },
    { new: true }
  );

  return `CN/${String(voucher.counter).padStart(3, "0")}/${financialYear}`;
};

// GET all credit notes (strictly filtered by branchId)
router.get("/", async (req, res) => {
  try {
    const { branchId } = req.query;
    if (!branchId || branchId === "undefined") {
      return res.status(400).json({ success: false, message: "Valid branchId is required" });
    }

    // ⚡ LIVE REPAIR: Find any notes for this branch's customers that are missing branchId
    const legacyNotes = await CreditNote.find({ 
      branchId: { $exists: false },
      "customer.customerId": { $exists: true }
    });
    
    if (legacyNotes.length > 0) {
      console.log(`🔧 Migrating ${legacyNotes.length} legacy credit notes...`);
      for (const cn of legacyNotes) {
        const customer = await Customer.findById(cn.customer.customerId);
        if (customer && customer.branchId) {
          await CreditNote.findByIdAndUpdate(cn._id, { branchId: customer.branchId });
        }
      }
    }

    const creditNotes = await CreditNote.find({ branchId })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: creditNotes });
  } catch (error) {
    console.error("Credit Note Fetch Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch credit notes" });
  }
});

// GET credit notes for specific sales order
router.get("/order/:salesOrderId", async (req, res) => {
  try {
    const creditNotes = await CreditNote.find({
      originalSalesOrderId: req.params.salesOrderId,
      status: "Created"
    });

    res.json({ success: true, data: creditNotes });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch credit notes" });
  }
});

// GET next available credit note ID for preview (Branch-Specific)
router.get("/next-id", async (req, res) => {
  try {
    const { branchId } = req.query;
    if (!branchId) {
      return res.status(400).json({ success: false, message: "branchId is required" });
    }

    const financialYear = getFinancialYear();
    
    let voucher = await VoucherType.findOne({
      branchId,
      name: "credit_note",
      orderType: "CN",
    });

    // If it doesn't exist, we'll peek at the actual branch records for a safe starting point
    let currentCounter = 0;
    if (voucher) {
      currentCounter = voucher.financialYear === financialYear ? voucher.counter : 0;
    } else {
      const lastCN = await CreditNote.findOne({ branchId, financialYear }).sort({ createdAt: -1 });
      currentCounter = lastCN ? (parseInt(lastCN.creditNoteId.split("/")[1]) || 0) : 0;
    }

    const nextId = `CN/${String(currentCounter + 1).padStart(3, "0")}/${financialYear}`;
    res.json({ success: true, nextId });
  } catch (error) {
    console.error("Next ID Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate next ID" });
  }
});


// CREATE credit note (sales order return)
router.post("/", async (req, res) => {
  try {
    const {
      originalSalesOrderId,
      customerId, // Use this for standalone returns
      branchId,
      items,
      reasonForReturn,
      userId,
      username
    } = req.body;

    let originalOrder = null;
    let customer = null;
    let finalBranchId = branchId;

    if (originalSalesOrderId) {
      // Get original sales order
      originalOrder = await SalesOrder.findById(originalSalesOrderId).populate("customer.customerId");
      
      // 💡 FALLBACK: If not found in SalesOrder, check if it's an Invoice ID
      if (!originalOrder) {
        const Invoice = mongoose.model("Invoice");
        const linkedInvoice = await Invoice.findById(originalSalesOrderId);
        if (linkedInvoice && linkedInvoice.salesOrderId) {
          originalOrder = await SalesOrder.findById(linkedInvoice.salesOrderId).populate("customer.customerId");
        }
      }

      if (!originalOrder) {
        return res.status(404).json({ success: false, message: "Sales order not found" });
      }
      customer = await Customer.findById(originalOrder.customer.customerId);
      finalBranchId = originalOrder.branchId;
    } else {
      // Standalone return
      if (!customerId) {
        return res.status(400).json({ success: false, message: "CustomerId is required for standalone returns" });
      }
      customer = await Customer.findById(customerId);
    }

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // Calculate returned amounts
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let grandTotal = 0;

    const returnedItems = items.map(item => {
      const sPrice = Number(item.sellingPrice || 0);
      const qty = Number(item.qty || 0);
      const discountP = Number(item.discountPercent || 0);
      const gstRate = Number(item.gst || 0);

      const itemSubtotal = sPrice * qty;
      const itemDiscount = (itemSubtotal * discountP) / 100;
      const itemTaxable = itemSubtotal - itemDiscount;
      const itemTax = (itemTaxable * gstRate) / 100;
      const itemTotal = itemTaxable + itemTax;

      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;
      totalTax += itemTax;
      grandTotal += itemTotal;

      return {
        productId: item.productId,
        name: item.name,
        qty: qty,
        sellingPrice: sPrice,
        discountType: item.discountType || "PERCENT",
        discountPercent: discountP,
        discountAmount: itemDiscount,
        gst: gstRate,
        tax: itemTax, // ✨ Added for GL/Accounting consistency
        cgst: item.igst ? 0 : itemTax / 2,
        sgst: item.igst ? 0 : itemTax / 2,
        igst: item.igst ? itemTax : 0,
        total: itemTotal,
      };
    });

    const financialYear = getFinancialYear();
    const creditNoteId = await generateBranchSpecificCNId(finalBranchId, financialYear);

    // Create credit note
    const creditNote = new CreditNote({
      creditNoteId,
      originalSalesOrderId: originalSalesOrderId || null,
      originalInvoiceId: originalOrder?.invoiceId || "STANDALONE",
      branchId: finalBranchId,
      customer: {
        customerId: customer._id,
        name: customer.name,
      },
      items: returnedItems,
      subtotal: Math.round(subtotal),
      totalDiscount: Math.round(totalDiscount),
      totalTax: Math.round(totalTax),
      grandTotal: Math.round(grandTotal),
      salesOwner: originalOrder?.salesOwner || "Standalone",
      salesMan: originalOrder?.salesMan || null,
      deliveryMan: originalOrder?.deliveryMan || null,
      financialYear,
      reasonForReturn: reasonForReturn || "Product Return",
    });

    await creditNote.save();

    // 1️⃣ ADD PRODUCTS BACK TO INVENTORY
    for (const item of returnedItems) {
      if (item.productId) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { totalQty: item.qty }
        });
      }
    }

    // 2️⃣ INCREASE CUSTOMER CREDIT (they get money back) - Netted
    let amountToReturn = Math.round(grandTotal);
    let currentDebit = customer.debit || 0;
    let currentCredit = customer.credit || 0;

    if (currentDebit >= amountToReturn) {
      currentDebit -= amountToReturn;
      amountToReturn = 0;
    } else {
      amountToReturn -= currentDebit;
      currentDebit = 0;
      currentCredit += amountToReturn;
    }

    const reducedBalance = Math.round((customer.closingBalance || 0) - Math.round(grandTotal));
    await Customer.findByIdAndUpdate(customer._id, {
      debit: currentDebit,
      credit: currentCredit,
      closingBalance: reducedBalance,
      totalBalance: reducedBalance,
    });

    // CREATE AUDIT LOG
    try {
      await createAuditLog({
        userId: userId || "System",
        username: username || "System",
        branchId: finalBranchId,
        action: "CREDIT_NOTE",
        description: `Created credit note ${creditNoteId} for ${customer.name} - ₹${grandTotal}`,
        targetId: creditNote._id,
        targetModel: "CreditNote",
      });
    } catch (logErr) { console.warn("Audit log failed"); }

    // 3️⃣ REDUCE COMMISSIONS (only for invoice-linked returns)
    if (originalSalesOrderId && originalOrder && mongoose.Types.ObjectId.isValid(originalSalesOrderId)) {
      try {
        const salesOrderObjectId = new mongoose.Types.ObjectId(originalSalesOrderId);
        let commission = await Commission.findOne({ salesOrderId: salesOrderObjectId });
        if (!commission && originalOrder.invoiceId) {
          commission = await Commission.findOne({ invoiceId: originalOrder.invoiceId });
        }

        if (commission) {
          const proportionReturned = grandTotal / (originalOrder.grandTotalWithMargin || originalOrder.grandTotal || 1);
          
          if (commission.salesOwnerId && commission.salesOwnerCommissionAmount > 0) {
            await SalesOwner.findByIdAndUpdate(commission.salesOwnerId, {
              $inc: { commissionAmount: -(commission.salesOwnerCommissionAmount * proportionReturned) }
            });
          }
          if (commission.salesManId && commission.salesManCommissionAmount > 0) {
            await SalesMan.findByIdAndUpdate(commission.salesManId, {
              $inc: { commissionAmount: -(commission.salesManCommissionAmount * proportionReturned) }
            });
          }
          if (commission.deliveryManId && commission.deliveryManCommissionAmount > 0) {
            await DeliveryMan.findByIdAndUpdate(commission.deliveryManId, {
              $inc: { commissionAmount: -(commission.deliveryManCommissionAmount * proportionReturned) }
            });
          }
        }
      } catch (commError) {
        console.warn("⚠️ Commission update failed:", commError.message);
      }
    }

    // ✅ POST JOURNAL ENTRY to GL
    try {
      await GLService.postCreditNoteJE(creditNote);
    } catch (glError) {
      console.warn("⚠️ GL posting failed (non-blocking):", glError.message);
    }

    res.status(201).json({
      success: true,
      message: "Credit note created successfully",
      creditNoteId,
      data: creditNote,
    });
  } catch (error) {
    console.error("Credit note creation error:", error);
    res.status(500).json({ success: false, message: "Failed to create credit note" });
  }
});

// CREATE GENERAL CREDIT NOTE (standalone adjustment)
router.post("/general", async (req, res) => {
  try {
    const {
      customerId,
      amount,
      reasonForReturn,
      branchId,
    } = req.body;

    if (!customerId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Missing or invalid required fields" });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // Generate Credit Note ID (Branch-Specific)
    const financialYear = getFinancialYear();
    const creditNoteId = await generateBranchSpecificCNId(branchId, financialYear);

    const creditNote = new CreditNote({
      creditNoteId,
      branchId,
      customer: {
        customerId,
        name: customer.name,
      },
      subtotal: amount,
      totalTax: 0,
      grandTotal: amount,
      reasonForReturn: reasonForReturn || "General Credit",
      financialYear,
      status: "Created",
      items: [] // No items for general CN
    });

    await creditNote.save();

    // Update Customer Balance (Increase Credit) - Netted
    let amountToReturn = amount;
    let currentDebit = customer.debit || 0;
    let currentCredit = customer.credit || 0;

    if (currentDebit >= amountToReturn) {
      currentDebit -= amountToReturn;
      amountToReturn = 0;
    } else {
      amountToReturn -= currentDebit;
      currentDebit = 0;
      currentCredit += amountToReturn;
    }

    const newClosingBalance = (customer.closingBalance || 0) - amount;

    await Customer.findByIdAndUpdate(customerId, {
      debit: currentDebit,
      credit: currentCredit,
      closingBalance: newClosingBalance,
      totalBalance: newClosingBalance,
    });

    // Create Audit Log
    await createAuditLog({
      userId: req.body.userId || "System",
      username: req.body.username || "System",
      branchId: branchId,
      action: "GENERAL_CREDIT_NOTE",
      description: `Created general credit note ${creditNoteId} for ${customer.name} - ₹${amount}`,
      targetId: creditNote._id,
      targetModel: "CreditNote",
    });

    res.json({
      success: true,
      message: "General credit note recorded successfully",
      data: creditNote,
    });
  } catch (error) {
    console.error("General CN error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create credit note" });
  }
});

// DELETE credit note (cancel return)
router.delete("/:id", async (req, res) => {
  try {
    const deletedCreditNote = await CreditNote.findByIdAndDelete(req.params.id);

    if (!deletedCreditNote) {
      return res.status(404).json({ success: false, message: "Credit note not found" });
    }

    res.json({
      success: true,
      message: "Credit note deleted and all changes reversed",
    });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ success: false, message: "Failed to delete credit note" });
  }
});

export default router;
