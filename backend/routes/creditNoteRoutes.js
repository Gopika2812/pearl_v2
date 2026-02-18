import express from "express";
import Commission from "../models/Commission.js";
import CreditNote from "../models/CreditNote.js";
import Customer from "../models/Customer.js";
import DeliveryMan from "../models/DeliveryMan.js";
import Product from "../models/Product.js";
import SalesMan from "../models/SalesMan.js";
import SalesOrder from "../models/SalesOrder.js";
import SalesOwner from "../models/SalesOwner.js";
import { getFinancialYear } from "../utils/financialYear.js";

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
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
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

    // 2️⃣ REDUCE CUSTOMER CLOSING BALANCE
    const customerId = originalOrder.customer.customerId;
    const customer = await Customer.findById(customerId);
    if (customer) {
      const reducedBalance = customer.closingBalance - grandTotal;
      await Customer.findByIdAndUpdate(customerId, {
        closingBalance: reducedBalance,
        totalBalance: reducedBalance,
      });
      creditNote.customer.closingBalance = reducedBalance;
      console.log(`✅ Customer balance reduced: ₹${reducedBalance}`);
    }

    // 3️⃣ REDUCE COMMISSIONS (proportional to returned amount)
    const commission = await Commission.findOne({ salesOrderId: originalSalesOrderId });
    if (commission) {
      const proportionReturned = grandTotal / (originalOrder.grandTotalWithMargin || originalOrder.grandTotal);
      
      // Sales Owner Commission
      if (commission.salesOwnerId && commission.salesOwnerCommissionAmount > 0) {
        const commissionReduction = commission.salesOwnerCommissionAmount * proportionReturned;
        await SalesOwner.findByIdAndUpdate(commission.salesOwnerId, {
          $inc: { commissionAmount: -commissionReduction }
        });
        console.log(`✅ Sales Owner commission reduced: -₹${commissionReduction.toFixed(2)}`);
      }

      // Sales Man Commission
      if (commission.salesManId && commission.salesManCommissionAmount > 0) {
        const commissionReduction = commission.salesManCommissionAmount * proportionReturned;
        await SalesMan.findByIdAndUpdate(commission.salesManId, {
          $inc: { commissionAmount: -commissionReduction }
        });
        console.log(`✅ Sales Man commission reduced: -₹${commissionReduction.toFixed(2)}`);
      }

      // Delivery Man Commission
      if (commission.deliveryManId && commission.deliveryManCommissionAmount > 0) {
        const commissionReduction = commission.deliveryManCommissionAmount * proportionReturned;
        await DeliveryMan.findByIdAndUpdate(commission.deliveryManId, {
          $inc: { commissionAmount: -commissionReduction }
        });
        console.log(`✅ Delivery Man commission reduced: -₹${commissionReduction.toFixed(2)}`);
      }
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
