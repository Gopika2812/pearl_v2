import express from "express";
import Ledger from "../models/Ledger.js";
import LedgerGroup from "../models/LedgerGroup.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import Vendor from "../models/Vendor.js";
import Customer from "../models/Customer.js";
import VoucherType from "../models/VoucherType.js";
import { getFinancialYear as getGlobalFinancialYear } from "../utils/financialYear.js";
import { updateProductCostsFromInvoice } from "../utils/priceUtil.js";


import auth from "../middleware/auth.js";
import { createAuditLog } from "../utils/logUtil.js";

const router = express.Router();

// Financial Year Helper
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

// GET NEXT INVOICE ID (without saving)
router.get("/next-invoice/:voucherType", async (req, res) => {
  try {
    const { voucherType } = req.params;
    const { branchId } = req.query;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    let voucher = await VoucherType.findOne({
      branchId,
      name: voucherType.toLowerCase(),
      orderType: "PO",
    });

    if (!voucher) {
      // 1. Fallback: Try to find any PO voucher type in this branch
      voucher = await VoucherType.findOne({ branchId, orderType: "PO" });
    }

    if (!voucher) {
      // 2. Fallback: Automatically create a default PO voucher type for this branch
      const currentFY = getFinancialYear();
      const prefix = "PO";
      voucher = new VoucherType({
        branchId,
        name: voucherType.toLowerCase() || "purchase order",
        orderType: "PO",
        prefix,
        counter: 1,
        financialYear: currentFY,
      });
      await voucher.save();
      console.log(`[SELF-HEALING] Dynamically created default PO voucher type for branch: ${branchId}`);
    }

    const currentFY = getFinancialYear();

    let counter = voucher.counter || 1;
    if (voucher.financialYear !== currentFY) {
      counter = 1;
    }

    const nextInvoiceId = `${voucher.prefix}/${String(counter).padStart(
      3,
      "0"
    )}/${currentFY}`;

    res.json({ nextInvoiceId });
  } catch (err) {
    console.error("Next invoice error:", err);
    res.status(500).json({ message: err.message });
  }
});

// GET ALL PURCHASE ORDERS (REFINED WITH PAGINATION)
router.get("/", async (req, res) => {
  try {
    const { 
      branchId, 
      vendorId,
      search, 
      status, 
      statuses, 
      excludeStatus, 
      fromDate, 
      toDate,
      page = 1,
      limit = 50
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    // Filter by branchId if provided
    if (branchId) {
      query.branchId = branchId;
    }

    // Filter by vendorId if provided
    if (vendorId) {
      query.vendorId = vendorId;
    }

    // Filter by date range
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Filter by single status
    if (status) {
      query.status = status;
    }

    // Filter by multiple statuses
    if (statuses) {
      const statusArray = statuses.split(",").map(s => s.trim());
      query.status = { $in: statusArray };
    }

    // Exclude specific statuses
    if (excludeStatus) {
      const excludeArray = excludeStatus.split(",").map(s => s.trim());
      if (!query.status) {
        query.status = { $nin: excludeArray };
      }
    }

    // Server-side search
    if (search) {
      query.$or = [
        { invoiceId: { $regex: search, $options: "i" } },
        { purchaseInvoiceId: { $regex: search, $options: "i" } },
        { vendor: { $regex: search, $options: "i" } },
        { "items.name": { $regex: search, $options: "i" } },
      ];
    }

    const total = await PurchaseOrder.countDocuments(query);
    const orders = await PurchaseOrder.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error("❌ Get POs error:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// GET ALL ASSETS / ITEMS SUMMARY (for HSN/Stock fallback)
router.get("/items", async (req, res) => {
  try {
    const orders = await PurchaseOrder.find({ status: "PLACED" });
    const stockMap = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const key = `${order.warehouse}_${item.productId}`;
        if (!stockMap[key]) {
          stockMap[key] = {
            productId: item.productId,
            warehouse: order.warehouse,
            qty: 0,
            sellingPrice: item.sellingPrice,
            gst: item.gst,
            hsn: item.hsn,
          };
        }
        stockMap[key].qty += item.qty;
      });
    });

    res.json(Object.values(stockMap));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load stock" });
  }
});

// GET SINGLE PURCHASE ORDER
router.get("/:id", auth, async (req, res) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Purchase Order not found" });
    res.json(order);
  } catch (err) {
    console.error("Get PO by ID error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/generate-invoice', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await PurchaseOrder.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const currentFY = getGlobalFinancialYear();

    // ─── SAFETY: Always check the PI collection directly ─────────────────────────
    // This prevents creating duplicate PIs even if order.purchaseInvoiceId is missing
    const existingPI = await PurchaseInvoice.findOne({ purchaseOrderId: order._id });

    // Triple safety check: PO flag  OR  existing PI in DB  OR  PO is already INVOICED status
    const isReInvoice = !!(order.purchaseInvoiceId || existingPI || order.status === 'INVOICED');

    // Auto-sync purchaseInvoiceId on PO if it was somehow missing
    if (!order.purchaseInvoiceId && existingPI) {
      console.warn(`[SYNC] PO ${order.invoiceId} missing purchaseInvoiceId. Found PI: ${existingPI.purchaseInvoiceId}. Syncing now...`);
      order.purchaseInvoiceId = existingPI.purchaseInvoiceId;
      order.lastInvoicedItems = (order.lastInvoicedItems?.length > 0) ? order.lastInvoicedItems : existingPI.items;
      order.lastInvoicedGrandTotal = order.lastInvoicedGrandTotal || existingPI.grandTotal;
      await order.save();
    }

    // If INVOICED but no PI found (orphaned state), block with clear error
    if (order.status === 'INVOICED' && !existingPI && !order.purchaseInvoiceId) {
      console.error(`[INVOICE] ⚠️ PO ${order.invoiceId} is INVOICED but no PI found in DB. Blocking duplicate creation.`);
      return res.status(409).json({
        success: false,
        message: `This Purchase Order is already invoiced but the linked Purchase Invoice could not be found. Please contact admin to resolve the data inconsistency.`
      });
    }

    console.log(`[INVOICE] PO: ${order.invoiceId} | isReInvoice: ${isReInvoice} | existingPI: ${existingPI?.purchaseInvoiceId || 'none'} | status: ${order.status}`);

    // ─── BRANCH A: RE-INVOICE (delta recalculation) ───────────────────────
    if (isReInvoice) {
      console.log(`[DIAGNOSTIC] Re-Invoicing PO: ${order.invoiceId}`);
      console.log(`[DIAGNOSTIC] Items in DB before: ${order.items.length}, GrandTotal: ${order.grandTotal}`);

      const newItems = (req.body.items && req.body.items.length > 0) ? req.body.items : order.items;
      console.log(`[DIAGNOSTIC] Items in Request: ${newItems.length}`);
      newItems.forEach((it, idx) => console.log(`  Item ${idx}: ${it.name}, Qty: ${it.qty}, Price: ${it.purchasePrice}`));

      const oldGrandTotal = Number(order.lastInvoicedGrandTotal || 0);

      // RECALCULATE NEW TOTALS
      const subtotal = newItems.reduce((acc, i) => acc + (Number(i.rowPrice) || (Number(i.purchasePrice) * Number(i.qty))), 0);
      const totalDiscount = req.body.totalDiscount !== undefined
        ? Number(req.body.totalDiscount)
        : (order.totalDiscount !== undefined && order.totalDiscount !== null
          ? order.totalDiscount
          : newItems.reduce((acc, i) => acc + (Number(i.discountAmount) || (Number(i.purchasePrice) * Number(i.qty) * (Number(i.discountPercent || 0) / 100))), 0));
      
      const discountRatio = subtotal > 0 ? (totalDiscount / subtotal) : 0;
      const sumRowDiscounts = newItems.reduce((acc, i) => acc + (Number(i.discountAmount) || (Number(i.purchasePrice) * Number(i.qty) * (Number(i.discountPercent || 0) / 100))), 0);
      const isCustomDiscount = Math.abs(totalDiscount - sumRowDiscounts) > 0.01;

      const totalTax = newItems.reduce((acc, i) => {
        const gst = Number(i.gst || 0);
        const rowPrice = Number(i.rowPrice) || (Number(i.purchasePrice) * Number(i.qty));
        const rowDiscount = Number(i.discountAmount) || (rowPrice * (Number(i.discountPercent || 0) / 100));
        const netTaxable = isCustomDiscount ? rowPrice * (1 - discountRatio) : (rowPrice - rowDiscount);
        return acc + (netTaxable * gst / 100);
      }, 0);
      
      const finalGrandTotal = Math.round(subtotal - totalDiscount + totalTax);
      const vendorDelta = finalGrandTotal - oldGrandTotal;

      // 1. UPDATE STOCK & SYNC PRICES (DELTA CALCULATION)
      const oldQtyMap = {};
      const oldBatchMap = {};
      for (const item of order.lastInvoicedItems || []) {
        if (item.productId) {
          const pid = item.productId.toString();
          oldQtyMap[pid] = item.qty;
          oldBatchMap[pid] = item.batch || "1";
        }
      }

      for (const item of newItems) {
        const product = await Product.findById(item.productId);
        if (product) {
          // A. Delta Stock Update
          const pid = item.productId.toString();
          const oldQty = oldQtyMap[pid] || 0;
          const oldBatch = oldBatchMap[pid] || "1";
          const newQty = item.qty;
          const newBatch = item.batch || "1";

          if (oldBatch === newBatch) {
            const deltaQty = newQty - oldQty;
            product.updateBatchStock(newBatch, deltaQty, item.expiryDate, item.mrp, item.manufacturingDate);
          } else {
            product.updateBatchStock(oldBatch, -oldQty);
            product.updateBatchStock(newBatch, newQty, item.expiryDate, item.mrp, item.manufacturingDate);
          }
          await product.save();
        }
      }

      // Sync product prices to Locked Prices using utility
      await updateProductCostsFromInvoice(newItems, order.purchaseInvoiceId || existingPI?.purchaseInvoiceId, true, req.user);

      const newPids = new Set(newItems.map(i => i.productId.toString()));
      for (const oldItem of order.lastInvoicedItems || []) {
        if (oldItem.productId && !newPids.has(oldItem.productId.toString())) {
          const product = await Product.findById(oldItem.productId);
          if (product) {
            product.updateBatchStock(oldItem.batch, -oldItem.qty);
            await product.save();
          }
        }
      }

      // 2. VENDOR BALANCE UPDATE
      if (vendorDelta !== 0 && order.vendor) {
        const vendorRecord = await Vendor.findOne({ branchId: order.branchId, name: order.vendor });
        if (vendorRecord) {
          vendorRecord.credit = (vendorRecord.credit || 0) + vendorDelta;
          await vendorRecord.save();
        }
      }

      // 3. PERSIST TO PO & PI
      order.items = newItems;
      order.subtotal = Math.round(subtotal);
      order.totalDiscount = Math.round(totalDiscount);
      order.totalTax = Math.round(totalTax);
      order.grandTotal = finalGrandTotal;
      order.status = 'INVOICED';
      order.lastInvoicedItems = newItems.map(i => i.toObject ? i.toObject() : i);
      order.lastInvoicedGrandTotal = finalGrandTotal;
      if (req.body.vendorBillNo) order.vendorBillNo = req.body.vendorBillNo;
      if (req.body.vendorDate) order.vendorDate = new Date(req.body.vendorDate);

      await order.save();

      // Update the EXISTING PI directly using its _id (most reliable — no field matching)
      const piToUpdate = existingPI;
      if (piToUpdate) {
        let vId = order.vendorId;
        if (!vId && order.vendor) {
          const vendorRecord = await Vendor.findOne({ branchId: order.branchId, name: order.vendor });
          if (vendorRecord) vId = vendorRecord._id;
        }
        await PurchaseInvoice.findByIdAndUpdate(piToUpdate._id, {
          $set: {
            items: newItems,
            subtotal: order.subtotal,
            totalDiscount: order.totalDiscount,
            totalTax: order.totalTax,
            grandTotal: order.grandTotal,
            vendorBillNo: order.vendorBillNo,
            vendorDate: order.vendorDate,
            vendorId: vId,
          }
        });
        console.log(`[INVOICE] ✅ PI Updated: ${piToUpdate.purchaseInvoiceId} (same PI, no duplicate)`);
      } else {
        console.error(`[INVOICE] ❌ Could not find PI to update for PO: ${order.invoiceId}`);
      }

      return res.json({
        success: true,
        message: `Re-Invoice complete. ${order.purchaseInvoiceId} updated.`,
        piNumber: order.purchaseInvoiceId
      });
    }

    // ─── BRANCH B: FIRST-TIME INVOICE ─────────────────────────────────────
    // ─── BRANCH B: FIRST-TIME INVOICE ─────────────────────────────────────
    let voucher = await VoucherType.findOne({ branchId: order.branchId, name: "purchase invoice", orderType: "PI" })
      || await VoucherType.findOne({ branchId: order.branchId, name: "Purchase Invoice" });

    if (!voucher) {
      voucher = await VoucherType.create({
        branchId: order.branchId,
        name: "purchase invoice",
        orderType: "PI",
        prefix: "PI",
        counter: 1,
        financialYear: currentFY,
      });
    }

    if (voucher.financialYear !== currentFY) {
      voucher.counter = 1;
      voucher.financialYear = currentFY;
    }

    const piNumber = `${voucher.prefix}/${String(voucher.counter).padStart(3, "0")}/${currentFY}`;

    const { items: bodyItems, vendorBillNo, vendorDate } = req.body;
    // Use request items if provided (from preview modal), otherwise fallback to current PO items
    const invoiceItems = (bodyItems && bodyItems.length > 0) ? bodyItems : order.items;

    // RECALCULATE ALL TOTALS FROM SCRATCH (BULLETPROOF)
    const subtotal = invoiceItems.reduce((acc, i) => acc + (Number(i.rowPrice) || (Number(i.purchasePrice) * Number(i.qty))), 0);
    const totalDiscount = req.body.totalDiscount !== undefined
      ? Number(req.body.totalDiscount)
      : (order.totalDiscount !== undefined && order.totalDiscount !== null
        ? order.totalDiscount
        : invoiceItems.reduce((acc, i) => acc + (Number(i.discountAmount) || (Number(i.purchasePrice) * Number(i.qty) * (Number(i.discountPercent || 0) / 100))), 0));
    
    const discountRatio = subtotal > 0 ? (totalDiscount / subtotal) : 0;
    const sumRowDiscounts = invoiceItems.reduce((acc, i) => acc + (Number(i.discountAmount) || (Number(i.purchasePrice) * Number(i.qty) * (Number(i.discountPercent || 0) / 100))), 0);
    const isCustomDiscount = Math.abs(totalDiscount - sumRowDiscounts) > 0.01;

    const totalTax = invoiceItems.reduce((acc, i) => {
      const gst = Number(i.gst || 0);
      const rowPrice = Number(i.rowPrice) || (Number(i.purchasePrice) * Number(i.qty));
      const rowDiscount = Number(i.discountAmount) || (rowPrice * (Number(i.discountPercent || 0) / 100));
      const netTaxable = isCustomDiscount ? rowPrice * (1 - discountRatio) : (rowPrice - rowDiscount);
      return acc + (netTaxable * gst / 100);
    }, 0);
    
    const calculatedGrandTotal = Math.round(subtotal - totalDiscount + totalTax);
    console.log(`[STABILITY CHECK] Recalculated GrandTotal: ${calculatedGrandTotal} (Sub: ${subtotal}, Tax: ${totalTax}, Disc: ${totalDiscount})`);

    let vId = order.vendorId;
    if (!vId && order.vendor) {
      const vendorRecord = await Vendor.findOne({ branchId: order.branchId, name: order.vendor });
      if (vendorRecord) vId = vendorRecord._id;
    }

    const purchaseInvoice = new PurchaseInvoice({
      purchaseInvoiceId: piNumber,
      purchaseOrderId: order._id,
      poNumber: order.invoiceId,
      branchId: order.branchId,
      warehouse: order.warehouse,
      vendor: order.vendor || "Unknown",
      vendorId: vId,
      items: invoiceItems,
      subtotal: Math.round(subtotal),
      totalDiscount: Math.round(totalDiscount),
      totalTax: Math.round(totalTax),
      extraExpenses: order.extraExpenses || [],
      extraExpenseAmount: order.extraExpenseAmount || 0,
      grandTotal: calculatedGrandTotal,
      financialYear: currentFY,
      vendorBillNo: req.body.vendorBillNo,
      vendorDate: req.body.vendorDate ? new Date(req.body.vendorDate) : undefined,
    });

    await purchaseInvoice.save();
    voucher.counter += 1;
    await voucher.save();

    // UPDATE PO TO MATCH PI EXACTLY (FORCE SYNC)
    order.items = invoiceItems;
    order.subtotal = Math.round(subtotal);
    order.totalDiscount = Math.round(totalDiscount);
    order.totalTax = Math.round(totalTax);
    order.grandTotal = calculatedGrandTotal;
    order.vendorBillNo = req.body.vendorBillNo;
    order.vendorDate = req.body.vendorDate ? new Date(req.body.vendorDate) : undefined;
    order.lastInvoicedItems = invoiceItems;
    order.lastInvoicedGrandTotal = calculatedGrandTotal;
    order.purchaseInvoiceId = piNumber;  // ✅ CRITICAL FIX: Link PO to PI so re-edits are detected
    order.status = 'INVOICED';

    // STOCK & PRICE UPDATES
    await updateProductCostsFromInvoice(invoiceItems, piNumber, false, req.user);

    for (const item of invoiceItems) {
      const product = await Product.findById(item.productId);
      if (product) {
        // B. Stock Update (Batch specific)
        product.updateBatchStock(item.batch, item.qty, item.expiryDate, item.mrp, item.manufacturingDate);
        await product.save();
      }
    }

    // VENDOR BALANCE UPDATE
    if (order.vendor) {
      const vendorRecord = await Vendor.findOne({ branchId: order.branchId, name: order.vendor });
      if (vendorRecord) {
        vendorRecord.credit = (vendorRecord.credit || 0) + calculatedGrandTotal;
        await vendorRecord.save();
      }
    }

    await order.save();

    // 📊 AUTOMATED LEDGER POSTING (Purchase)
    const purchaseAccountGroup = await LedgerGroup.findOneAndUpdate(
      { branchId: order.branchId, name: "Purchase Accounts" },
      { $setOnInsert: { nature: "Expense" } },
      { upsert: true, new: true }
    );

    // Group items by GST%
    const gstSlabs = {};
    order.items.forEach(item => {
      const gst = item.gst || 0;
      const gstFactor = 1 + (gst / 100);
      const taxableValue = Math.round(((item.purchasePrice || item.sellingPrice) * item.qty / gstFactor) * 100) / 100;
      gstSlabs[gst] = (gstSlabs[gst] || 0) + taxableValue;
    });

    for (const [gst, amount] of Object.entries(gstSlabs)) {
      const ledgerName = `Purchase ${gst}%`;
      await Ledger.findOneAndUpdate(
        { branchId: order.branchId, name: ledgerName, groupId: purchaseAccountGroup._id },
        { $inc: { currentBalance: -amount } }, // Purchase is an expense (decreases Assets/Balance if using simple balance)
        { upsert: true }
      );
    }


    // Audit Log for First Invoice
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: req.user.branch || order.branchId,
      action: "INVOICE_PO",
      description: `Generated Purchase Invoice: ${piNumber} for PO: ${order.invoiceId}. Total: ₹${order.grandTotal}`,
      targetId: order._id,
      targetModel: "PurchaseOrder",
    });

    res.json({
      success: true,
      message: `Purchase Invoice ${piNumber} generated successfully.`,
      piNumber,
    });
  } catch (err) {
    console.error('Generate invoice error:', err);
    res.status(500).json({ message: err.message });
  }
});


router.post("/", auth, async (req, res) => {
  try {
    const { voucherType, branchId, status, ...rest } = req.body;

    if (!rest.items || rest.items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    // Round numeric fields if provided (preserve decimals if enableRoundOff is explicitly false)
    const preserveDecimals = req.body.enableRoundOff === false;
    if (rest.grandTotal !== undefined) rest.grandTotal = preserveDecimals ? Math.round(Number(rest.grandTotal) * 100) / 100 : Math.round(Number(rest.grandTotal));
    if (rest.subtotal !== undefined) rest.subtotal = preserveDecimals ? Math.round(Number(rest.subtotal) * 100) / 100 : Math.round(Number(rest.subtotal));
    if (rest.totalTax !== undefined) rest.totalTax = Math.round(Number(rest.totalTax) * 100) / 100;
    if (rest.totalDiscount !== undefined) rest.totalDiscount = Math.round(Number(rest.totalDiscount) * 100) / 100;
    if (rest.transportCharge !== undefined) rest.transportCharge = Math.round(Number(rest.transportCharge) * 100) / 100;

    const finalizePI = async (orderDoc, invId, fy) => {
      const purchaseInvoice = new PurchaseInvoice({
        purchaseInvoiceId: invId,
        purchaseOrderId: orderDoc._id,
        poNumber: invId,
        branchId: orderDoc.branchId,
        warehouse: orderDoc.warehouse,
        vendor: orderDoc.vendor || "Unknown",
        vendorId: orderDoc.vendorId,
        items: orderDoc.items,
        subtotal: orderDoc.subtotal,
        totalDiscount: orderDoc.totalDiscount,
        totalTax: orderDoc.totalTax,
        extraExpenses: orderDoc.extraExpenses,
        extraExpenseAmount: orderDoc.extraExpenseAmount,
        grandTotal: orderDoc.grandTotal,
        financialYear: fy,
      });

      await purchaseInvoice.save();

      orderDoc.lastInvoicedItems = orderDoc.items;
      orderDoc.lastInvoicedGrandTotal = orderDoc.grandTotal;
      orderDoc.purchaseInvoiceId = invId;
      orderDoc.status = 'INVOICED';
      await orderDoc.save();

      for (const item of orderDoc.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.updateBatchStock(item.batch, item.qty, item.expiryDate, item.mrp, item.manufacturingDate);
          await product.save();
        }
      }

      if (orderDoc.vendor) {
        const vendorRecord = await Vendor.findOne({ branchId: orderDoc.branchId, name: orderDoc.vendor });
        if (vendorRecord) {
          vendorRecord.credit = (vendorRecord.credit || 0) + orderDoc.grandTotal;
          await vendorRecord.save();
        }
      }

      const purchaseAccountGroup = await LedgerGroup.findOneAndUpdate(
        { branchId: orderDoc.branchId, name: "Purchase Accounts" },
        { $setOnInsert: { nature: "Expense" } },
        { upsert: true, new: true }
      );

      const gstSlabs = {};
      orderDoc.items.forEach(item => {
        const gst = item.gst || 0;
        const gstFactor = 1 + (gst / 100);
        const taxableValue = Math.round(((item.purchasePrice || item.sellingPrice) * item.qty / gstFactor) * 100) / 100;
        gstSlabs[gst] = (gstSlabs[gst] || 0) + taxableValue;
      });

      for (const [gst, amount] of Object.entries(gstSlabs)) {
        const ledgerName = `Purchase ${gst}%`;
        await Ledger.findOneAndUpdate(
          { branchId: orderDoc.branchId, name: ledgerName, groupId: purchaseAccountGroup._id },
          { $inc: { currentBalance: -amount } },
          { upsert: true }
        );
      }
    };

    // Handle Customer-PO Flow / Auto Vendor Creation
    let resolvedVendorId = undefined;
    let resolvedCustomerId = req.body.customerId || undefined;

    if (resolvedCustomerId) {
      const customer = await Customer.findById(resolvedCustomerId);
      if (customer) {
        let vendorId = customer.linkedVendorId;
        if (!vendorId) {
          // Check if a vendor with the same name already exists in this branch
          const escapedName = customer.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          let vendorRecord = await Vendor.findOne({
            branchId,
            name: { $regex: new RegExp(`^${escapedName}$`, "i") }
          });

          if (!vendorRecord) {
            // Create a new vendor profile
            vendorRecord = new Vendor({
              name: customer.name,
              phone: customer.whatsapp || customer.phone || "",
              email: customer.email || "",
              address: customer.address || "",
              gstin: customer.gstin || "",
              branchId,
              openingBalance: 0
            });
            await vendorRecord.save();
          }

          // Link customer to this vendor
          customer.linkedVendorId = vendorRecord._id;
          await customer.save();
          vendorId = vendorRecord._id;
        }

        // Find the linked vendor to get their exact name and set vendorId
        const vendorRecord = await Vendor.findById(vendorId);
        if (vendorRecord) {
          rest.vendor = vendorRecord.name;
          resolvedVendorId = vendorRecord._id;
        }
      }
    } else if (rest.vendor) {
      // Find vendor by name to get vendorId
      const vendorRecord = await Vendor.findOne({ branchId, name: rest.vendor });
      if (vendorRecord) {
        resolvedVendorId = vendorRecord._id;
      }
    }

    let voucher = await VoucherType.findOne({ branchId, name: voucherType.toLowerCase(), orderType: "PO" })
      || await VoucherType.findOne({ branchId, name: voucherType });

    if (!voucher) {
      voucher = await VoucherType.findOne({ branchId, orderType: "PO" });
    }

    if (!voucher) {
      const currentFY = getGlobalFinancialYear();
      voucher = await VoucherType.findOneAndUpdate(
        { branchId, name: voucherType.toLowerCase() || "purchase order", orderType: "PO" },
        { $setOnInsert: { prefix: "PO", counter: 1, financialYear: currentFY, branchId, orderType: "PO" } },
        { upsert: true, new: true }
      );
      console.log(`[SELF-HEALING] Dynamically created default PO voucher type for branch: ${branchId}`);
    }

    const currentFY = getGlobalFinancialYear();

    // If the financial year rolled over, reset counter to 1 atomically
    if (voucher.financialYear !== currentFY) {
      voucher = await VoucherType.findByIdAndUpdate(
        voucher._id,
        { $set: { counter: 2, financialYear: currentFY } },
        { new: true }
      );
      // Use counter = 1 for this very first PO of the new FY
      const invoiceId = `${voucher.prefix}/001/${currentFY}`;

      const order = new PurchaseOrder({
        ...rest,
        invoiceId,
        voucherType,
        branchId,
        financialYear: currentFY,
        vendorId: resolvedVendorId,
        customerId: resolvedCustomerId,
        status: status || "PLACED",
      });
      await order.save();

      try { await updateProductCostsFromInvoice(rest.items, invoiceId, false, req.user); }
      catch (err) { console.warn("⚠️ Price Sync Failed (Non-blocking):", err.message); }

      if (voucher.orderType === "PI") {
        await finalizePI(order, invoiceId, currentFY);
      }

      await createAuditLog({
        userId: req.user.id,
        userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
        username: req.user.username,
        branchId: req.user.branch || branchId,
        action: "CREATE_PO",
        description: `Created Purchase Order: ${invoiceId} (Vendor: ${rest.vendor}). Total: ₹${order.grandTotal}`,
        targetId: order._id,
        targetModel: "PurchaseOrder",
      });

      return res.status(201).json({ message: "Purchase Order saved successfully", order });
    }

    // ⚡ ATOMIC COUNTER: grab-and-increment in a single MongoDB operation.
    // This guarantees no two concurrent requests ever get the same counter value.
    const MAX_RETRIES = 5;
    let savedOrder = null;
    let usedInvoiceId = null;
    let updatedVoucher = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // Atomically fetch the current counter AND increment it in one round-trip
      updatedVoucher = await VoucherType.findByIdAndUpdate(
        voucher._id,
        { $inc: { counter: 1 } },
        { new: false } // returns the BEFORE value — that's our counter to use
      );

      if (!updatedVoucher) {
        return res.status(500).json({ message: "Voucher type disappeared — please refresh and try again." });
      }

      const counterToUse = updatedVoucher.counter; // value BEFORE increment
      usedInvoiceId = `${updatedVoucher.prefix}/${String(counterToUse).padStart(3, "0")}/${currentFY}`;

      const order = new PurchaseOrder({
        ...rest,
        invoiceId: usedInvoiceId,
        voucherType,
        branchId,
        financialYear: currentFY,
        vendorId: resolvedVendorId,
        customerId: resolvedCustomerId,
        status: status || "PLACED",
      });

      try {
        await order.save();
        savedOrder = order;
        break; // ✅ Saved successfully — exit retry loop
      } catch (saveErr) {
        // 11000 = MongoDB duplicate key error (unique index on {branchId, invoiceId})
        if (saveErr.code === 11000 && attempt < MAX_RETRIES) {
          console.warn(`[PO-DEDUP] Duplicate invoiceId detected: ${usedInvoiceId} (attempt ${attempt}/${MAX_RETRIES}). Retrying with next counter...`);
          continue; // Retry: atomic $inc already bumped counter, so next loop gets a fresh value
        }
        throw saveErr; // Non-duplicate error or max retries exceeded — surface it
      }
    }

    if (!savedOrder) {
      return res.status(409).json({
        success: false,
        message: "Could not generate a unique Purchase Order ID after multiple attempts. Please try again."
      });
    }

    // ⚡ PRICE SYNC (non-blocking)
    try { await updateProductCostsFromInvoice(rest.items, usedInvoiceId, false, req.user); }
    catch (err) { console.warn("⚠️ Price Sync Failed (Non-blocking):", err.message); }

    if (updatedVoucher.orderType === "PI") {
      await finalizePI(savedOrder, usedInvoiceId, currentFY);
    }

    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: req.user.branch || branchId,
      action: "CREATE_PO",
      description: `Created Purchase Order: ${usedInvoiceId} (Vendor: ${rest.vendor}). Total: ₹${savedOrder.grandTotal}`,
      targetId: savedOrder._id,
      targetModel: "PurchaseOrder",
    });

    res.status(201).json({
      message: "Purchase Order saved successfully",
      order: savedOrder,
    });
  } catch (err) {
    console.error("PO save error:", err);
    res.status(500).json({ message: err.message });
  }
});


// UPDATE PURCHASE ORDER
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { items, warehouse, subtotal, totalTax, totalDiscount, grandTotal, transportCharge, vendor } = req.body;

    const order = await PurchaseOrder.findById(id);
    if (!order) return res.status(404).json({ message: "Purchase Order not found" });

    const oldState = {
      items: order.items.map(i => i.toObject()),
      grandTotal: order.grandTotal,
      warehouse: order.warehouse,
      vendor: order.vendor,
      vendorId: order.vendorId
    };

    let vendorChanged = false;
    let oldVendorName = order.vendor;
    let newVendorName = vendor;
    let oldGrandTotal = order.grandTotal || 0;

    if (newVendorName && newVendorName !== oldVendorName) {
      vendorChanged = true;
      const newVendorRecord = await Vendor.findOne({ branchId: order.branchId, name: newVendorName });
      if (newVendorRecord) {
        order.vendor = newVendorRecord.name;
        order.vendorId = newVendorRecord._id;
      } else {
        order.vendor = newVendorName;
      }
    }

    // Update warehouse & items fields
    if (items) order.items = items;
    if (warehouse) order.warehouse = warehouse;
    
    // FORCED SERVER-SIDE RECALCULATION
    let calcSubtotal = 0;
    let calcDiscount = 0;

    order.items.forEach(i => {
      const q = Number(i.qty) || 0;
      const p = Number(i.purchasePrice) || 0;
      const dPct = Number(i.discountPercent) || 0;

      const rowPrice = q * p;
      const dAmount = (rowPrice * dPct) / 100;

      calcSubtotal += rowPrice;
      calcDiscount += dAmount;

      i.rowPrice = rowPrice;
      i.discountAmount = dAmount;
    });

    order.subtotal = Math.round(calcSubtotal);
    
    let finalDiscount = calcDiscount;
    if (totalDiscount !== undefined && totalDiscount !== "") {
      finalDiscount = Number(totalDiscount);
    }
    order.totalDiscount = Math.round(finalDiscount);

    const discountRatio = calcSubtotal > 0 ? (finalDiscount / calcSubtotal) : 0;
    const hasCustomDiscount = totalDiscount !== undefined && totalDiscount !== "";

    let calcTax = 0;
    order.items.forEach(i => {
      const tPct = Number(i.gst) || 0;
      const netTaxable = hasCustomDiscount ? i.rowPrice * (1 - discountRatio) : (i.rowPrice - i.discountAmount);
      const taxAmount = (netTaxable * tPct) / 100;
      calcTax += taxAmount;

      i.taxableAmount = netTaxable;
      i.rowTax = taxAmount;
      i.total = netTaxable + taxAmount;
    });

    order.totalTax = Math.round(calcTax);
    
    if (transportCharge !== undefined) order.transportCharge = Math.round(Number(transportCharge));
    const extra = order.extraExpenseAmount || 0;
    const calculatedGrandTotal = Math.round(order.subtotal - order.totalDiscount + order.totalTax);
    order.grandTotal = calculatedGrandTotal;

    // Adjust vendor balances if PO is already invoiced
    if (order.status === "INVOICED") {
      if (vendorChanged) {
        // Revert old vendor credit balance
        if (oldVendorName) {
          const oldVendor = await Vendor.findOne({ branchId: order.branchId, name: oldVendorName });
          if (oldVendor) {
            oldVendor.credit = (oldVendor.credit || 0) - oldGrandTotal;
            await oldVendor.save();
          }
        }
        // Add credit balance to the new vendor
        if (order.vendor) {
          const newVendor = await Vendor.findOne({ branchId: order.branchId, name: order.vendor });
          if (newVendor) {
            newVendor.credit = (newVendor.credit || 0) + calculatedGrandTotal;
            await newVendor.save();
          }
        }
      } else {
        // Vendor didn't change, but grand total might have changed
        const vendorRecord = await Vendor.findOne({ branchId: order.branchId, name: order.vendor });
        if (vendorRecord) {
          const diff = calculatedGrandTotal - oldGrandTotal;
          if (diff !== 0) {
            vendorRecord.credit = (vendorRecord.credit || 0) + diff;
            await vendorRecord.save();
          }
        }
      }

      // Also update the associated PurchaseInvoice
      const pi = await PurchaseInvoice.findOne({ purchaseOrderId: order._id });
      if (pi) {
        pi.items = order.items;
        pi.subtotal = order.subtotal;
        pi.totalDiscount = order.totalDiscount;
        pi.totalTax = order.totalTax;
        pi.grandTotal = order.grandTotal;
        pi.warehouse = order.warehouse;
        pi.vendor = order.vendor;
        pi.vendorId = order.vendorId;
        await pi.save();
      }
    }

    await order.save();

    // ⚡ INSTANT PRICE SYNC: Update master product prices from PO Update
    try {
      await updateProductCostsFromInvoice(items, order.invoiceId, true, req.user);
    } catch (err) {
      console.warn("⚠️ Price Sync Failed (Non-blocking):", err.message);
    }

    // Log the update
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: req.user.branch || order.branchId,
      action: "UPDATE_PO",
      description: `Updated Purchase Order: ${order.invoiceId}`,
      targetId: id,
      targetModel: "PurchaseOrder",
      changes: {
        before: oldState,
        after: {
          items: order.items.map(i => i.toObject ? i.toObject() : i),
          grandTotal: order.grandTotal,
          warehouse: order.warehouse,
          vendor: order.vendor,
          vendorId: order.vendorId
        }
      }
    });

    // ALSO SNAPSHOT TO EDIT HISTORY
    order.editHistory.push({
      version: (order.editHistory.length || 0) + 1,
      editType: 'PRE_INVOICE_EDIT',
      items: order.items.map(i => i.toObject ? i.toObject() : i),
      subtotal: order.subtotal,
      totalTax: order.totalTax,
      grandTotal: order.grandTotal,
      editedAt: new Date(),
      note: `Manual update via Edit Modal.`
    });
    await order.save();

    res.json({
      success: true,
      message: "Purchase Order updated successfully",
      order,
    });
  } catch (err) {
    console.error("Update PO error:", err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE PURCHASE ORDER (CANCEL)
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await PurchaseOrder.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Purchase order not found" });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({ success: false, message: "Order already cancelled" });
    }

    // Revert effects if invoiced
    if (order.status === "INVOICED") {
      await revertPOEffects(order);
    }

    order.status = "CANCELLED";
    await order.save();

    // Log the cancellation
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: req.user.branch || order.branchId,
      action: "CANCEL_PO",
      description: `Cancelled Purchase Order: ${order.invoiceId}`,
      targetId: id,
      targetModel: "PurchaseOrder",
    });

    res.json({
      success: true,
      message: "Purchase Order cancelled. Stock and vendor effects reverted where applicable.",
    });
  } catch (err) {
    console.error("Delete/Cancel PO error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * REVERSION HELPER: Undoes stock and vendor credit impacts of an invoiced PO
 */
const revertPOEffects = async (order) => {
  console.log(`🔄 Reverting PO Effects: ${order.invoiceId}`);

  // 1. Decrease product qty (Batch specific)
  for (const item of order.items) {
    const product = await Product.findById(item.productId);
    if (product) {
      product.updateBatchStock(item.batch, -item.qty);
      await product.save();
    }
    console.log(`📉 Reverted stock for ${item.name}: -${item.qty} from batch ${item.batch || "1"}`);
  }

  // 2. Decrease vendor credit balance
  if (order.vendor && order.grandTotal) {
    const vendorName = typeof order.vendor === 'string' ? order.vendor : order.vendor?.name;
    const vendorId = typeof order.vendor === 'object' ? (order.vendor?._id || order.vendor?.id) : null;

    if (vendorId) {
      await Vendor.findByIdAndUpdate(vendorId, { $inc: { credit: -order.grandTotal } });
    } else if (vendorName) {
      await Vendor.findOneAndUpdate(
        { branchId: order.branchId, name: vendorName },
        { $inc: { credit: -order.grandTotal } }
      );
    }
    console.log(`📉 Reverted vendor credit: -₹${order.grandTotal}`);
  }

  // 3. Mark linked PurchaseInvoice as CANCELLED
  if (order.purchaseInvoiceId) {
    await PurchaseInvoice.findOneAndUpdate(
      { purchaseInvoiceId: order.purchaseInvoiceId, branchId: order.branchId },
      { status: "CANCELLED" }
    );
    console.log(`❌ Cancelled linked Purchase Invoice: ${order.purchaseInvoiceId}`);
  }
};

// 📨 REQUEST EDIT PERMISSION
router.patch("/:id/request-edit", async (req, res) => {
  try {
    const { id } = req.params;
    const { requestedBy } = req.body;
    const order = await PurchaseOrder.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.editRequestStatus = "PENDING";
    order.editRequestBy = requestedBy || "Unknown Staff";
    order.editRequestAt = new Date();
    await order.save();

    res.json({ success: true, message: "Edit request submitted to admin" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📨 REQUEST CANCEL PERMISSION
router.patch("/:id/request-cancel", async (req, res) => {
  try {
    const { id } = req.params;
    const { requestedBy } = req.body;
    const order = await PurchaseOrder.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.cancelRequestStatus = "PENDING";
    order.cancelRequestBy = requestedBy || "Unknown Staff";
    order.cancelRequestAt = new Date();
    await order.save();

    res.json({ success: true, message: "Cancel request submitted to admin" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📋 GET PENDING REQUESTS FOR BRANCH
router.get("/requests/branch/:branchId", async (req, res) => {
  try {
    const { branchId } = req.params;
    const requests = await PurchaseOrder.find({
      branchId,
      $or: [
        { editRequestStatus: "PENDING" },
        { cancelRequestStatus: "PENDING" }
      ]
    }).sort({ updatedAt: -1 });

    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ APPROVE EDIT REQUEST (Delta-based: stock NOT reverted, delta applied on re-invoice)
router.patch("/:id/approve-edit", async (req, res) => {
  try {
    const { id } = req.params;
    const order = await PurchaseOrder.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status === "INVOICED") {
      // DO NOT revert stock or vendor — delta will handle it on re-invoice
      // Snapshot the RE_EDIT_STARTED state into history
      order.editHistory.push({
        version: (order.editHistory.length || 0) + 1,
        editType: 'RE_EDIT_STARTED',
        items: order.items.map(i => i.toObject ? i.toObject() : i),
        subtotal: order.subtotal,
        totalTax: order.totalTax,
        grandTotal: order.grandTotal,
        editedAt: new Date(),
        note: `Admin approved re-edit. Stock and vendor untouched. Delta will apply on re-invoice.`
      });

      order.status = "PLACED"; // Back to editable
      // Keep purchaseInvoiceId so we know to RE-INVOICE (not create new PI)
      // Keep lastInvoicedItems for delta reference
    }

    order.editRequestStatus = "APPROVED";
    await order.save();

    res.json({ success: true, message: "Edit approved. You can now modify the Purchase Order. Stock will be adjusted on re-invoice." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ❌ REJECT EDIT REQUEST
router.patch("/:id/reject-edit", async (req, res) => {
  try {
    const { id } = req.params;
    const order = await PurchaseOrder.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.editRequestStatus = "REJECTED";
    await order.save();

    res.json({ success: true, message: "Edit request rejected" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ APPROVE CANCEL REQUEST (Soft-cancel: revert effects, mark CANCELLED, keep in records)
router.patch("/:id/approve-cancel", async (req, res) => {
  try {
    const { id } = req.params;
    const order = await PurchaseOrder.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status === "INVOICED") {
      console.log(`🕒 Starting cancellation reversion for PO: ${order.invoiceId}`);

      // 1. Determine items to revert (prioritize lastInvoicedItems snapshot)
      const itemsToRevert = (order.lastInvoicedItems && order.lastInvoicedItems.length > 0)
        ? order.lastInvoicedItems
        : order.items;

      const totalToRevert = order.lastInvoicedGrandTotal || order.grandTotal;

      // 2. Revert Stock (Batch specific)
      console.log(`📦 Reverting stock for ${itemsToRevert.length} items...`);
      for (const item of itemsToRevert) {
        if (item.productId && item.qty) {
          const product = await Product.findById(item.productId);
          if (product) {
            product.updateBatchStock(item.batch, -item.qty);
            await product.save();
          }
          console.log(`📉 Cancel revert stock: ${item.name || item.productId} -${item.qty} from batch ${item.batch || "1"}`);
        }
      }

      // 3. Revert Vendor Balance (Accounting for Netting AND Manual Payments)
      if (order.vendor && totalToRevert) {
        const vendorRecord = await Vendor.findOne({ branchId: order.branchId, name: order.vendor });
        if (vendorRecord) {
          // A. Handle Automatic Netting Reversion
          const nettingPayments = await Payment.find({
            "purchaseOrder.poId": order._id,
            paymentMethod: "other",
            description: /System Netting Adjustment/i,
            status: "completed"
          });

          const totalNettingReversion = nettingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
          const creditToRevert = totalToRevert - totalNettingReversion;

          console.log(`💰 Netting Reversion: ₹${totalNettingReversion} back to Debit. Remainder to revert: ₹${creditToRevert}`);

          // Restore Debit balance from netting
          if (totalNettingReversion > 0) {
            vendorRecord.debit = (vendorRecord.debit || 0) + totalNettingReversion;
            for (const pay of nettingPayments) {
              pay.status = "voided";
              pay.description += " (CANCELLED - PO effects reverted)";
              await pay.save();
            }
          }

          // B. REVERT CREDIT / MOVE TO ADVANCE (Manual Payments handle)
          if (creditToRevert > 0) {
            const currentCredit = vendorRecord.credit || 0;
            if (creditToRevert > currentCredit) {
              // Paid amount exists! Move the paid part to Vendor Debit (Advance)
              const paidRemainder = creditToRevert - currentCredit;
              vendorRecord.credit = 0;
              vendorRecord.debit = (vendorRecord.debit || 0) + paidRemainder;
              console.log(`✅ Credit zeroed, paid remainder ₹${paidRemainder} moved to Advance (Debit).`);
            } else {
              // Standard reduction (bill not yet fully paid or enough credit exists)
              vendorRecord.credit = currentCredit - creditToRevert;
              console.log(`✅ Vendor credit reduced by ₹${creditToRevert}.`);
            }
          }

          await vendorRecord.save();
          console.log(`✅ Vendor ${order.vendor} balance successfully adjusted.`);

          // C. Update manual Payment records with a note
          const manualPayments = await Payment.find({
            "purchaseOrder.poId": order._id,
            paymentMethod: { $ne: "other" }, // manual ones
            status: "completed"
          });

          for (const pay of manualPayments) {
            if (!pay.description.includes("CANCELLED")) {
              pay.description += ` (PO ${order.invoiceId} CANCELLED - This payment is now a general advance)`;
              await pay.save();
            }
          }
        }
      }

      // 4. Mark the linked PI as CANCELLED
      if (order.purchaseInvoiceId) {
        await PurchaseInvoice.findOneAndUpdate(
          { purchaseInvoiceId: order.purchaseInvoiceId, branchId: order.branchId },
          { cancelRequestStatus: "APPROVED", status: "CANCELLED" }
        );
      }
    }

    // Snapshot into editHistory
    order.editHistory.push({
      version: (order.editHistory.length || 0) + 1,
      editType: 'RE_EDIT_STARTED',
      items: order.items.map(i => i.toObject ? i.toObject() : i),
      grandTotal: order.grandTotal,
      editedAt: new Date(),
      note: `Order CANCELLED. Balance reverted and converted to Advance where applicable.`
    });

    // Soft cancel
    order.status = "CANCELLED";
    order.cancelRequestStatus = "APPROVED";
    await order.save();

    res.json({ success: true, message: "Order cancelled. Stock reverted and paid amounts moved to Vendor Advance." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ❌ REJECT CANCEL REQUEST
router.patch("/:id/reject-cancel", async (req, res) => {
  try {
    const { id } = req.params;
    const order = await PurchaseOrder.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.cancelRequestStatus = "REJECTED";
    await order.save();

    res.json({ success: true, message: "Cancel request rejected" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CANCEL PURCHASE ORDER (Soft cancel — never physically delete)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const order = await PurchaseOrder.findById(id);

    if (!order) {
      return res.status(404).json({ message: "Purchase Order not found" });
    }

    if (order.status === "INVOICED") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel an invoiced PO directly. Please use the 'Request Cancel' option."
      });
    }

    // Soft cancel — mark as CANCELLED, keep in DB
    order.status = "CANCELLED";
    order.cancelledAt = new Date();
    order.editHistory.push({
      version: (order.editHistory.length || 0) + 1,
      editType: 'RE_EDIT_STARTED',
      items: order.items.map(i => i.toObject ? i.toObject() : i),
      grandTotal: order.grandTotal,
      editedAt: new Date(),
      note: `Order cancelled (PLACED stage). No stock or vendor effects to revert.`
    });
    await order.save();

    res.json({
      success: true,
      message: "Purchase Order cancelled and kept in records.",
    });
  } catch (err) {
    console.error("Cancel PO error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

export default router;
