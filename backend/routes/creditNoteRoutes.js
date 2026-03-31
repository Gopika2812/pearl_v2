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
import { getFinancialYear } from "../utils/financialYear.js";
import GLService from "../utils/glService.js";

import { createAuditLog } from "../utils/logUtil.js";

const router = express.Router();

// GET all credit notes
router.get("/", async (req, res) => {
  try {
    const creditNotes = await CreditNote.find()
      .sort({ createdAt: -1 });

    res.json({ success: true, data: creditNotes });
  } catch (error) {
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

// CREATE credit note (sales order return)
router.post("/", async (req, res) => {
  try {
    const {
      originalSalesOrderId,
      items,
      reasonForReturn,
    } = req.body;

    // Get original sales order
    const originalOrder = await SalesOrder.findById(originalSalesOrderId);
    if (!originalOrder) {
      return res.status(404).json({ success: false, message: "Sales order not found" });
    }

    // Validate items exist in original order
    for (const returnItem of items) {
      const originalItem = originalOrder.items.find(i => i._id.toString() === returnItem._id);
      if (!originalItem) {
        return res.status(400).json({ success: false, message: "Item not found in original order" });
      }
      if (returnItem.qty > originalItem.qty) {
        return res.status(400).json({ success: false, message: "Return quantity exceeds original quantity" });
      }
    }

    // Calculate returned amounts
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let grandTotal = 0;

    const returnedItems = items.map(item => {
      const originalItem = originalOrder.items.find(i => i._id.toString() === item._id);
      const itemSubtotal = originalItem.sellingPrice * item.qty;
      const itemDiscount = (itemSubtotal * originalItem.discountPercent) / 100;
      const itemTaxable = itemSubtotal - itemDiscount;
      const itemTax = (itemTaxable * originalItem.gst) / 100;
      const itemTotal = itemTaxable + itemTax;

      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;
      totalTax += itemTax;
      grandTotal += itemTotal;

      return {
        productId: originalItem.productId,
        name: originalItem.name,
        qty: item.qty,
        sellingPrice: originalItem.sellingPrice,
        discountType: originalItem.discountType,
        discountPercent: originalItem.discountPercent,
        discountAmount: itemDiscount,
        gst: originalItem.gst,
        cgst: originalItem.cgst,
        sgst: originalItem.sgst,
        igst: originalItem.igst,
        total: itemTotal,
      };
    });

    // Generate Credit Note ID
    const financialYear = getFinancialYear();
    const creditNoteDoc = await CreditNote.findOne({ financialYear }).sort({ creditNoteId: -1 });
    const nextNumber = creditNoteDoc ? parseInt(creditNoteDoc.creditNoteId.split("/")[1]) + 1 : 1;
    const creditNoteId = `CN/${String(nextNumber).padStart(3, "0")}/${financialYear}`;

    // Create credit note
    const creditNote = new CreditNote({
      creditNoteId,
      originalSalesOrderId,
      originalInvoiceId: originalOrder.invoiceId,
      customer: {
        customerId: originalOrder.customer.customerId,
        name: originalOrder.customer.name,
      },
      items: returnedItems,
      subtotal: Math.round(subtotal),
      totalDiscount: Math.round(totalDiscount),
      totalTax: Math.round(totalTax),
      grandTotal: Math.round(grandTotal),
      salesOwner: originalOrder.salesOwner,
      salesMan: originalOrder.salesMan,
      deliveryMan: originalOrder.deliveryMan,
      financialYear,
      reasonForReturn,
    });

    await creditNote.save();

    // 1️⃣ ADD PRODUCTS BACK TO INVENTORY
    for (const item of returnedItems) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { totalQty: item.qty }
      });
      console.log(`✅ Product inventory restored: +${item.qty} units`);
    }

    // 2️⃣ INCREASE CUSTOMER CREDIT (they get money back)
    const customerId = originalOrder.customer.customerId;
    const customer = await Customer.findById(customerId);
    if (customer) {
      const newCredit = (customer.credit || 0) + Math.round(grandTotal);
      const reducedBalance = Math.round((customer.closingBalance || 0) - Math.round(grandTotal));
      await Customer.findByIdAndUpdate(customerId, {
        credit: newCredit,  // INCREASE credit
        closingBalance: reducedBalance,
        totalBalance: reducedBalance,
      });
      creditNote.customer.closingBalance = reducedBalance;
      console.log(`✅ Customer credit increased: +₹${Math.round(grandTotal)} (new credit: ₹${newCredit})`);
    }

    // CREATE AUDIT LOG
    await createAuditLog({
      userId: req.body.userId || "System",
      username: req.body.username || "System",
      branchId: originalOrder.branchId,
      action: "CREDIT_NOTE",
      description: `Created credit note ${creditNoteId} for ${originalOrder.customer.name} - ₹${grandTotal}`,
      targetId: creditNote._id,
      targetModel: "CreditNote",
    });

    // 3️⃣ REDUCE COMMISSIONS (proportional to returned amount)
    console.log(`🔍 Looking for commission for sales order: ${originalSalesOrderId}`);

    // Convert to ObjectId for proper matching
    const salesOrderObjectId = new mongoose.Types.ObjectId(originalSalesOrderId);
    let commission = await Commission.findOne({ salesOrderId: salesOrderObjectId });
    console.log(`📋 Commission found:`, commission ? "YES" : "NO");

    // Fallback: try to find commission by invoice ID
    if (!commission && originalOrder.invoiceId) {
      console.log(`🔄 Fallback search by invoiceId: ${originalOrder.invoiceId}`);
      commission = await Commission.findOne({ invoiceId: originalOrder.invoiceId });
      console.log(`📋 Commission found (fallback):`, commission ? "YES" : "NO");
    }

    if (commission) {
      console.log(`💾 Commission details:`, {
        salesOwnerId: commission.salesOwnerId,
        salesOwnerAmount: commission.salesOwnerCommissionAmount,
        salesManId: commission.salesManId,
        salesManAmount: commission.salesManCommissionAmount,
        deliveryManId: commission.deliveryManId,
        deliveryManAmount: commission.deliveryManCommissionAmount,
      });

      const proportionReturned = grandTotal / (originalOrder.grandTotalWithMargin || originalOrder.grandTotal);
      console.log(`📊 Proportion returned: ${proportionReturned.toFixed(2)} (${grandTotal} / ${originalOrder.grandTotalWithMargin})`);

      // Sales Owner Commission
      if (commission.salesOwnerId && commission.salesOwnerCommissionAmount > 0) {
        const commissionReduction = commission.salesOwnerCommissionAmount * proportionReturned;
        console.log(`🔄 Reducing Sales Owner [${commission.salesOwnerId}] by ₹${commissionReduction.toFixed(2)}`);
        const updateResult = await SalesOwner.findByIdAndUpdate(commission.salesOwnerId, {
          $inc: { commissionAmount: -commissionReduction }
        });
        if (updateResult) {
          console.log(`✅ Sales Owner commission reduced: -₹${commissionReduction.toFixed(2)}`);
        } else {
          console.warn(`⚠️ Sales Owner not found with ID: ${commission.salesOwnerId}`);
        }
      } else {
        console.warn(`⚠️ Sales Owner ID or commission amount missing`, {
          salesOwnerId: commission.salesOwnerId,
          amount: commission.salesOwnerCommissionAmount
        });
      }

      // Sales Man Commission
      if (commission.salesManId && commission.salesManCommissionAmount > 0) {
        const commissionReduction = commission.salesManCommissionAmount * proportionReturned;
        console.log(`🔄 Reducing Sales Man [${commission.salesManId}] by ₹${commissionReduction.toFixed(2)}`);
        const updateResult = await SalesMan.findByIdAndUpdate(commission.salesManId, {
          $inc: { commissionAmount: -commissionReduction }
        });
        if (updateResult) {
          console.log(`✅ Sales Man commission reduced: -₹${commissionReduction.toFixed(2)}`);
        } else {
          console.warn(`⚠️ Sales Man not found with ID: ${commission.salesManId}`);
        }
      } else {
        console.warn(`⚠️ Sales Man ID or commission amount missing`, {
          salesManId: commission.salesManId,
          amount: commission.salesManCommissionAmount
        });
      }

      // Delivery Man Commission
      if (commission.deliveryManId && commission.deliveryManCommissionAmount > 0) {
        const commissionReduction = commission.deliveryManCommissionAmount * proportionReturned;
        console.log(`🔄 Reducing Delivery Man [${commission.deliveryManId}] by ₹${commissionReduction.toFixed(2)}`);
        const updateResult = await DeliveryMan.findByIdAndUpdate(commission.deliveryManId, {
          $inc: { commissionAmount: -commissionReduction }
        });
        if (updateResult) {
          console.log(`✅ Delivery Man commission reduced: -₹${commissionReduction.toFixed(2)}`);
        } else {
          console.warn(`⚠️ Delivery Man not found with ID: ${commission.deliveryManId}`);
        }
      } else {
        console.warn(`⚠️ Delivery Man ID or commission amount missing`, {
          deliveryManId: commission.deliveryManId,
          amount: commission.deliveryManCommissionAmount
        });
      }
    } else {
      console.warn(`⚠️ No commission record found for sales order: ${originalSalesOrderId}. Invoice: ${originalOrder.invoiceId}`);
    }

    // ✅ POST JOURNAL ENTRY to GL
    try {
      const journalEntry = await GLService.postCreditNoteJE(creditNote);
      console.log(`✅ GL Entry posted: ${journalEntry.jeId}`);
    } catch (glError) {
      console.warn("⚠️ GL posting failed (non-blocking):", glError.message);
      // Don't fail the CN creation if GL posting fails
    }

    res.status(201).json({
      success: true,
      message: "Credit note created successfully",
      creditNoteId,
      commissionUpdated: !!commission,
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

    // Generate Credit Note ID
    const financialYear = getFinancialYear();
    const prefix = "CN";

    let creditNote;
    let creditNoteId;
    let saved = false;
    let retries = 0;

    while (!saved && retries < 5) {
      try {
        const lastCN = await CreditNote.findOne({
          creditNoteId: new RegExp(`^${prefix}/`),
          financialYear
        }).sort({ creditNoteId: -1 });

        const nextNumber = lastCN ? parseInt(lastCN.creditNoteId.split("/")[1]) + 1 : 1;
        creditNoteId = `${prefix}/${String(nextNumber).padStart(3, "0")}/${financialYear}`;

        creditNote = new CreditNote({
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
        saved = true;
      } catch (err) {
        if (err.code === 11000 || (err.message && err.message.includes('E11000'))) {
          retries++;
        } else {
          throw err;
        }
      }
    }

    if (!saved) {
      return res.status(500).json({ success: false, message: "Could not generate a unique ID. Please try again." });
    }

    // Update Customer Balance (Increase Credit)
    const newCredit = (customer.credit || 0) + amount;
    const newClosingBalance = (customer.closingBalance || 0) - amount;

    await Customer.findByIdAndUpdate(customerId, {
      credit: newCredit,
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
