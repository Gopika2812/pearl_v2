import express from "express";
import mongoose from "mongoose";
import Commission from "../models/Commission.js";
import Customer from "../models/Customer.js";
import SalesOrder from "../models/SalesOrder.js";
import VoucherType from "../models/VoucherType.js";
import { getFinancialYear } from "../utils/financialYear.js";


const router = express.Router();

// GET all sales orders (for OthersSummary)
router.get("/", async (req, res) => {
  try {
    const salesOrders = await SalesOrder.find()
      .select("invoiceId customer grandTotalWithMargin grandTotal closingBalance salesOwner createdAt")
      .populate('salesOwner', 'name')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: salesOrders });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch sales orders" });
  }
});

// GET sales order preview (for new orders)
router.get("/preview/:voucherType", async (req, res) => {
  try {
    const { voucherType } = req.params;
    const financialYear = getFinancialYear();

    const voucher = await VoucherType.findOne({
      name: voucherType.toLowerCase(),
      orderType: "SO",
    });

    if (!voucher) {
      return res.status(404).json({ message: "Sales voucher not found" });
    }

    // reset counter for preview if FY changed
    const counter =
      voucher.financialYear === financialYear ? voucher.counter : 1;

    const invoiceId = `${voucher.prefix}/${String(counter).padStart(
      3,
      "0"
    )}/${financialYear}`;

    res.json({ invoiceId });
  } catch (err) {
    console.error("Preview Error:", err);
    res.status(500).json({ message: "Failed to generate preview" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      voucherType,
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
    } = req.body;

    if (!voucherType || !items?.length) {
      return res.status(400).json({ message: "Invalid sales order data" });
    }

    const financialYear = getFinancialYear();

    // 🔑 Fetch voucher
    const voucher = await VoucherType.findOne({
      name: voucherType.toLowerCase(),
      orderType: "SO",
    });

    if (!voucher) {
      return res.status(404).json({ message: "Sales voucher not found" });
    }

    // 🔁 Reset counter if FY changed
    if (voucher.financialYear !== financialYear) {
      voucher.counter = 1;
      voucher.financialYear = financialYear;
    }

    const invoiceId = `${voucher.prefix}/${String(voucher.counter).padStart(
      3,
      "0"
    )}/${financialYear}`;

    // ✅ FETCH CUSTOMER INSIDE ROUTE
    const dbCustomer = await Customer.findById(customer.id);

    if (!dbCustomer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const openingBalance = dbCustomer.closingBalance || dbCustomer.totalBalance || 0;
    // Closing balance will be updated after invoice generation, not during creation
    const closingBalance = openingBalance;


    // 🧾 Save Sales Order
    const salesOrder = new SalesOrder({
      invoiceId,
      voucherType,
      orderType: "SO",

      customer: {
        customerId: customer.id,
        name: customer.name,
        whatsapp: customer.whatsapp,
        address: customer.address,
        district: customer.district,
        state: customer.state,
        pincode: customer.pincode,
      },

      openingBalance,
      closingBalance,

      warehouse,
      billingPerson,
      agent,
      items,
      sampleItems: sampleItems || [],
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
      financialYear,
    });


    await salesOrder.save();

    // ✅ Increment voucher counter
    voucher.counter += 1;
    await voucher.save();

    res.status(201).json({
      message: "Sales order created successfully",
      invoiceId,
      data: salesOrder,
    });
  } catch (error) {
    console.error("Sales Order Save Error:", error);
    res.status(500).json({ message: "Server error" });
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
