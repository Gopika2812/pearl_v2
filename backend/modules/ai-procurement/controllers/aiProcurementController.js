import InventoryAnalysisService from "../services/InventoryAnalysisService.js";
import ForecastService from "../services/ForecastService.js";
import POPlanningService from "../services/POPlanningService.js";
import POCreationService from "../services/POCreationService.js";
import AIChatService, { contextCache } from "../services/AIChatService.js";
import AIChatHistory from "../models/AIChatHistory.js";
import PurchaseOrder from "../../../models/PurchaseOrder.js";

// Helper to verify request role
const isSuperAdmin = (req) => {
  return req.user && (req.user.role === "SUPER_ADMIN" || req.user.role === "SUPERADMIN");
};

export const getDashboardData = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: "Forbidden: Super Admin access only" });
    }

    const { branchId } = req.query;
    if (!branchId) {
      return res.status(400).json({ success: false, message: "branchId is required" });
    }

    // Generate forecast (contains alerts, fast moving, slow moving, etc.)
    const forecast = await ForecastService.generateForecast(branchId);
    
    // Fetch pending POs (status = PLACED)
    const pendingPOs = await PurchaseOrder.find({
      branchId,
      status: "PLACED"
    })
      .sort({ createdAt: -1 })
      .lean();

    // Summarize pending PO details
    const pendingPOSummary = pendingPOs.map(po => ({
      poId: po._id,
      invoiceId: po.invoiceId,
      vendorName: po.vendor,
      grandTotal: po.grandTotal,
      date: po.date || po.createdAt,
      itemsCount: po.items?.length || 0,
    }));

    // Calculate metrics
    const totalItems = forecast.all.length;
    const outOfStockCount = forecast.all.filter(i => i.effectiveAvailable === 0).length;
    const criticalCount = forecast.all.filter(i => i.status === "CRITICAL").length;
    const lowStockCount = forecast.all.filter(i => i.status === "LOW").length;
    
    let totalStockValue = 0;
    forecast.all.forEach(item => {
      totalStockValue += (item.effectiveAvailable * item.purchasingPrice);
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalItems,
          outOfStockCount,
          criticalCount,
          lowStockCount,
          totalStockValue: Math.round(totalStockValue),
          pendingPOCount: pendingPOs.length,
        },
        alerts: forecast.alerts,
        fastMoving: forecast.fastMoving,
        slowMoving: forecast.slowMoving,
        pendingPOs: pendingPOSummary,
      }
    });
  } catch (error) {
    console.error("AI Procurement Dashboard Controller Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSuggestions = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: "Forbidden: Super Admin access only" });
    }

    const { branchId } = req.query;
    if (!branchId) {
      return res.status(400).json({ success: false, message: "branchId is required" });
    }

    const suggestions = await POPlanningService.getSuggestions(branchId);

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error("AI Procurement Suggestions Controller Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const handleChatQuery = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: "Forbidden: Super Admin access only" });
    }

    const { branchId, query } = req.body;
    if (!branchId || !query) {
      return res.status(400).json({ success: false, message: "branchId and query are required" });
    }

    const chatResponse = await AIChatService.handleChat(branchId, query, req.user.id);

    res.json({
      success: true,
      data: chatResponse
    });
  } catch (error) {
    console.error("AI Procurement Chat Controller Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getChatHistory = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: "Forbidden: Super Admin access only" });
    }

    const { branchId } = req.query;
    if (!branchId) {
      return res.status(400).json({ success: false, message: "branchId is required" });
    }

    const history = await AIChatHistory.find({
      superAdminId: req.user.id,
      branchId
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error("AI Procurement Chat History Controller Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const confirmAndCreatePO = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: "Forbidden: Super Admin access only" });
    }

    const { branchId, vendorId, items } = req.body;
    if (!branchId || !vendorId || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Missing required fields: branchId, vendorId, and items are required" });
    }

    const newPO = await POCreationService.createPurchaseOrderFromSuggestions(
      branchId,
      vendorId,
      items,
      req.user
    );

    // Invalidate cached inventory context for this branch
    try {
      contextCache.del(`procurement_context_${branchId}`);
      console.log(`🧹 [AI-PROCUREMENT] Invalidated inventory cache for branch: ${branchId}`);
    } catch (cacheErr) {
      console.warn("⚠️ Failed to clear context cache (non-blocking):", cacheErr.message);
    }

    res.status(201).json({
      success: true,
      message: `Purchase Order ${newPO.invoiceId} created successfully.`,
      data: {
        poId: newPO._id,
        invoiceId: newPO.invoiceId,
        grandTotal: newPO.grandTotal,
      }
    });
  } catch (error) {
    console.error("AI Procurement PO Creation Controller Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
