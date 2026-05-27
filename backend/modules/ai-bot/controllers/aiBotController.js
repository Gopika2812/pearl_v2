import SalesOrder from "../../../models/SalesOrder.js";
import Customer from "../../../models/Customer.js";
import Product from "../../../models/Product.js";
import BranchUser from "../../../models/BranchUser.js";
import Attendance from "../../hr-payroll/models/Attendance.js";
import Invoice from "../../../models/Invoice.js";
import Branch from "../../../models/Branch.js";
import mongoose from "mongoose";
import ForecastService from "../../ai-procurement/services/ForecastService.js";
import POPlanningService from "../../ai-procurement/services/POPlanningService.js";
import AILearnedFact from "../../ai-procurement/models/AILearnedFact.js";

/**
 * Pearl AI Assistant Bot Controller
 * Handles data-driven queries with branch-scoping and Super Admin fallbacks.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// Helper to identify Super Admin role
const isSuperAdminUser = (user) => {
  const role = String(user.role || "").toUpperCase();
  return role === "SUPER_ADMIN" || role === "SUPERADMIN";
};

export const queryBot = async (req, res) => {
  try {
    const { query, branchId: bodyBranchId } = req.body;
    const user = req.user || {};
    const bId = user.branchId || bodyBranchId || user.branch;
    const isSuperAdmin = isSuperAdminUser(user);

    const q = (query || "").toLowerCase().trim();
    let response = { type: "text", text: "", data: null };

    if (!q) {
      return res.json({ success: true, type: "text", text: "Please enter a question!" });
    }

    // ── 1. GATHER ERP CONTEXT DATA (Attendance, Sales, Stock) ──
    let bQuery = {};
    if (bId && mongoose.isValidObjectId(bId)) {
      const branchObjectId = new mongoose.Types.ObjectId(bId);
      bQuery = { $or: [{ branch: branchObjectId }, { branchId: branchObjectId }] };
    }

    // Attendance Context
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const presentCount = await Attendance.countDocuments({ 
      ...bQuery, 
      date: { $gte: todayStart, $lte: todayEnd }, 
      status: { $regex: /^present/i } 
    });
    
    const totalStaff = await BranchUser.countDocuments({ 
      ...bQuery, 
      status: { $regex: /^active/i } 
    });

    // Sales Context (Revenue & Invoices)
    const matchSales = { ...bQuery, status: { $ne: "CANCELLED" } };
    const salesStats = await Invoice.aggregate([
      { $match: matchSales }, 
      { $group: { _id: null, total: { $sum: "$grandTotal" }, count: { $sum: 1 } } }
    ]);
    const totalRevenue = salesStats[0]?.total || 0;
    const invoiceCount = salesStats[0]?.count || 0;

    // Stock Context (Shortages)
    const totalProducts = await Product.countDocuments(bQuery);
    const lowStockProducts = await Product.countDocuments({
      ...bQuery,
      $expr: { $lt: ["$totalQty", "$reorderLevel"] }
    });

    // Gather rich inventory context (Product Group, stock summary, and restocking suggestions)
    let suggestionsContext = "";
    let inventorySummaryContext = "";
    let learnedFactsContext = "";

    if (bId && mongoose.isValidObjectId(bId)) {
      try {
        const branchIdStr = bId.toString();
        const forecast = await ForecastService.generateForecast(branchIdStr);
        const suggestions = await POPlanningService.getSuggestions(branchIdStr);
        const learnedFacts = await AILearnedFact.find({ branchId: bId }).lean();
        
        inventorySummaryContext = forecast.all.map(
          item => `- Product: ${item.name} | Group: ${item.productGroupName} | Stock: ${item.effectiveAvailable} ${item.units} | Min Stock: ${item.minStockQty} | 30-Day Sales: ${item.thirtyDaySales} | Daily Velocity: ${item.dailySalesRate}/day | Status: ${item.status}`
        ).join("\n");

        suggestionsContext = suggestions.map(
          s => `- Restock ${s.productName} (Group: ${s.productGroupName}): Order ${s.suggestedQty} ${s.units} from ${s.vendorName}. Est. Cost: ₹${s.estTotal}. Reason: ${s.reason}`
        ).join("\n");

        learnedFactsContext = learnedFacts.map(f => `- ${f.fact}`).join("\n");
      } catch (err) {
        console.warn("⚠️ Failed to load rich inventory context for chatbot prompt:", err.message);
      }
    }

    // ── 2. TRY CONVERSATIONAL RESPONSE WITH GEMINI API ──
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
You are the Pearl ERP Chatbot assistant. You help managers and admins quickly inspect stats, run operations, analyze stocks, and plan restocking.
Here is the current operational context for the branch:
- Today's Staff Attendance: ${presentCount} present out of ${totalStaff} active staff. (Absent: ${Math.max(0, totalStaff - presentCount)})
- Total Revenue: ₹${totalRevenue.toLocaleString("en-IN")}
- Sales Invoice Count: ${invoiceCount}
- Product Catalog Size: ${totalProducts} total items
- Items with Low Stock: ${lowStockProducts} items below reorder level.

---
INVENTORY RECORD & MOVEMENT METRICS (ALL PRODUCTS):
${inventorySummaryContext || "No product catalog or stock summaries available."}

AI RESTOCKING RECOMMENDATIONS (RESTOCKING PRIORITY):
${suggestionsContext || "No restocking recommendations available."}

LEARNED FACTS & PREFERENCES FROM PAST USER CHAT FEEDBACK:
${learnedFactsContext || "No learned corrections/preferences yet."}
---

The user asks: "${query}"

Respond conversationally, concisely (under 200 words), and use markdown bold/bullet lists where appropriate.
If the user asks about attendance, sales, or low stock, refer to the context figures provided above.
Restocking should be the absolute first priority in your analysis.
Analyze, predict, and suggest PO orders by product group (e.g. McCain retail, etc.) or by individual products when asked.
Use the product group, sales velocity, daily sales rate, and stock summary data to explain product movement and support your suggestions.

CRITICAL INSTRUCTION FOR CORRECTING MISTAKES & REAL-TIME TRAINING:
If the user is correcting an error you made, correcting a fact (e.g., stock levels, vendor assignments, attendance numbers, or revenue stats), or setting a new operational preference/rule, you must output a summary of the learned fact/preference on a single line at the very end of your response formatted EXACTLY like this:
[LEARNED_FACT: <brief statement of the correct fact/rule learned>]
Example: "[LEARNED_FACT: McCain retail preferred vendor is McCain Foods, not McCain Direct.]"
Make sure it is on its own line. Do not output this unless a correction/rule is actually provided by the user.
`;

        const result = await model.generateContent(prompt);
        let replyText = result.response.text();

        // Check if Gemini learned a new fact or correction
        const learnedFactRegex = /\[LEARNED_FACT:\s*(.+?)\]/i;
        const match = replyText.match(learnedFactRegex);
        if (match && match[1]) {
          const factStr = match[1].trim();
          try {
            await AILearnedFact.create({
              branchId: bId,
              fact: factStr,
              category: "GENERAL"
            });
            console.log(`🧠 [AI-BOT] Learned new fact: "${factStr}"`);
          } catch (dbErr) {
            console.warn("⚠️ Failed to save learned fact:", dbErr.message);
          }
          // Remove the match tag from the final response
          replyText = replyText.replace(learnedFactRegex, "").trim();
        }

        return res.json({
          success: true,
          type: "text",
          text: replyText
        });
      } catch (geminiErr) {
        console.error("Gemini chatbot error, falling back to local patterns:", geminiErr.message);
      }
    }

    // ── 3. RULES-BASED FALLBACK ENGINE (Original Logic) ──
    if (q.includes("attendance") || q.includes("present today") || q.includes("who is present")) {
      response.text = `**Attendance Summary**\n\n` +
        `✅ Present: **${presentCount}**\n` +
        `👥 Total Staff: **${totalStaff}**\n` +
        `❌ Absent: **${Math.max(0, totalStaff - presentCount)}**`;

      if (presentCount > 0) {
        const list = await Attendance.find({ 
          ...bQuery,
          date: { $gte: todayStart, $lte: todayEnd }, 
          status: { $regex: /^present/i } 
        }).populate("employeeId", "name").limit(10);
        
        response.type = "list";
        response.data = list.map(u => u.employeeId?.name || "Unknown Staff");
      }
    } 
    else if (q.includes("sale") || q.includes("revenue") || q.includes("billing")) {
      if (salesStats.length > 0) {
        response.text = `**Sales Overview**\n\n💰 Total Revenue: **₹${totalRevenue.toLocaleString("en-IN")}**\n📄 Total Invoices: **${invoiceCount}**`;
      } else {
        response.text = "No sales records found for this branch.";
      }
    } 
    else if (q.includes("stock") || q.includes("inventory") || q.includes("shortage")) {
      response.text = `**Inventory Overview**\n\n📦 Total Catalog Items: **${totalProducts}**\n⚠️ Low/Critical Stock: **${lowStockProducts}** items below reorder level.`;
    }
    else {
      response.text = "Hello! I'm your Pearl ERP Assistant. You can ask me about **attendance today**, **sales summaries**, or **inventory levels**.";
    }

    res.json({ success: true, ...response });
  } catch (error) {
    console.error("AI Bot Controller Error:", error);
    res.status(500).json({ success: false, message: "Internal error in AI assistant module." });
  }
};
