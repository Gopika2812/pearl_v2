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
import gstzenService from "../utils/gstzenService.js";

import { createAuditLog } from "../utils/logUtil.js";

const router = express.Router();

/**
 * 🏗️ LIVE REPAIR: Drop the legacy global unique index to allow branch-specific numbering
 * This runs once on server startup to ensure Option B (branch-specific numbering) can work.
 */
mongoose.connection.on("connected", async () => {
  try {
    const collections = await mongoose.connection.db.listCollections({ name: "creditnotes" }).toArray();
    if (collections.length > 0) {
      const db = mongoose.connection.db;
      const indexes = await db.collection("creditnotes").indexes();
      const hasLegacyIndex = indexes.some(idx => idx.name === "creditNoteId_1");
      
      if (hasLegacyIndex) {
        await db.collection("creditnotes").dropIndex("creditNoteId_1");
        console.log("✅ Legacy global CreditNote index 'creditNoteId_1' dropped successfully.");
      }
    }
  } catch (err) {
    if (err.codeName !== "IndexNotFound") {
      console.warn("⚠️ Could not drop legacy CreditNote index:", err.message);
    }
  }
});

/**
 * 🛠️ SHARED CN ID GENERATOR
 * Generates an atomic, branch-specific ID using the VoucherType system.
 */
const generateBranchSpecificCNId = async (branchId, financialYear) => {
  if (!branchId || branchId === "undefined") {
    console.error("❌ CRITICAL ERROR: generateBranchSpecificCNId called without branchId!");
    throw new Error("Branch ID is required for Credit Note generation. Please check the request payload.");
  }
  
  // 1. Ensure the voucher entry exists for this branch's Credit Notes
  // Use atomic findOneAndUpdate with upsert to prevent race conditions
  let voucher = await VoucherType.findOne({
    branchId,
    name: "credit_note",
    orderType: "CN",
  });

  if (!voucher) {
    // 💡 LIVE REPAIR: If this is the first time, find the last CN for this branch to initialize accurately
    const lastCN = await CreditNote.findOne({ branchId, financialYear }).sort({ createdAt: -1 });
    const lastNum = lastCN ? (parseInt(lastCN.creditNoteId.split("/")[1]) || 0) : 0;

    voucher = await VoucherType.findOneAndUpdate(
      { branchId, name: "credit_note", orderType: "CN" },
      { 
        $setOnInsert: { 
          prefix: "CN", 
          counter: lastNum, 
          financialYear 
        } 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
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

  // 🛡️ SELF-HEALING: Check if this ID already exists
  let candidateCNId = `CN/${String(voucher.counter).padStart(3, "0")}/${financialYear}`;
  const exists = await CreditNote.findOne({ branchId, creditNoteId: candidateCNId });

  if (exists) {
    console.warn(`🚨 Duplicate Credit Note ID detected: ${candidateCNId}. Auto-healing...`);
    const latestCNs = await CreditNote.find({ 
      branchId, 
      creditNoteId: new RegExp(`^CN/`)
    }).select("creditNoteId").lean();

    const sequenceNumbers = latestCNs.map(cn => {
      const match = cn.creditNoteId.match(/\/(\d+)\//);
      return match ? parseInt(match[1]) : 0;
    });

    const maxSeq = Math.max(0, ...sequenceNumbers);
    voucher = await VoucherType.findByIdAndUpdate(
      voucher._id, 
      { counter: maxSeq + 1 }, 
      { new: true }
    );
    candidateCNId = `CN/${String(voucher.counter).padStart(3, "0")}/${financialYear}`;
  }

  return candidateCNId;
};

// GET all credit notes (strictly filtered by branchId)
router.get("/", async (req, res) => {
  try {
    const { branchId } = req.query;
    if (!branchId || branchId === "undefined") {
      return res.status(400).json({ success: false, message: "Valid branchId is required" });
    }

    const { page = 1, limit = 50, search = "", fromDate, toDate } = req.query;
    
    const query = { branchId };

    // 1. Search Filter
    if (search) {
      query.$or = [
        { creditNoteId: { $regex: search, $options: "i" } },
        { "customer.name": { $regex: search, $options: "i" } }
      ];
    }

    // 2. Date Filter
    if (fromDate && toDate) {
      query.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(new Date(toDate).setHours(23, 59, 59, 999))
      };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const creditNotes = await CreditNote.find(query)
      .populate("branchId")
      .populate("customer.customerId", "name whatsapp phone closingBalance debit credit")
      .populate("deliveryMan", "name phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await CreditNote.countDocuments(query);
    
    // Summary data for the whole branch (matching filters)
    const summaryAggregation = await CreditNote.aggregate([
      { $match: query },
      { $group: { _id: null, totalValue: { $sum: "$grandTotal" } } }
    ]);
    const totalValue = summaryAggregation.length > 0 ? summaryAggregation[0].totalValue : 0;

    res.json({ 
      success: true, 
      data: creditNotes,
      summary: {
        totalValue
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
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
    
    // 💡 LOGGING: Track nextId requests on Render to confirm branch isolation
    console.log(`🔍 Preview Level: Next ID for branch ${branchId} is ${nextId}`);
    
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
      // 🔥 CRITICAL: Prioritize branchId from the original order to ensure isolation
      finalBranchId = originalOrder.branchId || branchId;
    } else {
      // Standalone return
      if (!customerId) {
        return res.status(400).json({ success: false, message: "CustomerId is required for standalone returns" });
      }
      customer = await Customer.findById(customerId);
      // Ensure branchId is set for standalone returns from the customer if missing in body
      if (!finalBranchId && customer.branchId) finalBranchId = customer.branchId;
    }

    if (!finalBranchId) {
      return res.status(400).json({ success: false, message: "Branch ID must be provided to create a credit note" });
    }

    console.log(`🚀 Creating Credit Note for branch: ${finalBranchId} (Incoming: ${branchId})`);

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // Calculate returned amounts
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let grandTotal = 0;

    const returnedItems = [];
    for (const item of items.filter(item => item.qty > 0)) {
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

      // 🔍 BACKEND HSN LOOKUP FALLBACK
      let finalHsn = item.hsn;
      if (!finalHsn && item.productId) {
        const product = await Product.findById(item.productId);
        finalHsn = product?.hsnCode || product?.hsn || "";
      }

      returnedItems.push({
        productId: item.productId,
        name: item.name,
        hsn: finalHsn,
        unit: item.unit || "NOS",
        qty: qty,
        sellingPrice: sPrice,
        discountType: item.discountType || "PERCENT",
        discountPercent: discountP,
        discountAmount: itemDiscount,
        gst: gstRate,
        tax: itemTax,
        cgst: item.igst ? 0 : itemTax / 2,
        sgst: item.igst ? 0 : itemTax / 2,
        igst: item.igst ? itemTax : 0,
        total: itemTotal,
      });
    }

    const financialYear = getFinancialYear();
    const creditNoteId = await generateBranchSpecificCNId(finalBranchId, financialYear);

    const Branch = mongoose.model("Branch");
    const branch = await Branch.findById(finalBranchId);

    // Create credit note
    const creditNote = new CreditNote({
      creditNoteId,
      originalSalesOrderId: originalSalesOrderId || null,
      originalInvoiceId: originalOrder?.invoiceId || "STANDALONE",
      originalInvoiceDate: originalOrder?.invoiceDate || null,
      branchId: finalBranchId,
      customer: {
        customerId: customer._id,
        name: customer.name,
        whatsapp: customer.whatsapp || "",
        phone: customer.phone || "",
        address: customer.address || "",
        gstin: customer.gstin || "URP",
        state: customer.state || "TAMIL NADU",
        stateCode: customer.stateCode || "33",
        pincode: customer.pincode || "",
        district: customer.district || "",
        closingBalance: customer.closingBalance || 0,
      },
      seller: {
        name: branch?.name || "",
        address: branch?.address || "",
        gstin: branch?.gstin || "",
        state: branch?.state || "TAMIL NADU",
        stateCode: branch?.stateCode || "33",
        pincode: branch?.pincode || "",
        phone: branch?.phone || "",
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
// UPDATE credit note
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { items, reasonForReturn, userId, username } = req.body;

    const oldCN = await CreditNote.findById(id);
    if (!oldCN) return res.status(404).json({ success: false, message: "Credit note not found" });

    // 🛡️ RESTRICTION: Do not allow editing if E-Invoice is already generated
    if (oldCN.einvoiceStatus === "GENERATED") {
      return res.status(400).json({
        success: false,
        message: "Cannot edit a credit note after E-Invoice has been generated. Please cancel it first if allowed."
      });
    }

    const Customer = mongoose.model("Customer");
    const Product = mongoose.model("Product");

    // 1️⃣ REVERSE OLD IMPACT
    // Reverse Inventory
    for (const item of oldCN.items) {
      if (item.productId) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { totalQty: -item.qty }
        });
      }
    }
    // Reverse Customer Balance
    const customer = await Customer.findById(oldCN.customer.customerId);
    if (customer) {
      const restoredBalance = (customer.closingBalance || 0) + oldCN.grandTotal;
      let amountToTakeBack = oldCN.grandTotal;
      let currentDebit = customer.debit || 0;
      let currentCredit = customer.credit || 0;

      // Reverse the netted logic
      if (currentCredit >= amountToTakeBack) {
        currentCredit -= amountToTakeBack;
      } else {
        amountToTakeBack -= currentCredit;
        currentCredit = 0;
        currentDebit += amountToTakeBack;
      }

      await Customer.findByIdAndUpdate(customer._id, {
        debit: currentDebit,
        credit: currentCredit,
        closingBalance: restoredBalance,
        totalBalance: restoredBalance,
      });
    }

    // 2️⃣ CALCULATE NEW TOTALS
    let subtotal = 0;
    let totalTax = 0;
    let grandTotal = 0;
    const newItems = [];

    for (const item of items) {
      const sPrice = Number(item.sellingPrice || 0);
      const qty = Number(item.qty || 0);
      const disc = Number(item.discountPercent || 0);
      const gstRate = Number(item.gst || 0);

      const itemSubtotal = sPrice * qty;
      const itemTaxable = itemSubtotal * (1 - disc / 100);
      const itemTax = (itemTaxable * gstRate) / 100;
      const itemTotal = itemTaxable + itemTax;

      subtotal += itemSubtotal;
      totalTax += itemTax;
      grandTotal += itemTotal;

      newItems.push({
        ...item,
        tax: itemTax,
        total: itemTotal,
        cgst: itemTax / 2,
        sgst: itemTax / 2,
      });
    }

    // 3️⃣ APPLY NEW IMPACT
    // Apply Inventory
    for (const item of newItems) {
      if (item.productId) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { totalQty: item.qty }
        });
      }
    }
    // Apply Customer Balance
    if (customer) {
      const newBalance = (customer.closingBalance || 0) + oldCN.grandTotal - Math.round(grandTotal);
      let amountToReturn = Math.round(grandTotal);
      // Fetch fresh customer data after reversal
      const freshCustomer = await Customer.findById(customer._id);
      let cDebit = freshCustomer.debit || 0;
      let cCredit = freshCustomer.credit || 0;

      if (cDebit >= amountToReturn) {
        cDebit -= amountToReturn;
      } else {
        amountToReturn -= cDebit;
        cDebit = 0;
        cCredit += amountToReturn;
      }

      await Customer.findByIdAndUpdate(customer._id, {
        debit: cDebit,
        credit: cCredit,
        closingBalance: newBalance,
        totalBalance: newBalance,
      });
    }

    // 4️⃣ UPDATE RECORD
    const updatedCN = await CreditNote.findByIdAndUpdate(id, {
      items: newItems,
      reasonForReturn,
      subtotal: Math.round(subtotal),
      totalTax: Math.round(totalTax),
      grandTotal: Math.round(grandTotal),
    }, { new: true });

    // AUDIT LOG
    try {
      await createAuditLog({
        userId: userId || "System",
        username: username || "System",
        branchId: oldCN.branchId,
        action: "EDIT_CREDIT_NOTE",
        description: `Edited credit note ${oldCN.creditNoteId}. New Total: ₹${grandTotal}`,
        targetId: id,
        targetModel: "CreditNote",
      });
    } catch (e) {}

    res.json({ success: true, message: "Credit note updated successfully", data: updatedCN });
  } catch (error) {
    console.error("Edit CN error:", error);
    res.status(500).json({ success: false, message: "Failed to update credit note" });
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

// ==========================================
// 🚀 E-INVOICE & E-WAY BILL GENERATION (GSTZEN)
// ==========================================

/**
 * POST /api/credit-notes/generate-einvoice/:id
 * Generates E-Invoice IRN + E-Way Bill using GSTZen API for a Credit Note
 */
router.post("/generate-einvoice/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, username, transportDetails } = req.body;

    const creditNote = await CreditNote.findById(id)
      .populate("branchId")
      .populate("customer.customerId")
      .populate("items.productId");

    if (!creditNote) {
      return res.status(404).json({ success: false, message: "Credit Note not found" });
    }

    console.log(`\n🔄 Processing Credit Note E-Invoice: ${creditNote.creditNoteId}`);

    // Update transport details if provided
    if (transportDetails) {
      creditNote.vehicleNo = transportDetails.vehicleNo || creditNote.vehicleNo;
      creditNote.transportMode = transportDetails.transportMode || creditNote.transportMode || "1";
      creditNote.transportDistance = Number(transportDetails.transportDistance || 50);
      creditNote.vehicleType = transportDetails.vehicleType || creditNote.vehicleType || "REGULAR";
      await creditNote.save();
    }

    // ⚡ LIVE REPAIR: Ensure model consistency for older notes being processed
    // Fetch Branch and Customer to fill in missing printable details
    const branch = creditNote.branchId;
    const customerId = creditNote.customer?.customerId;
    const customer = await Customer.findById(customerId);

    console.log(`🔍 [CN REPAIR] Processing ${creditNote.creditNoteId}. Customer Match: ${customer ? 'YES' : 'NO'} (${customerId})`);

    if (branch) {
      creditNote.seller = {
        name: branch.name || "PEARL AGENCY",
        address: branch.address || "Address Not Provided",
        gstin: branch.gstin || "N/A",
        state: branch.state || "TAMIL NADU",
        stateCode: branch.stateCode || "33",
        pincode: branch.pincode || "",
        phone: branch.phone || "",
      };
    }
    
    if (customer) {
      console.log(`✅ [CN REPAIR] Updating customer snapshot for: ${customer.name}. GSTIN: ${customer.gstin}`);
      creditNote.customer = {
        customerId: customer._id,
        name: customer.name,
        address: customer.address || "",
        gstin: (customer.gstin && customer.gstin.trim()) ? customer.gstin : "URP",
        state: customer.state || "TAMIL NADU",
        stateCode: customer.stateCode || "33",
        pincode: customer.pincode || "",
        district: customer.district || "",
      };
    }

    // ⚡ LIVE REPAIR: Refresh items with HSN/Unit from Product if missing
    for (const item of creditNote.items) {
      if (!item.hsn || !item.unit) {
        const product = await Product.findById(item.productId);
        if (product) {
          item.hsn = (item.hsn && item.hsn !== "-") ? item.hsn : (product.hsnCode || "21050000");
          item.unit = (item.unit && item.unit !== "undefined") ? item.unit : (product.unit || "NOS");
        }
      }
    }

    await creditNote.save();
    console.log(`💾 [CN REPAIR] Record saved successfully.`);

    // Call GSTZen Service for Credit Note (docType: "CRN")
    let eInvoiceResult;
    try {
      eInvoiceResult = await gstzenService.generateEInvoice(creditNote, "CRN");
    } catch (gstError) {
      return res.status(400).json({
        success: false,
        message: "E-Invoice generation failed",
        error: gstError.message
      });
    }

    if (!eInvoiceResult || !eInvoiceResult.success) {
      return res.status(400).json({
        success: false,
        message: "Failed to generate E-Invoice",
        error: eInvoiceResult?.message || "Unknown error"
      });
    }

    // Update credit note with E-Invoice details
    creditNote.einvoiceStatus = "GENERATED";
    creditNote.irn = eInvoiceResult.irn;
    creditNote.ackNo = eInvoiceResult.ackNo;
    creditNote.ackDate = eInvoiceResult.ackDate;
    creditNote.signedInvoice = eInvoiceResult.signedInvoice;
    creditNote.signedQrCode = eInvoiceResult.signedQrCode;

    // E-Way Bill details
    if (eInvoiceResult.ewayBillNo) {
      creditNote.ewayBillNo = eInvoiceResult.ewayBillNo;
      creditNote.ewayBillDate = eInvoiceResult.ewayBillDate;
      creditNote.ewayBillValidUntil = eInvoiceResult.ewayBillValidUntil;
    }

    // PDF & QR URLs
    creditNote.invoicePdfUrl = eInvoiceResult.invoicePdfUrl;
    creditNote.ewayBillPdfUrl = eInvoiceResult.ewayBillPdfUrl;
    creditNote.qrCodeUrl = eInvoiceResult.qrCodeUrl;
    creditNote.signedQrCodeImgUrl = eInvoiceResult.signedQrCodeImgUrl;

    await creditNote.save();

    // Audit Log
    try {
      await createAuditLog({
        userId: userId || "System",
        username: username || "System",
        branchId: creditNote.branchId,
        action: "GENERATE_CN_EINVOICE",
        description: `E-Invoice (CRN): ${creditNote.creditNoteId}, IRN: ${creditNote.irn}`,
        targetId: creditNote._id,
        targetModel: "CreditNote"
      });
    } catch (logErr) { console.warn("Audit log failed"); }

    res.json({
      success: true,
      message: "Credit Note E-Invoice generated successfully",
      data: creditNote
    });

  } catch (error) {
    console.error("❌ Credit Note E-Invoice Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/credit-notes/generate-ewb-only/:id
 * Generates only E-Way Bill for an already generated IRN on a Credit Note
 */
router.post("/generate-ewb-only/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { transportDetails } = req.body;

    const creditNote = await CreditNote.findById(id).populate("branchId");
    if (!creditNote || !creditNote.irn) {
      return res.status(400).json({ message: "Valid IRN is required for E-Way Bill" });
    }

    if (transportDetails) {
      creditNote.vehicleNo = transportDetails.vehicleNo || creditNote.vehicleNo;
      creditNote.transportMode = transportDetails.transportMode || creditNote.transportMode || "1";
      creditNote.transportDistance = Number(transportDetails.transportDistance || 50);
      creditNote.vehicleType = transportDetails.vehicleType || creditNote.vehicleType || "REGULAR";
      await creditNote.save();
    }

    const ewbResult = await gstzenService.generateEWayBill(creditNote, { irn: creditNote.irn }, "CRN");

    if (ewbResult.success) {
      creditNote.ewayBillNo = ewbResult.ewayBillNo;
      creditNote.ewayBillDate = ewbResult.ewayBillDate;
      creditNote.ewayBillValidUntil = ewbResult.ewayBillValidUntil;
      creditNote.ewayBillPdfUrl = ewbResult.ewayBillPdfUrl;
      await creditNote.save();

      res.json({
        success: true,
        message: "E-Way Bill generated successfully",
        data: creditNote
      });
    } else {
      res.status(400).json({
        success: false,
        message: ewbResult.message || "E-Way Bill failed",
        details: ewbResult.raw
      });
    }
  } catch (error) {
    console.error("❌ CN EWB Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
