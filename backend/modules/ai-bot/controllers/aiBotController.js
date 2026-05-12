import SalesOrder from "../../../models/SalesOrder.js";
import Customer from "../../../models/Customer.js";
import Product from "../../../models/Product.js";
import BranchUser from "../../../models/BranchUser.js";
import Attendance from "../../hr-payroll/models/Attendance.js";
import Invoice from "../../../models/Invoice.js";
import Branch from "../../../models/Branch.js";
import mongoose from "mongoose";

/**
 * Pearl AI Assistant Bot Controller
 * Handles data-driven queries with branch-scoping and Super Admin fallbacks.
 */

// Helper to identify Super Admin role
const isSuperAdminUser = (user) => {
  const role = String(user.role || "").toUpperCase();
  return role === "SUPER_ADMIN" || role === "SUPERADMIN";
};

export const queryBot = async (req, res) => {
  try {
    const { query, branchId: bodyBranchId } = req.body;
    const user = req.user || {};
    const bId = user.branchId || bodyBranchId;
    const isSuperAdmin = isSuperAdminUser(user);

    const q = (query || "").toLowerCase();
    let response = { type: "text", text: "", data: null };

    // ── Build Branch Filter ──
    let bQuery = {};
    if (bId && mongoose.isValidObjectId(bId)) {
        const branchExists = await Branch.exists({ _id: bId });
        if (branchExists) {
            const branchObjectId = new mongoose.Types.ObjectId(bId);
            bQuery = { $or: [{ branch: branchObjectId }, { branchId: branchObjectId }] };
        } else if (!isSuperAdmin) {
            // Normal user fallback to provided ID
            const branchObjectId = new mongoose.Types.ObjectId(bId);
            bQuery = { $or: [{ branch: branchObjectId }, { branchId: branchObjectId }] };
        }
        // Super Admin with invalid branch defaults to global bQuery = {}
    }

    // ── Attendance Queries ──
    if (q.includes("attendance") || q.includes("present today") || q.includes("who is present")) {
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const todayEnd = new Date(todayStart);
        todayEnd.setUTCHours(23, 59, 59, 999);

        // Fetch counts for branch
        let presentCount = await Attendance.countDocuments({ 
            ...bQuery, 
            date: { $gte: todayStart, $lte: todayEnd }, 
            status: { $regex: /^present/i } 
        });
        
        let totalStaff = await BranchUser.countDocuments({ 
            ...bQuery, 
            status: { $regex: /^active/i } 
        });

        // ── Super Admin Global Fallback ──
        // If results are zero but user is super admin, show global stats
        if (presentCount === 0 && totalStaff === 0 && isSuperAdmin && Object.keys(bQuery).length > 0) {
            presentCount = await Attendance.countDocuments({ date: { $gte: todayStart, $lte: todayEnd }, status: { $regex: /^present/i } });
            totalStaff = await BranchUser.countDocuments({ status: { $regex: /^active/i } });
            
            response.text = `**Global Attendance Summary (All Branches)**\n\n` +
              `✅ Present: **${presentCount}**\n` +
              `👥 Total Staff: **${totalStaff}**\n` +
              `❌ Absent: **${Math.max(0, totalStaff - presentCount)}**\n\n` +
              `*(Showing system-wide data as no records were found for the current branch context)*`;
        } else {
            response.text = `**Attendance Summary**\n\n` +
              `✅ Present: **${presentCount}**\n` +
              `👥 Total Staff: **${totalStaff}**\n` +
              `❌ Absent: **${Math.max(0, totalStaff - presentCount)}**`;
        }

        // Include staff names if any are present
        if (presentCount > 0) {
            const list = await Attendance.find({ 
                ...(presentCount > 0 && totalStaff === 0 ? {} : bQuery), // use global if fallback was triggered
                date: { $gte: todayStart, $lte: todayEnd }, 
                status: { $regex: /^present/i } 
            }).populate("employeeId", "name").limit(10);
            
            response.type = "list";
            response.data = list.map(u => u.employeeId?.name || "Unknown Staff");
        }
    } 
    // ── Sales Queries ──
    else if (q.includes("sale") || q.includes("revenue") || q.includes("billing")) {
        const match = { ...bQuery, status: { $ne: "CANCELLED" } };
        const stats = await Invoice.aggregate([
            { $match: match }, 
            { $group: { _id: null, total: { $sum: "$grandTotal" }, count: { $sum: 1 } } }
        ]);
        
        if (stats.length > 0) {
          response.text = `**Sales Overview**\n\n💰 Total Revenue: **₹${stats[0].total.toLocaleString("en-IN")}**\n📄 Total Invoices: **${stats[0].count}**`;
        } else {
          response.text = "No sales records found for this period.";
        }
    } 
    // ── Default Greeting / Info ──
    else {
        response.text = "Hello! I'm your Pearl ERP Assistant. You can ask me about **attendance today**, **sales summaries**, or **inventory levels**.";
    }

    res.json({ success: true, ...response });
  } catch (error) {
    console.error("AI Bot Error:", error);
    res.status(500).json({ success: false, message: "Internal error in AI assistant module." });
  }
};
