import express from "express";
import mongoose from "mongoose";
import Commission from "../models/Commission.js";
import Customer from "../models/Customer.js";
import SalesOrder from "../models/SalesOrder.js";
import VoucherType from "../models/VoucherType.js";
import { getFinancialYear } from "../utils/financialYear.js";
import GLService from "../utils/glService.js";


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
    
    const salesOrders = await SalesOrder.find(query)
      .select("invoiceId customer items sampleItems grandTotalWithMargin grandTotal closingBalance salesOwner createdAt invoiceGenerated warehouse billingPerson")
      .populate('salesOwner', 'name')
      .sort({ createdAt: -1 });
    
    res.json(salesOrders);
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ message: "Failed to fetch sales orders" });
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
      console.error("❌ Voucher not found:", { branchId, voucherType, orderType: "SO" });
      return res.status(404).json({ message: "Sales voucher not found" });
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

    if (salesOrder.invoiceGenerated) {
      return res.status(400).json({ message: "Invoice already generated for this order" });
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

    await salesOrder.save();
    console.log("✅ Invoice generated:", salesOrder.invoiceId);

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

export default router;
