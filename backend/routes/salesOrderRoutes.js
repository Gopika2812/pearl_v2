import express from "express";
import mongoose from "mongoose";
import auth from "../middleware/auth.js";
import Commission from "../models/Commission.js";
import Customer from "../models/Customer.js";
import Invoice from "../models/Invoice.js";
import Product from "../models/Product.js";
import Receipt from "../models/Receipt.js";
import SalesOrder from "../models/SalesOrder.js";
import VoucherType from "../models/VoucherType.js";
import { getFinancialYear } from "../utils/financialYear.js";
import { createAuditLog } from "../utils/logUtil.js";
import { cacheData, clearCachePrefix } from "../middleware/cacheMiddleware.js";

const router = express.Router();

// RECORD PAYMENT for sales order
router.post("/:id/record-payment", clearCachePrefix("/api/sales-orders"), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, paymentDate, referenceNo, remarks } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required" });
    }

    const order = await SalesOrder.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Sales order not found" });

    // Allow slightly larger due to float rounding, but normally amount <= closingBalance
    if (amount > (order.closingBalance || 0) + 1) {
      return res.status(400).json({ success: false, message: "Amount exceeds closing balance" });
    }

    // 1. Generate Receipt ID and Create Receipt
    const financialYear = getFinancialYear();
    const prefix = "RCP";

    let receipt;
    let receiptId;
    let saved = false;
    let retries = 0;

    while (!saved && retries < 5) {
      try {
        const receiptDoc = await Receipt.findOne({
          receiptId: new RegExp(`^${prefix}/`),
          financialYear
        }).sort({ receiptId: -1 });
        const nextNumber = receiptDoc ? parseInt(receiptDoc.receiptId.split("/")[1]) + 1 : 1;
        receiptId = `${prefix}/${String(nextNumber).padStart(3, "0")}/${financialYear}`;

        receipt = new Receipt({
          receiptId,
          originalSalesOrderId: id,
          originalInvoiceId: order.invoiceId,
          customer: {
            customerId: order.customer.customerId,
            name: order.customer.name,
          },
          amount,
          paymentMethod: (paymentMethod || "CASH").toUpperCase(),
          reference: referenceNo || null,
          notes: remarks || null,
          financialYear,
          status: "confirmed",
          createdAt: paymentDate ? new Date(paymentDate) : new Date()
        });

        await receipt.save();
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
      return res.status(500).json({ success: false, message: "System busy. Could not generate a unique receipt ID. Please try again." });
    }

    // 2. Reduce Order Closing Balance
    order.closingBalance -= amount;
    // ensure closingbalance doesn't go below 0 due to flaots
    if (order.closingBalance < 0.01) order.closingBalance = 0;
    await order.save();

    // 3. Update Customer Balance
    const customer = await Customer.findById(order.customer.customerId);
    if (customer) {
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

      customer.debit = currentDebit;
      customer.credit = currentCredit;
      customer.closingBalance = (customer.closingBalance || 0) - amount;
      customer.totalBalance = customer.closingBalance;
      await customer.save();
    }

    res.json({
      success: true,
      message: "Payment recorded successfully",
      newClosingBalance: order.closingBalance,
      data: receipt
    });
  } catch (err) {
    console.error("Error recording payment:", err);
    res.status(500).json({ success: false, message: err.message || "Server Error" });
  }
});

// GET all sales orders with filtering and date ranges
router.get("/", async (req, res) => {
  try {
    const { branchId, customerName, status, isClaim, fromDate, toDate, customerId, search, voucherType, generated } = req.query;
    const query = {};

    // 1. Branch Filter (Always required)
    if (branchId) {
      query.branchId = branchId;
    }

    // 2. Voucher Type Filter
    if (voucherType) {
      query.voucherType = voucherType;
    }

    // 3. Invoice Generation Filter
    if (generated !== undefined && generated !== "") {
      query.invoiceGenerated = generated === "true";
    }

    // 4. Global Search (Overrides strict date filter if provided)
    if (search) {
      const searchCriteria = {
        $or: [
          { invoiceId: { $regex: search, $options: "i" } },
          { salesInvoiceId: { $regex: search, $options: "i" } },
          { "customer.name": { $regex: search, $options: "i" } }
        ]
      };
      query.$and = [searchCriteria];
    }

    // 5. Date Filter
    // Apply default 'Today' ONLY if no specific dates AND no search term are provided
    // 📅 Date Filtering: Respect specific dates if provided, or default to "Today" if no global search is active.
    // Status filters (voucherType, generated) should NOT disable the date filter.
    if (fromDate || toDate || !search) {
      const start = fromDate ? new Date(fromDate) : new Date();
      start.setHours(0, 0, 0, 0);

      const end = toDate ? new Date(toDate) : new Date();
      end.setHours(23, 59, 59, 999);

      query.orderDate = { $gte: start, $lte: end };
    }

    // 6. Status & Customer Filters
    if (customerName) {
      query["customer.name"] = { $regex: customerName, $options: "i" };
    }

    if (status) {
      query.status = status.toUpperCase();
    }

    if (customerId) {
      query["customer.customerId"] = customerId;
    }

    if (isClaim !== undefined) {
      query.isClaim = isClaim === "true";
    }

    // ⚡ Optimized Fetch
    const salesOrders = await SalesOrder.find(query)
      .select("invoiceId salesInvoiceId customer items sampleItems grandTotalWithMargin grandTotal commonDiscount invoiceCommonDiscount closingBalance salesOwner createdAt orderDate invoiceGenerated warehouse billingPerson voucherType reEditRequestStatus reEditRequestBy reEditRequestAt isReEdited status editHistory lastInvoicedGrandTotal transportCharge transportGstPercent transportGstAmount invoiceTransportCharge invoiceTransportGstAmount extraExpenses extraExpenseAmount invoiceItems lastInvoicedItems invoiceSubtotal invoiceTotalTax invoiceGrandTotal invoiceOpeningBalance invoiceClosingBalance")
      .populate('salesOwner', 'name')
      .populate('items.productId')
      .populate('invoiceItems.productId')
      .populate('lastInvoicedItems.productId')
      .sort({ createdAt: -1 })
      .limit(search ? 1000 : 200) // Increase limit for searches
      .lean();

    res.json(salesOrders);
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ message: "Failed to fetch sales orders" });
  }
});

// GET selling history (for Product Records)
router.get("/history", cacheData(120), async (req, res) => {
  try {
    const { branchId, fromDate, toDate, productGroupId, productId, customerId } = req.query;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const matchQuery = {
      branchId: new mongoose.Types.ObjectId(branchId),
      status: { $ne: "CANCELLED" }
    };

    if (customerId) {
      matchQuery["customer.customerId"] = new mongoose.Types.ObjectId(customerId);
    }

    if (fromDate || toDate) {
      matchQuery.createdAt = {};
      if (fromDate) matchQuery.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        matchQuery.createdAt.$lte = end;
      }
    }

    const aggregation = [
      { $match: matchQuery },
      { $unwind: "$items" },
    ];

    if (productId) {
      aggregation.push({
        $match: { "items.productId": new mongoose.Types.ObjectId(productId) }
      });
    }

    aggregation.push(
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" }
    );

    if (productGroupId) {
      aggregation.push({
        $match: { "productInfo.productGroup": new mongoose.Types.ObjectId(productGroupId) }
      });
    }

    aggregation.push(
      {
        $lookup: {
          from: "productgroups",
          localField: "productInfo.productGroup",
          foreignField: "_id",
          as: "groupInfo"
        }
      },
      {
        $unwind: {
          path: "$groupInfo",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          date: "$createdAt",
          invoiceId: 1,
          voucherType: 1,
          customerName: "$customer.name",
          productName: "$items.name",
          productGroupName: "$groupInfo.name",
          purchasingPrice: "$productInfo.purchasingPrice",
          gst: "$items.gst",
          qty: "$items.qty",
          sellingPrice: "$items.sellingPrice",
          discountAmount: "$items.discountAmount",
          // Calculate discount per unit
          discountPerUnit: {
            $cond: [
              { $gt: ["$items.qty", 0] },
              { $divide: ["$items.discountAmount", "$items.qty"] },
              0
            ]
          },
          // Gross Profit per unit = (actual selling price per unit) - cost
          grossProfit: {
            $subtract: [
              {
                $subtract: [
                  "$items.sellingPrice",
                  {
                    $cond: [
                      { $gt: ["$items.qty", 0] },
                      { $divide: ["$items.discountAmount", "$items.qty"] },
                      0
                    ]
                  }
                ]
              },
              "$productInfo.purchasingPrice"
            ]
          }
        }
      },
      { $sort: { date: -1 } },
      { $limit: 500 }
    );

    const history = await SalesOrder.aggregate(aggregation);
    res.json(history);
  } catch (error) {
    console.error("Aggregation error:", error);
    res.status(500).json({ message: "Failed to fetch sales history" });
  }
});


// GET sales order preview (for new orders)
router.get("/preview/:voucherType", async (req, res) => {
  try {
    const { voucherType } = req.params;  // ✅ FIX: Changed from req.query to req.params
    const { branchId } = req.query;
    const financialYear = getFinancialYear();

    console.log("📋 Preview requested:", { voucherType, branchId });

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const voucher = await VoucherType.findOne({
      branchId,
      name: voucherType.toLowerCase(),
      orderType: "SO",
    });

    if (!voucher) {
      console.error("❌ Voucher not found for preview:", { branchId, voucherType, orderType: "SO" });
      return res.status(404).json({ message: "Sales voucher not found" });
    }

    // reset counter for preview if FY changed
    const counter =
      voucher.financialYear === financialYear ? voucher.counter : 1;

    const invoiceId = `${voucher.prefix}/${String(counter).padStart(
      3,
      "0"
    )}/${financialYear}`;

    console.log("✅ Preview generated:", invoiceId);
    res.json({ invoiceId });
  } catch (err) {
    console.error("❌ Preview Error:", err.message);
    res.status(500).json({ message: "Failed to generate preview" });
  }
});

router.post("/", auth, clearCachePrefix("/api/sales-orders"), async (req, res) => {
  try {
    const {
      voucherType,
      branchId,
      customer,
      warehouse,
      billingPerson,
      agent,
      items,
      sampleItems,
      transportCharge,
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
      customerMargin,
      marginAmount,
      grandTotalWithMargin,
      ewayEnabled,
      ewayDetails,
      salesOwner,
      salesMan,
      deliveryMan,
      extraExpenses,
      extraExpenseAmount,
      commonDiscount,
      isClaim,
      orderDate,
    } = req.body;

    console.log("📤 POST /sales-orders received");

    if (!voucherType || (!items?.length && !sampleItems?.length) || !branchId) {
      console.error("❌ Missing required fields:", { voucherType, itemsLength: items?.length, sampleItemsLength: sampleItems?.length, branchId });
      return res.status(400).json({ message: "Invalid sales order data - voucherType, branchId, and at least one item (Regular or Sample) are required" });
    }

    const currentFY = getFinancialYear();
    console.log("📅 Financial year:", currentFY);

    // 🔑 Fetch voucher
    const voucher = await VoucherType.findOne({
      branchId,
      name: voucherType.toLowerCase(),
      orderType: "SO",
    });

    if (!voucher) {
      return res.status(404).json({ message: "Sales voucher not found" });
    }

    // 🔁 Reset counter if FY changed
    if (voucher.financialYear !== currentFY) {
      voucher.counter = 1;
      voucher.financialYear = currentFY;
    }

    // 🛡️ SYNC COUNTER WITH DATABASE (Collision Protection)
    const existingOrders = await SalesOrder.find({
      branchId,
      invoiceId: new RegExp(`^${voucher.prefix}/`),
      financialYear: currentFY
    }).select('invoiceId').lean();

    let highestNumInDB = 0;
    existingOrders.forEach(order => {
      const parts = order.invoiceId.split('/');
      if (parts.length >= 2) {
        const num = parseInt(parts[1]);
        if (!isNaN(num) && num > highestNumInDB) highestNumInDB = num;
      }
    });

    const nextNum = Math.max(voucher.counter, highestNumInDB + 1);
    const invoiceId = `${voucher.prefix}/${String(nextNum).padStart(3, "0")}/${currentFY}`;

    console.log("📝 Generated invoiceId:", invoiceId, `(Highest in DB: ${highestNumInDB})`);

    // ✅ FETCH CUSTOMER INSIDE ROUTE
    const dbCustomer = await Customer.findById(customer.id);

    if (!dbCustomer) {
      console.error("❌ Customer not found:", customer.id);
      return res.status(404).json({ message: "Customer not found" });
    }

    console.log("✅ Customer found:", dbCustomer.name);

    const openingBalance = (dbCustomer.debit || 0) - (dbCustomer.credit || 0);
    const closingBalance = Math.round(openingBalance + grandTotal);

    // 🧾 Save Sales Order
    const salesOrder = new SalesOrder({
      invoiceId,
      voucherType,
      orderType: "SO",
      branchId,
      customer: {
        customerId: customer.id,
        name: customer.name,
        whatsapp: customer.whatsapp,
        address: customer.address,
        district: customer.district,
        state: customer.state,
        stateCode: customer.stateCode || "33",
        pincode: customer.pincode,
        gstin: customer.gstin,
      },
      openingBalance: Math.round(openingBalance),
      closingBalance,
      warehouse,
      billingPerson,
      agent,
      items,
      sampleItems: sampleItems || [],
      transportCharge: Math.round(Number(transportCharge) || 0),
      subtotal: Math.round(Number(subtotal) || 0),
      totalDiscount: Math.round(Number(totalDiscount) || 0),
      totalTax: Math.round(Number(totalTax) || 0),
      grandTotal: Math.round(Number(grandTotal) || 0),
      customerMargin: Math.round(Number(customerMargin) || 0),
      marginAmount: Math.round(Number(marginAmount) || 0),
      grandTotalWithMargin: Math.round(Number(grandTotalWithMargin) || 0),
      extraExpenses: (extraExpenses || []).map((exp) => ({
        expenseName: exp.expenseName,
        basePrice: Math.round(Number(exp.basePrice) || 0),
        gstPercent: Math.round(Number(exp.gstPercent) || 0),
        gstAmount: Math.round(Number(exp.gstAmount) || 0),
        totalPrice: Math.round(Number(exp.totalPrice) || 0),
      })),
      extraExpenseAmount: Math.round(Number(extraExpenseAmount) || 0),
      commonDiscount: Math.round(Number(commonDiscount) || 0),
      ewayEnabled,
      ewayDetails,
      salesOwner,
      salesMan,
      deliveryMan,
      financialYear: currentFY,
      isClaim: isClaim || false,
      orderDate: orderDate ? new Date(orderDate) : new Date(),
    });

    await salesOrder.save();
    console.log("✅ SalesOrder saved successfully");

    // ✅ Sync and Increment voucher counter
    voucher.counter = nextNum + 1;
    await voucher.save();

    // Log Sales Order creation
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: salesOrder.branchId,
      action: "CREATE_SO",
      description: `Created Sales Order: ${salesOrder.invoiceId} for ${salesOrder.customer.name}. Total: ₹${salesOrder.grandTotal}`,
      targetId: salesOrder._id,
      targetModel: "SalesOrder",
    });

    console.log(`✅ Voucher counter incremented to ${voucher.counter}`);

    res.status(201).json({
      message: "Sales order created successfully",
      invoiceId,
      data: salesOrder,
    });
  } catch (error) {
    console.error("❌ Sales Order Save Error:", error.message);
    res.status(500).json({ message: error.message || "Server error" });
  }
});

router.get("/recent", cacheData(60), async (req, res) => {
  try {
    const { customerId, productId, limit = 5 } = req.query;

    const orders = await SalesOrder.find({
      "customer.customerId": new mongoose.Types.ObjectId(customerId),
      "items.productId": new mongoose.Types.ObjectId(productId)
    })
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({ data: orders });
  } catch (err) {
    console.error("Recent orders error:", err);
    res.status(500).json({ message: "Failed to fetch recent orders" });
  }
});

// GET all commissions
router.get("/commissions", async (req, res) => {
  try {
    const commissions = await Commission.find().sort({ createdAt: -1 });
    res.json({ success: true, data: commissions });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch commissions" });
  }
});

// GET commission by sales order ID
router.get("/commissions/order/:salesOrderId", async (req, res) => {
  try {
    const commission = await Commission.findOne({
      salesOrderId: req.params.salesOrderId,
    });
    if (!commission) {
      return res
        .status(404)
        .json({ success: false, message: "Commission not found" });
    }
    res.json({ success: true, data: commission });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch commission" });
  }
});

// 🗑️ SOFT-CANCEL SALES ORDER (Revert effects, mark CANCELLED, keep in records)
router.delete("/:id", auth, clearCachePrefix("/api/sales-orders"), async (req, res) => {
  try {
    const { id } = req.params;
    const { narration } = req.body; // ✅ Accept cancellation reason

    const salesOrder = await SalesOrder.findById(id)
      .populate("items.productId")
      .populate("invoiceItems.productId")
      .populate("lastInvoicedItems.productId");

    if (!salesOrder) {
      return res.status(404).json({ success: false, message: "Sales order not found" });
    }

    if (salesOrder.status === "CANCELLED") {
      return res.status(400).json({ success: false, message: "Order is already cancelled" });
    }

    // 🔄 REVERT EFFECTS IF INVOICED
    if (salesOrder.status === "INVOICED") {
      const Customer = mongoose.model("Customer");
      const Product = mongoose.model("Product");
      const Commission = mongoose.model("Commission");
      const SalesOwner = mongoose.model("SalesOwner");
      const SalesMan = mongoose.model("SalesMan");
      const DeliveryMan = mongoose.model("DeliveryMan");

      // 1. Revert Customer Balance using lastInvoicedGrandTotal
      const amountToRevert = salesOrder.lastInvoicedGrandTotal || salesOrder.grandTotal || 0;
      if (salesOrder.customer?.customerId && amountToRevert > 0) {
        const customer = await Customer.findById(salesOrder.customer.customerId);
        if (customer) {
          let remainingToRevert = amountToRevert;
          let currentCredit = customer.credit || 0;
          let currentDebit = customer.debit || 0;

          if (currentDebit >= remainingToRevert) {
            currentDebit -= remainingToRevert;
            remainingToRevert = 0;
          } else {
            remainingToRevert -= currentDebit;
            currentDebit = 0;
            currentCredit += remainingToRevert;
          }

          const newClosingBalance = (customer.closingBalance || 0) - amountToRevert;

          await Customer.findByIdAndUpdate(salesOrder.customer.customerId, {
            debit: currentDebit,
            credit: currentCredit,
            closingBalance: newClosingBalance,
            totalBalance: newClosingBalance
          });
          console.log(`✅ Customer balance reverted for cancellation: -₹${amountToRevert}`);
        }
      }

      // 2. Revert Product Stock using lastInvoicedItems
      const itemsToRevert = (salesOrder.lastInvoicedItems && salesOrder.lastInvoicedItems.length > 0)
        ? salesOrder.lastInvoicedItems
        : salesOrder.items;

      for (const item of itemsToRevert) {
        if (item.productId && item.qty > 0) {
          await Product.findByIdAndUpdate(item.productId, { $inc: { totalQty: item.qty } });
          console.log(`✅ Stock restored for ${item.name}: +${item.qty}`);
        }
      }

      // 3. Revert Commissions
      const commission = await Commission.findOne({ salesOrderId: id });
      if (commission) {
        if (commission.salesOwnerId) await SalesOwner.findByIdAndUpdate(commission.salesOwnerId, { $inc: { commissionAmount: -commission.salesOwnerCommissionAmount } });
        if (commission.salesManId) await SalesMan.findByIdAndUpdate(commission.salesManId, { $inc: { commissionAmount: -commission.salesManCommissionAmount } });
        if (commission.deliveryManId) await DeliveryMan.findByIdAndUpdate(commission.deliveryManId, { $inc: { commissionAmount: -commission.deliveryManCommissionAmount } });
        await Commission.deleteOne({ salesOrderId: id });
        console.log(`✅ Commissions reverted for cancellation.`);
      }
    }

    // Snapshot into editHistory before cancelling
    salesOrder.editHistory.push({
      version: (salesOrder.editHistory.length || 0) + 1,
      editType: 'RE_EDIT_STARTED',
      items: salesOrder.items,
      grandTotal: salesOrder.grandTotal,
      editedAt: new Date(),
      note: `Order CANCELLED by ${req.user.username || "Admin"}. Reason: ${narration || "No narration provided"}. All stock and customer balance effects reverted.`
    });

    salesOrder.status = "CANCELLED";
    salesOrder.cancelNarration = narration || "";
    salesOrder.cancelledBy = req.user.username || req.user.id;
    salesOrder.cancelledAt = new Date();
    await salesOrder.save();

    // Log the cancellation
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: salesOrder.branchId,
      action: "CANCEL_SO",
      description: `Cancelled Sales Order: ${salesOrder.invoiceId} (Customer: ${salesOrder.customer.name}). Reason: ${narration || "No reason given"}`,
      targetId: salesOrder._id,
      targetModel: "SalesOrder",
    });

    res.json({
      success: true,
      message: "Sales Order cancelled. Records kept for audit trail. Stock and customer balance reverted.",
    });
  } catch (err) {
    console.error("Cancel SO error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 📋 AUTO-APPROVING RE-EDIT (No Admin required as per user request)
router.patch("/:id/request-reedit", auth, clearCachePrefix("/api/sales-orders"), async (req, res) => {
  try {
    const { id } = req.params;
    const { requestedBy } = req.body;
    const order = await SalesOrder.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Snapshot current state before edit starts
    if (order.status === "INVOICED" || order.invoiceGenerated) {
      order.editHistory.push({
        version: (order.editHistory.length || 0) + 1,
        editType: 'RE_EDIT_STARTED',
        items: order.items,
        grandTotal: order.grandTotal,
        editedAt: new Date(),
        note: `Direct re-edit initiated by ${requestedBy || "Staff"}.`
      });

      order.status = "PLACED"; 
      order.isReEdited = true;
    }

    order.reEditRequestStatus = "APPROVED";
    order.reEditRequestBy = requestedBy || "Staff";
    order.reEditRequestAt = new Date();
    await order.save();

    res.json({ success: true, message: "Re-edit enabled. You can now modify the Sales Order." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ DIRECT RE-EDIT (Admin/Manager can immediately unlock an invoiced order)
router.patch("/:id/approve-edit", clearCachePrefix("/api/sales-orders"), async (req, res) => {
  try {
    const { id } = req.params;
    const { editedBy } = req.body;
    const order = await SalesOrder.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Switch status to PLACED even if it was INVOICED
    if (order.status === "INVOICED" || order.invoiceGenerated) {
      // Snapshot current state before edit starts
      order.editHistory.push({
        version: (order.editHistory.length || 0) + 1,
        editType: 'RE_EDIT_STARTED',
        items: order.items,
        grandTotal: order.grandTotal,
        editedAt: new Date(),
        note: `Admin approved re-edit. Items can now be modified. Deltas will apply on re-invoice.`
      });

      order.status = "PLACED"; // Return to PLACED status for editing
      order.isReEdited = true;
    }

    order.reEditRequestStatus = "APPROVED";
    await order.save();

    res.json({ success: true, message: "Re-edit approved. You can now modify the Sales Order." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🎯 GENERATE INVOICE FROM SALES ORDER
router.patch("/:id/generate-invoice", auth, clearCachePrefix("/api/sales-orders"), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      invoiceItems,
      invoiceSampleItems,
      invoiceSubtotal,
      invoiceTotalDiscount,
      invoiceTotalTax,
      invoiceTransportCharge,
      invoiceGrandTotal,
      invoiceCommonDiscount,
      invoiceOpeningBalance,
      invoiceClosingBalance,
    } = req.body;

    console.log("📋 Generating invoice flow for SO:", id);

    // 🔍 FIND SALES ORDER
    const salesOrder = await SalesOrder.findById(id);
    if (!salesOrder) return res.status(404).json({ message: "Sales order not found" });

    if (salesOrder.status === "INVOICED" && salesOrder.reEditRequestStatus !== "APPROVED") {
      return res.status(400).json({ message: "Invoice already generated. Request re-edit to modify." });
    }

    const currentFY = getFinancialYear();
    const Invoice = mongoose.model("Invoice");
    const isReInvoice = salesOrder.invoiceGenerated || salesOrder.status === "INVOICED";

    // ─── BRANCH A: RE-INVOICE (DeltaRecalculation) ───────────────────────
    if (isReInvoice) {
      console.log(`🔄 Re-Invoicing ${salesOrder.invoiceId} → updating ${salesOrder.salesInvoiceId}`);

      const oldState = {
        items: salesOrder.lastInvoicedItems.map(i => i.toObject()),
        grandTotal: salesOrder.lastInvoicedGrandTotal
      };

      // 1. Calculate Deltas
      const oldQtyMap = {};
      (salesOrder.lastInvoicedItems || []).forEach(item => {
        oldQtyMap[item.productId.toString()] = item.qty || 0;
      });

      const itemsToInvoice = invoiceItems || salesOrder.items;
      const samplesToInvoice = invoiceSampleItems || salesOrder.sampleItems;
      const allNewItems = [...itemsToInvoice, ...samplesToInvoice];

      // Stock Deltas
      for (const item of allNewItems) {
        const pid = item.productId.toString();
        const oldQty = oldQtyMap[pid] || 0;
        const deltaQty = item.qty - oldQty;
        if (deltaQty !== 0) {
          await Product.findByIdAndUpdate(item.productId, { $inc: { totalQty: -deltaQty } });
        }
      }

      // Handle removed items
      const newPidSet = new Set(allNewItems.map(i => i.productId.toString()));
      for (const oldItem of salesOrder.lastInvoicedItems) {
        const pid = oldItem.productId.toString();
        if (!newPidSet.has(pid)) {
          await Product.findByIdAndUpdate(pid, { $inc: { totalQty: oldItem.qty } });
        }
      }

      // 2. Financial Deltas (Customer Balance + Customer Swap)
      const oldTotal = salesOrder.lastInvoicedGrandTotal || 0;
      const newTotal = Math.round(Number(invoiceGrandTotal) || salesOrder.grandTotal || 0);
      
      // Determine if customer has changed since last invoice
      const oldCustomerId = salesOrder.lastInvoicedCustomerId || salesOrder.customer?.customerId;
      const currentCustomerId = salesOrder.customer?.customerId;
      const isCustomerSwapped = oldCustomerId && currentCustomerId && oldCustomerId.toString() !== currentCustomerId.toString();

      if (isCustomerSwapped) {
        console.log(`🔄 Customer Swap detected: ${oldCustomerId} -> ${currentCustomerId}`);
        
        // A. Revert entire old total from old customer
        const oldCustomer = await Customer.findById(oldCustomerId);
        if (oldCustomer) {
          let remainingToRevert = oldTotal;
          let oldDebit = oldCustomer.debit || 0;
          let oldCredit = oldCustomer.credit || 0;

          if (oldDebit >= remainingToRevert) {
            oldDebit -= remainingToRevert;
          } else {
            remainingToRevert -= oldDebit;
            oldDebit = 0;
            oldCredit += remainingToRevert;
          }

          await Customer.findByIdAndUpdate(oldCustomerId, {
            debit: oldDebit,
            credit: oldCredit,
            $inc: { closingBalance: -oldTotal, totalBalance: -oldTotal }
          });
          console.log(`✅ Old customer (${oldCustomer.name}) balance reverted: -₹${oldTotal}`);
        }

        // B. Apply entire new total to current customer
        const currentCustomer = await Customer.findById(currentCustomerId);
        if (currentCustomer) {
          let remainingToAdd = newTotal;
          let curDebit = currentCustomer.debit || 0;
          let curCredit = currentCustomer.credit || 0;

          if (curCredit >= remainingToAdd) {
            curCredit -= remainingToAdd;
          } else {
            remainingToAdd -= curCredit;
            curCredit = 0;
            curDebit += remainingToAdd;
          }

          await Customer.findByIdAndUpdate(currentCustomerId, {
            debit: curDebit,
            credit: curCredit,
            $inc: { closingBalance: newTotal, totalBalance: newTotal }
          });
          console.log(`✅ Current customer (${currentCustomer.name}) balance updated: +₹${newTotal}`);
        }
      } else if (newTotal !== oldTotal) {
        // Standard Delta for same customer
        const balanceDelta = newTotal - oldTotal;
        const customer = await Customer.findById(currentCustomerId);
        if (customer) {
          let remainingDelta = balanceDelta;
          let currentDebit = customer.debit || 0;
          let currentCredit = customer.credit || 0;

          if (balanceDelta > 0) {
            // Increasing Balance: Consume credit first
            if (currentCredit >= remainingDelta) {
              currentCredit -= remainingDelta;
              remainingDelta = 0;
            } else {
              remainingDelta -= currentCredit;
              currentCredit = 0;
              currentDebit += remainingDelta;
            }
          } else {
            // Decreasing Balance: Consume debit first
            const absDelta = Math.abs(remainingDelta);
            if (currentDebit >= absDelta) {
              currentDebit -= absDelta;
            } else {
              const excess = absDelta - currentDebit;
              currentDebit = 0;
              currentCredit += excess;
            }
          }

          await Customer.findByIdAndUpdate(currentCustomerId, {
            debit: currentDebit,
            credit: currentCredit,
            $inc: { closingBalance: balanceDelta, totalBalance: balanceDelta }
          });
          console.log(`✅ Ledger Delta Applied for ${customer.name}: ₹${balanceDelta}`);
        }
      }

      // 3. Update separate Invoice document
      await Invoice.findOneAndUpdate(
        { invoiceNumber: salesOrder.salesInvoiceId, branchId: salesOrder.branchId },
        {
          items: itemsToInvoice,
          sampleItems: samplesToInvoice,
          subtotal: Math.round(Number(invoiceSubtotal) || 0),
          totalDiscount: Math.round(Number(invoiceTotalDiscount) || 0),
          commonDiscount: Math.round(Number(invoiceCommonDiscount) || 0),
          totalTax: { total: Math.round(Number(invoiceTotalTax) || 0) },
          transportCharge: Math.round(Number(invoiceTransportCharge) || 0),
          grandTotal: newTotal,
          closingBalance: Math.round(Number(invoiceClosingBalance) || 0),
        }
      );

      // 4. Snapshot & Save SO
      salesOrder.editHistory.push({
        version: (salesOrder.editHistory.length || 0) + 1,
        editType: 'RE_INVOICED',
        items: allNewItems,
        grandTotal: newTotal,
        editedAt: new Date(),
        note: `Sales Invoice ${salesOrder.salesInvoiceId} updated with delta corrections.`
      });

      // Log Re-Invoice
      console.log(`📡 AUDIT LOG DEBUG (SO Route): isReInvoice=${isReInvoice}`);
      await createAuditLog({
        userId: req.user.id,
        userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
        username: req.user.username,
        branchId: salesOrder.branchId,
        action: isReInvoice ? "RE_INVOICE_SO" : "INVOICE_SO",
        description: `${isReInvoice ? 'Regenerated' : 'Finalized'} Invoice: ${salesOrder.salesInvoiceId} for Order: ${salesOrder.invoiceId}. Total: ₹${newTotal}. Items: ${allNewItems.slice(0, 3).map(i => i.productName || i.name).join(", ")}${allNewItems.length > 3 ? "..." : ""}`,
        targetId: salesOrder._id,
        targetModel: "SalesOrder",
        changes: {
          before: oldState,
          after: {
            items: allNewItems.map(i => i.toObject ? i.toObject() : i),
            grandTotal: newTotal
          }
        }
      });

      salesOrder.lastInvoicedItems = allNewItems;
      salesOrder.invoiceItems = allNewItems;
      salesOrder.lastInvoicedGrandTotal = newTotal;
      salesOrder.lastInvoicedCustomerId = currentCustomerId;
      salesOrder.status = "INVOICED";
      salesOrder.reEditRequestStatus = "NONE";
      await salesOrder.save();

      return res.json({
        success: true,
        message: `Re-Invoice complete. ${salesOrder.salesInvoiceId} updated.`,
        siNumber: salesOrder.salesInvoiceId
      });
    }

    // ─── BRANCH B: FIRST-TIME INVOICE ─────────────────────────────────────
    const rawSoId = salesOrder.invoiceId || "";
    const cleanSoId = rawSoId.replace(/^(SO|SO REF|SO\sREF)[:\s\-]*/i, "");
    const soPrefixPrefix = cleanSoId.split('/')[0];

    let siPrefix = soPrefixPrefix.endsWith("SO")
      ? soPrefixPrefix.replace(/SO$/i, "SI")
      : `${soPrefixPrefix}SI`;

    console.log(`🔍 Absolute Sync (Convert): SO [${soPrefixPrefix}] -> Target SI [${siPrefix}]`);


    // 🔬 SEARCH ONLY BY EXACT PREFIX. DO NOT USE NAME FALLBACK.
    let siVoucher = await VoucherType.findOne({
      branchId: salesOrder.branchId,
      prefix: siPrefix,
      orderType: "SI",
      financialYear: currentFY
    });

    // 🆕 AUTO-CREATE SI VOUCHER IF MISSING (EXACT PREFIX MATCH)
    if (!siVoucher) {
      console.log(`⚠️ No SI voucher found for prefix '${siPrefix}'. Auto-creating now...`);

      siVoucher = new VoucherType({
        branchId: salesOrder.branchId,
        name: soPrefixPrefix.toLowerCase().replace(/so$/i, ""), // Normalize name from its prefix
        orderType: "SI",
        prefix: siPrefix,
        counter: 1,
        financialYear: currentFY
      });
      await siVoucher.save();
      console.log(`✅ Automated SI Voucher created with absolute prefix: ${siPrefix} (Counter: 1)`);
    }

    const siNumber = `${siVoucher.prefix}/${String(siVoucher.counter).padStart(3, "0")}/${currentFY}`;

    // Create separate Invoice document
    const itemsToInvoice = invoiceItems || salesOrder.items;
    const samplesToInvoice = invoiceSampleItems || salesOrder.sampleItems;
    const grandTotalToUse = Math.round(Number(invoiceGrandTotal) || salesOrder.grandTotal || 0);

    const invoiceDoc = new Invoice({
      invoiceNumber: siNumber,
      salesOrderId: salesOrder._id,
      branchId: salesOrder.branchId,
      warehouse: salesOrder.warehouse,
      billingPerson: salesOrder.billingPerson,
      customer: salesOrder.customer,
      items: itemsToInvoice,
      sampleItems: samplesToInvoice,
      subtotal: Math.round(Number(invoiceSubtotal) || 0),
      totalDiscount: Math.round(Number(invoiceTotalDiscount) || 0),
      commonDiscount: Math.round(Number(invoiceCommonDiscount) || 0),
      totalTax: { total: Math.round(Number(invoiceTotalTax) || 0) },
      transportCharge: Math.round(Number(invoiceTransportCharge) || 0),
      grandTotal: grandTotalToUse,
      openingBalance: Math.round(Number(invoiceOpeningBalance) || 0),
      closingBalance: Math.round(Number(invoiceClosingBalance) || 0),
      financialYear: currentFY,
      invoiceDate: salesOrder.orderDate || salesOrder.createdAt,
      status: "FINALIZED"
    });
    await invoiceDoc.save();

    // Increment SI Counter
    siVoucher.counter += 1;
    await siVoucher.save();

    // 2. Reduce Stock
    const allItems = [...itemsToInvoice, ...samplesToInvoice];
    for (const item of allItems) {
      if (item.productId && item.qty > 0) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { totalQty: -item.qty } });
      }
    }

    // 3. Increase Customer Balance (Netted)
    if (salesOrder.customer?.customerId && grandTotalToUse > 0) {
      const customer = await Customer.findById(salesOrder.customer.customerId);
      if (customer) {
        let remainingCharge = grandTotalToUse;
        let currentDebit = customer.debit || 0;
        let currentCredit = customer.credit || 0;

        // Consume existing credit (advance) first
        if (currentCredit >= remainingCharge) {
          currentCredit -= remainingCharge;
          remainingCharge = 0;
        } else {
          remainingCharge -= currentCredit;
          currentCredit = 0;
          currentDebit += remainingCharge;
        }

        await Customer.findByIdAndUpdate(salesOrder.customer.customerId, {
          debit: currentDebit,
          credit: currentCredit,
          $inc: { closingBalance: grandTotalToUse, totalBalance: grandTotalToUse }
        });
      }
    }

    // 4. Record on SalesOrder
    const invoiceSnapshot = {
      version: (salesOrder.editHistory.length || 0) + 1,
      editType: 'INVOICED',
      items: allItems,
      grandTotal: grandTotalToUse,
      invoicedAt: new Date(),
      editedBy: req.user.username, // ✨ NEW
      invoiceNumber: siNumber
    };

    salesOrder.editHistory.push(invoiceSnapshot);
    salesOrder.lastInvoicedItems = allItems;
    salesOrder.invoiceItems = allItems;
    salesOrder.lastInvoicedGrandTotal = grandTotalToUse;
    salesOrder.lastInvoicedCustomerId = salesOrder.customer?.customerId;
    salesOrder.status = "INVOICED";
    salesOrder.salesInvoiceId = siNumber;
    salesOrder.recordType = "SALES INVOICE";
    salesOrder.invoiceGenerated = true;

    await salesOrder.save();

    // Log First-Time Invoice
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: salesOrder.branchId,
      action: isReInvoice ? "RE_INVOICE_SO" : "INVOICE_SO",
      description: `${isReInvoice ? 'Regenerated' : 'Finalized'} Invoice: ${siNumber} for PO: ${salesOrder.invoiceId}. Total: ₹${grandTotalToUse}. Items: ${allItems.slice(0, 3).map(i => i.productName || i.name).join(", ")}${allItems.length > 3 ? "..." : ""}`,
      targetId: salesOrder._id,
      targetModel: "SalesOrder",
    });

    res.json({
      success: true,
      message: `Sales Invoice ${siNumber} generated successfully.`,
      siNumber,
      invoiceId: invoiceDoc._id
    });

  } catch (error) {
    console.error("❌ Sales Invoice generation error:", error.message);
    res.status(500).json({ message: error.message || "Failed to generate sales invoice" });
  }
});

// CREATE NEW SALES ORDER
router.post("/", clearCachePrefix("/api/sales-orders"), async (req, res) => {
  try {
    const { customer, items, ...rest } = req.body;
    // ... implementation
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET single sales order by ID (for credit note modal) - MUST BE LAST ROUTE
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid sales order ID" });
    }

    const salesOrder = await SalesOrder.findById(id);

    if (!salesOrder) {
      return res.status(404).json({ success: false, message: "Sales order not found" });
    }

    res.json({ success: true, data: salesOrder });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch sales order" });
  }
});

/**
 * GET: All Unpaid Invoices for a specific Customer
 */
router.get("/unpaid/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;
    const unpaidOrders = await SalesOrder.find({
      "customer.customerId": customerId,
      status: "INVOICED",
      closingBalance: { $gt: 0 }
    }).sort({ createdAt: 1 }); // Oldest first (FIFO payment logic)

    res.json({ success: true, data: unpaidOrders });
  } catch (error) {
    console.error("Fetch Unpaid Orders Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✏️ UPDATE SALES ORDER (From EditBillModal)
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { items, sampleItems, grandTotal, subtotal, totalTax, totalDiscount, commonDiscount, extraExpenses, extraExpenseAmount, customer, transportCharge, transportGstPercent, transportGstAmount, roundOff } = req.body;

    const salesOrder = await SalesOrder.findById(id);
    if (!salesOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    const beforeState = {
      items: JSON.parse(JSON.stringify(salesOrder.items || [])),
      extraExpenses: JSON.parse(JSON.stringify(salesOrder.extraExpenses || [])),
      grandTotal: salesOrder.grandTotal,
      subtotal: salesOrder.subtotal,
      customerName: salesOrder.customer?.name,
    };

    // 🔄 CUSTOMER CHANGE - DELTA HANDLING ───────────────────────────
    let customerSwapped = false;
    let oldCustomerId = null;
    let oldCustomerObj = null;

    if (customer && customer.id && customer.id !== salesOrder.customer?.customerId?.toString()) {
      customerSwapped = true;
      oldCustomerId = salesOrder.customer.customerId;
      oldCustomerObj = await Customer.findById(oldCustomerId);
      const dbCustomer = await Customer.findById(customer.id);
      
      if (dbCustomer) {
        salesOrder.customer = {
          customerId: dbCustomer._id,
          name: dbCustomer.name,
          whatsapp: dbCustomer.whatsapp,
          address: dbCustomer.address,
          district: dbCustomer.district,
          state: dbCustomer.state,
          pincode: dbCustomer.pincode,
          gstin: dbCustomer.gstin,
          stateCode: dbCustomer.stateCode || "33",
        };
        
        // ✨ DRAFT MODE: We DO NOT update openingBalance or closingBalance yet.
        // These will be updated only when "Generate Invoice" is clicked.
      }
    }

    // ─── DRAFT UPDATE (NO FINANCIAL IMPACT) ───────────────────────────
    // We only update the document fields. Customer balance and Product stock 
    // will be updated ONLY when the user clicks "Generate Invoice" (Finalize).
    const newGrandTotal = Math.round(Number(grandTotal) || 0);
    const difference = newGrandTotal - (salesOrder.grandTotal || 0);

    // ─── Update standard fields ──────────────────────────────────────
    salesOrder.items = items || [];
    salesOrder.sampleItems = sampleItems || [];
    salesOrder.extraExpenses = (extraExpenses || []).map((exp) => ({
      expenseName: exp.expenseName,
      basePrice: Math.round(Number(exp.basePrice) || 0),
      gstPercent: Math.round(Number(exp.gstPercent) || 0),
      gstAmount: Math.round(Number(exp.gstAmount) || 0),
      totalPrice: Math.round(Number(exp.totalPrice) || 0),
    }));
    salesOrder.extraExpenseAmount = Math.round(Number(extraExpenseAmount) || 0);
    salesOrder.transportCharge = Math.round(Number(transportCharge) || 0);
    salesOrder.transportGstPercent = Math.round(Number(transportGstPercent) || 0);
    salesOrder.transportGstAmount = Math.round(Number(transportGstAmount) || 0);

    salesOrder.subtotal = Math.round(Number(subtotal) || 0);
    salesOrder.totalTax = Math.round(Number(totalTax) || 0);
    salesOrder.totalDiscount = Math.round(Number(totalDiscount) || 0);
    salesOrder.commonDiscount = Math.round(Number(commonDiscount) || 0);

    salesOrder.grandTotal = newGrandTotal;
    salesOrder.grandTotalWithMargin = newGrandTotal;
    salesOrder.roundOff = Number(roundOff) || 0;

    // Snapshot this version in history if it was already invoiced (Version tracking)
    if (salesOrder.invoiceGenerated || salesOrder.status === "INVOICED") {
      salesOrder.editHistory.push({
        version: (salesOrder.editHistory.length || 0) + 1,
        editType: 'PRE_INVOICE_EDIT',
        items: [...(items || []), ...(sampleItems || [])],
        subtotal: Math.round(Number(subtotal) || 0),
        totalTax: { total: Math.round(Number(totalTax) || 0) },
        grandTotal: newGrandTotal,
        editedAt: new Date(),
        editedBy: req.user.username, // ✨ NEW
        note: `Draft Edit (V${(salesOrder.editHistory.length || 0) + 1}) - Balance/Stock not yet affected.`
      });
      salesOrder.isReEdited = true;
    }

    // ✨ DRAFT MODE: We DO NOT update the Invoice document yet.
    // The Invoice document will be updated only when the user clicks "Finalize".
    // This keeps the Ledger (Balance) fixed at the OLD value until confirmed.

    await salesOrder.save();

    // 4. Create Audit Log
    try {
      await createAuditLog({
        userId: req.user.id,
        userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
        username: req.user.username,
        branchId: salesOrder.branchId,
        action: "UPDATE_SALES_ORDER",
        description: `Updated Sales Order: ${salesOrder.invoiceId}. Net Balance Delta: ₹${difference}`,
        targetId: salesOrder._id,
        targetModel: "SalesOrder",
        changes: { before: beforeState, after: { items: items || [], grandTotal: newGrandTotal, subtotal: subtotal } }
      });
    } catch (auditErr) {
      console.warn("⚠️ Audit log failed (non-blocking):", auditErr.message);
    }

    res.json({ success: true, message: "Sales order updated successfully", data: salesOrder });
  } catch (error) {
    console.error("Update Sales Order Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 📨 REQUEST RE-EDIT PERMISSION
router.patch("/:id/request-re-edit", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const staffName = req.user.username;

    const salesOrder = await SalesOrder.findById(id);
    if (!salesOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    if (!salesOrder.invoiceGenerated) {
      return res.status(400).json({ message: "Order is not invoiced yet. You can edit it directly." });
    }

    salesOrder.reEditRequestStatus = "PENDING";
    salesOrder.reEditRequestBy = staffName;
    salesOrder.reEditRequestAt = new Date();

    await salesOrder.save();

    // Log request
    await createAuditLog({
      userId: req.user.id,
      userModel: "BranchUser",
      username: req.user.username,
      branchId: salesOrder.branchId,
      action: "REQUEST_REEDIT",
      description: `Requested re-edit permission for Invoice: ${salesOrder.invoiceId}`,
      targetId: salesOrder._id,
      targetModel: "SalesOrder",
    });

    res.json({
      success: true,
      message: "Re-edit request submitted to admin",
      data: salesOrder,
    });
  } catch (err) {
    console.error("❌ Re-edit Request Error:", err.message);
    res.status(500).json({ message: "Failed to submit re-edit request" });
  }
});

// 📋 GET PENDING RE-EDIT REQUESTS FOR BRANCH
router.get("/re-edit-requests/branch/:branchId", async (req, res) => {
  try {
    const { branchId } = req.params;
    const requests = await SalesOrder.find({
      branchId,
      reEditRequestStatus: "PENDING",
    })
      .select("invoiceId customer reEditRequestBy reEditRequestAt grandTotal")
      .sort({ reEditRequestAt: -1 });

    res.json({ success: true, data: requests });
  } catch (err) {
    console.error("❌ Fetch Re-edit Requests Error:", err.message);
    res.status(500).json({ message: "Failed to fetch re-edit requests" });
  }
});

// ✅ APPROVE RE-EDIT REQUEST
router.patch("/:id/approve-re-edit", auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const salesOrder = await SalesOrder.findById(id).session(session);
    if (!salesOrder) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Order not found" });
    }

    if (salesOrder.salesInvoiceId) {
      const Invoice = mongoose.model("Invoice");
      const Product = mongoose.model("Product");
      const Customer = mongoose.model("Customer");

      const invoice = await Invoice.findOne({ invoiceNumber: salesOrder.salesInvoiceId }).session(session);

      if (invoice) {
        // REVERT STOCK
        for (const item of invoice.items) {
          await Product.findByIdAndUpdate(item.productId, { $inc: { totalQty: item.qty || 0 } }).session(session);
        }

        // REVERT CUSTOMER BALANCE
        if (invoice.customer?.customerId && invoice.grandTotal > 0) {
          await Customer.findByIdAndUpdate(invoice.customer.customerId, {
            $inc: { debit: -invoice.grandTotal, closingBalance: -invoice.grandTotal }
          }).session(session);
        }

        // DELETE INVOICE
        await Invoice.findByIdAndDelete(invoice._id).session(session);
      }
    }

    salesOrder.status = "PENDING";
    salesOrder.invoiceGenerated = false;
    salesOrder.salesInvoiceId = null;
    salesOrder.reEditRequestStatus = "APPROVED";

    await salesOrder.save({ session });

    // Log approval
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: salesOrder.branchId,
      action: "APPROVE_REEDIT",
      description: `Approved re-edit for Invoice: ${salesOrder.invoiceId}. Original invoice deleted and effects reverted.`,
      targetId: salesOrder._id,
      targetModel: "SalesOrder",
    });

    await session.commitTransaction();
    res.json({ success: true, message: "Re-edit request approved. Invoice deleted and status reset." });
  } catch (err) {
    await session.abortTransaction();
    console.error("Re-edit Approval Error:", err);
    res.status(500).json({ message: "Failed to approve request" });
  } finally {
    session.endSession();
  }
});

// ❌ REJECT RE-EDIT REQUEST
router.patch("/:id/reject-re-edit", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const salesOrder = await SalesOrder.findById(id);
    if (!salesOrder) return res.status(404).json({ message: "Order not found" });

    salesOrder.reEditRequestStatus = "REJECTED";
    await salesOrder.save();

    res.json({ success: true, message: "Re-edit request rejected" });
  } catch (err) {
    res.status(500).json({ message: "Failed to reject request" });
  }
});

// 📨 AUTO-APPROVING CANCEL (No Admin required as per user request)
router.patch("/:id/request-cancel", auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const staffName = req.user.username;

    const salesOrder = await SalesOrder.findById(id).session(session);
    if (!salesOrder) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Sales order not found" });
    }

    if (salesOrder.salesInvoiceId) {
      const Invoice = mongoose.model("Invoice");
      const Product = mongoose.model("Product");
      const Customer = mongoose.model("Customer");

      const invoice = await Invoice.findOne({ invoiceNumber: salesOrder.salesInvoiceId }).session(session);

      if (invoice) {
        // 1. REVERT STOCK
        for (const item of invoice.items) {
          if (item.productId) {
            await Product.findByIdAndUpdate(item.productId, { $inc: { totalQty: item.qty || 0 } }).session(session);
          }
        }

        // 2. REVERT CUSTOMER BALANCE
        if (invoice.customer?.customerId && invoice.grandTotal > 0) {
          await Customer.findByIdAndUpdate(invoice.customer.customerId, {
            $inc: { debit: -invoice.grandTotal, closingBalance: -invoice.grandTotal }
          }).session(session);
        }

        // 3. DELETE INVOICE DOCUMENT
        await Invoice.findByIdAndDelete(invoice._id).session(session);
      }
    }

    // 4. UPDATE SALES ORDER
    salesOrder.status = "CANCELLED";
    salesOrder.invoiceGenerated = false;
    salesOrder.salesInvoiceId = null;
    salesOrder.cancelRequestStatus = "APPROVED";
    salesOrder.cancelRequestBy = staffName;
    salesOrder.cancelRequestAt = new Date();

    await salesOrder.save({ session });

    await createAuditLog({
      userId: req.user.id,
      userModel: "BranchUser",
      username: req.user.username,
      branchId: salesOrder.branchId,
      action: "AUTO_CANCEL_SI",
      description: `Directly cancelled Invoice: ${salesOrder.invoiceId}. Stock and balance reverted.`,
      targetId: salesOrder._id,
      targetModel: "SalesOrder",
    });

    await session.commitTransaction();
    res.json({ success: true, message: "Invoice cancelled successfully. Records reverted.", data: salesOrder });
  } catch (err) {
    await session.abortTransaction();
    console.error("Auto-Cancel Error:", err);
    res.status(500).json({ message: "Failed to cancel invoice: " + err.message });
  } finally {
    session.endSession();
  }
});

// ✅ APPROVE CANCEL REQUEST
router.patch("/:id/approve-cancel", auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const salesOrder = await SalesOrder.findById(id).session(session);
    if (!salesOrder) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Order not found" });
    }

    if (salesOrder.salesInvoiceId) {
      const Invoice = mongoose.model("Invoice");
      const Product = mongoose.model("Product");
      const Customer = mongoose.model("Customer");

      const invoice = await Invoice.findOne({ invoiceNumber: salesOrder.salesInvoiceId }).session(session);

      if (invoice) {
        // REVERT STOCK
        for (const item of invoice.items) {
          await Product.findByIdAndUpdate(item.productId, { $inc: { totalQty: item.qty || 0 } }).session(session);
        }

        // REVERT CUSTOMER BALANCE
        if (invoice.customer?.customerId && invoice.grandTotal > 0) {
          await Customer.findByIdAndUpdate(invoice.customer.customerId, {
            $inc: { debit: -invoice.grandTotal, closingBalance: -invoice.grandTotal }
          }).session(session);
        }

        // DELETE INVOICE
        await Invoice.findByIdAndDelete(invoice._id).session(session);
      }
    }

    salesOrder.status = "CANCELLED";
    salesOrder.invoiceGenerated = false;
    salesOrder.salesInvoiceId = null;
    salesOrder.cancelRequestStatus = "APPROVED";

    await salesOrder.save({ session });

    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: salesOrder.branchId,
      action: "APPROVE_CANCEL",
      description: `Approved cancellation for Invoice: ${salesOrder.invoiceId}. Invoice deleted and effects reverted.`,
      targetId: salesOrder._id,
      targetModel: "SalesOrder",
    });

    await session.commitTransaction();
    res.json({ success: true, message: "Cancellation request approved. Invoice deleted." });
  } catch (err) {
    await session.abortTransaction();
    console.error("Cancel Approval Error:", err);
    res.status(500).json({ message: "Failed to approve request" });
  } finally {
    session.endSession();
  }
});

// ❌ REJECT CANCEL REQUEST
router.patch("/:id/reject-cancel", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const salesOrder = await SalesOrder.findById(id);
    if (!salesOrder) return res.status(404).json({ message: "Order not found" });

    salesOrder.cancelRequestStatus = "REJECTED";
    await salesOrder.save();

    res.json({ success: true, message: "Cancellation request rejected" });
  } catch (err) {
    res.status(500).json({ message: "Failed to reject request" });
  }
});

// DELETE - Cancel and remove Sales Order (with sequence restoration)
router.delete("/:id/cancel", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.user.username;

    const salesOrder = await SalesOrder.findById(id);
    if (!salesOrder) {
      return res.status(404).json({ success: false, message: "Sales order not found" });
    }

    const { invoiceId, branchId, voucherType, financialYear, invoiceGenerated } = salesOrder;

    const voucher = await VoucherType.findOne({
      branchId,
      name: voucherType.toLowerCase(),
      orderType: "SO",
      financialYear
    });

    if (voucher) {
      const parts = invoiceId.split("/");
      const currentCounterInInvoice = parseInt(parts[1], 10);
      if (voucher.counter === currentCounterInInvoice + 1) {
        voucher.counter -= 1;
        await voucher.save();
      }
    }

    if (invoiceGenerated) {
      const Invoice = mongoose.model("Invoice");
      await Invoice.deleteOne({ salesOrderId: id });
    }

    await SalesOrder.findByIdAndDelete(id);

    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: username,
      branchId,
      action: "CANCEL_BILL",
      description: `Cancelled and deleted Bill: ${invoiceId}. Reverted balance and commissions.`,
      targetId: id,
      targetModel: "SalesOrder",
    });

    res.status(200).json({
      success: true,
      message: `Bill ${invoiceId} cancelled successfully. Financial impacts reverted.`,
    });

  } catch (error) {
    console.error("❌ Bill Cancellation Error:", error);
    res.status(500).json({ success: false, message: "Failed to cancel bill", error: error.message });
  }
});

export default router;
