import express from "express";
import Product from "../models/Product.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import Vendor from "../models/Vendor.js";
import VoucherType from "../models/VoucherType.js";
import Payment from "../models/Payment.js";
import { getFinancialYear as getGlobalFinancialYear } from "../utils/financialYear.js";

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


router.post('/:id/generate-invoice', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await PurchaseOrder.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status === 'INVOICED') return res.status(400).json({ message: 'Order already invoiced' });

    const currentFY = getFinancialYear();
    const isReInvoice = !!(order.purchaseInvoiceId && order.lastInvoicedItems?.length > 0);

    // ─── BRANCH A: RE-INVOICE (delta recalculation) ───────────────────────
    if (isReInvoice) {
      console.log(`🔄 Re-Invoicing ${order.invoiceId} → updating ${order.purchaseInvoiceId}`);

      // Build a map of OLD invoiced quantities
      const oldQtyMap = {};
      const oldTotalMap = {};
      for (const item of order.lastInvoicedItems) {
        oldQtyMap[item.productId.toString()] = item.qty;
        oldTotalMap[item.productId.toString()] = item.total || 0;
      }

      // Apply DELTA to stock and vendor
      let oldGrandTotal = order.lastInvoicedGrandTotal || 0;
      let newGrandTotal = order.grandTotal || 0;

      for (const item of order.items) {
        const pid = item.productId.toString();
        const oldQty = oldQtyMap[pid] || 0;
        const deltaQty = item.qty - oldQty;
        if (deltaQty !== 0) {
          await Product.findByIdAndUpdate(item.productId, { $inc: { totalQty: deltaQty } });
          console.log(`📦 Stock delta for ${item.name}: ${deltaQty > 0 ? '+' : ''}${deltaQty}`);
        }
      }

      // Handle removed items (items in old but not in new)
      for (const oldItem of order.lastInvoicedItems) {
        const stillExists = order.items.some(i => i.productId.toString() === oldItem.productId.toString());
        if (!stillExists) {
          await Product.findByIdAndUpdate(oldItem.productId, { $inc: { totalQty: -oldItem.qty } });
          console.log(`📦 Removed item ${oldItem.name}: -${oldItem.qty}`);
        }
      }

      // ─── VENDOR BALANCE UPDATE (with netting) ─────────────────────────
      const vendorDelta = newGrandTotal - oldGrandTotal;
      let debitSubtracted = 0;
      let creditAdded = 0;

      if (vendorDelta !== 0 && order.vendor) {
        const vendorRecord = await Vendor.findOne({ branchId: order.branchId, name: order.vendor });
        if (vendorRecord) {
          if (vendorDelta > 0) {
            // INCREASING DEBT: Subtract from debit balance first
            const currentDebit = vendorRecord.debit || 0;
            if (currentDebit > 0) {
              if (vendorDelta <= currentDebit) {
                debitSubtracted = vendorDelta;
                vendorRecord.debit -= vendorDelta;
              } else {
                debitSubtracted = currentDebit;
                creditAdded = vendorDelta - currentDebit;
                vendorRecord.debit = 0;
                vendorRecord.credit = (vendorRecord.credit || 0) + creditAdded;
              }
            } else {
              creditAdded = vendorDelta;
              vendorRecord.credit = (vendorRecord.credit || 0) + vendorDelta;
            }
          } else {
            // DECREASING DEBT (vendorDelta is negative): Reduce credit balance first
            const amountToReduce = Math.abs(vendorDelta);
            const currentCredit = vendorRecord.credit || 0;
            if (amountToReduce <= currentCredit) {
              vendorRecord.credit -= amountToReduce;
            } else {
              const remainder = amountToReduce - currentCredit;
              vendorRecord.credit = 0;
              vendorRecord.debit = (vendorRecord.debit || 0) + remainder;
            }
          }
          await vendorRecord.save();
          console.log(`💰 Vendor balance updated (delta: ${vendorDelta}): DebitSub: ${debitSubtracted}, CreditAdd: ${creditAdded}`);
        }
      }

      // Update the existing PI record (same ID)
      await PurchaseInvoice.findOneAndUpdate(
        { purchaseInvoiceId: order.purchaseInvoiceId },
        {
          items: order.items,
          subtotal: order.subtotal,
          totalTax: order.totalTax,
          grandTotal: order.grandTotal,
          extraExpenses: order.extraExpenses,
          extraExpenseAmount: order.extraExpenseAmount,
        }
      );

      // Snapshot to editHistory
      order.editHistory.push({
        version: (order.editHistory.length || 0) + 1,
        editType: 'RE_INVOICED',
        items: order.items.map(i => i.toObject()),
        subtotal: order.subtotal,
        totalTax: order.totalTax,
        grandTotal: order.grandTotal,
        editedAt: new Date(),
        note: `${order.purchaseInvoiceId} updated | Stock delta applied | Vendor delta: ₹${vendorDelta}`
      });

      // Update lastInvoicedItems for next possible re-edit
      order.lastInvoicedItems = order.items.map(i => i.toObject());
      order.lastInvoicedGrandTotal = order.grandTotal;
      order.status = 'INVOICED';
      order.editRequestStatus = 'NONE';
      await order.save();

      // ─── AUTOMATIC PAYMENT RECORD (for netting) ──────────────
      if (debitSubtracted > 0 && order.vendor) {
        // Generate a Pay ID
        let payVoucher = await VoucherType.findOne({ branchId: order.branchId, name: "payment", orderType: "PM" });
        if (!payVoucher) {
          payVoucher = await VoucherType.create({ branchId: order.branchId, name: "payment", orderType: "PM", prefix: "PAY", counter: 1, financialYear: currentFY });
        }
        if (payVoucher.financialYear !== currentFY) {
          payVoucher.counter = 1; payVoucher.financialYear = currentFY;
        }
        payVoucher.counter += 1;
        await payVoucher.save();
        const payId = `pay${String(payVoucher.counter).padStart(3, "0")}/${currentFY}`;

        const vendorRecord = await Vendor.findOne({ branchId: order.branchId, name: order.vendor });
        const autoPayment = new Payment({
          paymentId: payId,
          branchId: order.branchId,
          paymentType: "vendor_payment",
          amount: debitSubtracted,
          paymentMethod: "other",
          paymentDate: new Date(),
          vendor: { vendorId: vendorRecord?._id, name: order.vendor },
          purchaseOrder: { poId: order._id, invoiceId: order.invoiceId },
          description: `System Netting Adjustment (Debit Balance used for PI: ${order.purchaseInvoiceId})`,
          billingPerson: "System (Auto-Netting)",
          status: "completed",
        });
        await autoPayment.save();
        console.log(`✅ Automatic Payment Record created for netting: ${payId} (₹${debitSubtracted})`);
      }

      return res.json({
        success: true,
        message: `Re-Invoice complete. ${order.purchaseInvoiceId} updated with delta changes.`,
        piNumber: order.purchaseInvoiceId,
        vendorDelta,
        debitSubtracted,
        creditAdded
      });
    }

    // ─── BRANCH B: FIRST-TIME INVOICE ─────────────────────────────────────
    // 1. Fetch independent PI counter
    let piVoucher = await VoucherType.findOne({
      branchId: order.branchId,
      orderType: "PI",
      financialYear: currentFY,
    });

    if (!piVoucher) {
      console.log(`⚠️ No PI voucher found for branch ${order.branchId}. Auto-creating default PI...`);
      piVoucher = new VoucherType({
        branchId: order.branchId,
        name: "purchase invoice",
        orderType: "PI",
        prefix: "PI",
        counter: 1,
        financialYear: currentFY
      });
      await piVoucher.save();
    }


    // PI number = sequential based on PI counter
    const piNumber = `${piVoucher.prefix}/${String(piVoucher.counter).padStart(3, "0")}/${currentFY}`;
    console.log(`🔗 PO: ${order.invoiceId}  →  Generated Independent PI: ${piNumber}`);

    // Increment PI counter
    piVoucher.counter += 1;
    await piVoucher.save();

    // 2. Create PI record
    const purchaseInvoice = new PurchaseInvoice({
      purchaseInvoiceId: piNumber,
      purchaseOrderId: order._id,
      branchId: order.branchId,
      warehouse: order.warehouse,
      vendor: order.vendor,
      items: order.items,
      subtotal: order.subtotal,
      totalTax: order.totalTax,
      extraExpenses: (order.extraExpenses || []).map(exp => ({
        expenseName: exp.expenseName,
        amount: exp.amount || exp.basePrice,
        basePrice: exp.basePrice || exp.amount,
        gst: exp.gst || exp.gstPercent,
        gstPercent: exp.gstPercent || exp.gst,
        gstAmount: exp.gstAmount || 0,
        totalPrice: exp.totalPrice,
      })),
      extraExpenseAmount: order.extraExpenseAmount,
      grandTotal: order.grandTotal,
      voucherType: order.voucherType,
      financialYear: currentFY,
      createdBy: "System"
    });
    await purchaseInvoice.save();

    // 3. Full stock increase
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { totalQty: item.qty } });
    }

    // 4. Vendor balance update with netting
    let debitSubtracted = 0;
    let creditAdded = 0;
    if (order.vendor && order.grandTotal) {
      const vendorRecord = await Vendor.findOne({ branchId: order.branchId, name: order.vendor });
      if (vendorRecord) {
        const amountToApply = order.grandTotal;
        const currentDebit = vendorRecord.debit || 0;

        if (currentDebit > 0) {
          if (amountToApply <= currentDebit) {
            debitSubtracted = amountToApply;
            vendorRecord.debit -= amountToApply;
          } else {
            debitSubtracted = currentDebit;
            creditAdded = amountToApply - currentDebit;
            vendorRecord.debit = 0;
            vendorRecord.credit = (vendorRecord.credit || 0) + creditAdded;
          }
        } else {
          creditAdded = amountToApply;
          vendorRecord.credit = (vendorRecord.credit || 0) + amountToApply;
        }
        await vendorRecord.save();
        console.log(`💰 Vendor Balance Auto-Netting: Subtracted ${debitSubtracted} from Debit, Added ${creditAdded} to Credit.`);
      }
    }

    // 5. Snapshot to editHistory + save lastInvoicedItems
    order.editHistory.push({
      version: (order.editHistory.length || 0) + 1,
      editType: 'INVOICED',
      items: order.items.map(i => i.toObject()),
      subtotal: order.subtotal,
      totalTax: order.totalTax,
      grandTotal: order.grandTotal,
      editedAt: new Date(),
      note: `${piNumber} created | Stock +${order.items.reduce((s, i) => s + i.qty, 0)} units | Vendor +₹${order.grandTotal}`
    });

    order.lastInvoicedItems = order.items.map(i => i.toObject());
    order.lastInvoicedGrandTotal = order.grandTotal;
    order.status = 'INVOICED';
    order.purchaseInvoiceId = piNumber;
    await order.save();

    // ─── AUTOMATIC PAYMENT RECORD (for netting) ──────────────
    if (debitSubtracted > 0 && order.vendor) {
      // Generate a Pay ID
      let payVoucher = await VoucherType.findOne({ branchId: order.branchId, name: "payment", orderType: "PM" });
      if (!payVoucher) {
        payVoucher = await VoucherType.create({ branchId: order.branchId, name: "payment", orderType: "PM", prefix: "PAY", counter: 1, financialYear: currentFY });
      }
      if (payVoucher.financialYear !== currentFY) {
        payVoucher.counter = 1; payVoucher.financialYear = currentFY;
      }
      payVoucher.counter += 1;
      await payVoucher.save();
      const payId = `pay${String(payVoucher.counter).padStart(3, "0")}/${currentFY}`;

      const vendorRecord = await Vendor.findOne({ branchId: order.branchId, name: order.vendor });
      const autoPayment = new Payment({
        paymentId: payId,
        branchId: order.branchId,
        paymentType: "vendor_payment",
        amount: debitSubtracted,
        paymentMethod: "other",
        paymentDate: new Date(),
        vendor: { vendorId: vendorRecord?._id, name: order.vendor },
        purchaseOrder: { poId: order._id, invoiceId: order.invoiceId },
        description: `System Netting Adjustment (Debit Balance used for PI: ${piNumber})`,
        billingPerson: "System (Auto-Netting)",
        status: "completed",
      });
      await autoPayment.save();
      console.log(`✅ Automatic Payment Record created for netting: ${payId} (₹${debitSubtracted})`);
    }

    res.json({
      success: true,
      message: `Purchase Invoice ${piNumber} generated successfully.`,
      piNumber,
      piId: purchaseInvoice._id,
      debitSubtracted,
      creditAdded
    });
  } catch (err) {
    console.error('Generate invoice error:', err);
    res.status(500).json({ message: err.message });
  }
});


router.post("/", async (req, res) => {
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
    if (rest.totalTax !== undefined) rest.totalTax = Math.round(Number(rest.totalTax));
    if (rest.totalDiscount !== undefined) rest.totalDiscount = Math.round(Number(rest.totalDiscount));
    if (rest.transportCharge !== undefined) rest.transportCharge = Math.round(Number(rest.transportCharge));

    // IMPORTANT: Must filter by orderType "PO" to get the correct counter
    const voucher = await VoucherType.findOne({ branchId, name: voucherType.toLowerCase(), orderType: "PO" })
      || await VoucherType.findOne({ branchId, name: voucherType });

    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    const currentFY = getFinancialYear();

    if (voucher.financialYear !== currentFY) {
      voucher.counter = 1;
      voucher.financialYear = currentFY;
    }

    // AUTO-HEAL: Find the actual highest existing PO number for this prefix
    // to fix any counter mismatch (e.g. after swaps or manual changes)
    const regex = new RegExp(`^${voucher.prefix}/\\d+/${currentFY}$`);
    const highestPO = await PurchaseOrder.findOne({ invoiceId: regex }).sort({ invoiceId: -1 }).lean();
    if (highestPO) {
      const parts = highestPO.invoiceId.split('/');
      const highestNum = parseInt(parts[1], 10);
      if (!isNaN(highestNum) && voucher.counter <= highestNum) {
        console.log(`⚠️ Counter mismatch detected! Counter: ${voucher.counter}, Highest existing: ${highestNum}. Auto-correcting to ${highestNum + 1}`);
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

    // Only increment voucher counter after successful save
    voucher.counter += 1;
    await voucher.save();

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
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { items, warehouse, subtotal, totalTax, totalDiscount, grandTotal, transportCharge } = req.body;

    const order = await PurchaseOrder.findById(id);
    if (!order) return res.status(404).json({ message: "Purchase Order not found" });

    if (order.status === "INVOICED") {
      return res.status(400).json({ message: "Cannot edit an order that has already been invoiced" });
    }

    // Update fields
    if (items) order.items = items;
    if (warehouse) order.warehouse = warehouse;
    if (subtotal !== undefined) order.subtotal = Math.round(Number(subtotal));
    if (totalTax !== undefined) order.totalTax = Math.round(Number(totalTax));
    if (totalDiscount !== undefined) order.totalDiscount = Math.round(Number(totalDiscount));
    if (grandTotal !== undefined) order.grandTotal = Math.round(Number(grandTotal));
    if (transportCharge !== undefined) order.transportCharge = Math.round(Number(transportCharge));

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

      // 3. Revert Vendor Balance (Accounting for Netting)
      if (order.vendor && totalToRevert) {
        const vendorRecord = await Vendor.findOne({ branchId: order.branchId, name: order.vendor });
        if (vendorRecord) {
          // Find if there was any automatic netting payment for this PO
          const nettingPayments = await Payment.find({
            "purchaseOrder.poId": order._id,
            paymentMethod: "other",
            description: /System Netting Adjustment/i,
            status: "completed"
          });

          const totalNettingReversion = nettingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
          const creditToRevert = totalToRevert - totalNettingReversion;

          console.log(`💰 Netting Reversion: ₹${totalNettingReversion} back to Debit, ₹${creditToRevert} from Credit.`);

          // Restore Debit balance
          if (totalNettingReversion > 0) {
            vendorRecord.debit = (vendorRecord.debit || 0) + totalNettingReversion;
            // Void the netting payment records so they don't show up in totals anymore
            for (const pay of nettingPayments) {
              pay.status = "voided";
              pay.description += " (CANCELLED - PO effects reverted)";
              await pay.save();
            }
          }

          // Reduce Credit balance
          if (creditToRevert > 0) {
            vendorRecord.credit = Math.max(0, (vendorRecord.credit || 0) - creditToRevert);
          }

          await vendorRecord.save();
          console.log(`✅ Vendor ${order.vendor} balance reverted.`);
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
      editType: 'RE_EDIT_STARTED', // closest type; can be extended
      items: order.items.map(i => i.toObject ? i.toObject() : i),
      grandTotal: order.grandTotal,
      editedAt: new Date(),
      note: `Order CANCELLED by admin approval. Stock and vendor credit reverted.`
    });

    // Soft cancel — keep in records
    order.status = "CANCELLED";
    order.cancelRequestStatus = "APPROVED";
    await order.save();

    res.json({ success: true, message: "Order cancelled. Records kept for audit trail. Stock and vendor balance reverted." });
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
