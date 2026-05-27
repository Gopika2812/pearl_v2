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
import Token from "../../../models/Token.js";
import FollowUp from "../../../models/FollowUp.js";
import Invoice from "../../../models/Invoice.js";

export const getFrequentCustomers = async (req, res) => {
  try {
    const { branchId, all } = req.query;
    if (!branchId) return res.status(400).json({ message: "branchId is required" });

    if (all === "true") {
      const customersWithOrderCount = await Customer.aggregate([
        { $match: { branchId: new mongoose.Types.ObjectId(branchId) } },
        {
          $lookup: {
            from: "salesorders",
            let: { custId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$customer.customerId", "$$custId"] } } },
              { $count: "count" }
            ],
            as: "orders"
          }
        },
        {
          $project: {
            name: 1,
            whatsapp: 1,
            email: 1,
            district: 1,
            state: 1,
            debit: 1,
            credit: 1,
            closingBalance: 1,
            orderCount: { $ifNull: [{ $arrayElemAt: ["$orders.count", 0] }, 0] }
          }
        },
        { $sort: { orderCount: -1, name: 1 } }
      ]);
      return res.json(customersWithOrderCount);
    }

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

    // Priority: Explicit baseUrl from frontend > Env Var > Live URL Fallback > Localhost
    const baseUrl = req.body.baseUrl || process.env.FRONTEND_URL || 'https://pearlsfrontend.web.app';

    res.status(201).json({ 
        token, 
        link: `${baseUrl}/shared-order/${token}` 
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

    // Fetch repeatedly bought products for this customer
    const customerId = session.customerId?._id;
    let recommendations = [];
    if (customerId) {
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

        const productIds = recommended.map(p => p._id);
        const fullProducts = await Product.find({ _id: { $in: productIds } }).lean();

        // Fetch locked prices for this customer and these products
        const CustomerLockedPrice = mongoose.models.CustomerLockedPrice || mongoose.model("CustomerLockedPrice");
        const lockedPrices = await CustomerLockedPrice.find({ customerId, productId: { $in: productIds } }).lean();

        recommendations = recommended.map(rec => {
          const full = fullProducts.find(p => p._id.toString() === rec._id.toString());
          if (!full) return null;
          const lp = lockedPrices.find(l => l.productId.toString() === rec._id.toString());
          return { 
            ...full, 
            frequency: rec.frequency,
            totalQty: rec.totalQty,
            sellingPrice: lp ? lp.lockedPrice : full.sellingPrice,
            isLockedPrice: !!lp
          };
        }).filter(Boolean);
    }

    sharedLink.viewCount += 1;
    await sharedLink.save();

    res.json({ session, notes, recommendations });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getBranchProducts = async (req, res) => {
  try {
    const { branchId, search, customerId } = req.query;
    if (!branchId) return res.status(400).json({ message: "branchId is required" });

    const query = { branchId };
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const products = await Product.find(query)
      .select("name sellingPrice image gst hsnCode units")
      .limit(50)
      .lean();

    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      const CustomerLockedPrice = mongoose.models.CustomerLockedPrice || mongoose.model("CustomerLockedPrice");
      const productIds = products.map(p => p._id);
      const lockedPrices = await CustomerLockedPrice.find({ customerId, productId: { $in: productIds } }).lean();
      
      const productsWithPrices = products.map(p => {
        const lp = lockedPrices.find(l => l.productId.toString() === p._id.toString());
        return {
          ...p,
          sellingPrice: lp ? lp.lockedPrice : p.sellingPrice,
          isLockedPrice: !!lp
        };
      });
      return res.json(productsWithPrices);
    }

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
        status: "ONLINE_PENDING",
        isOnlineOrder: true
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
    const { branchId, assignedTo: filterUser, fromDate, toDate } = req.query;
    const userId = req.user.id || req.user._id;
    const username = req.user.username;
    const name = req.user.name;

    if (!branchId) return res.status(400).json({ message: "branchId is required" });

    const isAdmin = req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN" || req.user.role === "SUPERADMIN" || req.user.role === "MANAGER";

    // Date Range Setup
    let dateQuery = {};
    if (fromDate && toDate) {
      dateQuery = { createdAt: { $gte: new Date(fromDate), $lte: new Date(toDate) } };
    }

    // 1. Fetch Manual CRM Tasks
    let manualTaskQuery = { branchId, ...dateQuery };
    if (filterUser) {
      manualTaskQuery.$or = [{ assignedTo: filterUser }, { createdBy: filterUser }];
    } else if (!isAdmin) {
      manualTaskQuery.$or = [{ assignedTo: username }, { assignedTo: name }, { createdBy: username }];
    }
    const manualTasks = await CRMTask.find(manualTaskQuery).populate("customerId").sort({ createdAt: -1 });

    // 2. Fetch Tokens
    let tokenQuery = { branchId, status: { $in: ["OPEN", "TAKEN", "IN_PROGRESS"] }, ...dateQuery };
    if (filterUser) {
      // Find user to get their ID if filterUser is a username
      const TokenUser = await mongoose.model("BranchUser").findOne({ $or: [{ username: filterUser }, { name: filterUser }] });
      if (TokenUser) {
        tokenQuery.$or = [{ "assignedTo.id": TokenUser._id }, { takenBy: TokenUser._id }];
      } else {
        tokenQuery = { _id: null }; // No user found, return nothing
      }
    } else if (!isAdmin) {
      tokenQuery.$or = [{ "assignedTo.id": userId }, { takenBy: userId }];
    }
    const tokens = await Token.find(tokenQuery).populate("customer.id");

    const tokenTasks = tokens.map(t => ({
      _id: `token-${t._id}`,
      title: `Token: ${t.tokenId}`,
      description: t.message,
      status: t.status === "OPEN" ? "TODO" : (t.status === "IN_PROGRESS" ? "IN_PROGRESS" : "REVIEW"),
      priority: "HIGH",
      assignedTo: t.assignedTo?.name || t.takenBy?.name || "Unassigned",
      customerId: t.customer?.id,
      type: "TOKEN",
      refId: t._id,
      createdAt: t.createdAt
    }));

    // 3. Fetch Follow-Ups
    const followUpQuery = isAdmin ? { branchId, status: "PENDING" } : { branchId, status: "PENDING", followUpBy: { $in: [username, name] } };
    const followUps = await FollowUp.find(followUpQuery).populate("customerId");

    const followUpTasks = followUps.map(f => ({
      _id: `followup-${f._id}`,
      title: `Follow Up: ${f.customerId?.name || "Customer"}`,
      description: f.remarks || "Regular follow up",
      status: "TODO",
      priority: "MEDIUM",
      assignedTo: f.followUpBy,
      customerId: f.customerId,
      dueDate: f.nextFollowUpDate,
      type: "FOLLOW_UP",
      refId: f._id,
      createdAt: f.createdAt
    }));

    // 4. Fetch Sales Orders & Invoices
    let invoiceQuery = { branchId, status: { $ne: "CANCELLED" }, ...dateQuery };
    if (filterUser) {
      // Fetch user ID for objectId fields
      const InvUser = await mongoose.model("BranchUser").findOne({ $or: [{ username: filterUser }, { name: filterUser }] });
      invoiceQuery.$or = [
        { storageMan: filterUser },
        { stockChecker: filterUser },
        { deliveryPerson: filterUser },
        { billingPerson: filterUser }
      ];
      if (InvUser) invoiceQuery.$or.push({ deliveryMan: InvUser._id });
    } else if (!isAdmin) {
      invoiceQuery.$or = [
        { storageMan: username }, { storageMan: name },
        { stockChecker: username }, { stockChecker: name },
        { deliveryPerson: username }, { deliveryPerson: name },
        { billingPerson: username }, { billingPerson: name },
        { deliveryMan: userId }
      ];
    }
    const activeInvoices = await Invoice.find(invoiceQuery).populate("customer.customerId").sort({ createdAt: -1 });

    const invoiceTasks = activeInvoices.map(inv => {
      let status = "IN_PROGRESS";
      if (inv.deliveryStatus === "COMPLETED") status = "DONE";
      else if (inv.status === "FINALIZED" || inv.status === "PRINTED") status = "REVIEW";

      return {
        _id: `invoice-${inv._id}`,
        title: `Inv: ${inv.invoiceNumber}`,
        description: `Customer: ${inv.customer?.name} | Area: ${inv.area || "N/A"}`,
        status: status,
        priority: "MEDIUM",
        assignedTo: inv.storageMan || inv.billingPerson || "Unassigned",
        customerId: inv.customer?.customerId,
        type: "INVOICE",
        refId: inv._id,
        createdAt: inv.createdAt
      };
    });

    let soQuery = { branchId, status: "PLACED", ...dateQuery };
    if (filterUser) {
        const SOUser = await mongoose.model("BranchUser").findOne({ $or: [{ username: filterUser }, { name: filterUser }] });
        soQuery.$or = [
            { salesOwner: filterUser },
            { agent: filterUser },
            { billingPerson: filterUser }
        ];
        if (SOUser) soQuery.$or.push({ salesMan: SOUser._id });
    } else if (!isAdmin) {
      soQuery.$or = [
        { salesOwner: username }, { salesOwner: name },
        { agent: username }, { agent: name },
        { billingPerson: username }, { billingPerson: name },
        { salesMan: userId }
      ];
    }
    const activeSalesOrders = await SalesOrder.find(soQuery).populate("customer.customerId");

    const soTasks = activeSalesOrders.map(so => ({
      _id: `so-${so._id}`,
      title: `SO: ${so.invoiceId}`,
      description: `New order for ${so.customer?.name}`,
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      assignedTo: so.salesOwner || so.billingPerson || "Unassigned",
      customerId: so.customer?.customerId,
      type: "SALES_ORDER",
      refId: so._id,
      createdAt: so.createdAt
    }));

    // Combine all tasks
    const allTasks = [
      ...manualTasks.map(t => ({ ...t.toObject(), type: "MANUAL" })),
      ...tokenTasks,
      ...followUpTasks,
      ...invoiceTasks,
      ...soTasks
    ];

    res.json(allTasks);
  } catch (error) {
    console.error("Unified Task Board Error:", error);
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
