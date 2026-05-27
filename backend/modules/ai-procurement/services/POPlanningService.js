import ForecastService from "./ForecastService.js";
import PurchaseOrder from "../../../models/PurchaseOrder.js";
import Vendor from "../../../models/Vendor.js";
import mongoose from "mongoose";

const { ObjectId } = mongoose.Types;

class POPlanningService {
  /**
   * Generates PO suggestions for items requiring restock.
   */
  async getSuggestions(branchId) {
    if (!branchId) {
      throw new Error("branchId is required for PO planning suggestions");
    }

    const bId = new ObjectId(branchId);
    
    // Get forecast data
    const forecast = await ForecastService.generateForecast(branchId);

    // Filter items that need restocking
    const itemsToRestock = forecast.all.filter(item => {
      // Restock if out of stock, critical, low, OR if stockout is predicted within lead time + 3 days buffer
      const bufferDays = 3;
      const needsRestock = 
        item.status === "OUT_OF_STOCK" || 
        item.status === "CRITICAL" || 
        item.status === "LOW" ||
        item.daysUntilStockout <= (item.leadTime + bufferDays);
      
      return needsRestock;
    });

    // To find historical vendors for items that lack a preferredVendor, 
    // fetch recent Purchase Orders in one query
    const recentPOs = await PurchaseOrder.find({
      branchId: bId,
      status: { $in: ["RECEIVED", "INVOICED", "PLACED"] }
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const productVendorHistory = new Map();
    for (const po of recentPOs) {
      for (const item of po.items || []) {
        if (!item.productId) continue;
        const pid = item.productId.toString();
        if (!productVendorHistory.has(pid) && po.vendor) {
          productVendorHistory.set(pid, {
            name: po.vendor,
            id: po.vendorId
          });
        }
      }
    }

    // Get all vendors for the branch to map name to ID if needed
    const branchVendors = await Vendor.find({ branchId: bId }).lean();
    const vendorMap = new Map();
    for (const vendor of branchVendors) {
      vendorMap.set(vendor.name.toLowerCase().trim(), vendor);
    }

    const suggestions = [];

    for (const item of itemsToRestock) {
      // 1. Determine Supplier
      let vendorName = item.preferredVendor || "";
      let vendorId = null;

      // Check history if preferredVendor is empty
      if (!vendorName) {
        const hist = productVendorHistory.get(item.productId.toString());
        if (hist) {
          vendorName = hist.name;
          vendorId = hist.id;
        }
      }

      // Map vendor name to vendorId if we don't have it
      if (vendorName && !vendorId) {
        const mappedVendor = vendorMap.get(vendorName.toLowerCase().trim());
        if (mappedVendor) {
          vendorId = mappedVendor._id;
        }
      }

      // If still no vendor, check if there's any vendor in the branch to suggest as fallback
      if (!vendorName && branchVendors.length > 0) {
        vendorName = branchVendors[0].name;
        vendorId = branchVendors[0]._id;
      }

      // 2. Calculate Suggested Quantity
      // We want to bring stock back to maxStockQty. If maxStockQty is not set or smaller than safety stock,
      // suggest reorderQty or a default calculation (covering 30 days of sales).
      const deficiency = (item.maxStockQty || 50) - item.effectiveAvailable;
      const salesBasedQty = Math.ceil(item.dailySalesRate * 30);
      const defaultReorderQty = item.reorderQty || 20;

      let suggestedQty = Math.max(defaultReorderQty, deficiency);
      
      // If the product is selling fast, ensure suggestedQty covers at least 30 days of sales
      if (salesBasedQty > suggestedQty) {
        suggestedQty = salesBasedQty;
      }

      // Round suggested quantity to avoid decimals
      suggestedQty = Math.ceil(suggestedQty);

      // 3. Dates
      const reorderDate = item.suggestedReorderDate || new Date();
      const expectedReceivingDate = new Date(reorderDate);
      expectedReceivingDate.setDate(expectedReceivingDate.getDate() + (item.leadTime || 7));

      // 4. Financials
      const costPrice = item.purchasingPrice || 0;
      const gst = item.gst || 0;
      const subtotal = suggestedQty * costPrice;
      const taxAmount = (subtotal * gst) / 100;
      const estTotal = Math.round(subtotal + taxAmount);

      // 5. Reasoning
      let reason = "";
      if (item.status === "OUT_OF_STOCK") {
        reason = "Product is currently completely out of stock.";
      } else if (item.status === "CRITICAL") {
        reason = `Stock level (${item.effectiveAvailable} ${item.units}) is below safety threshold (${item.minStockQty} ${item.units}).`;
      } else if (item.daysUntilStockout <= item.leadTime) {
        reason = `Stockout predicted in ${item.daysUntilStockout} days, which is less than supplier lead time (${item.leadTime} days).`;
      } else {
        reason = "Stock replenishment recommended to maintain optimal buffer levels.";
      }

      suggestions.push({
        productId: item.productId,
        productName: item.name,
        productGroupId: item.productGroupId,
        productGroupName: item.productGroupName,
        hsnCode: item.hsnCode,
        vendorName: vendorName || "No Vendor Assigned",
        vendorId,
        suggestedQty,
        units: item.units,
        costPrice,
        gst,
        reorderDate,
        expectedReceivingDate,
        estTotal,
        reason,
        currentStock: item.effectiveAvailable,
        dailySalesRate: item.dailySalesRate,
      });
    }

    return suggestions;
  }
}

export default new POPlanningService();
