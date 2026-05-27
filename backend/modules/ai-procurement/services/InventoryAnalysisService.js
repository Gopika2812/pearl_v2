import Product from "../../../models/Product.js";
import PurchaseOrder from "../../../models/PurchaseOrder.js";
import SalesOrder from "../../../models/SalesOrder.js";
import ProductGroup from "../../../models/ProductGroup.js";
import mongoose from "mongoose";

const { ObjectId } = mongoose.Types;

class InventoryAnalysisService {
  /**
   * Retrieves comprehensive inventory analysis for a given branch.
   * Calculates current stock, allocated stock, effective available stock,
   * safety stock levels, and flags shortages.
   */
  async getBranchInventoryStatus(branchId) {
    if (!branchId) {
      throw new Error("branchId is required for inventory analysis");
    }

    const bId = new ObjectId(branchId);

    // Fetch all products, purchase orders, and aggregated sales order quantities in parallel
    const [products, poData, soOrderedData, soInvoicedData] = await Promise.all([
      Product.find({ branchId: bId }).populate("productGroup").lean(),
      
      // 1. Aggregate received/invoiced POs
      PurchaseOrder.aggregate([
        {
          $match: {
            branchId: bId,
            status: { $in: ["RECEIVED", "PARTIALLY_RETURNED", "INVOICED"] }
          }
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            totalReceivedQty: { $sum: "$items.qty" }
          }
        }
      ]),

      // 2. Aggregate Sales Order Ordered Quantities
      SalesOrder.aggregate([
        {
          $match: {
            branchId: bId,
            status: { $ne: "CANCELLED" }
          }
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            totalOrdered: { $sum: "$items.qty" }
          }
        }
      ]),

      // 3. Aggregate Sales Order Invoiced Quantities
      SalesOrder.aggregate([
        {
          $match: {
            branchId: bId,
            status: { $ne: "CANCELLED" }
          }
        },
        { $unwind: "$invoiceItems" },
        {
          $group: {
            _id: "$invoiceItems.productId",
            totalInvoiced: { $sum: "$invoiceItems.qty" }
          }
        }
      ])
    ]);

    // Map PO data
    const poDataMap = new Map();
    for (const po of poData) {
      if (po._id) {
        poDataMap.set(po._id.toString(), po.totalReceivedQty || 0);
      }
    }

    // Map Sales Order data
    const soDataMap = new Map();
    
    for (const item of soOrderedData) {
      if (item._id) {
        const pid = item._id.toString();
        if (!soDataMap.has(pid)) {
          soDataMap.set(pid, { totalOrdered: 0, totalInvoiced: 0 });
        }
        soDataMap.get(pid).totalOrdered = item.totalOrdered || 0;
      }
    }

    for (const item of soInvoicedData) {
      if (item._id) {
        const pid = item._id.toString();
        if (!soDataMap.has(pid)) {
          soDataMap.set(pid, { totalOrdered: 0, totalInvoiced: 0 });
        }
        soDataMap.get(pid).totalInvoiced = item.totalInvoiced || 0;
      }
    }

    // Build the status list
    const analysis = products.map((product) => {
      const productIdStr = product._id.toString();
      const initialQty = product.totalQty || 0;
      const poQty = poDataMap.get(productIdStr) || 0;
      const totalSO = soDataMap.get(productIdStr) || { totalOrdered: 0, totalInvoiced: 0 };

      const totalReceived = initialQty + poQty;
      const currentStock = totalReceived - totalSO.totalInvoiced;
      const pendingSO = Math.max(0, totalSO.totalOrdered - totalSO.totalInvoiced);
      
      // Effective available = currentStock - pending orders (allocated)
      const effectiveAvailable = Math.max(0, currentStock - pendingSO);
      
      const reorderLevel = product.reorderLevel || product.minStockQty || 10;
      const minStockQty = product.minStockQty || reorderLevel;
      const maxStockQty = product.maxStockQty || (reorderLevel * 5);

      // Determine stock status
      let status = "NORMAL";
      if (effectiveAvailable === 0) {
        status = "OUT_OF_STOCK";
      } else if (effectiveAvailable < minStockQty) {
        status = "CRITICAL";
      } else if (effectiveAvailable < reorderLevel + 5) {
        status = "LOW";
      }

      return {
        productId: product._id,
        name: product.name,
        productGroupId: product.productGroup?._id || null,
        productGroupName: product.productGroup?.name || "Uncategorized",
        hsnCode: product.hsnCode || product.hsn,
        preferredVendor: product.preferredVendor,
        purchasingPrice: product.purchasingPrice || 0,
        sellingPrice: product.sellingPrice || 0,
        gst: product.gst || 0,
        units: product.units || "units",
        initialQty,
        poQty,
        currentStock,
        allocatedStock: pendingSO,
        effectiveAvailable,
        reorderLevel,
        minStockQty,
        maxStockQty,
        status,
        leadTime: product.leadTime || 7,
      };
    });

    return analysis;
  }
}

export default new InventoryAnalysisService();
