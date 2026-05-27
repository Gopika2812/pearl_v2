import SalesOrder from "../../../models/SalesOrder.js";
import InventoryAnalysisService from "./InventoryAnalysisService.js";
import mongoose from "mongoose";

const { ObjectId } = mongoose.Types;

class ForecastService {
  /**
   * Forecasts stockout dates, calculates sales velocity, and flags fast/slow-moving products.
   */
  async generateForecast(branchId) {
    if (!branchId) {
      throw new Error("branchId is required for forecasting");
    }

    const bId = new ObjectId(branchId);
    
    // Get current inventory status
    const inventoryStatus = await InventoryAnalysisService.getBranchInventoryStatus(branchId);

    // Calculate time frame: 30 days ago to now
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Aggregate sales volumes in the last 30 days via DB aggregation (fast)
    const recentSales = await SalesOrder.aggregate([
      {
        $match: {
          branchId: bId,
          date: { $gte: thirtyDaysAgo },
          status: { $ne: "CANCELLED" }
        }
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          thirtyDaySales: { $sum: "$items.qty" }
        }
      }
    ]);

    // Map sales volume
    const salesVolumeMap = new Map();
    for (const record of recentSales) {
      if (record._id) {
        salesVolumeMap.set(record._id.toString(), record.thirtyDaySales || 0);
      }
    }

    const forecastData = inventoryStatus.map(item => {
      const pidStr = item.productId.toString();
      const thirtyDaySales = salesVolumeMap.get(pidStr) || 0;
      
      // Calculate daily sales rate (velocity)
      const dailySalesRate = parseFloat((thirtyDaySales / 30).toFixed(4));
      
      // Predict days remaining until stockout
      let daysUntilStockout = 999; // Represents 'safe' or 'stable'
      let predictedStockoutDate = null;

      if (item.effectiveAvailable <= 0) {
        daysUntilStockout = 0;
        predictedStockoutDate = new Date();
      } else if (dailySalesRate > 0) {
        daysUntilStockout = parseFloat((item.effectiveAvailable / dailySalesRate).toFixed(1));
        const stockoutDate = new Date();
        stockoutDate.setDate(stockoutDate.getDate() + Math.ceil(daysUntilStockout));
        predictedStockoutDate = stockoutDate;
      }

      // Calculate reorder warning date (must order before stockout date by supplier lead time)
      let suggestedReorderDate = null;
      if (predictedStockoutDate) {
        const leadTimeDays = item.leadTime || 7;
        const reorderDate = new Date(predictedStockoutDate);
        reorderDate.setDate(reorderDate.getDate() - leadTimeDays);
        suggestedReorderDate = reorderDate;
      } else {
        // Fallback for items with 0 sales velocity but below reorder level
        if (item.status === "CRITICAL" || item.status === "LOW") {
          suggestedReorderDate = new Date(); // Reorder now
        }
      }

      return {
        ...item,
        thirtyDaySales,
        dailySalesRate,
        daysUntilStockout,
        predictedStockoutDate,
        suggestedReorderDate,
      };
    });

    // Partition into fast-moving and slow-moving
    const fastMoving = [...forecastData]
      .filter(item => item.thirtyDaySales > 0)
      .sort((a, b) => b.thirtyDaySales - a.thirtyDaySales)
      .slice(0, 10); // Top 10 items

    const slowMoving = [...forecastData]
      .filter(item => item.thirtyDaySales === 0 && item.effectiveAvailable > 0)
      .sort((a, b) => b.effectiveAvailable - a.effectiveAvailable)
      .slice(0, 10); // Items in stock but not selling

    const outOfStockOrCritical = forecastData.filter(
      item => item.status === "OUT_OF_STOCK" || item.status === "CRITICAL" || item.daysUntilStockout <= (item.leadTime || 7)
    ).sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);

    return {
      all: forecastData,
      fastMoving,
      slowMoving,
      alerts: outOfStockOrCritical,
    };
  }
}

export default new ForecastService();
