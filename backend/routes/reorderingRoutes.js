import express from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import SalesOrder from "../models/SalesOrder.js";

const { ObjectId } = mongoose.Types;
const router = express.Router();

/**
 * GET /api/reordering/dashboard
 * Aggregates stock data from PO and SO for re-ordering analysis
 */
router.get("/dashboard", async (req, res) => {
  try {
    // Fetch all data with a single set of aggregation queries (not N+1)
    const [products, poData, soData] = await Promise.all([
      Product.find({}).lean(),
      
      // Aggregate ALL PO items by product in one query
      PurchaseOrder.aggregate([
        {
          $match: {
            status: { $in: ["PLACED", "RECEIVED", "PARTIALLY_RETURNED"] }
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
      
      // Fetch ALL SO data in one query, then aggregate in memory
      SalesOrder.find({}, { items: 1, invoiceItems: 1 }).lean()
    ]);

    // Pre-process SO data into a map for O(1) lookup
    const soDataMap = new Map();
    
    for (const so of soData) {
      for (const item of so.items) {
        const productId = item.productId.toString();
        if (!soDataMap.has(productId)) {
          soDataMap.set(productId, { totalOrdered: 0, totalInvoiced: 0 });
        }
        soDataMap.get(productId).totalOrdered += item.qty;
      }
      
      for (const item of so.invoiceItems) {
        const productId = item.productId.toString();
        if (!soDataMap.has(productId)) {
          soDataMap.set(productId, { totalOrdered: 0, totalInvoiced: 0 });
        }
        soDataMap.get(productId).totalInvoiced += item.qty;
      }
    }

    // Create a map for O(1) PO lookup
    const poDataMap = new Map();
    for (const po of poData) {
      poDataMap.set(po._id.toString(), po.totalReceivedQty);
    }

    // Build stockData by mapping products with pre-aggregated data
    const stockData = products.map((product) => {
      const productIdStr = product._id.toString();
      
      // Get bulk uploaded qty from Product schema
      const bulkUploadedQty = product.totalQty || 0;
      
      // Get PO qty from aggregated PO data
      const poQty = poDataMap.get(productIdStr) || 0;
      
      // Total stock received = Bulk uploaded + PO
      const stockReceived = bulkUploadedQty + poQty;
      
      const soInfo = soDataMap.get(productIdStr) || { totalOrdered: 0, totalInvoiced: 0 };
      
      const totalSOQty = soInfo.totalOrdered;
      const totalInvoicedQty = soInfo.totalInvoiced;
      const pendingSO = totalSOQty - totalInvoicedQty;
      
      // Current stock = Stock received - Already invoiced/sold
      const currentStock = stockReceived - totalInvoicedQty;
      
      // Allocated = Reserved for pending (not yet invoiced) SO
      const allocatedStock = pendingSO;
      
      // Effective = Available after allocating for pending
      const effectiveAvailable = currentStock - allocatedStock;
      const reorderLevel = product.reorderLevel || 10;

      return {
        productId: product._id,
        productName: product.name,
        productGroup: product.productGroup,
        hsn: product.hsnCode || product.hsncode,
        
        // Stock Levels - Breakdown
        bulkUploadedQty, // Initial stock from bulk upload
        poQty, // Stock from POs
        currentStock, // Total: (Bulk + PO) - Already Invoiced
        allocatedStock, // Reserved for pending SO
        effectiveAvailable, // What can be sold now
        
        // Sales Order Details
        totalSOOrdered: totalSOQty,
        totalSOInvoiced: totalInvoicedQty,
        pendingSO, // Not yet invoiced
        
        // Re-ordering Config (to be set by user)
        reorderLevel,
        reorderQty: product.reorderQty || 20,
        leadTime: product.leadTime || 7,
        checkPeriod: product.checkPeriod || "MONTHLY",
        
        // Status calculation
        status:
          effectiveAvailable === 0
            ? "OUT_OF_STOCK"
            : effectiveAvailable < reorderLevel
            ? "CRITICAL"
            : effectiveAvailable < reorderLevel + 5
            ? "LOW"
            : "NORMAL",
        
        lastChecked: product.lastChecked || new Date(),
        nextCheckDate: product.nextCheckDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };
    });

    // Sort by status (critical/out_of_stock first)
    const statusPriority = { OUT_OF_STOCK: 0, CRITICAL: 1, LOW: 2, NORMAL: 3 };
    stockData.sort((a, b) => statusPriority[a.status] - statusPriority[b.status]);

    return res.json({
      success: true,
      count: stockData.length,
      data: stockData
    });
  } catch (error) {
    console.error("Error fetching reordering dashboard:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching dashboard"
    });
  }
});

/**
 * GET /api/reordering/product/:productId
 * Get detailed re-ordering info for a specific product
 */
router.get("/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Get PO data
    const poItems = await PurchaseOrder.aggregate([
      {
        $match: {
          status: { $in: ["PLACED", "RECEIVED", "PARTIALLY_RETURNED"] }
        }
      },
      { $unwind: "$items" },
      {
        $match: {
          "items.productId": new ObjectId(productId)
        }
      },
      {
        $group: {
          _id: "$items.productId",
          totalReceivedQty: { $sum: "$items.qty" },
          poCount: { $sum: 1 }
        }
      }
    ]);

    const currentStock = poItems.length > 0 ? poItems[0].totalReceivedQty : 0;

    // Get bulk uploaded qty from Product schema
    const bulkUploadedQty = product.totalQty || 0;
    
    // Total stock received = Bulk + PO
    const stockReceived = bulkUploadedQty + currentStock;

    // Get SO data with details
    const soItems = await SalesOrder.find(
      { "items.productId": productId },
      {
        invoiceId: 1,
        date: 1,
        customer: 1,
        items: 1,
        invoiceItems: 1,
        backOrderSummary: 1
      }
    ).lean();

    let totalSOQty = 0;
    let totalInvoicedQty = 0;
    const soDetails = [];

    for (const so of soItems) {
      const orderedInSO = so.items
        .filter((item) => item.productId.toString() === productId.toString())
        .reduce((sum, item) => sum + item.qty, 0);

      const invoicedInSO = so.invoiceItems
        .filter((item) => item.productId.toString() === productId.toString())
        .reduce((sum, item) => sum + item.qty, 0);

      const pendingInSO = orderedInSO - invoicedInSO;

      if (orderedInSO > 0) {
        soDetails.push({
          soId: so.invoiceId,
          date: so.date,
          customer: so.customer?.name,
          orderedQty: orderedInSO,
          invoicedQty: invoicedInSO,
          pendingQty: pendingInSO
        });
      }

      totalSOQty += orderedInSO;
      totalInvoicedQty += invoicedInSO;
    }

    const pendingSO = totalSOQty - totalInvoicedQty;
    
    // Current stock = Stock received - Already invoiced/sold
    const actualCurrentStock = stockReceived - totalInvoicedQty;
    
    // Allocated = Reserved for pending (not yet invoiced) SO
    const allocatedStock = pendingSO;
    
    // Effective = Available after allocating for pending
    const effectiveAvailable = actualCurrentStock - allocatedStock;

    return res.json({
      success: true,
      data: {
        productId,
        productName: product.name,
        productGroup: product.productGroup,
        hsn: product.hsnCode || product.hsncode,
        
        stock: {
          bulkUploadedQty, // Initial stock from bulk upload
          poQty: currentStock, // Stock from POs
          totalCurrentStock: actualCurrentStock, // Total: (Bulk + PO) - Invoiced
          allocatedStock,
          effectiveAvailable
        },
        
        salesOrder: {
          totalOrdered: totalSOQty,
          totalInvoiced: totalInvoicedQty,
          pendingSO,
          details: soDetails
        },
        
        reordering: {
          reorderLevel: product.reorderLevel || 10,
          reorderQty: product.reorderQty || 20,
          leadTime: product.leadTime || 7,
          checkPeriod: product.checkPeriod || "MONTHLY"
        },
        
        status:
          effectiveAvailable < (product.reorderLevel || 10)
            ? effectiveAvailable === 0
              ? "OUT_OF_STOCK"
              : "CRITICAL"
            : effectiveAvailable < (product.reorderLevel || 10) + 5
            ? "LOW"
            : "NORMAL"
      }
    });
  } catch (error) {
    console.error("Error fetching product reordering info:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching product info"
    });
  }
});

/**
 * PUT /api/reordering/product/:productId/settings
 * Update reorder settings for a product
 */
router.put("/product/:productId/settings", async (req, res) => {
  try {
    const { productId } = req.params;
    const { reorderLevel, reorderQty, leadTime, checkPeriod } = req.body;

    const product = await Product.findByIdAndUpdate(
      productId,
      {
        reorderLevel,
        reorderQty,
        leadTime,
        checkPeriod,
        lastChecked: new Date()
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    return res.json({
      success: true,
      message: "Settings updated",
      data: product
    });
  } catch (error) {
    console.error("Error updating reorder settings:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating settings"
    });
  }
});

export default router;
