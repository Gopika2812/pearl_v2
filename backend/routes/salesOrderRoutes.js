import express from "express";
import mongoose from "mongoose";
import Commission from "../models/Commission.js";
import CommissionRule from "../models/CommissionRule.js";
import Customer from "../models/Customer.js";
import DeliveryMan from "../models/DeliveryMan.js";
import SalesMan from "../models/SalesMan.js";
import SalesOrder from "../models/SalesOrder.js";
import SalesOwner from "../models/SalesOwner.js";
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
    const closingBalance = openingBalance + Number(grandTotalWithMargin || grandTotal);


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

    // 💰 CREATE COMMISSION RECORDS (Using Commission Rules)
    try {
      const orderValue = grandTotalWithMargin || grandTotal;
      
      // Get sales personnel data
      const salesOwnerDoc = salesOwner ? await SalesOwner.findById(salesOwner) : null;
      const salesManDoc = salesMan ? await SalesMan.findById(salesMan) : null;
      const deliveryManDoc = deliveryMan ? await DeliveryMan.findById(deliveryMan) : null;

      // Function to get applicable commission for a person based on role type
      const getCommission = async (personId, roleType) => {
        if (!personId) return { percentage: 0, amount: 0 };
        
        // Find applicable commission rule (highest minimum order value that doesn't exceed order value)
        const rule = await CommissionRule.findOne({
          personId: personId,
          roleType: roleType,
          minimumOrderValue: { $lte: orderValue },
          isActive: true,
        }).sort({ minimumOrderValue: -1 });
        
        if (!rule) return { percentage: 0, amount: 0 };
        
        const commissionAmount = (orderValue * rule.commissionPercentage) / 100;
        return { percentage: rule.commissionPercentage, amount: commissionAmount };
      };

      // Get applicable commissions for all three roles
      const soCommission = await getCommission(salesOwner, "SalesOwner");
      const smCommission = await getCommission(salesMan, "SalesMan");
      const dmCommission = await getCommission(deliveryMan, "DeliveryMan");

      const commissionData = {
        salesOrderId: salesOrder._id,
        orderValue: orderValue,
        invoiceId: invoiceId,

        // Sales Owner
        salesOwnerId: salesOwnerDoc?._id,
        salesOwnerName: salesOwnerDoc?.name,
        salesOwnerCommissionPercentage: soCommission.percentage,
        salesOwnerCommissionAmount: soCommission.amount,

        // Sales Man
        salesManId: salesManDoc?._id,
        salesManName: salesManDoc?.name,
        salesManCommissionPercentage: smCommission.percentage,
        salesManCommissionAmount: smCommission.amount,

        // Delivery Man
        deliveryManId: deliveryManDoc?._id,
        deliveryManName: deliveryManDoc?.name,
        deliveryManCommissionPercentage: dmCommission.percentage,
        deliveryManCommissionAmount: dmCommission.amount,
      };

      commissionData.totalCommission =
        commissionData.salesOwnerCommissionAmount +
        commissionData.salesManCommissionAmount +
        commissionData.deliveryManCommissionAmount;

      const commission = new Commission(commissionData);
      await commission.save();

      console.log("✅ Commission record created:", commission._id);
    } catch (commissionError) {
      console.error("⚠️ Commission creation failed:", commissionError.message);
    }

    // ✅ UPDATE CUSTOMER BALANCE (HERE)
    await Customer.findByIdAndUpdate(customer.id, {
      totalBalance: closingBalance,
      closingBalance: closingBalance,
    });

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

    // 🔄 REVERT CUSTOMER CLOSING BALANCE
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      const customer = await Customer.findById(customerId);
      if (customer) {
        const revertedBalance = customer.closingBalance - orderValue;
        await Customer.findByIdAndUpdate(customerId, {
          closingBalance: revertedBalance,
          totalBalance: revertedBalance,
        });
        console.log(`✅ Customer balance reverted from ₹${customer.closingBalance} to ₹${revertedBalance}`);
      }
    } else {
      console.warn("⚠️ No valid customer ID found in sales order");
    }

    // � REVERT COMMISSION AMOUNTS FROM SALES PERSONNEL
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

    // 🗑️ DELETE ASSOCIATED COMMISSION RECORD
    await Commission.deleteOne({ salesOrderId: req.params.id });
    console.log("✅ Commission record deleted");

    // 🗑️ DELETE SALES ORDER
    await SalesOrder.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Sales order deleted. Customer balance and all commissions reverted.",
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
