import SalesOrder from "../../../models/SalesOrder.js";
import Customer from "../../../models/Customer.js";
import Product from "../../../models/Product.js";
import BranchUser from "../../../models/BranchUser.js";
import AuditLog from "../../../models/AuditLog.js";
import Attendance from "../../hr-payroll/models/Attendance.js";
import Vendor from "../../../models/Vendor.js";
import Invoice from "../../../models/Invoice.js";
import CRMTask from "../../crm-orders/models/CRMTask.js";
import mongoose from "mongoose";

const KNOWLEDGE_BASE = {
  saravanan: {
    name: "Saravanan Kumar",
    description: "Saravanan Kumar is the Managing Director and the visionary leader of this company. He oversees the strategic growth, premium quality standards, and overall business ecosystem across all branches.",
  },
  app: {
    features: ["Inventory Management", "Sales & Purchase Orders", "CRM Assisted Smart Orders", "Automated Delivery Flow", "HR & Payroll", "Kanban Task Board", "Real-time Analytics"],
    version: "2.5.0 (AI Assisted)",
    developer: "HIG AI Automation LLP"
  }
};

const getDateRange = (query) => {
  const now = new Date();
  const start = new Date(now);
  let label = "overall";

  if (query.includes("today")) {
    start.setHours(0, 0, 0, 0);
    label = "today";
  } else if (query.includes("yesterday")) {
    start.setDate(now.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { range: { $gte: start, $lte: end }, label: "yesterday" };
  } else if (query.includes("week")) {
    start.setDate(now.getDate() - 7);
    label = "this week";
  } else if (query.includes("month")) {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    label = "this month";
  } else if (query.includes("year")) {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    label = "this year";
  } else {
    return { range: null, label: "overall" };
  }

  return { range: { $gte: start }, label };
};

export const queryBot = async (req, res) => {
  try {
    const { query, branchId } = req.body;
    if (!query) return res.status(400).json({ success: false, message: "Query is required" });

    const lowerQuery = query.toLowerCase();
    const { range, label } = getDateRange(lowerQuery);
    
    let response = {
      type: "text",
      text: "I'm not sure about that. I can help with 'profit', 'sales', 'tasks', or 'stock' details.",
      data: null
    };

    // 1. Profit Queries
    if (lowerQuery.includes("profit") || lowerQuery.includes("margin") || lowerQuery.includes("gain")) {
      const matchQuery = { branchId: new mongoose.Types.ObjectId(branchId), status: "FINALIZED" };
      if (range) matchQuery.createdAt = range;

      const profitData = await Invoice.aggregate([
        { $match: matchQuery },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        { $unwind: "$productInfo" },
        {
          $project: {
            revenue: { $multiply: ["$items.sellingPrice", "$items.qty"] },
            cost: { $multiply: ["$productInfo.purchasingPrice", "$items.qty"] }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$revenue" },
            totalCost: { $sum: "$cost" }
          }
        }
      ]);

      if (profitData.length > 0) {
        const profit = profitData[0].totalRevenue - profitData[0].totalCost;
        const margin = (profit / profitData[0].totalRevenue) * 100;
        response.text = `Analysis for ${label}: We generated ₹${profitData[0].totalRevenue.toLocaleString()} in revenue with a total cost of ₹${profitData[0].totalCost.toLocaleString()}. The net profit is ₹${profit.toLocaleString()} (approx ${margin.toFixed(2)}% margin).`;
      } else {
        response.text = `I couldn't find any finalized invoice records for ${label} to calculate profit.`;
      }
      return res.json({ success: true, ...response });
    }

    // 2. Sales / Revenue Queries
    if (lowerQuery.includes("sales") || lowerQuery.includes("revenue") || lowerQuery.includes("invoice") || lowerQuery.includes("billing")) {
      const matchQuery = { branchId: new mongoose.Types.ObjectId(branchId) };
      if (range) matchQuery.createdAt = range;

      const salesStats = await Invoice.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, total: { $sum: "$grandTotal" }, count: { $sum: 1 } } }
      ]);

      if (salesStats.length > 0) {
        response.text = `Sales for ${label}: ₹${salesStats[0].total.toLocaleString()} from ${salesStats[0].count} invoices.`;
        const recent = await Invoice.find(matchQuery).sort({ createdAt: -1 }).limit(3);
        if (recent.length > 0) {
          response.type = "list";
          response.data = recent.map(i => `${i.invoiceNumber}: ₹${i.grandTotal.toLocaleString()} (${i.customer?.name || 'Unknown'})`);
        }
      } else {
        response.text = `No sales records found for ${label}.`;
      }
      return res.json({ success: true, ...response });
    }

    // 3. Task / Kanban Queries
    if (lowerQuery.includes("task") || lowerQuery.includes("todo") || lowerQuery.includes("kanban")) {
      const tasks = await CRMTask.find({ branchId }).sort({ createdAt: -1 }).limit(10);
      const stats = await CRMTask.aggregate([
        { $match: { branchId: new mongoose.Types.ObjectId(branchId) } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]);

      const statSummary = stats.map(s => `${s._id}: ${s.count}`).join(", ");
      response.text = `Task status: ${statSummary}. Recent items:`;
      response.type = "list";
      response.data = tasks.map(t => `${t.title} [${t.status}]`);
      return res.json({ success: true, ...response });
    }

    // 4. Stock / Inventory Queries
    if (lowerQuery.includes("stock") || lowerQuery.includes("product") || lowerQuery.includes("inventory")) {
      const productCount = await Product.countDocuments({ branchId });
      const lowStock = await Product.find({ branchId, totalQty: { $lt: 10 } }).limit(5);
      response.text = `Inventory Summary: ${productCount} products total. ${lowStock.length > 0 ? "Alert: Low stock items found." : "Stock is stable."}`;
      if (lowStock.length > 0) {
        response.type = "list";
        response.data = lowStock.map(p => `${p.name}: ${p.totalQty} remaining`);
      }
      return res.json({ success: true, ...response });
    }

    // 5. User Status Check
    const userMatch = lowerQuery.match(/(?:is|where is|what is|about)\s+([a-zA-Z]+)(?:\s+working|\s+doing|\s+on|\s+present)?/i);
    const potentialName = userMatch ? userMatch[1] : (lowerQuery.includes("saravanan") ? "saravanan" : null);

    if (potentialName) {
      const targetUser = await BranchUser.findOne({ name: new RegExp(potentialName, "i") });
      if (targetUser) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const attendance = await Attendance.findOne({ employeeId: targetUser._id, date: { $gte: today } });
        const latestLog = await AuditLog.findOne({ user: targetUser._id }).sort({ createdAt: -1 });

        let statusText = attendance && attendance.status === "Present" 
          ? `${targetUser.name} is currently PRESENT.` 
          : `${targetUser.name} is not marked as present today.`;

        let activityText = latestLog ? ` Last seen on [${latestLog.action}] at ${new Date(latestLog.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : "";
        let bioText = targetUser.name.toLowerCase().includes("saravanan") ? ` ${KNOWLEDGE_BASE.saravanan.description}` : "";
        response.text = `${statusText}${activityText}${bioText}`;
        return res.json({ success: true, ...response });
      }
    }

    res.json({ success: true, ...response });
  } catch (error) {
    console.error("AI Bot Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
