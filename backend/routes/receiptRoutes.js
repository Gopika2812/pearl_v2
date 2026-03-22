import express from "express";
import Customer from "../models/Customer.js";
import Receipt from "../models/Receipt.js";
import SalesOrder from "../models/SalesOrder.js";
import { getFinancialYear } from "../utils/financialYear.js";

const router = express.Router();

// GET all receipts
router.get("/", async (req, res) => {
  try {
    const receipts = await Receipt.find()
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: receipts });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch receipts" });
  }
});

// GET receipts for specific sales order
router.get("/order/:salesOrderId", async (req, res) => {
  try {
    const receipts = await Receipt.find({
      originalSalesOrderId: req.params.salesOrderId,
      status: { $in: ["confirmed", "bounced"] }
    });
    
    res.json({ success: true, data: receipts });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch receipts" });
  }
});

// CREATE receipt (payment received)
router.post("/", async (req, res) => {
  try {
    const {
      originalSalesOrderId,
      amount,
      paymentMethod,
      reference,
      notes,
    } = req.body;

    // Validate inputs
    if (!originalSalesOrderId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Missing or invalid required fields" });
    }

    // Get original sales order
    const originalOrder = await SalesOrder.findById(originalSalesOrderId);
    if (!originalOrder) {
      return res.status(404).json({ success: false, message: "Sales order not found" });
    }

    // Validate amount doesn't exceed invoice total
    if (amount > (originalOrder.grandTotal || 0)) {
      return res.status(400).json({ success: false, message: "Receipt amount exceeds invoice total" });
    }

    // Generate Receipt ID
    const financialYear = getFinancialYear();
    const receiptDoc = await Receipt.findOne({ financialYear }).sort({ receiptId: -1 });
    const nextNumber = receiptDoc ? parseInt(receiptDoc.receiptId.split("/")[1]) + 1 : 1;
    const receiptId = `RCP/${String(nextNumber).padStart(3, "0")}/${financialYear}`;

    // Create receipt
    const receipt = new Receipt({
      receiptId,
      originalSalesOrderId,
      originalInvoiceId: originalOrder.invoiceId,
      customer: {
        customerId: originalOrder.customer.customerId,
        name: originalOrder.customer.name,
      },
      amount,
      paymentMethod: paymentMethod || "CASH",
      reference: reference || null,
      notes: notes || null,
      financialYear,
      status: "confirmed",
    });

    await receipt.save();

    // UPDATE CUSTOMER DEBIT (DECREASE for payment) AND CREDIT
    const customerId = originalOrder.customer.customerId;
    const customer = await Customer.findById(customerId);
    if (customer) {
      let remainingAmount = amount;
      let currentDebit = customer.debit || 0;
      let currentCredit = customer.credit || 0;

      // Payment reduces debit first
      if (currentDebit >= remainingAmount) {
        currentDebit -= remainingAmount;
        remainingAmount = 0;
      } else {
        // Excess goes to credit
        remainingAmount -= currentDebit;
        currentDebit = 0;
        currentCredit += remainingAmount;
      }

      const newClosingBalance = (customer.closingBalance || 0) - amount;
      
      await Customer.findByIdAndUpdate(customerId, {
        debit: currentDebit,
        credit: currentCredit,
        closingBalance: newClosingBalance,
        totalBalance: newClosingBalance,
      });
      
      console.log(`✅ Customer balance updated: debit: ₹${currentDebit}, credit: ₹${currentCredit}, closingBalance: ₹${newClosingBalance}`);
    }

    res.json({
      success: true,
      message: "Receipt created successfully",
      data: receipt,
    });
  } catch (error) {
    console.error("Error creating receipt:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create receipt" });
  }
});

// CREATE BOUNCE RECORD (reverse payment & create ledger record)
router.post("/bounce", async (req, res) => {
  try {
    const { originalSalesOrderId, amount, notes } = req.body;

    if (!originalSalesOrderId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Missing or invalid required fields" });
    }

    const originalOrder = await SalesOrder.findById(originalSalesOrderId);
    if (!originalOrder) {
      return res.status(404).json({ success: false, message: "Sales order not found" });
    }

    const financialYear = getFinancialYear();
    const receiptDoc = await Receipt.findOne({ financialYear }).sort({ receiptId: -1 });
    const nextNumber = receiptDoc ? parseInt(receiptDoc.receiptId.split("/")[1]) + 1 : 1;
    const receiptId = `BNC/${String(nextNumber).padStart(3, "0")}/${financialYear}`;

    const bounceReceipt = new Receipt({
      receiptId,
      originalSalesOrderId,
      originalInvoiceId: originalOrder.invoiceId,
      customer: {
        customerId: originalOrder.customer.customerId,
        name: originalOrder.customer.name,
      },
      amount,
      paymentMethod: "BOUNCED",
      reference: "Cheque Bounced",
      notes: notes || "Bounced Penalty/Return",
      financialYear,
      status: "bounced",
    });

    await bounceReceipt.save();

    // INCREASE CUSTOMER DEBIT (Customer owes the bounced amount again)
    const customerId = originalOrder.customer.customerId;
    const customer = await Customer.findById(customerId);
    if (customer) {
      const newDebit = (customer.debit || 0) + amount;
      const newClosingBalance = (customer.closingBalance || 0) + amount;
      
      await Customer.findByIdAndUpdate(customerId, {
        debit: newDebit,
        closingBalance: newClosingBalance,
        totalBalance: newClosingBalance,
      });
      
      console.log(`✅ Bounce processed - Customer debit increased to ₹${newDebit}`);
    }

    res.json({
      success: true,
      message: "Bounce recorded successfully",
      data: bounceReceipt,
    });
  } catch (error) {
    console.error("Error creating bounce record:", error);
    res.status(500).json({ success: false, message: "Failed to record bounce" });
  }
});

// CANCEL receipt (delete receipt entry)
router.delete("/:receiptId", async (req, res) => {
  try {
    const receipt = await Receipt.findByIdAndDelete(req.params.receiptId);
    if (!receipt) {
      return res.status(404).json({ success: false, message: "Receipt not found" });
    }

    // REVERSE customer payment update
    const customerId = receipt.customer.customerId;
    const customer = await Customer.findById(customerId);
    if (customer) {
      let remainingAmountToReverse = receipt.amount;
      let currentDebit = customer.debit || 0;
      let currentCredit = customer.credit || 0;

      // Reversing a payment: first reduce credit, then increase debit
      if (currentCredit >= remainingAmountToReverse) {
        currentCredit -= remainingAmountToReverse;
        remainingAmountToReverse = 0;
      } else {
        remainingAmountToReverse -= currentCredit;
        currentCredit = 0;
        currentDebit += remainingAmountToReverse;
      }

      const reversedBalance = (customer.closingBalance || 0) + receipt.amount;
      
      await Customer.findByIdAndUpdate(customerId, {
        debit: currentDebit,
        credit: currentCredit,
        closingBalance: reversedBalance,
        totalBalance: reversedBalance,
      });
      
      console.log(`✅ Receipt cancelled - Customer balance reverted`);
    }

    res.json({
      success: true,
      message: "Receipt cancelled successfully",
      data: receipt,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to cancel receipt" });
  }
});

export default router;
