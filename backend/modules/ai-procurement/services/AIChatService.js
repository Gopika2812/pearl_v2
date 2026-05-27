import { GoogleGenerativeAI } from "@google/generative-ai";
import POPlanningService from "./POPlanningService.js";
import ForecastService from "./ForecastService.js";
import Vendor from "../../../models/Vendor.js";
import AIChatHistory from "../models/AIChatHistory.js";
import AILearnedFact from "../models/AILearnedFact.js";
import mongoose from "mongoose";
import NodeCache from "node-cache";

const { ObjectId } = mongoose.Types;
export const contextCache = new NodeCache({ stdTTL: 120 }); // Cache branch context for 120 seconds

class AIChatService {
  /**
   * Processes a conversational query from a Super Admin.
   * Leverages Gemini with local context, falling back to a rules-based engine if no API key is set.
   */
  async handleChat(branchId, query, superAdminId) {
    if (!branchId || !query) {
      throw new Error("Missing branchId or query");
    }

    const bId = new ObjectId(branchId);
    const q = query.toLowerCase().trim();

    // 1. Gather all local inventory analytics and forecast context (from cache if fresh)
    const cacheKey = `procurement_context_${branchId}`;
    let contextData = contextCache.get(cacheKey);

    if (!contextData) {
      const forecast = await ForecastService.generateForecast(branchId);
      const suggestions = await POPlanningService.getSuggestions(branchId);
      const vendors = await Vendor.find({ branchId: bId }).lean();
      
      contextData = { forecast, suggestions, vendors };
      contextCache.set(cacheKey, contextData);
      console.log(`⚡ [AI-PROCUREMENT] Cached fresh inventory context for branch: ${branchId}`);
    } else {
      console.log(`🚀 [AI-PROCUREMENT] Using cached inventory context for branch: ${branchId}`);
    }

    const { forecast, suggestions, vendors } = contextData;

    // Fetch learned facts live so corrections/rules apply immediately
    const learnedFacts = await AILearnedFact.find({ branchId: bId }).lean();

    // 2. Try using the Gemini API
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Using gemini-1.5-flash as the fast, standard model
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Construct context message
        const contextStr = this._buildContextString(forecast, suggestions, vendors, learnedFacts);

        const prompt = `
You are an expert ERP Procurement and Inventory Planning AI Assistant.
Below is the live inventory, sales velocity, forecasting, and supplier data for the current branch:

---
${contextStr}
---

The user (a Super Admin) asks: "${query}"

Respond professionally, concisely, and with concrete figures (using INR ₹).
Restocking should be the absolute first priority in your analysis and suggestions.
Analyze, predict, and suggest PO orders by product group (e.g. McCain retail, etc.) or by individual products.
Use the product group, sales velocity, daily sales rate, and stock summary data to explain product movement and support your restocking plans.
If the user asks to recommend or plan a Purchase Order, output a clear, bulleted recommendation listing the suggested items (with their product group), vendor, quantity, cost, and expected delivery date.

CRITICAL INSTRUCTION FOR CORRECTING MISTAKES & REAL-TIME TRAINING:
If the user is correcting an error you made, correcting a fact (e.g., actual lead time, wrong vendor, reorder quantities, or stock levels), or setting a new operational preference/rule, you must output a summary of the learned fact/preference on a single line at the very end of your response formatted EXACTLY like this:
[LEARNED_FACT: <brief statement of the correct fact/rule learned>]
Example: "[LEARNED_FACT: McCain retail preferred vendor is McCain Foods, not McCain Direct.]"
Make sure it is on its own line. Do not output this unless a correction/rule is actually provided by the user.

Always maintain a helpful, data-driven, and procurement-focused tone. Keep the answer under 300 words.
`;

        const result = await model.generateContent(prompt);
        let text = result.response.text();

        // Check if Gemini learned a new fact or correction
        const learnedFactRegex = /\[LEARNED_FACT:\s*(.+?)\]/i;
        const match = text.match(learnedFactRegex);
        if (match && match[1]) {
          const factStr = match[1].trim();
          try {
            await AILearnedFact.create({
              branchId: bId,
              fact: factStr,
              category: "PROCUREMENT"
            });
            console.log(`🧠 [AI-PROCUREMENT] Learned new fact: "${factStr}"`);
            
            // Invalidate the cache to ensure the new correction is factored immediately
            contextCache.del(`procurement_context_${branchId}`);
          } catch (dbErr) {
            console.warn("⚠️ Failed to save learned fact:", dbErr.message);
          }
          // Remove the match tag from the final response
          text = text.replace(learnedFactRegex, "").trim();
        }

        // Save to chat history
        await AIChatHistory.create({
          superAdminId,
          query,
          response: text,
          branchId: bId,
        });

        return {
          response: text,
          usedAI: true,
        };
      } catch (err) {
        console.error("Gemini API call failed, falling back to rule-based engine:", err.message);
      }
    }

    // 3. Resilient Rule-Based Fallback Engine
    const responseText = this._generateRuleBasedResponse(q, forecast, suggestions, vendors);

    // Save fallback to history
    await AIChatHistory.create({
      superAdminId,
      query,
      response: responseText,
      branchId: bId,
    });

    return {
      response: responseText,
      usedAI: false,
    };
  }

  /**
   * Helper to compile database details into structured text context for the LLM.
   */
  _buildContextString(forecast, suggestions, vendors, learnedFacts = []) {
    const fullProductSummary = forecast.all.map(
      item => `- Product: ${item.name} | Group: ${item.productGroupName || 'Uncategorized'} | Stock: ${item.effectiveAvailable} ${item.units} | Min Stock (Safety): ${item.minStockQty} | Max Stock: ${item.maxStockQty} | 30-Day Sales: ${item.thirtyDaySales} | Velocity: ${item.dailySalesRate}/day | Status: ${item.status} | Lead Time: ${item.leadTime} days | Days to Stockout: ${item.daysUntilStockout === 999 ? 'Stable' : item.daysUntilStockout}`
    ).join("\n");

    const lowStockList = forecast.alerts.map(
      item => `- ${item.name} [Group: ${item.productGroupName || 'Uncategorized'}]: Current Stock = ${item.effectiveAvailable} ${item.units}, Safety Stock = ${item.minStockQty}, Days to Stockout = ${item.daysUntilStockout === 999 ? 'N/A' : item.daysUntilStockout}`
    ).join("\n");

    const suggestionsList = suggestions.map(
      s => `- ${s.productName} [Group: ${s.productGroupName || 'Uncategorized'}]: Order ${s.suggestedQty} ${s.units} from ${s.vendorName} (Cost: ₹${s.costPrice}/unit, Est. Total: ₹${s.estTotal}). Reason: ${s.reason}`
    ).join("\n");

    const fastMovingList = forecast.fastMoving.map(
      item => `- ${item.name}: Sold ${item.thirtyDaySales} ${item.units} in last 30 days (Velocity: ${item.dailySalesRate} units/day)`
    ).join("\n");

    const slowMovingList = forecast.slowMoving.map(
      item => `- ${item.name}: Stock = ${item.effectiveAvailable} ${item.units}, 0 sales in last 30 days`
    ).join("\n");

    const vendorNames = vendors.map(v => `- Vendor: ${v.name} (ID: ${v._id}, Status: ${v.isActive ? 'Active' : 'Inactive'})`).join("\n");
    const learnedFactsList = learnedFacts.map(f => `- ${f.fact}`).join("\n");

    return `
1. COMPLETE INVENTORY RECORD & MOVEMENT METRICS (ALL PRODUCTS):
${fullProductSummary || "No products found in the catalog."}

2. SUGGESTED PURCHASE RECOMMENDATIONS (RESTOCKING PRIORITY):
${suggestionsList || "None. No items currently require restocking."}

3. REGISTERED SUPPLIERS:
${vendorNames || "No suppliers configured for this branch."}

4. LEARNED CORRECTIONS & PREFERENCES FROM PAST USER CHAT FEEDBACK:
${learnedFactsList || "None recorded yet. If the user corrects any stock values, vendor assignments, lead times, or planning rules in this chat session, make sure to learn them."}
`;
  }

  /**
   * Rules-based responder when Gemini API key is missing or fails.
   */
  _generateRuleBasedResponse(query, forecast, suggestions, vendors) {
    if (query.includes("stock") || query.includes("shortage") || query.includes("deplet") || query.includes("out of")) {
      const critical = forecast.alerts;
      if (critical.length === 0) {
        return "✅ **Inventory Health Check**: All items are currently above safety stock thresholds. There are no predicted stock shortages in the near future.";
      }
      let resp = `⚠️ **Stock Alert Summary**:\nWe detected **${critical.length}** product(s) facing shortages or imminent stockouts:\n\n`;
      critical.slice(0, 5).forEach(item => {
        resp += `- **${item.name}**: Stock is **${item.effectiveAvailable} ${item.units}** (safety level: ${item.minStockQty}). `;
        if (item.daysUntilStockout === 0) {
          resp += "❌ **OUT OF STOCK**.\n";
        } else {
          resp += `Predicted stockout in **${item.daysUntilStockout} days**.\n`;
        }
      });
      if (critical.length > 5) resp += `\n*(And ${critical.length - 5} more items. Check the alerts panel on the right for the full list).*`;
      return resp;
    }

    if (query.includes("urgent") || query.includes("restock") || query.includes("reorder") || query.includes("suggest") || query.includes("recommend")) {
      if (suggestions.length === 0) {
        return "✅ No urgent restocks are needed at this time. All inventory levels are within safe operating margins.";
      }
      let resp = `📋 **AI Restocking Suggestions**:\nHere are the top purchase recommendations to maintain stock buffers:\n\n`;
      suggestions.slice(0, 5).forEach(s => {
        resp += `- **${s.productName}**: Suggest ordering **${s.suggestedQty} ${s.units}** from **${s.vendorName}** (Est. Cost: **₹${s.estTotal}**). Reason: *${s.reason}*\n`;
      });
      if (suggestions.length > 5) resp += `\n*(And ${suggestions.length - 5} more suggestions are listed in the reorder table).*`;
      return resp;
    }

    if (query.includes("fast") || query.includes("popular") || query.includes("velocity")) {
      const fast = forecast.fastMoving;
      if (fast.length === 0) {
        return "📈 **Sales Analysis**: No sales recorded in the last 30 days to calculate velocity metrics.";
      }
      let resp = `⚡ **Fast-Moving Products (Last 30 Days)**:\nThese items are experiencing high demand:\n\n`;
      fast.slice(0, 5).forEach(item => {
        resp += `- **${item.name}**: Sold **${item.thirtyDaySales} ${item.units}** (Velocity: **${item.dailySalesRate} units/day**)\n`;
      });
      return resp;
    }

    if (query.includes("slow") || query.includes("dead") || query.includes("dormant")) {
      const slow = forecast.slowMoving;
      if (slow.length === 0) {
        return "📉 **Sales Analysis**: No slow-moving items with positive stock found.";
      }
      let resp = `🐢 **Slow-Moving Products**:\nThese items have positive stock but zero sales in the last 30 days:\n\n`;
      slow.slice(0, 5).forEach(item => {
        resp += `- **${item.name}**: Stock level of **${item.effectiveAvailable} ${item.units}** (0 sales)\n`;
      });
      return resp;
    }

    if (query.includes("supplier") || query.includes("vendor") || query.includes("recommend supplier")) {
      if (vendors.length === 0) {
        return "❌ No active suppliers are configured in the system for this branch.";
      }
      let resp = `🏢 **Supplier List**:\nYou have **${vendors.length}** configured supplier(s) for this branch:\n\n`;
      vendors.slice(0, 5).forEach(v => {
        resp += `- **${v.name}** (GSTIN: ${v.gstin || "Unregistered"})\n`;
      });
      return resp;
    }

    // Default response showing aggregate stats
    const totalItems = forecast.all.length;
    const outOfStockCount = forecast.all.filter(i => i.effectiveAvailable === 0).length;
    const criticalCount = forecast.all.filter(i => i.status === "CRITICAL").length;

    return `👋 **Hello! I'm your AI Procurement Assistant.**\n\nI analyze sales orders and inventory to help you optimize purchasing. Here is a quick snapshot of the current branch:\n\n` +
      `- 📦 Total Catalog Items: **${totalItems}**\n` +
      `- ❌ Out of Stock Items: **${outOfStockCount}**\n` +
      `- ⚠️ Critical Stock Items: **${criticalCount}**\n` +
      `- 🏢 Configured Suppliers: **${vendors.length}**\n\n` +
      `Ask me questions like:\n` +
      `* *"Which products are running out soon?"*\n` +
      `* *"Suggest reorder quantities"* \n` +
      `* *"Show fast-moving products"*`;
  }
}

export default new AIChatService();
