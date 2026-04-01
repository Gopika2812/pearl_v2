import express from "express";
import Product from "../models/Product.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import Vendor from "../models/Vendor.js";
import VoucherType from "../models/VoucherType.js";
import Payment from "../models/Payment.js";
import { getFinancialYear as getGlobalFinancialYear } from "../utils/financialYear.js";
import Ledger from "../models/Ledger.js";
import LedgerGroup from "../models/LedgerGroup.js";


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

    const voucher = await VoucherType.findOne({
      branchId,
      name: voucherType.toLowerCase(),
      orderType: "PO",
    });

    if (!voucher) return res.status(404).json({ message: "Voucher not found" });

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

// GET ALL PURCHASE ORDERS
router.get("/", async (req, res) => {
  try {
    const { branchId, search, status, statuses, excludeStatus } = req.query;
    const query = {};
    
    // Filter by branchId if provided
    if (branchId) {
      query.branchId = branchId;
    }

    // Filter by single status (e.g., ?status=INVOICED)
    if (status) {
      query.status = status;
    }

    // Filter by multiple statuses (e.g., ?statuses=INVOICED,PARTIALLY_RETURNED)
    if (statuses) {
      const statusArray = statuses.split(",").map(s => s.trim());
      query.status = { $in: statusArray };
    }

    // Exclude specific statuses (e.g., ?excludeStatus=CANCELLED)
    if (excludeStatus) {
      const excludeArray = excludeStatus.split(",").map(s => s.trim());
      if (query.status) {
        // If already filtering by status, skip excludeStatus
      } else {
        query.status = { $nin: excludeArray };
      }
    }

    // 🔍 SERVER-SIDE SEARCH: invoiceId, Vendor, and Item Name
    if (search) {
      query.$or = [
        { invoiceId: { $regex: search, $options: "i" } },
        { purchaseInvoiceId: { $regex: search, $options: "i" } },
        { vendor: { $regex: search, $options: "i" } },
        { "items.name": { $regex: search, $options: "i" } },
      ];
    }
    
    console.log("🔍 GET /api/purchase-orders - query:", JSON.stringify(query));
    const orders = await PurchaseOrder.find(query).sort({ createdAt: -1 });
    console.log(`✅ Found ${orders.length} purchase orders`);
    
    res.json(orders);
  } catch (err) {
    console.error("❌ Get POs error:", err);
    res.status(500).json({ 
      message: err.message 
    });
  }
});

router.post('/:id/generate-invoice', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await PurchaseOrder.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status === 'INVOICED') return res.status(400).json({ message: 'Order already invoiced' });

    const currentFY = getGlobalFinancialYear();
    const isReInvoice = !!(order.purchaseInvoiceId && order.lastInvoicedItems?.length > 0);

    // ─── BRANCH A: RE-INVOICE (delta recalculation) ───────────────────────
    if (isReInvoice) {
      console.log(`🔄 Re-Invoicing ${order.invoiceId} → updating ${order.purchaseInvoiceId}`);
      
      const oldState = {
        items: order.lastInvoicedItems.map(i => i.toObject()),
        grandTotal: order.lastInvoicedGrandTotal
      };

      // Build a map of OLD invoiced quantities
      const oldQtyMap = {};
      for (const item of order.lastInvoicedItems) {
        oldQtyMap[item.productId.toString()] = item.qty;
      }

      // Apply DELTA to stock
      for (const item of order.items) {
        const pid = item.productId.toString();
        const oldQty = oldQtyMap[pid] || 0;
        const deltaQty = item.qty - oldQty;
        if (deltaQty !== 0) {
          await Product.findByIdAndUpdate(item.productId, { $inc: { totalQty: deltaQty } });
        }
      }

      // Handle removed items
      for (const oldItem of order.lastInvoicedItems) {
        const stillExists = order.items.some(i => i.productId.toString() === oldItem.productId.toString());
        if (!stillExists) {
          await Product.findByIdAndUpdate(oldItem.productId, { $inc: { totalQty: -oldItem.qty } });
        }
      }

      // VENDOR BALANCE UPDATE
      const vendorDelta = (order.grandTotal || 0) - (order.lastInvoicedGrandTotal || 0);
      if (vendorDelta !== 0 && order.vendor) {
        const vendorRecord = await Vendor.findOne({ branchId: order.branchId, name: order.vendor });
        if (vendorRecord) {
          vendorRecord.credit = (vendorRecord.credit || 0) + vendorDelta;
          await vendorRecord.save();
        }
      }

      // Update separate Invoice document
      await PurchaseInvoice.findOneAndUpdate(
        { invoiceNumber: order.purchaseInvoiceId, branchId: order.branchId },
        {
          items: order.items,
          subtotal: order.subtotal,
          totalTax: order.totalTax,
          grandTotal: order.grandTotal,
        }
      );

      order.editHistory.push({
        version: (order.editHistory.length || 0) + 1,
        editType: 'RE_INVOICED',
        items: order.items.map(i => i.toObject()),
        grandTotal: order.grandTotal,
        editedAt: new Date(),
        note: `Purchase Invoice ${order.purchaseInvoiceId} updated with delta corrections.`
      });

      // Audit Log for Re-Invoice
      await createAuditLog({
        userId: req.user.id,
        userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
        username: req.user.username,
        branchId: req.user.branch || order.branchId,
        action: "RE_INVOICE_PO",
        description: `Re-Invoiced PO: ${order.invoiceId} (PI: ${order.purchaseInvoiceId}). Delta: ₹${vendorDelta}`,
        targetId: order._id,
        targetModel: "PurchaseOrder",
        changes: {
          before: oldState,
          after: {
            items: order.items.map(i => i.toObject()),
            grandTotal: order.grandTotal
          }
        }
      });

      order.lastInvoicedItems = order.items.map(i => i.toObject());
      order.lastInvoicedGrandTotal = order.grandTotal;
      order.status = 'INVOICED';
      await order.save();

      return res.json({
        success: true,
        message: `Re-Invoice complete. ${order.purchaseInvoiceId} updated.`,
        piNumber: order.purchaseInvoiceId
      });
    }

    // ─── BRANCH B: FIRST-TIME INVOICE ─────────────────────────────────────
    const voucher = await VoucherType.findOne({ branchId: order.branchId, name: "purchase invoice", orderType: "PI" })
      || await VoucherType.findOne({ branchId: order.branchId, name: "Purchase Invoice" });

    if (!voucher) return res.status(404).json({ message: "PI Voucher type not found" });

    if (voucher.financialYear !== currentFY) {
      voucher.counter = 1;
      voucher.financialYear = currentFY;
    }

    const piNumber = `${voucher.prefix}/${String(voucher.counter).padStart(3, "0")}/${currentFY}`;

    const purchaseInvoice = new PurchaseInvoice({
      invoiceNumber: piNumber,
      poNumber: order.invoiceId,
      branchId: order.branchId,
      vendor: order.vendor,
      items: order.items,
      subtotal: order.subtotal,
      totalTax: order.totalTax,
      grandTotal: order.grandTotal,
      financialYear: currentFY,
    });

    await purchaseInvoice.save();
    voucher.counter += 1;
    await voucher.save();

    // STOCK + VENDOR UPDATES (Simplified for brevity in replacement)
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { totalQty: item.qty } });
    }

    if (order.vendor && order.grandTotal) {
      const vendorRecord = await Vendor.findOne({ branchId: order.branchId, name: order.vendor });
      if (vendorRecord) {
        vendorRecord.credit = (vendorRecord.credit || 0) + order.grandTotal;
        await vendorRecord.save();
      }
    }

    order.status = 'INVOICED';
    order.purchaseInvoiceId = piNumber;
    order.lastInvoicedItems = order.items.map(i => i.toObject());
    order.lastInvoicedGrandTotal = order.grandTotal;
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

    // Round numeric fields if provided
    if (rest.grandTotal !== undefined) rest.grandTotal = Math.round(Number(rest.grandTotal));
    if (rest.subtotal !== undefined) rest.subtotal = Math.round(Number(rest.subtotal));
    if (rest.totalTax !== undefined) rest.totalTax = Math.round(Number(totalTax));
    if (rest.totalDiscount !== undefined) rest.totalDiscount = Math.round(Number(rest.totalDiscount));
    if (rest.transportCharge !== undefined) rest.transportCharge = Math.round(Number(rest.transportCharge));

    const voucher = await VoucherType.findOne({ branchId, name: voucherType.toLowerCase(), orderType: "PO" })
      || await VoucherType.findOne({ branchId, name: voucherType });

    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    const currentFY = getGlobalFinancialYear();

    if (voucher.financialYear !== currentFY) {
      voucher.counter = 1;
      voucher.financialYear = currentFY;
    }

    const regex = new RegExp(`^${voucher.prefix}/\\d+/${currentFY}$`);
    const highestPO = await PurchaseOrder.findOne({ invoiceId: regex }).sort({ invoiceId: -1 }).lean();
    if (highestPO) {
      const parts = highestPO.invoiceId.split('/');
      const highestNum = parseInt(parts[1], 10);
      if (!isNaN(highestNum) && voucher.counter <= highestNum) {
        voucher.counter = highestNum + 1;
        await voucher.save();
      }
    }

    const invoiceId = `${voucher.prefix}/${String(voucher.counter).padStart(3, "0")}/${currentFY}`;

    const order = new PurchaseOrder({
      invoiceId,
      voucherType,
      branchId,
      financialYear: currentFY,
      ...rest,
      status: status || "PLACED",
    });

    await order.save();

    voucher.counter += 1;
    await voucher.save();

    // Log the creation
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

    res.status(201).json({
      message: "Purchase Order saved successfully",
      order,
    });
  } catch (err) {
    console.error("PO save error:", err);
    res.status(500).json({ message: err.message });
  }
});

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

// UPDATE PURCHASE ORDER
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { items, warehouse, subtotal, totalTax, totalDiscount, grandTotal, transportCharge } = req.body;

    const order = await PurchaseOrder.findById(id);
    if (!order) return res.status(404).json({ message: "Purchase Order not found" });

    if (order.status === "INVOICED") {
      return res.status(400).json({ message: "Cannot edit an order that has already been invoiced" });
    }

    const oldState = {
      items: order.items.map(i => i.toObject()),
      grandTotal: order.grandTotal,
      warehouse: order.warehouse
    };

    // Update fields
    if (items) order.items = items;
    if (warehouse) order.warehouse = warehouse;
    if (subtotal !== undefined) order.subtotal = Math.round(Number(subtotal));
    if (totalTax !== undefined) order.totalTax = Math.round(Number(totalTax));
    if (totalDiscount !== undefined) order.totalDiscount = Math.round(Number(totalDiscount));
    if (grandTotal !== undefined) order.grandTotal = Math.round(Number(grandTotal));
    if (transportCharge !== undefined) order.transportCharge = Math.round(Number(transportCharge));

    await order.save();

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
          items: order.items.map(i => i.toObject()),
          grandTotal: order.grandTotal,
          warehouse: order.warehouse
        }
      }
    });

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
  
  // 1. Decrease product qty
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, { $inc: { totalQty: -item.qty } });
    console.log(`📉 Reverted stock for ${item.name}: -${item.qty}`);
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

      // 2. Revert Stock
      console.log(`📦 Reverting stock for ${itemsToRevert.length} items...`);
      for (const item of itemsToRevert) {
        if (item.productId && item.qty) {
          await Product.findByIdAndUpdate(item.productId, { $inc: { totalQty: -item.qty } });
          console.log(`📉 Cancel revert stock: ${item.name || item.productId} -${item.qty}`);
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
          { cancelRequestStatus: "APPROVED" }
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
