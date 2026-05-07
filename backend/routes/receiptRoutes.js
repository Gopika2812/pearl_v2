import express from "express";
import Customer from "../models/Customer.js";
import Receipt from "../models/Receipt.js";
import SalesOrder from "../models/SalesOrder.js";
import VoucherType from "../models/VoucherType.js";
import { getFinancialYear } from "../utils/financialYear.js";
import { createAuditLog } from "../utils/logUtil.js";

const router = express.Router();

/**
 * 🏗️ LIVE REPAIR: Drop the legacy global unique index to allow branch-specific numbering
 */
import mongoose from "mongoose";
mongoose.connection.on("connected", async () => {
  try {
    const collections = await mongoose.connection.db.listCollections({ name: "receipts" }).toArray();
    if (collections.length > 0) {
      const db = mongoose.connection.db;
      const indexes = await db.collection("receipts").indexes();
      const hasLegacyIndex = indexes.some(idx => idx.name === "receiptId_1");

      if (hasLegacyIndex) {
        await db.collection("receipts").dropIndex("receiptId_1");
        console.log("✅ Legacy global Receipt index 'receiptId_1' dropped successfully.");
      }
    }
  } catch (err) {
    if (err.codeName !== "IndexNotFound") {
      console.warn("⚠️ Could not drop legacy Receipt index:", err.message);
    }
  }
});

/**
 * 🛠️ SHARED RECEIPT ID GENERATOR
 */
const generateBranchSpecificReceiptId = async (branchId, financialYear, prefix = "REC") => {
  if (!branchId) return `${prefix}/${Date.now()}`;

  let voucher = await VoucherType.findOne({
    branchId,
    name: prefix === "REC" ? "receipt" : "receipt_bounce",
    orderType: prefix === "REC" ? "REC" : "BNC",
  });

  if (!voucher) {
    voucher = await VoucherType.create({
      branchId,
      name: prefix === "REC" ? "receipt" : "receipt_bounce",
      orderType: prefix === "REC" ? "REC" : "BNC",
      prefix: prefix,
      counter: 0,
      financialYear
    });
  }

  if (voucher.financialYear !== financialYear) {
    voucher = await VoucherType.findByIdAndUpdate(voucher._id, { counter: 0, financialYear }, { new: true });
  }

  // Atomic increment
  voucher = await VoucherType.findByIdAndUpdate(voucher._id, { $inc: { counter: 1 } }, { new: true });

  // 🛡️ SELF-HEALING: Check if this ID already exists (prevents Duplicate Key Error)
  let candidateId = `${voucher.prefix}/${String(voucher.counter).padStart(3, "0")}/${financialYear}`;
  const exists = await Receipt.findOne({ branchId, receiptId: candidateId });

  if (exists) {
    console.warn(`🚨 Duplicate Receipt ID detected: ${candidateId}. Auto-healing counter...`);
    // Find the actual Maximum in the DB
    const latestReceipts = await Receipt.find({
      branchId,
      financialYear,
      receiptId: new RegExp(`^${voucher.prefix}/`)
    }).select("receiptId").lean();

    const sequenceNumbers = latestReceipts.map(r => {
      const match = r.receiptId.match(/\/(\d+)\//);
      return match ? parseInt(match[1]) : 0;
    });

    const maxSeq = Math.max(0, ...sequenceNumbers);
    const newCounter = maxSeq + 1;

    // Update the counter to jumping past the duplicates
    voucher = await VoucherType.findByIdAndUpdate(
      voucher._id,
      { counter: newCounter },
      { new: true }
    );
    candidateId = `${voucher.prefix}/${String(voucher.counter).padStart(3, "0")}/${financialYear}`;
    console.log(`✅ Counter healed. New ID: ${candidateId}`);
  }

  return candidateId;
};

// GET all receipts (optional branch filtering and date filtering)
router.get("/", async (req, res) => {
  try {
    const { branchId, fromDate, toDate } = req.query;
    const query = branchId ? { branchId } : {};

    if (fromDate || toDate) {
      let startStr = fromDate;
      let endStr = toDate;

      // 🛡️ Safeguard: If dates are inverted (Start > End), swap them
      if (startStr && endStr && startStr > endStr) {
        [startStr, endStr] = [endStr, startStr];
      }

      const start = startStr ? new Date(startStr) : new Date();
      start.setHours(0, 0, 0, 0);

      const end = endStr ? new Date(endStr) : new Date(start);
      end.setHours(23, 59, 59, 999);

      query.createdAt = { $gte: start, $lte: end };
    }

    const receipts = await Receipt.find(query)
      .populate("generatedBy", "name")
      .populate("cancelledBy", "name")
      .populate("originalSalesOrderId", "salesInvoiceId invoiceId")
      .populate("relatedOrders.salesOrderId", "salesInvoiceId invoiceId")
      .sort({ createdAt: -1 });
    res.json({ data: receipts });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch receipts" });
  }
});

// ⚡ SPEED OPTIMIZATION: Get summary for multiple orders in one call
router.post("/batch-summary", async (req, res) => {
  try {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.json({ data: {} });
    }

    // Convert to ObjectIds
    const oIds = orderIds
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    const results = await Receipt.aggregate([
      { $match: { originalSalesOrderId: { $in: oIds }, status: "confirmed" } },
      {
        $group: {
          _id: "$originalSalesOrderId",
          totalReceived: { $sum: "$amount" }
        }
      }
    ]);

    const summaryMap = {};
    results.forEach(r => {
      summaryMap[r._id.toString()] = r.totalReceived;
    });

    res.json({ success: true, data: summaryMap });
  } catch (error) {
    console.error("Batch summary error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE GENERAL receipt (standalone payment)
router.post("/general", async (req, res) => {
  try {
    const {
      customerId,
      amount,
      paymentMethod,
      reference,
      notes,
      branchId,
    } = req.body;

    if (!customerId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Missing or invalid required fields" });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // Generate Standalone Receipt ID
    const financialYear = getFinancialYear();
    const receiptId = await generateBranchSpecificReceiptId(branchId, financialYear);

    // Create receipt
    const receipt = new Receipt({
      receiptId,
      branchId,
      customer: {
        customerId,
        name: customer.name,
      },
      amount,
      paymentMethod: paymentMethod || "CASH",
      reference: reference || null,
      notes: notes || null,
      financialYear,
      status: "confirmed",
    });

    await receipt.save();
    const saved = true;

    if (!saved) {
      return res.status(500).json({ success: false, message: "System busy. Could not generate a unique receipt ID. Please try again." });
    }

    // UPDATE CUSTOMER BALANCE
    let remainingAmount = amount;
    let currentDebit = customer.debit || 0;
    let currentCredit = customer.credit || 0;

    if (currentDebit >= remainingAmount) {
      currentDebit -= remainingAmount;
      remainingAmount = 0;
    } else {
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

    // CREATE AUDIT LOG
    await createAuditLog({
      userId: req.body.userId || "System",
      username: req.body.username || "System",
      branchId: branchId,
      action: "GENERAL_RECEIPT",
      description: `Created standalone receipt ${receiptId} for ${customer.name} - ₹${amount}`,
      targetId: receipt._id,
      targetModel: "Receipt",
    });

    res.json({
      success: true,
      message: "Debit Receipt recorded successfully",
      data: receipt,
    });
  } catch (error) {
    console.error("Error creating general receipt:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create receipt" });
  }
});

// GET receipts for specific sales order
router.get("/order/:salesOrderId", async (req, res) => {
  try {
    const receipts = await Receipt.find({
      $or: [
        { originalSalesOrderId: req.params.salesOrderId },
        { "relatedOrders.salesOrderId": req.params.salesOrderId }
      ],
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

    // Validate amount doesn't exceed invoice total (with a small margin for rounding)
    const maxAllowed = Math.max(
      originalOrder.grandTotal || 0,
      originalOrder.invoiceGrandTotal || 0,
      originalOrder.lastInvoicedGrandTotal || 0,
      originalOrder.closingBalance || 0
    );

    if (amount > maxAllowed + 1) {
      return res.status(400).json({
        success: false,
        message: `Receipt amount (₹${amount}) exceeds invoice total (₹${maxAllowed})`
      });
    }

    // Generate Receipt ID
    const financialYear = getFinancialYear();
    const receiptId = await generateBranchSpecificReceiptId(originalOrder.branchId, financialYear);

    // Create receipt
    const receipt = new Receipt({
      receiptId,
      branchId: originalOrder.branchId,
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
    const saved = true;

    if (!saved) {
      return res.status(500).json({ success: false, message: "System busy. Could not generate a unique receipt ID. Please try again." });
    }

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

    // 🔄 UPDATE SALES ORDER CLOSING BALANCE
    const newOrderClosingBalance = Math.max(0, (originalOrder.closingBalance || 0) - amount);
    await SalesOrder.findByIdAndUpdate(originalSalesOrderId, {
      closingBalance: newOrderClosingBalance,
      // If balance is fully paid, we could potentially update status, but keeping it as is for now
      // to avoid side effects with other status-based logic.
    });
    console.log(`✅ SalesOrder ${originalOrder.invoiceId} closing balance updated to ₹${newOrderClosingBalance}`);

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

// CREATE BOUNCE RECORD (LEGACY: reverse payment & create ledger record)
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
    const receiptId = await generateBranchSpecificReceiptId(originalOrder.branchId, financialYear, "BNC");

    const bounceReceipt = new Receipt({
      receiptId,
      branchId: originalOrder.branchId,
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
    }

    // 🔥 FIX: ALSO Increase SalesOrder closing balance
    await SalesOrder.findByIdAndUpdate(originalSalesOrderId, {
      $inc: { closingBalance: amount }
    });

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

// ⚡ NEW: BOUNCE A SPECIFIC RECEIPT
router.post("/:id/bounce", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { notes, userId, username } = req.body;

    const receipt = await Receipt.findById(id).session(session);
    if (!receipt) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Receipt not found" });
    }

    if (receipt.status === "bounced") {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Receipt is already marked as bounced" });
    }

    if (receipt.status === "cancelled") {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Cannot bounce a cancelled receipt" });
    }

    // 1. Mark Original Receipt as Bounced (but keep confirmed status for the original credit row)
    receipt.isBounced = true;
    await receipt.save({ session });

    // 2. Generate a NEW Reversal Receipt (for the Debit row)
    const financialYear = getFinancialYear();
    const bounceReceiptId = await generateBranchSpecificReceiptId(receipt.branchId, financialYear, "BNC");

    const bounceReceipt = new Receipt({
      receiptId: bounceReceiptId,
      branchId: receipt.branchId,
      generatedBy: userId || receipt.generatedBy,
      originalSalesOrderId: receipt.originalSalesOrderId,
      originalInvoiceId: receipt.originalInvoiceId,
      relatedOrders: receipt.relatedOrders,
      customer: receipt.customer,
      amount: receipt.amount,
      paymentMethod: "BOUNCED",
      reference: `BOUNCE: ${receipt.receiptId}`,
      notes: notes || "Cheque Bounced Reversal",
      financialYear: financialYear,
      status: "bounced",
      bounceId: receipt._id, // Link to original
    });

    await bounceReceipt.save({ session });

    // Link original to the bounce record
    receipt.bounceId = bounceReceipt._id;
    await receipt.save({ session });

    // 3. Increase Customer Debit (Reverse the credit impact)
    const customerId = receipt.customer.customerId;
    const customer = await Customer.findById(customerId).session(session);
    if (customer) {
      const amount = receipt.amount || 0;
      const newDebit = (customer.debit || 0) + amount;
      const newClosingBalance = (customer.closingBalance || 0) + amount;

      await Customer.findByIdAndUpdate(customerId, {
        debit: newDebit,
        closingBalance: newClosingBalance,
        totalBalance: newClosingBalance,
      }).session(session);
    }

    // 4. Restore Sales Order Closing Balances
    if (receipt.relatedOrders && receipt.relatedOrders.length > 0) {
      for (const ro of receipt.relatedOrders) {
        await SalesOrder.findByIdAndUpdate(ro.salesOrderId, {
          $inc: { closingBalance: ro.amount }
        }).session(session);
      }
    } else if (receipt.originalSalesOrderId) {
      await SalesOrder.findByIdAndUpdate(receipt.originalSalesOrderId, {
        $inc: { closingBalance: receipt.amount }
      }).session(session);
    }

    // 5. Audit Log
    await createAuditLog({
      userId: userId || "System",
      username: username || "System",
      branchId: receipt.branchId,
      action: "BOUNCE_RECEIPT",
      description: `Recorded bounce for receipt ${receipt.receiptId}. Created reversal record ${bounceReceiptId}.`,
      targetId: receipt._id,
      targetModel: "Receipt",
    });

    await session.commitTransaction();
    res.json({ success: true, message: "Receipt bounce reversal record created successfully." });
  } catch (error) {
    await session.abortTransaction();
    console.error("Bounce Receipt error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to bounce receipt" });
  } finally {
    session.endSession();
  }
});

// UPDATE receipt
router.put("/:id", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { customerId, amount, paymentMethod, reference, notes, userId, username } = req.body;

    const oldReceipt = await Receipt.findById(id).session(session);
    if (!oldReceipt) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Receipt not found" });
    }

    if (oldReceipt.status === "cancelled") {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Cannot edit a cancelled receipt" });
    }

    const oldCustomerId = oldReceipt.customer.customerId;
    const oldCustomer = await Customer.findById(oldCustomerId).session(session);

    // 1️⃣ REVERSE OLD IMPACT
    // Reverse Customer Balance
    if (oldCustomer) {
      const oldAmount = oldReceipt.amount || 0;
      let cDebit = oldCustomer.debit || 0;
      let cCredit = oldCustomer.credit || 0;

      if (oldReceipt.paymentMethod === "CREDIT") {
        cDebit += oldAmount;
        cCredit += oldAmount;
      } else {
        let remainingToReverse = oldAmount;
        const creditToRemove = Math.min(cCredit, remainingToReverse);
        cCredit -= creditToRemove;
        remainingToReverse -= creditToRemove;
        cDebit += remainingToReverse;
      }

      const restoredBalance = (oldCustomer.closingBalance || 0) + (oldReceipt.paymentMethod === "CREDIT" ? 0 : oldAmount);

      await Customer.findByIdAndUpdate(oldCustomer._id, {
        debit: cDebit,
        credit: cCredit,
        closingBalance: restoredBalance,
        totalBalance: restoredBalance,
      }).session(session);
    }

    // Reverse Sales Order Balances
    if (oldReceipt.relatedOrders && oldReceipt.relatedOrders.length > 0) {
      for (const ro of oldReceipt.relatedOrders) {
        await SalesOrder.findByIdAndUpdate(ro.salesOrderId, {
          $inc: { closingBalance: ro.amount }
        }).session(session);
      }
    } else if (oldReceipt.originalSalesOrderId) {
      await SalesOrder.findByIdAndUpdate(oldReceipt.originalSalesOrderId, {
        $inc: { closingBalance: oldReceipt.amount }
      }).session(session);
    }

    // 2️⃣ HANDLE CUSTOMER CHANGE & NEW TOTALS
    let finalCustomer = oldCustomer;
    if (customerId && customerId !== oldCustomerId.toString()) {
      finalCustomer = await Customer.findById(customerId).session(session);
      if (!finalCustomer) {
        await session.abortTransaction();
        return res.status(404).json({ success: false, message: "New customer not found" });
      }
    }

    const newAmount = Number(amount || oldReceipt.amount);
    const newPaymentMethod = paymentMethod || oldReceipt.paymentMethod;

    // 3️⃣ APPLY NEW IMPACT
    // Apply Customer Balance
    if (finalCustomer) {
      // Re-fetch to get fresh state (might be same customer)
      const freshCustomer = await Customer.findById(finalCustomer._id).session(session);

      let remainingAmount = newAmount;
      let cDebit = freshCustomer.debit || 0;
      let cCredit = freshCustomer.credit || 0;

      if (newPaymentMethod === "CREDIT") {
        const actualCreditToUse = Math.min(cCredit, remainingAmount);
        cDebit = Math.max(0, cDebit - actualCreditToUse);
        cCredit -= actualCreditToUse;
      } else {
        if (cDebit >= remainingAmount) {
          cDebit -= remainingAmount;
          remainingAmount = 0;
        } else {
          remainingAmount -= cDebit;
          cDebit = 0;
          cCredit += remainingAmount;
        }
      }

      const newClosingBalance = (freshCustomer.closingBalance || 0) - (newPaymentMethod === "CREDIT" ? 0 : newAmount);

      await Customer.findByIdAndUpdate(freshCustomer._id, {
        debit: cDebit,
        credit: cCredit,
        closingBalance: newClosingBalance,
        totalBalance: newClosingBalance,
      }).session(session);
    }

    // Apply Sales Order Balances (ONLY if same customer)
    // If customer changed, we UNLINK the sales orders from this receipt to prevent data corruption
    let updatedOriginalSalesOrderId = oldReceipt.originalSalesOrderId;
    let updatedOriginalInvoiceId = oldReceipt.originalInvoiceId;
    let updatedRelatedOrders = oldReceipt.relatedOrders;

    if (customerId && customerId !== oldCustomerId.toString()) {
      // Customer changed - Unlink everything
      updatedOriginalSalesOrderId = null;
      updatedOriginalInvoiceId = "UNLINKED (CUST SWAP)";
      updatedRelatedOrders = [];
      console.log(`⚠️ Receipt ${oldReceipt.receiptId} unlinked from orders due to customer swap.`);
    } else {
      // Same customer - Update order balances with NEW amount
      // Note: This is complex for bulk receipts. For simplicity, we only handle single order updates here
      // if amount changed.
      if (oldReceipt.originalSalesOrderId && !oldReceipt.relatedOrders?.length) {
        await SalesOrder.findByIdAndUpdate(oldReceipt.originalSalesOrderId, {
          $inc: { closingBalance: -newAmount }
        }).session(session);
      }
      // Bulk receipts (relatedOrders) usually shouldn't be edited via this route, 
      // but we maintain the link if customer is same.
    }

    // 4️⃣ UPDATE RECORD
    const updateData = {
      amount: newAmount,
      paymentMethod: newPaymentMethod,
      reference: reference !== undefined ? reference : oldReceipt.reference,
      notes: notes !== undefined ? notes : oldReceipt.notes,
      originalSalesOrderId: updatedOriginalSalesOrderId,
      originalInvoiceId: updatedOriginalInvoiceId,
      relatedOrders: updatedRelatedOrders,
    };

    if (customerId && customerId !== oldCustomerId.toString()) {
      updateData.customer = {
        customerId: finalCustomer._id,
        name: finalCustomer.name,
      };
    }

    const updatedReceipt = await Receipt.findByIdAndUpdate(id, updateData, { new: true, session });

    // 5️⃣ AUDIT LOG
    await createAuditLog({
      userId: userId || "System",
      username: username || "System",
      branchId: oldReceipt.branchId,
      action: "EDIT_RECEIPT",
      description: `Edited receipt ${oldReceipt.receiptId}. New Amount: ₹${newAmount}. ${customerId ? 'Customer Swapped.' : ''}`,
      targetId: id,
      targetModel: "Receipt",
    });

    await session.commitTransaction();
    res.json({ success: true, message: "Receipt updated successfully", data: updatedReceipt });
  } catch (error) {
    await session.abortTransaction();
    console.error("Edit Receipt error:", error);
    res.status(500).json({ success: false, message: "Failed to update receipt" });
  } finally {
    session.endSession();
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

// 📦 BULK CREATE receipts (for multiple invoices)
router.post("/bulk", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      customerId,
      payments, // Array of { salesOrderId, amount }
      paymentMethod,
      reference,
      notes,
      paymentDate,
      branchId,
      totalCreditAmount // 🔥 New field
    } = req.body;

    if (!customerId || !payments || !Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid bulk payment data" });
    }

    const customer = await Customer.findById(customerId).session(session);
    if (!customer) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const financialYear = getFinancialYear();
    const createdReceipts = [];
    let totalCashAmount = 0;
    const cashRelatedOrders = [];
    const creditReceipts = [];

    // 1. Process all payments to build the data
    for (const p of payments) {
      const order = await SalesOrder.findById(p.salesOrderId).session(session);
      if (!order) continue;

      const totalApplied = (p.amount || 0) + (p.creditAmount || 0);
      if (p.amount > 0) {
        const actualInvoiceId = order.salesInvoiceId || order.invoiceId;
        totalCashAmount += p.amount;
        cashRelatedOrders.push({
          salesOrderId: order._id,
          invoiceId: actualInvoiceId,
          amount: p.amount
        });
      }

      if (p.creditAmount > 0) {
        const actualInvoiceId = order.salesInvoiceId || order.invoiceId;
        // Credit receipts remain separate for accounting (CRD prefix)
        const creditReceiptId = await generateBranchSpecificReceiptId(branchId || order.branchId, financialYear, "CRD");
        const creditReceipt = new Receipt({
          receiptId: creditReceiptId,
          branchId: branchId || order.branchId,
          originalSalesOrderId: order._id,
          originalInvoiceId: actualInvoiceId,
          customer: { customerId: customer._id, name: customer.name },
          amount: p.creditAmount,
          paymentMethod: "CREDIT",
          reference: "Credit Applied",
          notes: `Utilized existing customer credit against ${actualInvoiceId}`,
          financialYear,
          status: "confirmed",
          paymentDate: paymentDate || new Date(),
          generatedBy: req.user?.id || null
        });
        await creditReceipt.save({ session });
        creditReceipts.push(creditReceipt);
      }

      // Update Order Balance
      const newOrderClosingBalance = Math.max(0, (order.closingBalance || 0) - totalApplied);
      await SalesOrder.findByIdAndUpdate(order._id, { closingBalance: newOrderClosingBalance }).session(session);
    }

    // 2. Create the SINGLE Master Cash/Bank Receipt
    if (totalCashAmount > 0) {
      const receiptId = await generateBranchSpecificReceiptId(branchId, financialYear);
      const masterReceipt = new Receipt({
        receiptId,
        branchId,
        customer: { customerId: customer._id, name: customer.name },
        amount: totalCashAmount,
        paymentMethod: paymentMethod || "CASH",
        reference: reference || null,
        notes: notes || "Consolidated payment for multiple invoices",
        relatedOrders: cashRelatedOrders,
        // For backwards compatibility, set the first order as the main one
        originalSalesOrderId: cashRelatedOrders[0]?.salesOrderId,
        originalInvoiceId: cashRelatedOrders[0]?.invoiceId,
        financialYear,
        status: "confirmed",
        paymentDate: paymentDate || new Date(),
        generatedBy: req.user?.id || null
      });
      await masterReceipt.save({ session });
      createdReceipts.push(masterReceipt);
    }

    // Add credit receipts to the results
    createdReceipts.push(...creditReceipts);

    // Update Customer Totals
    let remainingAmount = totalCashAmount; // This is NEW cash/bank money
    let currentDebit = customer.debit || 0;
    let currentCredit = customer.credit || 0;

    // Apply NEW money first
    if (currentDebit >= remainingAmount) {
      currentDebit -= remainingAmount;
      remainingAmount = 0;
    } else {
      remainingAmount -= currentDebit;
      currentDebit = 0;
      currentCredit += remainingAmount;
    }

    // 🔥 Apply EXPLICIT Credit Utilization
    // If the frontend sent an explicit totalCreditAmount, subtract it from BOTH debit and credit.
    if (totalCreditAmount > 0) {
      const actualCreditToUse = Math.min(currentCredit, totalCreditAmount);
      currentDebit = Math.max(0, currentDebit - actualCreditToUse);
      currentCredit -= actualCreditToUse;
    }

    const newClosingBalance = (customer.closingBalance || 0) - totalCashAmount;
    await Customer.findByIdAndUpdate(customerId, {
      debit: currentDebit,
      credit: currentCredit,
      closingBalance: newClosingBalance,
      totalBalance: newClosingBalance,
    }).session(session);

    await createAuditLog({
      userId: req.user?.id || "SYSTEM",
      userModel: "BranchUser",
      username: req.user?.username || "System",
      branchId: branchId || customer.branchId,
      action: "BULK_RECEIPT",
      description: `Recorded bulk receipt for ${customer.name}. Total: ₹${totalCashAmount}. Invoices: ${cashRelatedOrders.map(ro => ro.invoiceId).join(", ")}`,
      targetId: customer._id,
      targetModel: "Customer"
    });

    await session.commitTransaction();
    res.json({ success: true, message: `${createdReceipts.length} receipts recorded successfully`, data: createdReceipts });
  } catch (error) {
    await session.abortTransaction();
    console.error("Bulk Receipt Error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
});

/**
 * POST: Cancel a Receipt
 */
router.post("/:id/cancel", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    const receipt = await Receipt.findById(id).session(session);

    if (!receipt) {
      return res.status(404).json({ success: false, message: "Receipt not found" });
    }

    if (receipt.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Receipt already cancelled" });
    }

    const customer = await Customer.findById(receipt.customer.customerId).session(session);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // 1. REVERSE CUSTOMER BALANCE
    const amount = receipt.amount || 0;
    let currentDebit = customer.debit || 0;
    let currentCredit = customer.credit || 0;

    if (receipt.paymentMethod === "CREDIT") {
      // It was credit utilization: Reversed logic
      currentDebit += amount;
      currentCredit += amount;
    } else {
      // Regular payment reversal: Reduce credit first, then increase debit
      let remainingToReverse = amount;
      const creditToRemove = Math.min(currentCredit, remainingToReverse);
      currentCredit -= creditToRemove;
      remainingToReverse -= creditToRemove;
      currentDebit += remainingToReverse;
    }

    const newClosingBalance = (customer.closingBalance || 0) + (receipt.paymentMethod === "CREDIT" ? 0 : amount);

    await Customer.findByIdAndUpdate(customer._id, {
      debit: currentDebit,
      credit: currentCredit,
      closingBalance: newClosingBalance,
      totalBalance: newClosingBalance,
    }).session(session);

    // 2. REVERSE SALES ORDER BALANCE (if linked)
    if (receipt.relatedOrders && receipt.relatedOrders.length > 0) {
      for (const ro of receipt.relatedOrders) {
        await SalesOrder.findByIdAndUpdate(ro.salesOrderId, {
          $inc: { closingBalance: ro.amount }
        }).session(session);
      }
    } else if (receipt.originalSalesOrderId) {
      const order = await SalesOrder.findById(receipt.originalSalesOrderId).session(session);
      if (order) {
        const newOrderBalance = (order.closingBalance || 0) + amount;
        await SalesOrder.findByIdAndUpdate(order._id, { closingBalance: newOrderBalance }).session(session);
      }
    }

    // 3. UPDATE RECEIPT STATUS
    receipt.status = "cancelled";
    receipt.cancelledBy = req.user?.id || null;
    receipt.cancelReason = reason || "No reason provided";
    await receipt.save({ session });

    // 4. AUDIT LOG
    await createAuditLog({
      userId: req.user?.id || "SYSTEM",
      userModel: "BranchUser",
      username: req.user?.username || "System",
      branchId: receipt.branchId,
      action: "RECEIPT_CANCEL",
      description: `Cancelled receipt ${receipt.receiptId} for ₹${amount}. Customer: ${customer.name}.`,
      targetId: receipt._id,
      targetModel: "Receipt"
    });

    await session.commitTransaction();
    res.json({ success: true, message: "Receipt cancelled successfully" });
  } catch (error) {
    await session.abortTransaction();
    console.error("Cancel Receipt Error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
});

export default router;
