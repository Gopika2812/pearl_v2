import express from "express";
import mongoose from "mongoose";
import Commission from "../models/Commission.js";
import Customer from "../models/Customer.js";
import SalesOrder from "../models/SalesOrder.js";
import VoucherType from "../models/VoucherType.js";
import { createAuditLog } from "../utils/logUtil.js";
import { getFinancialYear } from "../utils/financialYear.js";
import GLService from "../utils/glService.js";
import Product from "../models/Product.js";
import ProductGroup from "../models/ProductGroup.js";



const router = express.Router();

// GET all sales orders (for OthersSummary)
router.get("/", async (req, res) => {
  try {
    const { branchId } = req.query;
    const query = {};
    
    // Filter by branchId if provided
    if (branchId) {
      query.branchId = branchId;
    }

    if (req.query.isClaim !== undefined) {
      query.isClaim = req.query.isClaim === "true";
    }
    
    const salesOrders = await SalesOrder.find(query)
      .select("invoiceId customer items sampleItems grandTotalWithMargin grandTotal closingBalance salesOwner createdAt date invoiceGenerated warehouse billingPerson voucherType reEditRequestStatus reEditRequestBy reEditRequestAt isReEdited")
      .populate('salesOwner', 'name')
      .sort({ createdAt: -1 });
    
    res.json(salesOrders);
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ message: "Failed to fetch sales orders" });
  }
});

// GET selling history (for Product Records)
router.get("/history", async (req, res) => {
  try {
    const { branchId, fromDate, toDate, productGroupId, productId } = req.query;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const matchQuery = {
      branchId: new mongoose.Types.ObjectId(branchId),
    };

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
      { $sort: { date: -1 } }
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

router.post("/", async (req, res) => {
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
      isClaim,
    } = req.body;

    console.log("📤 POST /sales-orders received");
    
    if (!voucherType || !items?.length || !branchId) {
      console.error("❌ Missing required fields:", { voucherType, itemsLength: items?.length, branchId });
      return res.status(400).json({ message: "Invalid sales order data - voucherType, items, and branchId are required" });
    }

    const financialYear = getFinancialYear();
    console.log("📅 Financial year:", financialYear);

    // 🔑 Fetch voucher
    const voucher = await VoucherType.findOne({
      branchId,
      name: voucherType.toLowerCase(),
      orderType: "SO",
    });

    if (!voucher) {
      return res.status(404).json({ message: "Sales voucher not found" });
    }

    // 💳 CREDIT LIMIT CHECK
    const customerDoc = await Customer.findById(customer.id || customer.customerId || customer._id);
    if (customerDoc) {
      const netBalance = (customerDoc.debit || 0) - (customerDoc.credit || 0);
      const orderTotal = grandTotalWithMargin || grandTotal || 0;
      const totalAfterOrder = netBalance + orderTotal;
      
      if (totalAfterOrder > customerDoc.creditLimit && !customerDoc.isCreditBypassed) {
        return res.status(403).json({ 
          success: false, 
          isCreditLimitExceeded: true,
          message: `Credit Limit Exceeded! Customer net balance (₹${netBalance.toLocaleString()}) plus this order (₹${orderTotal.toLocaleString()}) exceeds the limit of ₹${customerDoc.creditLimit.toLocaleString()}. Admin permission required to proceed.` 
        });
      }
    }
    
    console.log("✅ Voucher found:", { prefix: voucher.prefix, counter: voucher.counter });

    // 🔁 Reset counter if FY changed
    if (voucher.financialYear !== financialYear) {
      voucher.counter = 1;
      voucher.financialYear = financialYear;
    }

    const invoiceId = `${voucher.prefix}/${String(voucher.counter).padStart(
      3,
      "0"
    )}/${financialYear}`;
    
    console.log("📝 Generated invoiceId:", invoiceId);

    // ✅ FETCH CUSTOMER INSIDE ROUTE
    const dbCustomer = await Customer.findById(customer.id);

    if (!dbCustomer) {
      console.error("❌ Customer not found:", customer.id);
      return res.status(404).json({ message: "Customer not found" });
    }
    
    console.log("✅ Customer found:", dbCustomer.name);

    const openingBalance = dbCustomer.closingBalance || dbCustomer.totalBalance || 0;
    // ✅ FIXED: Closing balance = opening balance + grandTotal (SO increases customer's AR)
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
        pincode: customer.pincode,
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
        expenseId: exp.expenseId,
        expenseName: exp.expenseName,
        basePrice: Math.round(Number(exp.basePrice) || 0),
        days: exp.days,
        totalPrice: Math.round(Number(exp.totalPrice) || 0),
      })),
      extraExpenseAmount: Math.round(Number(extraExpenseAmount) || 0),
      ewayEnabled,
      ewayDetails,
      salesOwner,
      salesMan,
      deliveryMan,
      financialYear,
      isClaim: isClaim || false,
    });

    console.log("💾 About to save SalesOrder...");
    await salesOrder.save();
    console.log("✅ SalesOrder saved successfully");

    // ⚠️ INVENTORY REDUCTION REMOVED - Only reduce when invoice is confirmed
    // Inventory will be reduced when sales invoice is generated, not at order stage

    // ⚠️ DO NOT UPDATE CUSTOMER DEBIT/BALANCE HERE
    // Customer debit will be updated ONLY when invoice is generated
    console.log("⏳ Customer debit will be updated when invoice is generated");

    // ✅ POST JOURNAL ENTRY to GL
    try {
      const journalEntry = await GLService.postSalesOrderJE(salesOrder);
      console.log(`✅ GL Entry posted: ${journalEntry.jeId}`);
    } catch (glError) {
      console.warn("⚠️ GL posting failed (non-blocking):", glError.message);
      // Don't fail the SO creation if GL posting fails
    }

    // ✅ Increment voucher counter
    voucher.counter += 1;
    await voucher.save();
    // Log Sales Order creation
    await createAuditLog({
      userId: req.body.userId || salesOrder.billingPerson || salesOrder.salesOwner, // Fallback if no explicit userId
      username: salesOrder.billingPerson || "System", 
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
    console.error("Stack:", error.stack);
    res.status(500).json({ message: error.message || "Server error" });
  }
});

router.get("/recent", async (req, res) => {
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

// DELETE sales order and revert customer balance
router.delete("/:id", async (req, res) => {
  try {
    const salesOrder = await SalesOrder.findById(req.params.id);
    
    if (!salesOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Sales order not found" });
    }

    const orderValue = salesOrder.grandTotalWithMargin || salesOrder.grandTotal || 0;
    const customerId = salesOrder.customer?.customerId; // ✅ GET CUSTOMER ID CORRECTLY

    // 🔄 REVERT CUSTOMER CLOSING BALANCE (ONLY IF INVOICE WAS GENERATED)
    if (salesOrder.invoiceGenerated && customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      const customer = await Customer.findById(customerId);
      if (customer) {
        const revertedBalance = customer.closingBalance - orderValue;
        await Customer.findByIdAndUpdate(customerId, {
          closingBalance: revertedBalance,
          totalBalance: revertedBalance,
        });
        console.log(`✅ Customer balance reverted from ₹${customer.closingBalance} to ₹${revertedBalance}`);
      }
    } else if (!salesOrder.invoiceGenerated) {
      console.log("ℹ️ Invoice was not generated, so no balance to revert");
    }

    // 🗑️ REVERT COMMISSIONS (ONLY IF INVOICE WAS GENERATED)
    if (salesOrder.invoiceGenerated) {
      const commission = await Commission.findOne({ salesOrderId: req.params.id });
      if (commission) {
        // Revert Sales Owner Commission
        if (commission.salesOwnerId && commission.salesOwnerCommissionAmount > 0) {
          await SalesOwner.findByIdAndUpdate(commission.salesOwnerId, {
            $inc: { commissionAmount: -commission.salesOwnerCommissionAmount }
          });
          console.log(`✅ Sales Owner commission reverted: -₹${commission.salesOwnerCommissionAmount}`);
        }

        // Revert Sales Man Commission
        if (commission.salesManId && commission.salesManCommissionAmount > 0) {
          await SalesMan.findByIdAndUpdate(commission.salesManId, {
            $inc: { commissionAmount: -commission.salesManCommissionAmount }
          });
          console.log(`✅ Sales Man commission reverted: -₹${commission.salesManCommissionAmount}`);
        }

        // Revert Delivery Man Commission
        if (commission.deliveryManId && commission.deliveryManCommissionAmount > 0) {
          await DeliveryMan.findByIdAndUpdate(commission.deliveryManId, {
            $inc: { commissionAmount: -commission.deliveryManCommissionAmount }
          });
          console.log(`✅ Delivery Man commission reverted: -₹${commission.deliveryManCommissionAmount}`);
        }
      }
    }

    // 🗑️ DELETE ASSOCIATED COMMISSION RECORD (if any)
    await Commission.deleteOne({ salesOrderId: req.params.id });

    // Log Sales Order deletion
    await createAuditLog({
      userId: req.query.userId || "System", // Ideally passed from frontend
      username: req.query.username || "System",
      branchId: salesOrder.branchId,
      action: "DELETE_SO",
      description: `Deleted Sales Order: ${salesOrder.invoiceId} for ${salesOrder.customer.name}`,
      targetId: salesOrder._id,
      targetModel: "SalesOrder",
    });

    // 🗑️ DELETE SALES ORDER
    await SalesOrder.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Sales order deleted. Customer balance reverted if invoice was generated.",
    });
  } catch (error) {
    console.error("Delete error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete sales order" });
  }
});

// 🎯 GENERATE INVOICE FROM SALES ORDER
router.patch("/:id/generate-invoice", async (req, res) => {
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
      invoiceOpeningBalance,
      invoiceClosingBalance,
    } = req.body;

    console.log("📋 Generating invoice for SO:", id);

    // 🔍 FIND SALES ORDER
    const salesOrder = await SalesOrder.findById(id);
    if (!salesOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    if (salesOrder.invoiceGenerated && salesOrder.reEditRequestStatus !== "APPROVED") {
      return res.status(400).json({ message: "Invoice already generated for this order. Request re-edit permission from admin to modify." });
    }

    console.log("✅ SO found:", salesOrder.invoiceId);

    // 📝 UPDATE WITH INVOICE DETAILS
    salesOrder.invoiceItems = invoiceItems || [];
    salesOrder.invoiceSampleItems = invoiceSampleItems || [];
    salesOrder.invoiceSubtotal = Math.round(Number(invoiceSubtotal) || 0);
    salesOrder.invoiceTotalDiscount = Math.round(Number(invoiceTotalDiscount) || 0);
    salesOrder.invoiceTotalTax = Math.round(Number(invoiceTotalTax) || 0);
    salesOrder.invoiceTransportCharge = Math.round(Number(invoiceTransportCharge) || 0);
    salesOrder.invoiceGrandTotal = Math.round(Number(invoiceGrandTotal) || 0);
    salesOrder.invoiceOpeningBalance = Math.round(Number(invoiceOpeningBalance) || 0);
    salesOrder.invoiceClosingBalance = Math.round(Number(invoiceClosingBalance) || 0);

    // 🔄 CONVERT TO SALES INVOICE
    salesOrder.recordType = "SALES INVOICE";
    salesOrder.invoiceGenerated = true;

    // If this was a re-edit, mark it and reset request status
    if (salesOrder.reEditRequestStatus === "APPROVED") {
      salesOrder.isReEdited = true;
      salesOrder.reEditRequestStatus = "NONE";
    }

    await salesOrder.save();
    console.log("✅ Invoice generated:", salesOrder.invoiceId);

    // 💳 RESET CREDIT BYPASS FOR CUSTOMER
    if (salesOrder.customer?.customerId) {
      await Customer.findByIdAndUpdate(salesOrder.customer.customerId, {
        isCreditBypassed: false,
        creditLimitRequestStatus: "NONE"
      });
      console.log("🔄 Credit bypass reset for customer");
    }

    // 🏦 POST INVOICE JOURNAL ENTRY to GL
    try {
      const journalEntry = await GLService.postSalesInvoiceJE(salesOrder);
      console.log(`✅ Invoice GL Entry posted: ${journalEntry.jeId}`);
    } catch (glError) {
      console.warn("⚠️ Invoice GL posting failed (non-blocking):", glError.message);
    }

    res.json({
      success: true,
      message: "Invoice generated successfully",
      invoiceId: salesOrder.invoiceId,
      data: salesOrder,
    });
  } catch (error) {
    console.error("❌ Invoice generation error:", error.message);
    res.status(500).json({ message: error.message || "Failed to generate invoice" });
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

// ✏️ UPDATE SALES ORDER (From EditBillModal)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { items, sampleItems, grandTotal, subtotal, totalTax, totalDiscount } = req.body;

    // 1. Find the order first
    const salesOrder = await SalesOrder.findById(id);
    if (!salesOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    if (salesOrder.invoiceGenerated && salesOrder.reEditRequestStatus !== "APPROVED") {
      return res.status(400).json({ message: "Cannot edit an order that has already been invoiced without admin approval" });
    }

    // 2. Identify the difference in grandTotal so we adjust Customer Balance smoothly
    // EditBillModal strictly passes rounded grandTotals now but we'll safeguard it:
    const newGrandTotal = Math.round(Number(grandTotal) || 0);
    const difference = newGrandTotal - (salesOrder.grandTotal || 0);

    // Capture 'before' state for audit log
    const beforeState = {
      items: JSON.parse(JSON.stringify(salesOrder.items || [])),
      grandTotal: salesOrder.grandTotal,
      subtotal: salesOrder.subtotal,
    };

    // 3. Update the fields
    salesOrder.items = items || [];
    salesOrder.sampleItems = sampleItems || [];
    salesOrder.subtotal = Math.round(Number(subtotal) || 0);
    salesOrder.totalTax = Math.round(Number(totalTax) || 0);
    salesOrder.totalDiscount = Math.round(Number(totalDiscount) || 0);
    
    // Set Grand Total variables
    salesOrder.grandTotal = newGrandTotal;
    salesOrder.grandTotalWithMargin = newGrandTotal; // Usually margin relies on custom user input, syncing it as backup.
    
    // Reset re-edit status after successful update
    if (salesOrder.reEditRequestStatus === "APPROVED") {
      salesOrder.reEditRequestStatus = "NONE";
      salesOrder.isReEdited = true; // Mark as re-edited for invoice labeling
    }

    // Also shift closing balance for the exact SO receipt
    salesOrder.closingBalance = (salesOrder.closingBalance || 0) + difference;

    await salesOrder.save();

    // Log Sales Order update
    await createAuditLog({
      userId: req.body.updatedBy || salesOrder.billingPerson || "System",
      username: req.body.updatedByUsername || salesOrder.billingPerson || "System",
      branchId: salesOrder.branchId,
      action: "UPDATE_SO",
      description: `Updated Sales Order: ${salesOrder.invoiceId}. Total changed from ₹${beforeState.grandTotal} to ₹${salesOrder.grandTotal}`,
      targetId: salesOrder._id,
      targetModel: "SalesOrder",
      changes: {
        before: beforeState,
        after: {
          items: salesOrder.items,
          grandTotal: salesOrder.grandTotal,
          subtotal: salesOrder.subtotal,
        }
      }
    });

    res.json({
      success: true,
      message: "Sales order updated successfully",
      data: salesOrder
    });
  } catch (err) {
    console.error("❌ PUT Sales Order Error:", err.message);
    res.status(500).json({ message: "Failed to update Sales Order" });
  }
});

// 📨 REQUEST RE-EDIT PERMISSION
router.patch("/:id/request-re-edit", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, requestedBy } = req.body;
    const staffName = username || requestedBy || "Unknown Staff";

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
      userId: req.body.userId || "System",
      username: username || "System",
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
router.patch("/:id/approve-re-edit", async (req, res) => {
  try {
    const { id } = req.params;
    const salesOrder = await SalesOrder.findById(id);
    if (!salesOrder) return res.status(404).json({ message: "Order not found" });

    salesOrder.reEditRequestStatus = "APPROVED";
    await salesOrder.save();

    res.json({ success: true, message: "Re-edit request approved" });
  } catch (err) {
    res.status(500).json({ message: "Failed to approve request" });
  }
});

// ❌ REJECT RE-EDIT REQUEST
router.patch("/:id/reject-re-edit", async (req, res) => {
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

// DELETE - Cancel and remove Sales Order (with sequence restoration)
router.delete("/:id/cancel", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, username } = req.body; // For audit logging

    console.log(`🗑️ Attempting to cancel Sales Order: ${id}`);

    const salesOrder = await SalesOrder.findById(id);
    if (!salesOrder) {
      return res.status(404).json({ success: false, message: "Sales order not found" });
    }

    const { invoiceId, branchId, voucherType, financialYear, invoiceGenerated } = salesOrder;

    // 1️⃣ CHECK SEQUENCE RESTORATION
    // Logic: If this was the LATEST bill for this voucher type, we can decrement the counter
    const voucher = await VoucherType.findOne({
      branchId,
      name: voucherType.toLowerCase(),
      orderType: "SO",
      financialYear
    });

    if (voucher) {
      // Extract numeric part of invoiceId (e.g., "SO/005/2025-26" -> 5)
      const parts = invoiceId.split("/");
      const currentCounterInInvoice = parseInt(parts[1], 10);

      // If the current sequence is exactly currentCounterInInvoice + 1, it means this was the last one
      if (voucher.counter === currentCounterInInvoice + 1) {
        voucher.counter -= 1;
        await voucher.save();
        console.log(`✅ Voucher sequence restored: ${invoiceId} was the latest. Counter back to ${voucher.counter}`);
      } else {
        console.log(`ℹ️ Voucher sequence NOT restored: ${invoiceId} (Num: ${currentCounterInInvoice}) was not the latest (Voucher Counter: ${voucher.counter})`);
      }
    }

    // 2️⃣ DELETE ASSOCIATED INVOICE (if any)
    if (invoiceGenerated) {
      const Invoice = mongoose.model("Invoice");
      await Invoice.deleteOne({ salesOrderId: id });
      console.log(`✅ Associated invoice for ${invoiceId} deleted`);
    }

    // 3️⃣ DELETE SALES ORDER (triggers hooks for balance reversion)
    const deletedOrder = await SalesOrder.findByIdAndDelete(id);
    
    // 4️⃣ AUDIT LOG
    await createAuditLog({
      userId: userId || "System",
      username: username || "System",
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
