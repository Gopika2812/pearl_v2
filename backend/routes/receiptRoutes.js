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
      status: "confirmed"
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

    // UPDATE CUSTOMER DEBIT (INCREASE as per user's requirement)
    const customerId = originalOrder.customer.customerId;
    const customer = await Customer.findById(customerId);
    if (customer) {
      const newDebit = (customer.debit || 0) + amount;
      const newClosingBalance = Math.max(0, (customer.closingBalance || 0) - amount);
      
      await Customer.findByIdAndUpdate(customerId, {
        debit: newDebit,  // INCREASE debit (payment received)
        closingBalance: newClosingBalance,
        totalBalance: newClosingBalance,
      });
      
      console.log(`✅ Customer debit increased: +₹${amount} (new debit: ₹${newDebit})`);
      console.log(`✅ Customer balance reduced: ₹${newClosingBalance}`);
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

// CANCEL receipt (delete receipt entry)
router.delete("/:receiptId", async (req, res) => {
  try {
    const receipt = await Receipt.findByIdAndDelete(req.params.receiptId);
    if (!receipt) {
      return res.status(404).json({ success: false, message: "Receipt not found" });
    }

    // REVERSE customer debit update
    const customerId = receipt.customer.customerId;
    const customer = await Customer.findById(customerId);
    if (customer) {
      const reversedDebit = Math.max(0, (customer.debit || 0) - receipt.amount);
      const reversedBalance = (customer.closingBalance || 0) + receipt.amount;
      
      await Customer.findByIdAndUpdate(customerId, {
        debit: reversedDebit,
        closingBalance: reversedBalance,
        totalBalance: reversedBalance,
      });
      
      console.log(`✅ Receipt cancelled - Customer debit decreased: -₹${receipt.amount}`);
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
