import mongoose from "mongoose";
import SalesOrder from "../../../models/SalesOrder.js";
import Product from "../../../models/Product.js";
import Customer from "../../../models/Customer.js";
import CRMOrderSession from "../models/CRMOrderSession.js";
import CRMSharedLink from "../models/CRMSharedLink.js";
import CRMNote from "../models/CRMNote.js";
import VoucherType from "../../../models/VoucherType.js";
import { getFinancialYear } from "../../../utils/financialYear.js";
import crypto from "crypto";
import CRMTask from "../models/CRMTask.js";

export const getFrequentCustomers = async (req, res) => {
  try {
    const { branchId } = req.query;
    if (!branchId) return res.status(400).json({ message: "branchId is required" });

    const frequent = await SalesOrder.aggregate([
      { $match: { branchId: new mongoose.Types.ObjectId(branchId) } },
      { $group: { 
          _id: "$customer.customerId", 
          orderCount: { $sum: 1 }, 
          name: { $first: "$customer.name" },
          whatsapp: { $first: "$customer.whatsapp" }
      } },
      { $sort: { orderCount: -1 } },
      { $limit: 10 }
    ]);

    res.json(frequent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRecommendedProducts = async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const recommended = await SalesOrder.aggregate([
      { $match: { "customer.customerId": new mongoose.Types.ObjectId(customerId) } },
      { $unwind: "$items" },
      { $group: { 
          _id: "$items.productId", 
          frequency: { $sum: 1 },
          totalQty: { $sum: "$items.qty" },
          name: { $first: "$items.name" }
      } },
      { $sort: { frequency: -1, totalQty: -1 } },
      { $limit: 12 }
    ]);

    // Populate full product details
    const productIds = recommended.map(p => p._id);
    const fullProducts = await Product.find({ _id: { $in: productIds } }).lean();

    const result = recommended.map(rec => {
      const full = fullProducts.find(p => p._id.toString() === rec._id.toString());
      return { ...rec, ...full };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createSession = async (req, res) => {
  try {
    const { branchId, customerId, items, notes } = req.body;
    
    const session = new CRMOrderSession({
      branchId,
      customerId,
      items,
      notes,
      createdBy: req.user?.username || "Admin"
    });

    await session.save();

    if (notes) {
        const crmNote = new CRMNote({
            sessionId: session._id,
            note: notes,
            createdBy: req.user?.username || "Admin"
        });
        await crmNote.save();
    }

    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const generateLink = async (req, res) => {
  try {
    const { sessionId, expiryDays } = req.body;
    
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null;

    const sharedLink = new CRMSharedLink({
      sessionId,
      token,
      expiresAt
    });

    await sharedLink.save();
    
    await CRMOrderSession.findByIdAndUpdate(sessionId, { status: "SHARED" });

    res.status(201).json({ 
        token, 
        link: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/shared-order/${token}` 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPublicOrder = async (req, res) => {
  try {
    const { token } = req.params;
    
    const sharedLink = await CRMSharedLink.findOne({ token }).populate("sessionId");
    if (!sharedLink) return res.status(404).json({ message: "Link not found" });
    
    if (sharedLink.expiresAt && sharedLink.expiresAt < new Date()) {
        return res.status(410).json({ message: "Link expired" });
    }

    if (sharedLink.isUsed) {
        return res.status(403).json({ message: "Link already used" });
    }

    const session = await CRMOrderSession.findById(sharedLink.sessionId._id)
        .populate("customerId")
        .populate("items.productId");

    const notes = await CRMNote.find({ sessionId: session._id, showToCustomer: true });

    sharedLink.viewCount += 1;
    await sharedLink.save();

    res.json({ session, notes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getBranchProducts = async (req, res) => {
  try {
    const { branchId, search } = req.query;
    if (!branchId) return res.status(400).json({ message: "branchId is required" });

    const query = { branchId };
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const products = await Product.find(query)
      .select("name sellingPrice image gst hsnCode units")
      .limit(50)
      .lean();

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const confirmPublicOrder = async (req, res) => {
  try {
    const { token } = req.params;
    const { items } = req.body; // Allows customer to update quantities

    const sharedLink = await CRMSharedLink.findOne({ token }).populate("sessionId");
    if (!sharedLink || sharedLink.isUsed) return res.status(404).json({ message: "Invalid or used link" });

    const session = await CRMOrderSession.findById(sharedLink.sessionId._id).populate("customerId");
    if (!session) return res.status(404).json({ message: "Session not found" });

    const customer = await Customer.findById(session.customerId);
    
    // Reuse existing logic to create Sales Order
    // We need to calculate totals based on items
    let subtotal = 0;
    let totalTax = 0;
    const processedItems = [];

    for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;
        
        const sellingPrice = item.sellingPrice || product.sellingPrice;
        const gst = product.gst || 0;
        const itemTotal = sellingPrice * item.qty;
        const itemTax = (itemTotal * gst) / 100;
        
        subtotal += itemTotal;
        totalTax += itemTax;

        processedItems.push({
            productId: product._id,
            name: product.name,
            hsn: product.hsnCode,
            qty: item.qty,
            sellingPrice: sellingPrice,
            gst: gst,
            total: itemTotal + itemTax
        });
    }

    const grandTotal = Math.round(subtotal + totalTax);

    // Get Voucher
    const voucher = await VoucherType.findOne({
        branchId: session.branchId,
        orderType: "SO",
        name: "standard" // or fallback to first available
    }) || await VoucherType.findOne({ branchId: session.branchId, orderType: "SO" });

    if (!voucher) return res.status(500).json({ message: "No sales voucher configured for this branch" });

    const currentFY = getFinancialYear();
    const invoiceId = `${voucher.prefix}/${String(voucher.counter).padStart(3, "0")}/${currentFY}`;

    const openingBalance = (customer.debit || 0) - (customer.credit || 0);
    const closingBalance = Math.round(openingBalance + grandTotal);

    const salesOrder = new SalesOrder({
        invoiceId,
        voucherType: voucher.name,
        branchId: session.branchId,
        customer: {
            customerId: customer._id,
            name: customer.name,
            whatsapp: customer.whatsapp,
            address: customer.address,
            district: customer.district,
            state: customer.state,
            stateCode: customer.stateCode || "33",
            pincode: customer.pincode,
            gstin: customer.gstin,
        },
        items: processedItems,
        subtotal: Math.round(subtotal),
        totalTax: Math.round(totalTax),
        grandTotal: grandTotal,
        openingBalance: Math.round(openingBalance),
        closingBalance: Math.round(closingBalance),
        billingPerson: "Smart CRM Order",
        agent: "Smart CRM Order",
        financialYear: currentFY,
        status: "PLACED"
    });

    await salesOrder.save();
    
    // Update voucher counter
    voucher.counter += 1;
    await voucher.save();

    // Mark link and session as used
    sharedLink.isUsed = true;
    await sharedLink.save();
    
    session.status = "CONFIRMED";
    session.salesOrderRef = salesOrder._id;
    await session.save();

    res.json({ success: true, message: "Order confirmed and created in ERP", orderId: salesOrder.invoiceId });
  } catch (error) {
    console.error("Confirmation Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Task Board Logic
export const getTasks = async (req, res) => {
  try {
    const { branchId } = req.query;
    const tasks = await CRMTask.find({ branchId }).populate("customerId").sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createTask = async (req, res) => {
  try {
    const { branchId, title, description, assignedTo, customerId, priority, dueDate } = req.body;
    const task = new CRMTask({
      branchId,
      title,
      description,
      assignedTo,
      customerId,
      priority,
      dueDate,
      createdBy: req.user?.username || "Admin"
    });
    await task.save();
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;
    const task = await CRMTask.findByIdAndUpdate(taskId, updates, { new: true });
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    await CRMTask.findByIdAndDelete(taskId);
    res.json({ message: "Task deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
