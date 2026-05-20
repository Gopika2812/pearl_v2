import express from "express";
import moment from "moment-timezone";
import mongoose from "mongoose";
import multer from "multer";
import XLSX from "xlsx";
import CreditNote from "../models/CreditNote.js";
import CustomerLockedPrice from "../models/CustomerLockedPrice.js";
import DebitNote from "../models/DebitNote.js";
import Invoice from "../models/Invoice.js";
import Product from "../models/Product.js";
import ProductCategory from "../models/ProductCategory.js";
import ProductGroup from "../models/ProductGroup.js";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import SalesOrder from "../models/SalesOrder.js";
import Warehouse from "../models/Warehouse.js";
import PhysicalStockEntry from "../models/PhysicalStockEntry.js";

import auth from "../middleware/auth.js";
import { createAuditLog } from "../utils/logUtil.js";

const HARD_ANCHOR_DATE = moment.tz("2026-03-31 23:59:59", "Asia/Kolkata").toDate();

const router = express.Router();

// Configure multer with 50MB limit for bulk uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// POST: Add New Product
router.post("/", async (req, res) => {
  try {
    const { productGroup, productCategories = [], name, perQty, units, totalQty, purchasingPrice, sellingPrice, adminMargin, marginPercentage, lockedPrice, hsnCode, gst, branchId } = req.body;

    if (!name || !perQty || !units || hsnCode === undefined || !branchId) {
      return res.status(400).json({
        success: false,
        message: "Name, Per Qty, Units, HSN Code, and branchId are required",
      });
    }

    // Check if product already exists in this branch (Case Insensitive)
    const existingProduct = await Product.findOne({
      branchId,
      name: { $regex: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: `A product with the name "${name}" already exists in this branch.`,
      });
    }

    // Validate productGroup is a valid ObjectId if provided
    if (productGroup && !mongoose.Types.ObjectId.isValid(productGroup)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Product Group ID",
      });
    }

    // Verify product group exists if provided and belongs to same branch
    if (productGroup) {
      const groupExists = await ProductGroup.findOne({ _id: productGroup, branchId });
      if (!groupExists) {
        return res.status(400).json({
          success: false,
          message: "Product Group not found or does not belong to this branch",
        });
      }
    }

    // Validate productCategories array if provided
    const validCategoryIds = [];
    if (Array.isArray(productCategories) && productCategories.length > 0) {
      for (const catId of productCategories) {
        if (!mongoose.Types.ObjectId.isValid(catId)) {
          return res.status(400).json({
            success: false,
            message: `Invalid Product Category ID: ${catId}`,
          });
        }

        const categoryExists = await ProductCategory.findOne({ _id: catId, branchId });
        if (!categoryExists) {
          return res.status(400).json({
            success: false,
            message: `Product Category not found or does not belong to this branch: ${catId}`,
          });
        }
        validCategoryIds.push(catId);
      }
    }

    const pPrice = Math.round((Number(purchasingPrice) || 0) * 100) / 100;
    const sPrice = Math.round((Number(sellingPrice) || 0) * 100) / 100;
    let finalMargin = 0;
    let finalMarginPercentage = Number(marginPercentage) || 0;

    // Auto-calculate margin if prices provided but marginPercentage is not
    if (pPrice > 0 && sPrice > 0 && (!marginPercentage || Number(marginPercentage) === 0)) {
      finalMargin = Math.round((sPrice - pPrice) * 100) / 100;
      finalMarginPercentage = Math.round((finalMargin / pPrice) * 100 * 100) / 100;
    }

    const product = new Product({
      branchId,
      productGroup: productGroup || null,
      productCategories: validCategoryIds,
      name,
      perQty: Math.round((Number(perQty) || 0) * 100) / 100,
      units,
      totalQty: Math.round((Number(totalQty) || 0) * 100) / 100,
      openingQty: Math.round((Number(totalQty) || 0) * 100) / 100,
      manualOpeningDate: new Date("2026-03-31T23:59:59.999Z"),
      purchasingPrice: pPrice,
      sellingPrice: sPrice,
      adminMargin: Math.round((Number(adminMargin) || 0) * 100) / 100,
      margin: finalMargin,
      marginPercentage: finalMarginPercentage,
      lockedPrice: Math.round((Number(lockedPrice) || 0) * 100) / 100,
      hsnCode,
      gst: Math.round((Number(gst) || 0) * 100) / 100,
    });

    const savedProduct = await product.save();
    const populated = await Product.findById(savedProduct._id)
      .populate("productGroup", "name")
      .populate("productCategories", "name")
      .populate("warehouse", "name");

    res.status(201).json({
      success: true,
      message: "Product saved successfully",
      data: populated,
    });
  } catch (error) {
    console.error("Save Product Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save product",
      error: error.message,
    });
  }
});

// GET: Fetch All Products with Pagination
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10000, search = "", diag = "", branchId, productGroup, productCategory, mini = false } = req.query;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    // Convert branchId string to MongoDB ObjectId
    let branchObjectId;
    try {
      branchObjectId = mongoose.Types.ObjectId.isValid(branchId)
        ? new mongoose.Types.ObjectId(branchId)
        : branchId;
    } catch (e) {
      branchObjectId = branchId;
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(10000, Math.max(1, parseInt(limit) || 10000));
    const skip = (pageNum - 1) * pageSize;

    // Build search filter with branchId
    const filter = { branchId: branchObjectId };
    if (search) filter.name = { $regex: search, $options: "i" };
    if (productGroup && productGroup !== "ALL") filter.productGroup = productGroup;
    if (productCategory && productCategory !== "ALL") filter.productCategories = productCategory;

    // ⚡ Get total count
    const total = await Product.countDocuments(filter);

    // ⚡ Fetch paginated results with lean() for faster performance
    const products = await Product.find(filter)
      .populate("productGroup", "_id name")
      .populate("productCategories", "_id name")
      .populate("warehouse", "_id name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    if (mini === "true" || mini === true) {
        // Fetch last purchase dates for all products in this branch
        const [poDates, piDates] = await Promise.all([
          PurchaseOrder.aggregate([
            { $match: { branchId: branchObjectId, status: { $ne: "CANCELLED" } } },
            { $unwind: "$items" },
            { $group: { _id: "$items.productId", lastDate: { $max: "$date" } } }
          ]),
          PurchaseInvoice.aggregate([
            { $match: { branchId: branchObjectId } },
            { $unwind: "$items" },
            { $group: { _id: "$items.productId", lastDate: { $max: "$invoiceDate" } } }
          ])
        ]);

        const purchaseDateMap = new Map();
        poDates.forEach(d => {
          if (d._id) purchaseDateMap.set(d._id.toString(), d.lastDate);
        });
        piDates.forEach(d => {
          if (d._id) {
            const idStr = d._id.toString();
            const existing = purchaseDateMap.get(idStr);
            if (!existing || new Date(d.lastDate) > new Date(existing)) {
              purchaseDateMap.set(idStr, d.lastDate);
            }
          }
        });

        const enhanced = products.map(product => ({
          ...product,
          lastPurchaseDate: purchaseDateMap.get(product._id.toString()) || null
        }));

        return res.json({
            success: true,
            data: enhanced,
            pagination: {
                page: pageNum,
                limit: pageSize,
                total,
                pages: Math.ceil(total / pageSize),
            }
        });
    }

    // ⚡ SYNC: Fetch financial totals for the returned products to calculate "Tally Stock"
    const productIds = products.map(p => p._id);
    
    const [salesTotals, purchaseTotals, cnTotals, dnTotals, psvTotals, poDates, piDates, siDates] = await Promise.all([
      Invoice.aggregate([
        { $match: { branchId: branchObjectId, status: { $ne: "CANCELLED" }, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: "$items" },
        { $match: { "items.productId": { $in: productIds }, "items.qty": { $gt: 0 } } },
        { $group: { _id: "$items.productId", total: { $sum: "$items.qty" } } }
      ]),
      PurchaseInvoice.aggregate([
        { $match: { branchId: branchObjectId, status: { $ne: "CANCELLED" }, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: "$items" },
        { $match: { "items.productId": { $in: productIds }, "items.qty": { $gt: 0 } } },
        { $group: { _id: "$items.productId", total: { $sum: "$items.qty" } } }
      ]),
      CreditNote.aggregate([
        { $match: { branchId: branchObjectId, status: { $ne: "CANCELLED" }, createdAt: { $gt: HARD_ANCHOR_DATE } } },
        { $addFields: { effectiveDate: { $ifNull: ["$date", "$createdAt"] } } },
        { $match: { effectiveDate: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: "$items" },
        { $match: { "items.productId": { $in: productIds }, "items.qty": { $gt: 0 } } },
        { $group: { _id: "$items.productId", total: { $sum: "$items.qty" } } }
      ]),
      DebitNote.aggregate([
        { $match: { branchId: branchObjectId, status: { $ne: "CANCELLED" }, date: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: "$items" },
        { $match: { "items.productId": { $in: productIds }, "items.qty": { $gt: 0 } } },
        { $group: { _id: "$items.productId", total: { $sum: "$items.qty" } } }
      ]),
      // ✅ PSV: Approved physical stock adjustments (branch-scoped, formula-based)
      PhysicalStockEntry.aggregate([
        { $match: { branchId: branchObjectId, status: "APPROVED", productId: { $in: productIds } } },
        { $group: { _id: "$productId", inward: { $sum: "$inwardQty" }, outward: { $sum: "$outwardQty" } } }
      ]),
      PurchaseOrder.aggregate([
        { $match: { branchId: branchObjectId, status: { $ne: "CANCELLED" }, "items.productId": { $in: productIds } } },
        { $unwind: "$items" },
        { $match: { "items.productId": { $in: productIds } } },
        { $group: { _id: "$items.productId", lastDate: { $max: "$date" } } }
      ]),
      PurchaseInvoice.aggregate([
        { $match: { branchId: branchObjectId, "items.productId": { $in: productIds } } },
        { $unwind: "$items" },
        { $match: { "items.productId": { $in: productIds } } },
        { $group: { _id: "$items.productId", lastDate: { $max: "$invoiceDate" } } }
      ]),
      Invoice.aggregate([
        { $match: { branchId: branchObjectId, status: { $ne: "CANCELLED" }, "items.productId": { $in: productIds } } },
        { $unwind: "$items" },
        { $match: { "items.productId": { $in: productIds } } },
        { $group: { _id: "$items.productId", lastDate: { $max: "$invoiceDate" } } }
      ])
    ]);

    const salesMap    = new Map(salesTotals.map(t => [t._id.toString(), t.total]));
    const purchaseMap = new Map(purchaseTotals.map(t => [t._id.toString(), t.total]));
    const cnMap       = new Map(cnTotals.map(t => [t._id.toString(), t.total]));
    const dnMap       = new Map(dnTotals.map(t => [t._id.toString(), t.total]));
    const psvMap      = new Map(psvTotals.map(t => [t._id.toString(), { inward: t.inward, outward: t.outward }]));

    const purchaseDateMap = new Map();
    poDates.forEach(d => {
      if (d._id) purchaseDateMap.set(d._id.toString(), d.lastDate);
    });
    piDates.forEach(d => {
      if (d._id) {
        const idStr = d._id.toString();
        const existing = purchaseDateMap.get(idStr);
        if (!existing || new Date(d.lastDate) > new Date(existing)) {
          purchaseDateMap.set(idStr, d.lastDate);
        }
      }
    });

    const salesDateMap = new Map();
    if (siDates) {
      siDates.forEach(d => {
        if (d._id) salesDateMap.set(d._id.toString(), d.lastDate);
      });
    }

    // ⚡ Dynamically calculate Restocking variables (sales period qty) if requested
    let restockingMap = new Map();
    if (req.query.includeRestocking === "true") {
      let maxDays = 7;
      products.forEach(p => {
        const days = p.restockingConfig?.salesPeriodDays || 7;
        if (days > maxDays) maxDays = days;
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - maxDays);

      const salesInvoices = await Invoice.aggregate([
        {
          $match: {
            branchId: branchObjectId,
            invoiceDate: { $gte: startDate },
            status: { $ne: "CANCELLED" },
            "items.productId": { $in: productIds }
          }
        },
        { $unwind: "$items" },
        { $match: { "items.productId": { $in: productIds } } },
        {
          $group: {
            _id: {
              productId: "$items.productId",
              dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$invoiceDate" } }
            },
            totalQty: { $sum: "$items.qty" }
          }
        }
      ]);

      // Organize by productId for O(1) retrieval
      const salesByProduct = new Map();
      salesInvoices.forEach(s => {
        if (s._id && s._id.productId) {
          const pid = s._id.productId.toString();
          if (!salesByProduct.has(pid)) {
            salesByProduct.set(pid, []);
          }
          salesByProduct.get(pid).push({
            date: new Date(s._id.dateStr),
            qty: s.totalQty || 0
          });
        }
      });

      // Calculate for each product
      products.forEach(p => {
        const pId = p._id.toString();
        const days = p.restockingConfig?.salesPeriodDays || 7;
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        let sellingQty = 0;
        const txns = salesByProduct.get(pId) || [];
        txns.forEach(t => {
          if (t.date >= cutoffDate) {
            sellingQty += t.qty;
          }
        });

        restockingMap.set(pId, {
          salesPeriodDays: days,
          sellingQtyInPeriod: sellingQty,
          threshold: p.restockingConfig?.threshold !== undefined && p.restockingConfig?.threshold !== null 
            ? p.restockingConfig.threshold 
            : sellingQty,
          restockingQty: p.restockingConfig?.restockingQty || null
        });
      });
    }

    // ⚡ Return product with current ground-truth "Tally Stock" (includes PSV adjustments)
    const enhancedProducts = products.map((product) => {
      const pId = product._id.toString();
      const opening           = Number(product.openingQty || 0);
      const inwardPurchases   = Number(purchaseMap.get(pId) || 0);
      const inwardCreditNotes = Number(cnMap.get(pId) || 0);
      const outwardSales      = Number(salesMap.get(pId) || 0);
      const outwardDebitNotes = Number(dnMap.get(pId) || 0);
      const psv               = psvMap.get(pId) || { inward: 0, outward: 0 };

      const closingStock = (opening + inwardPurchases + inwardCreditNotes + psv.inward)
                         - (outwardSales + outwardDebitNotes + psv.outward);

      const dynamicRestocking = restockingMap.get(pId);
      const restockingConfig = dynamicRestocking || product.restockingConfig || {
        salesPeriodDays: 7,
        sellingQtyInPeriod: 0,
        threshold: 10,
        restockingQty: null
      };

      return {
        ...product,
        restockingConfig,
        availableQty: Math.round(closingStock * 100) / 100,
        lastPurchaseDate: purchaseDateMap.get(pId) || null,
        lastSalesDate: salesDateMap.get(pId) || null
      };
    });

    // DIAGNOSTIC MODE - if ?diag=1 is passed
    let diagnosticData = {};
    if (diag === "1") {
      const allProducts = await Product.countDocuments({});
      const withGroup = await Product.countDocuments({ productGroup: { $exists: true, $ne: null } });
      const withoutGroup = await Product.countDocuments({ $or: [{ productGroup: null }, { productGroup: { $exists: false } }] });
      const chicProduct = await Product.findOne({ name: { $regex: "Chick Cheese", $options: "i" } }).lean();

      diagnosticData = {
        totalInDB: allProducts,
        withProductGroup: withGroup,
        withoutProductGroup: withoutGroup,
        chickenProductFound: !!chicProduct,
        chickenProductName: chicProduct?.name || "Not found",
        chickenProductId: chicProduct?._id || "N/A",
      };
    }

    res.json({
      success: true,
      data: enhancedProducts,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
      ...(diag === "1" && { diagnostic: diagnosticData }),
    });
  } catch (error) {
    console.error("Fetch Product Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
});

// GET: Fetch Products by Product Group
router.get("/group/:productGroupId", async (req, res) => {
  try {
    const { productGroupId } = req.params;
    const { search = "" } = req.query;

    console.log(`🔍 Fetching products for group: ${productGroupId}`);

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(productGroupId)) {
      console.log(`❌ Invalid ObjectId: ${productGroupId}`);
      return res.status(400).json({
        success: false,
        message: "Invalid Product Group ID",
      });
    }

    // Build filter
    const filter = { productGroup: productGroupId };
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    console.log(`📋 Search filter:`, filter);

    // ⚡ Fetch products with lean() for faster performance
    const products = await Product.find(filter)
      .populate("productGroup", "name")
      .populate("productCategories", "name")
      .sort({ name: 1 })
      .lean();

    // ⚡ SYNC: Fetch financial totals for the returned products to calculate "Tally Stock"
    const productIds = products.map(p => p._id);
    const branchObjectId = products.length > 0 ? products[0].branchId : null;

    if (products.length > 0 && branchObjectId) {
      const [salesTotals, purchaseTotals, cnTotals, dnTotals] = await Promise.all([
        Invoice.aggregate([
          { $match: { branchId: branchObjectId, status: { $ne: "CANCELLED" }, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
          { $unwind: "$items" },
          { $match: { "items.productId": { $in: productIds }, "items.qty": { $gt: 0 } } },
          { $group: { _id: "$items.productId", total: { $sum: "$items.qty" } } }
        ]),
        PurchaseInvoice.aggregate([
          { $match: { branchId: branchObjectId, status: { $ne: "CANCELLED" }, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
          { $unwind: "$items" },
          { $match: { "items.productId": { $in: productIds }, "items.qty": { $gt: 0 } } },
          { $group: { _id: "$items.productId", total: { $sum: "$items.qty" } } }
        ]),
        CreditNote.aggregate([
          { $match: { branchId: branchObjectId, status: { $ne: "CANCELLED" }, createdAt: { $gt: HARD_ANCHOR_DATE } } },
          { $addFields: { effectiveDate: { $ifNull: ["$date", "$createdAt"] } } },
          { $match: { effectiveDate: { $gt: HARD_ANCHOR_DATE } } },
          { $unwind: "$items" },
          { $match: { "items.productId": { $in: productIds }, "items.qty": { $gt: 0 } } },
          { $group: { _id: "$items.productId", total: { $sum: "$items.qty" } } }
        ]),
        DebitNote.aggregate([
          { $match: { branchId: branchObjectId, status: { $ne: "CANCELLED" }, date: { $gt: HARD_ANCHOR_DATE } } },
          { $unwind: "$items" },
          { $match: { "items.productId": { $in: productIds }, "items.qty": { $gt: 0 } } },
          { $group: { _id: "$items.productId", total: { $sum: "$items.qty" } } }
        ])
      ]);

      const salesMap = new Map(salesTotals.map(t => [t._id.toString(), t.total]));
      const purchaseMap = new Map(purchaseTotals.map(t => [t._id.toString(), t.total]));
      const cnMap = new Map(cnTotals.map(t => [t._id.toString(), t.total]));
      const dnMap = new Map(dnTotals.map(t => [t._id.toString(), t.total]));

      const enhancedProducts = products.map((product) => {
        const pId = product._id.toString();
        const opening = Number(product.openingQty || 0);
        const inwardPurchases = Number(purchaseMap.get(pId) || 0);
        const inwardCreditNotes = Number(cnMap.get(pId) || 0);
        const outwardSales = Number(salesMap.get(pId) || 0);
        const outwardDebitNotes = Number(dnMap.get(pId) || 0);

        const closingStock = (opening + inwardPurchases + inwardCreditNotes) - (outwardSales + outwardDebitNotes);

        return {
          ...product,
          availableQty: Math.round(closingStock * 100) / 100
        };
      });

      return res.json({
        success: true,
        data: enhancedProducts,
      });
    }

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Fetch Product by Group Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
});

router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  console.log("🔥 BULK UPLOAD HIT (v2 with decimals)");

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Excel file required" });
    }

    const { branchId, skipExisting = false } = req.body;
    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });

    let sheetToProcess = null;
    let headerIndex = -1;
    let rows = [];

    // ⚡ SMART SHEET & HEADER DETECTION:
    // Some files have multiple tabs (Summary, Product, etc.). 
    // We loop through all sheets to find the one with the actual data.
    for (const sheetName of workbook.SheetNames) {
      const currentSheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(currentSheet, { header: 1, defval: "" });

      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i].map(cell => String(cell || "").trim().toLowerCase());
        if (row.includes("name") || row.includes("product name") || row.includes("stock item") || row.includes("item name")) {
          headerIndex = i;
          sheetToProcess = currentSheet;
          console.log(`✅ Found valid headers in sheet: "${sheetName}" at row ${i + 1}`);

          // Parse rows from this sheet
          rows = XLSX.utils.sheet_to_json(currentSheet, {
            range: headerIndex,
            raw: false,
            defval: ""
          });
          break;
        }
      }
      if (sheetToProcess) break;
    }

    if (!sheetToProcess) {
      console.error("❌ Could not find a sheet with valid headers (Name/Product Name/Stock Item)");
      return res.status(400).json({
        success: false,
        message: "Could not find a column named 'Name' in any of the sheets. Please check your Excel file."
      });
    }

    console.log("📄 TOTAL ROWS DETECTED:", rows.length);
    console.log("📄 FIRST DATA ROW RAW:", rows[0]);


    // ⚡ OPTIMIZATION: Batch load all product groups for this branch ONCE
    const allProductGroups = await ProductGroup.find({ branchId });
    const productGroupMap = new Map(
      allProductGroups.map(group => [group.name.toLowerCase(), group._id])
    );


    // ⚡ OPTIMIZATION: Batch load all product categories for this branch ONCE
    const allProductCategories = await ProductCategory.find({ branchId });
    const productCategoryMap = new Map(
      allProductCategories.map(cat => [cat.name.toLowerCase(), cat._id])
    );

    // ⚡ OPTIMIZATION: Batch load all warehouses for this branch ONCE
    const allWarehouses = await Warehouse.find({ branchId });
    const warehouseMap = new Map(
      allWarehouses.map(wh => [wh.name.toLowerCase(), wh._id])
    );

    // ⚡ OPTIMIZATION: Batch load all existing products in this branch
    // Product names are unique per branch, so we can index by name alone for lookup
    const existingProducts = await Product.find({ branchId }, { _id: 1, name: 1, productGroup: 1, purchasingPrice: 1 });
    const existingProductNameMap = new Map(
      existingProducts.map(p => [p.name.toLowerCase().trim().replace(/\s+/g, ' '), p])
    );

    let productsToBulkInsert = [];
    let productsToBulkUpdate = [];
    let skipped = [];
    let alreadyExistsCount = 0;

    // 🔄 First pass: Validate and collect all valid records
    for (const row of rows) {
      const normalizedRow = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.replace(/[\s"\n\r]+/g, "").toLowerCase(),
          String(v || "").trim(),
        ])
      );

      const name = normalizedRow.stockitem || normalizedRow.productname || normalizedRow.itemname || normalizedRow.name || "";
      if (!name) {
        console.warn("⚠️ Skipping row: Missing product name", { row, normalizedRow });
        skipped.push({ row, reason: "Missing product name (Ensure your header is 'Item Name' or 'Name')" });
        continue;
      }

      // Check if product already exists (by name only within branch)
      const normalizedName = name.toLowerCase().trim().replace(/\s+/g, ' ');
      const existingProduct = existingProductNameMap.get(normalizedName);
      const existingProductId = existingProduct?._id;

      // Prepare data object - start EMPTY to only include fields present in row
      let productData = {};

      // Product Group logic: only update if group is provided
      if (normalizedRow.stockgroup !== undefined || normalizedRow.mainstockgroup !== undefined || normalizedRow.productgroup !== undefined || normalizedRow.group !== undefined) {
        const groupName = normalizedRow.stockgroup || normalizedRow.mainstockgroup || normalizedRow.productgroup || normalizedRow.group || "General";
        let groupId = productGroupMap.get(groupName.toLowerCase());
        if (!groupId) {
          try {
            const newGroup = await ProductGroup.create({ name: groupName, branchId });
            groupId = newGroup._id;
            productGroupMap.set(groupName.toLowerCase(), groupId);
          } catch (err) {
            skipped.push({ row, reason: `Could not create product group: ${err.message}` });
            continue;
          }
        }
        productData.productGroup = groupId;
      }

      // Optional fields logic: only add to productData if present in Excel
      if (normalizedRow.perqty !== undefined) productData.perQty = Math.round(Number(normalizedRow.perqty) * 100) / 100;

      // 🔄 Unit Conversion Mapping & Extraction
      const cleanNumber = (val) => {
        if (val === undefined || val === null || val === "") return 1;
        const matched = String(val).match(/(\d+\.?\d*)/);
        return matched ? parseFloat(matched[1]) : 1;
      };

      if (normalizedRow.unit !== undefined || normalizedRow.units !== undefined || normalizedRow.qtyunit !== undefined) {
        productData.units = normalizedRow.unit || normalizedRow.units || normalizedRow.qtyunit;
      }

      const toTitleCase = (str) => {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
      };

      const uUnit = toTitleCase(normalizedRow.qtyunit || normalizedRow.unit || normalizedRow.units || productData.units || "");
      const aUnit = toTitleCase(normalizedRow.altunit || "");
      const uVal = cleanNumber(normalizedRow.unitvalue || normalizedRow.value);
      const aVal = cleanNumber(normalizedRow.altvalue || normalizedRow.altunitvalue);

      if (uUnit || aUnit) {
        productData.unitConversion = {
          unit: uUnit,
          altUnit: aUnit,
          value: uVal,
          altValue: aVal
        };
      }

      if (normalizedRow.totalqty !== undefined) productData.totalQty = Math.round(Number(normalizedRow.totalqty) * 100) / 100;

      // Handle HSN Code (Check multiple aliases)
      let hsnVal = normalizedRow.hsncode || normalizedRow.hsnsac || normalizedRow.hsn;
      if (hsnVal !== undefined) {
        const originalHsn = hsnVal;
        // Smart padding: if it's a numeric string of length 7, 5, 3, or 1, pad with leading zero
        if (/^\d{1,7}$/.test(hsnVal) && hsnVal.length % 2 !== 0) {
          hsnVal = hsnVal.padStart(hsnVal.length + 1, '0');
        }
        if (originalHsn !== hsnVal) {
          console.log(`✨ Smart Padded HSN: "${originalHsn}" -> "${hsnVal}" for product: "${name}"`);
        }
        productData.hsnCode = hsnVal;
      }

      // GST Check
      const gstRaw = normalizedRow['gst%'] || normalizedRow.gst || normalizedRow.gstpercent || normalizedRow.gstrate || normalizedRow['tax%'] || normalizedRow.tax || normalizedRow.taxability;
      if (gstRaw !== undefined) {
        let gst = parseFloat(String(gstRaw).replace(/[^\d.-]/g, ''));
        productData.gst = isNaN(gst) ? 0 : Math.round(gst * 100) / 100;
      }

      // Financials (Prices & Margins)
      let pPrice = undefined;
      if (normalizedRow.purchasingprice !== undefined) {
        pPrice = parseFloat(normalizedRow.purchasingprice.toString().replace(/[^\d.-]/g, ''));
        if (!isNaN(pPrice)) productData.purchasingPrice = Math.round(pPrice * 100) / 100;
      }

      let sPrice = undefined;
      if (normalizedRow.sellingprice !== undefined) {
        sPrice = parseFloat(normalizedRow.sellingprice.toString().replace(/[^\d.-]/g, ''));
        if (!isNaN(sPrice)) productData.sellingPrice = Math.round(sPrice * 100) / 100;
      }

      let marginPercent = undefined;
      // Added aliases for marginPercentage (like "Margin Percentage" -> "marginpercentage")
      const mRaw = normalizedRow.marginpercentage || normalizedRow.margin || normalizedRow['margin%'] || normalizedRow.marginpercent;
      if (mRaw !== undefined) {
        marginPercent = parseFloat(mRaw.toString().replace(/[^\d.-]/g, ''));
        if (!isNaN(marginPercent)) productData.marginPercentage = Math.round(marginPercent * 100) / 100;
      }

      // Calculate/Update consistency between prices and margins
      if (productData.purchasingPrice !== undefined && productData.sellingPrice !== undefined) {
        productData.margin = Math.round((productData.sellingPrice - productData.purchasingPrice) * 100) / 100;
        if (productData.purchasingPrice > 0) {
          productData.marginPercentage = Math.round((productData.margin / productData.purchasingPrice) * 100 * 100) / 100;
        }
      } else if (productData.purchasingPrice !== undefined && productData.marginPercentage !== undefined) {
        productData.margin = Math.round((productData.purchasingPrice * productData.marginPercentage / 100) * 100) / 100;
        productData.sellingPrice = Math.round((productData.purchasingPrice + productData.margin) * 100) / 100;
      } else if (productData.sellingPrice !== undefined && productData.marginPercentage !== undefined) {
        // Back-calculate purchasingPrice: P = S / (1 + M/100)
        productData.purchasingPrice = Math.round((productData.sellingPrice / (1 + productData.marginPercentage / 100)) * 100) / 100;
        productData.margin = Math.round((productData.sellingPrice - productData.purchasingPrice) * 100) / 100;
      } else if (existingProduct && productData.marginPercentage !== undefined && productData.sellingPrice === undefined && productData.purchasingPrice === undefined) {
        // ⚡ SPECIAL CASE: Update margin only for existing product
        // Recalculate selling price based on existing database cost
        const existingCost = existingProduct.purchasingPrice || 0;
        productData.margin = Math.round((existingCost * productData.marginPercentage / 100) * 100) / 100;
        productData.sellingPrice = Math.round((existingCost + productData.margin) * 100) / 100;
        console.log(`✨ Auto-calculated selling price for existing product [${name}]: ₹${productData.sellingPrice} (from ${productData.marginPercentage}% margin)`);
      }

      // Warehouse
      if (normalizedRow.warehouse !== undefined) {
        const whName = normalizedRow.warehouse;
        if (whName) {
          let whId = warehouseMap.get(whName.toLowerCase());
          if (!whId) {
            try {
              const newWH = await Warehouse.create({ name: whName, branchId });
              whId = newWH._id;
              warehouseMap.set(whName.toLowerCase(), whId);
            } catch (err) { console.warn("Warehouse creation failed"); }
          }
          if (whId) productData.warehouse = whId;
        } else {
          productData.warehouse = null;
        }
      }

      // Categories
      if (normalizedRow.productcategories !== undefined || normalizedRow.productcategory !== undefined) {
        const catStr = normalizedRow.productcategories || normalizedRow.productcategory || "";
        const catNames = catStr.split(',').map(c => c.trim()).filter(c => c);
        let categoryIds = [];
        for (const catName of catNames) {
          let catId = productCategoryMap.get(catName.toLowerCase());
          if (!catId) {
            try {
              const newCat = await ProductCategory.create({ name: catName, branchId });
              catId = newCat._id;
              productCategoryMap.set(catName.toLowerCase(), catId);
            } catch (err) { console.warn("Category creation failed"); }
          }
          if (catId) categoryIds.push(catId);
        }
        productData.productCategories = categoryIds;
      }

      // 💰 STOCK AUDIT LOGIC (SIMPLE REPLACE MODE)
      const hasStockColumn = 'totalqty' in normalizedRow || 'qty' in normalizedRow || 'openingquantity' in normalizedRow || 'openingstock' in normalizedRow || 'closingqty' in normalizedRow || 'openingqty' in normalizedRow;

      if (hasStockColumn) {
        const rawQty = normalizedRow.totalqty || normalizedRow.qty || normalizedRow.openingquantity || normalizedRow.openingstock || normalizedRow.closingqty || normalizedRow.openingqty || "";
        const qty = parseFloat(String(rawQty).replace(/[^0-9.-]+/g, "")) || 0;
        productData.totalQty = Math.round(qty * 100) / 100;
        productData.openingQty = productData.totalQty;
        productData.manualOpeningDate = new Date("2026-03-31T23:59:59.999Z");
      }

      if (existingProductId) {
        if (skipExisting === true || skipExisting === "true") {
          alreadyExistsCount++;
          continue;
        }
        // Queue for update
        productsToBulkUpdate.push({
          updateOne: {
            filter: { _id: existingProductId },
            update: { $set: productData }
          }
        });
      } else {
        // Ensure essential defaults for NEW products
        const newProductData = {
          branchId,
          name,
          productGroup: productData.productGroup || (await ProductGroup.findOne({ name: "General", branchId }))?._id || (await ProductGroup.create({ name: "General", branchId }))._id,
          perQty: 1,
          units: "kg",
          totalQty: 0,
          hsnCode: "0000",
          purchasingPrice: 0,
          sellingPrice: 0,
          gst: 0,
          ...productData
        };
        productsToBulkInsert.push(newProductData);
        existingProductNameMap.set(name.toLowerCase(), "pending_insert");
      }

    }

    // ⚡ OPTIMIZATION: Bulk insert all at once
    let insertedCount = 0;
    if (productsToBulkInsert.length > 0) {
      const inserted = await Product.insertMany(productsToBulkInsert, { ordered: false });
      insertedCount = inserted.length;
    }

    let updatedCount = 0;
    if (productsToBulkUpdate.length > 0) {
      const result = await Product.bulkWrite(productsToBulkUpdate, { ordered: false });
      updatedCount = result.modifiedCount;

      // ⚡ DYNAMIC PRICING SYNC (BULK):
      // Trigger sync for all products that had price changes
      const updatedProductIds = productsToBulkUpdate
        .filter(op => op.updateOne.update.$set && op.updateOne.update.$set.purchasingPrice !== undefined)
        .map(op => op.updateOne.filter._id);

      if (updatedProductIds.length > 0) {
        console.log(`📡 Bulk Sync: Triggering price sync for ${updatedProductIds.length} products...`);
        const updatedProducts = await Product.find({ _id: { $in: updatedProductIds } }, { _id: 1, purchasingPrice: 1, name: 1 });

        for (const p of updatedProducts) {
          const lockedPrices = await CustomerLockedPrice.find({ productId: p._id });
          if (lockedPrices.length > 0) {
            const lpOps = lockedPrices.map(lp => {
              // 📈 PERCENTAGE SYNC LOGIC:
              let mPct = lp.marginPercentage;
              if (!mPct || mPct === 0) {
                const refCost = lp.purchasingPrice || p.purchasingPrice;
                mPct = refCost > 0 ? ((lp.margin || (lp.lockedPrice - refCost)) / refCost) * 100 : 0;
              }

              const newLockedPrice = Math.round((p.purchasingPrice + (p.purchasingPrice * mPct / 100)) * 100) / 100;
              const newAbsoluteMargin = Math.round((newLockedPrice - p.purchasingPrice) * 100) / 100;

              return {
                updateOne: {
                  filter: { _id: lp._id },
                  update: {
                    $set: {
                      lockedPrice: newLockedPrice,
                      purchasingPrice: p.purchasingPrice,
                      margin: newAbsoluteMargin,
                      marginPercentage: Math.round(mPct * 100) / 100
                    }
                  }
                }
              };
            });
            await CustomerLockedPrice.bulkWrite(lpOps);
            console.log(`   ✅ Synced ${lockedPrices.length} locked prices for [${p.name}]`);
          }
        }
      }
    }

    // 3️⃣ Log the Bulk Action
    if (insertedCount > 0 || updatedCount > 0) {
      await createAuditLog({
        userId: req.user.id,
        userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
        username: req.user.username,
        branchId,
        action: "PRODUCT_BULK_UPLOAD",
        description: `Bulk product upload completed. Inserted: ${insertedCount}, Updated: ${updatedCount}.`,
      });
    }

    console.log(`✅ Uploaded: ${insertedCount}, 🔄 Updated: ${updatedCount}, ⚠️ Skipped: ${skipped.length}, ⏩ Already Existed: ${alreadyExistsCount}`);

    return res.json({
      message: "Bulk product upload completed",
      insertedCount,
      updatedCount,
      skippedCount: skipped.length + alreadyExistsCount,
      alreadyExistsCount,
      errorCount: skipped.length,
      skipped,
    });
  } catch (err) {
    console.error("Bulk product upload error:", err);
    return res.status(500).json({
      message: "Bulk upload failed",
      error: err.message,
    });
  }
});

// ✅ Snapshot Export of March 31st Stock Balances
// Calculated as: (Live Stock) - (April Inwards) + (April Outwards)
router.get("/export/snapshot-mar31", async (req, res) => {
  try {
    const { branchId } = req.query;
    if (!branchId) return res.status(400).json({ success: false, message: "branchId is required" });

    const startOfApril = new Date("2026-04-01T00:00:00.000Z");
    const products = await Product.find({ branchId }).sort({ name: 1 }).lean();
    const branchOid = new mongoose.Types.ObjectId(branchId);

    // 1. April Inwards (Purchases + Sales Returns)
    const purchases = await PurchaseOrder.aggregate([
      { $match: { branchId: branchOid, status: { $in: ["RECEIVED", "INVOICED"] }, createdAt: { $gte: startOfApril } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", qty: { $sum: "$items.qty" } } }
    ]);
    const pMap = new Map(purchases.map(p => [p._id.toString(), p.qty]));

    const creditNotes = await CreditNote.aggregate([
      { $match: { branchId: branchOid, status: { $in: ["Created", "confirmed"] }, createdAt: { $gte: startOfApril } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", qty: { $sum: "$items.qty" } } }
    ]);
    const cnMap = new Map(creditNotes.map(cn => [cn._id.toString(), cn.qty]));

    // 2. April Outwards (Sales + Purchase Returns)
    const sales = await SalesOrder.aggregate([
      { $match: { branchId: branchOid, invoiceGenerated: true, status: { $ne: "CANCELLED" }, createdAt: { $gte: startOfApril } } },
      { $unwind: "$invoiceItems" },
      { $group: { _id: "$invoiceItems.productId", qty: { $sum: "$invoiceItems.qty" } } }
    ]);
    const sMap = new Map(sales.map(s => [s._id.toString(), s.qty]));

    const debitNotes = await DebitNote.aggregate([
      { $match: { branchId: branchOid, status: "confirmed", createdAt: { $gte: startOfApril } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", qty: { $sum: "$items.returnedQty" } } }
    ]);
    const dnMap = new Map(debitNotes.map(dn => [dn._id.toString(), dn.qty]));

    const results = products.map(p => {
      const pid = p._id.toString();
      const aprIn = (pMap.get(pid) || 0) + (cnMap.get(pid) || 0);
      const aprOut = (sMap.get(pid) || 0) + (dnMap.get(pid) || 0);

      // If openingQty was manually uploaded, use it. Otherwise calculate backwards.
      const snapshotQty = p.manualOpeningDate ? p.openingQty : (p.totalQty - aprIn + aprOut);

      return {
        "Item Name": p.name,
        "HSN": p.hsnCode || "-",
        "Unit": p.units || "-",
        "Stock (31-Mar-2026)": Math.max(0, snapshotQty)
      };
    });

    res.json({ success: true, data: results });
  } catch (error) {
    console.error("Stock March 31 Snapshot Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🔄 RETROACTIVE PRICE SYNC: Rebuild price history from past Invoices
router.post("/sync-past-prices", auth, async (req, res) => {
  try {
    const { branchId } = req.query;
    if (!branchId) return res.status(400).json({ message: "branchId required" });

    // Using dynamic import for the model to ensure it's loaded
    const PurchaseInvoice = (await import("../models/PurchaseInvoice.js")).default;
    const invoices = await PurchaseInvoice.find({ branchId }).sort({ invoiceDate: 1, createdAt: 1 });

    let updateCount = 0;
    let historyCount = 0;

    for (const inv of invoices) {
      if (!inv.items) continue;

      for (const item of inv.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          const newPPrice = Number(item.purchasePrice) || 0;
          const oldPPrice = Number(product.purchasingPrice) || 0;

          if (newPPrice > 0) {
            const oldSPrice = product.sellingPrice || 0;

            // Check if this invoice is already in history to avoid duplicates
            const alreadyLogged = (product.priceHistory || []).some(h => h.sourceVoucher === inv.purchaseInvoiceId);

            if (!alreadyLogged) {
              product.purchasingPrice = newPPrice;
              await product.save(); // Triggers margin calculation

              product.priceHistory.push({
                oldPurchasingPrice: oldPPrice,
                newPurchasingPrice: newPPrice,
                oldSellingPrice: oldSPrice,
                newSellingPrice: product.sellingPrice,
                effectiveDate: inv.invoiceDate || inv.createdAt,
                sourceVoucher: inv.purchaseInvoiceId,
                type: oldPPrice === 0 ? "INITIAL" : (newPPrice > oldPPrice ? "INCREASE" : "DECREASE"),
                note: `Synced from past Purchase Invoice ${inv.purchaseInvoiceId}`
              });
              await product.save();
              historyCount++;
            }
            updateCount++;
          }
        }
      }
    }

    res.json({ success: true, message: `Successfully synced ${updateCount} item entries and created ${historyCount} history records.` });
  } catch (err) {
    console.error("Sync Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// PUT: Update Product
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, productGroup, productCategories = [], perQty, units, totalQty,
      purchasingPrice, sellingPrice, adminMargin, marginPercentage, lockedPrice, margin,
      hsnCode, gst, branchId, unitConversion, openingQty, manualOpeningDate,
      totalQtyUnit, mrp, reorderLevel, reorderQty, leadTime, checkPeriod,
      preferredVendor, minStockQty, maxStockQty, restockingDays, restockingConfig
    } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const oldProduct = await Product.findById(id);
    if (!oldProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Validate productGroup is a valid ObjectId if provided
    if (productGroup && !mongoose.Types.ObjectId.isValid(productGroup)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Product Group ID",
      });
    }

    // Verify product group exists if provided and belongs to same branch
    if (productGroup && (branchId || oldProduct.branchId)) {
      const bid = branchId || oldProduct.branchId;
      const groupExists = await ProductGroup.findOne({ _id: productGroup, branchId: bid });
      if (!groupExists) {
        return res.status(400).json({
          success: false,
          message: "Product Group not found or does not belong to this branch",
        });
      }
    }

    // Prepare update object - only include provided fields
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (productGroup !== undefined) updateData.productGroup = productGroup || null;
    if (productCategories !== undefined) updateData.productCategories = productCategories;
    if (perQty !== undefined) updateData.perQty = Math.round(Number(perQty) * 100) / 100;
    if (units !== undefined) updateData.units = units;
    if (hsnCode !== undefined) updateData.hsnCode = hsnCode;
    if (gst !== undefined) updateData.gst = Math.round(Number(gst) * 100) / 100;
    if (purchasingPrice !== undefined) updateData.purchasingPrice = Math.round(Number(purchasingPrice) * 100) / 100;
    if (sellingPrice !== undefined) updateData.sellingPrice = Math.round(Number(sellingPrice) * 100) / 100;
    if (adminMargin !== undefined) updateData.adminMargin = Math.round(Number(adminMargin) * 100) / 100;
    if (marginPercentage !== undefined) updateData.marginPercentage = Math.round(Number(marginPercentage) * 100) / 100;
    if (lockedPrice !== undefined) updateData.lockedPrice = Math.round(Number(lockedPrice) * 100) / 100;
    if (margin !== undefined) updateData.margin = Math.round(Number(margin) * 100) / 100;
    if (unitConversion !== undefined) updateData.unitConversion = unitConversion;
    if (openingQty !== undefined) updateData.openingQty = Number(openingQty);
    if (manualOpeningDate !== undefined) updateData.manualOpeningDate = manualOpeningDate;

    // Advanced Inventory Fields
    if (totalQtyUnit !== undefined) updateData.totalQtyUnit = totalQtyUnit;
    if (mrp !== undefined) updateData.mrp = Math.round(Number(mrp) * 100) / 100;
    if (reorderLevel !== undefined) updateData.reorderLevel = Number(reorderLevel);
    if (reorderQty !== undefined) updateData.reorderQty = Number(reorderQty);
    if (leadTime !== undefined) updateData.leadTime = Number(leadTime);
    if (checkPeriod !== undefined) updateData.checkPeriod = checkPeriod;
    if (preferredVendor !== undefined) updateData.preferredVendor = preferredVendor;
    if (minStockQty !== undefined) updateData.minStockQty = Number(minStockQty);
    if (maxStockQty !== undefined) updateData.maxStockQty = Number(maxStockQty);
    if (restockingDays !== undefined) updateData.restockingDays = restockingDays;
    if (restockingConfig !== undefined) updateData.restockingConfig = restockingConfig;

    // ⚡ AUTO-RECONCILE: If openingQty or totalQty needs sync
    if (openingQty !== undefined || totalQty !== undefined) {
      const bid = branchId || oldProduct.branchId;
      const branchOid = new mongoose.Types.ObjectId(bid);
      const HARD_ANCHOR_DATE = new Date("2026-03-31T23:59:59Z");

      // Calculate movements for this product ONLY
      const [purchases, sales, debitNotes, creditNotes] = await Promise.all([
        PurchaseOrder.aggregate([
          { $match: { branchId: branchOid, status: { $in: ["RECEIVED", "PARTIALLY_RETURNED", "FULLY_RETURNED", "INVOICED"] }, "items.productId": oldProduct._id, createdAt: { $gt: HARD_ANCHOR_DATE } } },
          { $unwind: "$items" },
          { $match: { "items.productId": oldProduct._id } },
          { $group: { _id: null, total: { $sum: "$items.qty" } } }
        ]),
        SalesOrder.aggregate([
          { $match: { branchId: branchOid, invoiceGenerated: true, status: { $ne: "CANCELLED" }, "invoiceItems.productId": oldProduct._id, createdAt: { $gt: HARD_ANCHOR_DATE } } },
          { $unwind: "$invoiceItems" },
          { $match: { "invoiceItems.productId": oldProduct._id } },
          { $group: { _id: null, total: { $sum: "$invoiceItems.qty" } } }
        ]),
        DebitNote.aggregate([
          { $match: { branchId: branchOid, status: "Created", "items.productId": oldProduct._id, createdAt: { $gt: HARD_ANCHOR_DATE } } },
          { $unwind: "$items" },
          { $match: { "items.productId": oldProduct._id } },
          { $group: { _id: null, total: { $sum: "$items.qty" } } }
        ]),
        CreditNote.aggregate([
          { $match: { branchId: branchOid, status: { $in: ["Created", "confirmed"] }, "items.productId": oldProduct._id, createdAt: { $gt: HARD_ANCHOR_DATE } } },
          { $unwind: "$items" },
          { $match: { "items.productId": oldProduct._id } },
          { $group: { _id: null, total: { $sum: "$items.qty" } } }
        ])
      ]);

      const tIn = (purchases[0]?.total || 0) + (creditNotes[0]?.total || 0);
      const tOut = (sales[0]?.total || 0) + (debitNotes[0]?.total || 0);

      let anchor = oldProduct.openingQty || 0;

      // If openingQty is explicitly updated, use it
      if (openingQty !== undefined) {
        anchor = Number(openingQty);
        updateData.openingQty = anchor;
        updateData.totalQty = anchor + tIn - tOut;
      }
      // If ONLY totalQty is updated (e.g. from UI form edit), DO NOT reverse calculate openingQty!
      // The anchor must remain strictly what was imported. 
      else if (totalQty !== undefined) {
        updateData.totalQty = Math.round(Number(totalQty) * 100) / 100;
      }
    }

    const productToUpdate = await Product.findById(id);
    if (!productToUpdate) return res.status(404).json({ message: "Product not found" });

    productToUpdate._updatedByUser = req.user;
    Object.assign(productToUpdate, updateData);
    const savedProduct = await productToUpdate.save();
    
    const updatedProduct = await Product.findById(savedProduct._id)
      .populate("productGroup", "name")
      .populate("productCategories", "name")
      .populate("warehouse", "name");

    // Log openingQty changes (Inventory Anchor)
    const openingQtyChanged = openingQty !== undefined && Number(openingQty) !== oldProduct.openingQty;
    if (openingQtyChanged) {
      await createAuditLog({
        userId: req.user.id,
        userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
        username: req.user.username,
        branchId: req.user.branch || oldProduct.branchId,
        action: "UPDATE_PRODUCT_OPENING_QTY",
        description: `Updated Opening Stock for ${updatedProduct.name}: ${oldProduct.openingQty} -> ${openingQty}.`,
        targetId: updatedProduct._id,
        targetModel: "Product",
        changes: {
          before: { openingQty: oldProduct.openingQty },
          after: { openingQty: Number(openingQty) }
        }
      });
    }

    // Log price changes if any
    const priceChanged =
      (purchasingPrice !== undefined && Math.round(purchasingPrice * 100) / 100 !== oldProduct.purchasingPrice) ||
      (sellingPrice !== undefined && Math.round(sellingPrice * 100) / 100 !== oldProduct.sellingPrice);

    if (priceChanged) {
      await createAuditLog({
        userId: req.user.id,
        userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
        username: req.user.username,
        branchId: req.user.branch || oldProduct.branchId,
        action: "UPDATE_PRODUCT_PRICE",
        description: `Updated price for product: ${updatedProduct.name}`,
        targetId: id,
        targetModel: "Product",
        changes: {
          before: {
            purchasingPrice: oldProduct.purchasingPrice,
            sellingPrice: oldProduct.sellingPrice,
          },
          after: {
            purchasingPrice: updatedProduct.purchasingPrice,
            sellingPrice: updatedProduct.sellingPrice,
          },
        },
      });
    } else {
      // Log general update
      await createAuditLog({
        userId: req.user.id,
        userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
        username: req.user.username,
        branchId: req.user.branch || oldProduct.branchId,
        action: "UPDATE_PRODUCT",
        description: `Updated product details: ${updatedProduct.name}`,
        targetId: id,
        targetModel: "Product",
      });
    }

    res.json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Update Product Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
    });
  }
});

/**
 * DELETE: Delete Product
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: "Product deleted successfully",
      data: deletedProduct,
    });
  } catch (error) {
    console.error("Delete Product Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
});

/**
 * DELETE: Bulk Delete Products
 */
router.delete("/bulk-delete", auth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "No IDs provided" });
    }

    // Verify all IDs are valid
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.status(400).json({ success: false, message: "No valid IDs provided" });
    }

    const result = await Product.deleteMany({ _id: { $in: validIds } });

    // Optional: Log the bulk delete action
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: req.user.branch,
      action: "BULK_DELETE_PRODUCT",
      description: `Bulk deleted ${result.deletedCount} products`,
      targetModel: "Product",
      changes: { ids: validIds }
    });

    res.json({
      success: true,
      message: `${result.deletedCount} products deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Bulk Delete Product Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform bulk delete",
      error: error.message,
    });
  }
});

// GET: Fetch available qty for a specific product (for Sales Order)
// Formula: Closing Stock = Opening Qty (Anchor) + Total Inwards - Total Outwards
router.get("/available/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const { branchId } = req.query;

    const pOid = new mongoose.Types.ObjectId(productId);
    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const branchOid = product.branchId || new mongoose.Types.ObjectId(branchId);
    if (!branchOid) {
      return res.status(400).json({ success: false, message: "branchId is required" });
    }

    // 🧮 Calculate ALL movements after the anchor for this specific product
    const [purchases, sales, debitNotes, creditNotes] = await Promise.all([
      PurchaseInvoice.aggregate([
        { $match: { branchId: branchOid, "items.productId": pOid, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: "$items" },
        { $match: { "items.productId": pOid } },
        { $group: { _id: null, total: { $sum: "$items.qty" } } }
      ]),
      Invoice.aggregate([
        { $match: { branchId: branchOid, status: { $ne: "CANCELLED" }, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: "$items" },
        { $match: { "items.productId": pOid } },
        { $group: { _id: null, total: { $sum: "$items.qty" } } }
      ]),
      DebitNote.aggregate([
        { $match: { branchId: branchOid, status: { $ne: "Cancelled" }, date: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: "$items" },
        { $match: { "items.productId": pOid, $or: [{ "items.qty": { $gt: 0 } }, { "items.returnedQty": { $gt: 0 } }] } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$items.qty", "$items.returnedQty", 0] } } } }
      ]),
      CreditNote.aggregate([
        { $match: { branchId: branchOid, status: { $ne: "Cancelled" }, createdAt: { $gt: HARD_ANCHOR_DATE } } },
        { $addFields: { effectiveDate: { $ifNull: ["$date", "$createdAt"] } } },
        { $unwind: "$items" },
        { $match: { "items.productId": pOid, $or: [{ "items.qty": { $gt: 0 } }, { "items.returnedQty": { $gt: 0 } }] } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$items.qty", "$items.returnedQty", 0] } } } }
      ])
    ]);

    const inwards = (purchases[0]?.total || 0) + (creditNotes[0]?.total || 0);
    const outwards = (sales[0]?.total || 0) + (debitNotes[0]?.total || 0);

    // Final Live Closing Stock
    const availableQty = (product.openingQty || 0) + inwards - outwards;

    res.json({
      success: true,
      data: {
        productId,
        productName: product.name,
        availableQty: availableQty,
        excelAnchor: product.openingQty || 0,
        movements: { inwards, outwards }
      }
    });
  } catch (error) {
    console.error("Fetch available qty Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch live available qty"
    });
  }
});

// POST: Apply group margin percentage to all products in a group or category

// GET: Group-wise Stock Summary (High Speed Aggregation)
router.get("/stock-group-summary", async (req, res) => {
  try {
    const { branchId, startDate, endDate } = req.query;
    if (!branchId || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Missing required parameters" });
    }

    const branchOid = new mongoose.Types.ObjectId(branchId);

    // 🌍 LOCAL TIMEZONE LOCK: Asia/Kolkata
    // Start of Day IST converted to UTC for DB query
    const reportStart = moment.tz(startDate, "Asia/Kolkata").startOf('day').toDate();
    // End of Day IST converted to UTC
    const reportEnd = moment.tz(endDate, "Asia/Kolkata").endOf('day').toDate();

    // Hard cutoff at the start of original Excel implementation (April 1st IST)
    // Mar 31, 2026 23:59:59 IST = 2026-03-31T18:29:59.999Z

    // ⚡ Execute group-level math directly in MongoDB
    const products = await Product.find({ branchId }).select("productGroup totalQty purchasingPrice manualOpeningDate openingQty").lean();

    const [purchases, sales, debitNotes, creditNotes, psvTotals] = await Promise.all([
      PurchaseInvoice.aggregate([
        { $match: { branchId: branchOid, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            inBeforeReport: { $sum: { $cond: [{ $lt: ["$invoiceDate", reportStart] }, "$items.qty", 0] } },
            inDuringPeriod: { $sum: { $cond: [{ $and: [{ $gte: ["$invoiceDate", reportStart] }, { $lte: ["$invoiceDate", reportEnd] }] }, "$items.qty", 0] } }
          }
        }
      ]),
      Invoice.aggregate([
        { $match: { branchId: branchOid, status: { $ne: "CANCELLED" }, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: "$items" },
        { $match: { "items.qty": { $gt: 0 } } },
        {
          $group: {
            _id: "$items.productId",
            outBeforeReport: { $sum: { $cond: [{ $lt: ["$invoiceDate", reportStart] }, "$items.qty", 0] } },
            outDuringPeriod: { $sum: { $cond: [{ $and: [{ $gte: ["$invoiceDate", reportStart] }, { $lte: ["$invoiceDate", reportEnd] }] }, "$items.qty", 0] } }
          }
        }
      ]),
      DebitNote.aggregate([
        { $match: { branchId: branchOid, status: { $ne: "Cancelled" }, date: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: "$items" },
        { $match: { $or: [{ "items.qty": { $gt: 0 } }, { "items.returnedQty": { $gt: 0 } }] } },
        {
          $group: {
            _id: "$items.productId",
            outBeforeReport: { $sum: { $cond: [{ $lt: ["$date", reportStart] }, { $ifNull: ["$items.qty", "$items.returnedQty", 0] }, 0] } },
            outDuringPeriod: { $sum: { $cond: [{ $and: [{ $gte: ["$date", reportStart] }, { $lte: ["$date", reportEnd] }] }, { $ifNull: ["$items.qty", "$items.returnedQty", 0] }, 0] } }
          }
        }
      ]),
      CreditNote.aggregate([
        { $match: { branchId: branchOid, status: { $ne: "Cancelled" }, createdAt: { $gt: HARD_ANCHOR_DATE } } },
        { $addFields: { effectiveDate: { $ifNull: ["$date", "$createdAt"] } } },
        { $unwind: "$items" },
        { $match: { $or: [{ "items.qty": { $gt: 0 } }, { "items.returnedQty": { $gt: 0 } }] } },
        {
          $group: {
            _id: "$items.productId",
            inBeforeReport: { $sum: { $cond: [{ $lt: ["$effectiveDate", reportStart] }, { $ifNull: ["$items.qty", "$items.returnedQty", 0] }, 0] } },
            inDuringPeriod: { $sum: { $cond: [{ $and: [{ $gte: ["$effectiveDate", reportStart] }, { $lte: ["$effectiveDate", reportEnd] }] }, { $ifNull: ["$items.qty", "$items.returnedQty", 0] }, 0] } }
          }
        }
      ]),
      PhysicalStockEntry.aggregate([
        { $match: { branchId: branchOid, status: "APPROVED" } },
        {
          $addFields: {
            effectiveDate: { $ifNull: ["$entryDate", "$createdAt"] }
          }
        },
        {
          $group: {
            _id: "$productId",
            inBeforeReport: { $sum: { $cond: [{ $lt: ["$effectiveDate", reportStart] }, "$inwardQty", 0] } },
            inDuringPeriod: { $sum: { $cond: [{ $and: [{ $gte: ["$effectiveDate", reportStart] }, { $lte: ["$effectiveDate", reportEnd] }] }, "$inwardQty", 0] } },
            outBeforeReport: { $sum: { $cond: [{ $lt: ["$effectiveDate", reportStart] }, "$outwardQty", 0] } },
            outDuringPeriod: { $sum: { $cond: [{ $and: [{ $gte: ["$effectiveDate", reportStart] }, { $lte: ["$effectiveDate", reportEnd] }] }, "$outwardQty", 0] } }
          }
        }
      ])
    ]);

    const pMap = new Map(purchases.map(p => [p._id.toString(), p]));
    const sMap = new Map(sales.map(s => [s._id.toString(), s]));
    const dnMap = new Map(debitNotes.map(dn => [dn._id.toString(), dn]));
    const cnMap = new Map(creditNotes.map(cn => [cn._id.toString(), cn]));
    const psvMap = new Map(psvTotals.map(psv => [psv._id.toString(), psv]));

    const groupTotals = {};
    products.forEach(product => {
      const gid = (product.productGroup || "uncategorized").toString();
      const pid = product._id.toString();

      const ps = pMap.get(pid) || { inBeforeReport: 0, inDuringPeriod: 0 };
      const ss = sMap.get(pid) || { outBeforeReport: 0, outDuringPeriod: 0 };
      const dns = dnMap.get(pid) || { outBeforeReport: 0, outDuringPeriod: 0 };
      const cns = cnMap.get(pid) || { inBeforeReport: 0, inDuringPeriod: 0 };
      const psv = psvMap.get(pid) || { inBeforeReport: 0, inDuringPeriod: 0, outBeforeReport: 0, outDuringPeriod: 0 };

      // ⚓ CHAIN-LINKED MATH
      // 1. Opening = Excel Anchor + ∑In(Before report) - ∑Out(Before report)
      const excelAnchor = product.openingQty || 0;
      const inBefore = ps.inBeforeReport + cns.inBeforeReport + psv.inBeforeReport;
      const outBefore = ss.outBeforeReport + dns.outBeforeReport + psv.outBeforeReport;

      const openingQty = excelAnchor + inBefore - outBefore;

      // 2. Movements during the selected report period
      const inwards = ps.inDuringPeriod + cns.inDuringPeriod + psv.inDuringPeriod;
      const outwards = ss.outDuringPeriod + dns.outDuringPeriod + psv.outDuringPeriod;

      // 3. Closing = Opening + Inwards - Outwards
      const closingQty = openingQty + inwards - outwards;

      if (!groupTotals[gid]) groupTotals[gid] = { openingQty: 0, openingValue: 0, inwards: 0, outwards: 0, closingQty: 0, closingValue: 0 };

      groupTotals[gid].openingQty += openingQty;
      groupTotals[gid].openingValue += (openingQty * (product.purchasingPrice || 0));
      groupTotals[gid].inwards += inwards;
      groupTotals[gid].outwards += outwards;
      groupTotals[gid].closingQty += closingQty;
      groupTotals[gid].closingValue += (closingQty * (product.purchasingPrice || 0));
    });

    res.json({ success: true, data: groupTotals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET: Stock Journal Report (Opening vs Closing)
router.get("/stock-journal", async (req, res) => {
  try {
    const { branchId, startDate, endDate, productGroupId } = req.query;

    if (!branchId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "branchId, startDate, and endDate are required",
      });
    }

    const branchOid = new mongoose.Types.ObjectId(branchId);

    // 🌍 LOCAL TIMEZONE LOCK: Asia/Kolkata
    const reportStart = moment.tz(startDate, "Asia/Kolkata").startOf('day').toDate();
    const reportEnd = moment.tz(endDate, "Asia/Kolkata").endOf('day').toDate();

    console.log(`📊 Generating Stock Journal: ${branchId} | Group: ${productGroupId || 'ALL'} | ${reportStart.toDateString()} - ${reportEnd.toDateString()}`);

    // 1️⃣ Build Filter for Products
    const productFilter = { branchId };
    if (productGroupId && productGroupId !== "all") {
      productFilter.productGroup = productGroupId;
    }

    // 2️⃣ Fetch Products (Optimized with Select and Lean)
    const products = await Product.find(productFilter)
      .select("name totalQty branchId purchasingPrice sellingPrice manualOpeningDate openingQty productGroup")
      .populate("productGroup", "name")
      .lean();

    if (!products.length) {
      return res.json({ success: true, data: [] });
    }

    const [purchases, sales, debitNotes, creditNotes, psvTotals] = await Promise.all([
      PurchaseInvoice.aggregate([
        { $match: { branchId: branchOid, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            inBeforeReport: { $sum: { $cond: [{ $lt: ["$invoiceDate", reportStart] }, "$items.qty", 0] } },
            inDuringPeriod: { $sum: { $cond: [{ $and: [{ $gte: ["$invoiceDate", reportStart] }, { $lte: ["$invoiceDate", reportEnd] }] }, "$items.qty", 0] } }
          }
        }
      ]),
      Invoice.aggregate([
        { $match: { branchId: branchOid, status: { $ne: "CANCELLED" }, invoiceDate: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: "$items" },
        { $match: { "items.qty": { $gt: 0 } } },
        {
          $group: {
            _id: "$items.productId",
            outBeforeReport: { $sum: { $cond: [{ $lt: ["$invoiceDate", reportStart] }, "$items.qty", 0] } },
            outDuringPeriod: { $sum: { $cond: [{ $and: [{ $gte: ["$invoiceDate", reportStart] }, { $lte: ["$invoiceDate", reportEnd] }] }, "$items.qty", 0] } }
          }
        }
      ]),
      DebitNote.aggregate([
        { $match: { branchId: branchOid, status: { $ne: "Cancelled" }, date: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: "$items" },
        { $match: { $or: [{ "items.qty": { $gt: 0 } }, { "items.returnedQty": { $gt: 0 } }] } },
        {
          $group: {
            _id: "$items.productId",
            outBeforeReport: { $sum: { $cond: [{ $lt: ["$date", reportStart] }, { $ifNull: ["$items.qty", "$items.returnedQty", 0] }, 0] } },
            outDuringPeriod: { $sum: { $cond: [{ $and: [{ $gte: ["$date", reportStart] }, { $lte: ["$date", reportEnd] }] }, { $ifNull: ["$items.qty", "$items.returnedQty", 0] }, 0] } }
          }
        }
      ]),
      CreditNote.aggregate([
        { $match: { branchId: branchOid, status: { $ne: "Cancelled" }, createdAt: { $gt: HARD_ANCHOR_DATE } } },
        { $addFields: { effectiveDate: { $ifNull: ["$date", "$createdAt"] } } },
        { $unwind: "$items" },
        { $match: { $or: [{ "items.qty": { $gt: 0 } }, { "items.returnedQty": { $gt: 0 } }] } },
        {
          $group: {
            _id: "$items.productId",
            inBeforeReport: { $sum: { $cond: [{ $lt: ["$effectiveDate", reportStart] }, { $ifNull: ["$items.qty", "$items.returnedQty", 0] }, 0] } },
            inDuringPeriod: { $sum: { $cond: [{ $and: [{ $gte: ["$effectiveDate", reportStart] }, { $lte: ["$effectiveDate", reportEnd] }] }, { $ifNull: ["$items.qty", "$items.returnedQty", 0] }, 0] } }
          }
        }
      ]),
      PhysicalStockEntry.aggregate([
        { $match: { branchId: branchOid, status: "APPROVED", productId: { $in: products.map(p => p._id) } } },
        {
          $addFields: {
            effectiveDate: { $ifNull: ["$entryDate", "$createdAt"] }
          }
        },
        {
          $group: {
            _id: "$productId",
            inBefore: { $sum: { $cond: [{ $lt: ["$effectiveDate", reportStart] }, "$inwardQty", 0] } },
            inDuring: { $sum: { $cond: [{ $and: [{ $gte: ["$effectiveDate", reportStart] }, { $lte: ["$effectiveDate", reportEnd] }] }, "$inwardQty", 0] } },
            outBefore: { $sum: { $cond: [{ $lt: ["$effectiveDate", reportStart] }, "$outwardQty", 0] } },
            outDuring: { $sum: { $cond: [{ $and: [{ $gte: ["$effectiveDate", reportStart] }, { $lte: ["$effectiveDate", reportEnd] }] }, "$outwardQty", 0] } }
          }
        }
      ])
    ]);

    // Maps for O(1) lookup
    const pMap = new Map(purchases.map(p => [p._id.toString(), { inBefore: p.inBeforeReport, inDuring: p.inDuringPeriod }]));
    const sMap = new Map(sales.map(s => [s._id.toString(), { outBefore: s.outBeforeReport, outDuring: s.outDuringPeriod }]));
    const dnMap = new Map(debitNotes.map(dn => [dn._id.toString(), { outBefore: dn.outBeforeReport, outDuring: dn.outDuringPeriod }]));
    const cnMap = new Map(creditNotes.map(cn => [cn._id.toString(), { inBefore: cn.inBeforeReport, inDuring: cn.inDuringPeriod }]));
    const psvMap = new Map(psvTotals.map(psv => [psv._id.toString(), psv]));

    // 6️⃣ Calculate Journal for each Product
    const journalData = products.map((product) => {
      const pid = product._id.toString();
      const ps = pMap.get(pid) || { inBefore: 0, inDuring: 0 };
      const ss = sMap.get(pid) || { outBefore: 0, outDuring: 0 };
      const dns = dnMap.get(pid) || { outBefore: 0, outDuring: 0 };
      const cns = cnMap.get(pid) || { inBefore: 0, inDuring: 0 };
      const psv = psvMap.get(pid) || { inBefore: 0, inDuring: 0, outBefore: 0, outDuring: 0 };

      const hasAnchor = product.openingQty !== undefined;
      let openingQty, closingQty;

      if (hasAnchor) {
        // Opening = Anchor (Mar 31) + Movements BEFORE Report Start
        openingQty = product.openingQty + ps.inBefore + cns.inBefore + psv.inBefore - ss.outBefore - dns.outBefore - psv.outBefore;
        // Closing = Opening + Movements DURING Report Period
        closingQty = openingQty + ps.inDuring + cns.inDuring + psv.inDuring - ss.outDuring - dns.outDuring - psv.outDuring;
      } else {
        // Fallback if no anchor (Back-calculation from totalQty)
        const totalInSinceReport = ps.inDuring + cns.inDuring + psv.inDuring;
        const totalOutSinceReport = ss.outDuring + dns.outDuring + psv.outDuring;
        openingQty = Math.max(0, product.totalQty - totalInSinceReport + totalOutSinceReport);
        closingQty = product.totalQty;
      }

      const inwards = ps.inDuring + cns.inDuring + psv.inDuring;
      const outwards = ss.outDuring + dns.outDuring + psv.outDuring;

      return {
        productId: pid,
        productName: product.name,
        groupName: product.productGroup?.name || "Uncategorized",
        branchId: product.branchId,
        opening: {
          qty: openingQty,
          rate: product.purchasingPrice || 0,
          amount: Math.round(openingQty * (product.purchasingPrice || 0) * 100) / 100,
        },
        closing: {
          qty: closingQty,
          rate: product.sellingPrice || 0,
          amount: Math.round(closingQty * (product.sellingPrice || 0) * 100) / 100,
        },
        purchasesInPeriod: inwards,
        salesInPeriod: outwards,
      };
    });

    // ⚡ SELF-HEALING SYNC: If ?sync=true, update the database totalQty
    if (req.query.sync === "true") {
      const bulkOps = journalData.map(item => ({
        updateOne: {
          filter: { _id: item.productId },
          update: { $set: { totalQty: item.closing.qty } }
        }
      }));
      if (bulkOps.length > 0) {
        await Product.bulkWrite(bulkOps);
        console.log(`✅ Synced ${bulkOps.length} products with stock journal calculations`);
      }
    }

    res.json({
      success: true,
      data: journalData,
    });
  } catch (error) {
    console.error("Stock Journal API Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate stock journal",
      error: error.message,
    });
  }
});

// GET: Unified Product Ledger (High Speed Merge with Anchor-Aware Opening Balance)
router.get("/:id/ledger", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { branchId, fromDate, toDate } = req.query;
    if (!branchId || !fromDate || !toDate) {
      return res.status(400).json({ success: false, message: "Missing required parameters" });
    }

    const branchOid = new mongoose.Types.ObjectId(branchId);
    const productOid = new mongoose.Types.ObjectId(id);

    // 🌍 LOCAL TIMEZONE LOCK: Asia/Kolkata
    const start = moment.tz(fromDate, "Asia/Kolkata").startOf('day').toDate();
    const end = moment.tz(toDate, "Asia/Kolkata").endOf('day').toDate();

    // 🔗 Fetch Ground Truth (Anchor)
    const product = await Product.findById(id).select("openingQty manualOpeningDate").lean();
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    // 🧮 1. Calculate Movements BEFORE Report Start (Post-Anchor)
    const [pBefore, sBefore, dnBefore, cnBefore, psvBefore] = await Promise.all([
      PurchaseOrder.aggregate([
        { $match: { branchId: branchOid, status: { $in: ["RECEIVED", "PARTIALLY_RETURNED", "FULLY_RETURNED", "INVOICED"] }, date: { $gt: HARD_ANCHOR_DATE, $lt: start } } },
        { $unwind: "$items" },
        { $match: { "items.productId": productOid } },
        { $group: { _id: null, total: { $sum: "$items.qty" } } }
      ]),
      SalesOrder.aggregate([
        { $match: { branchId: branchOid, invoiceGenerated: true, status: { $ne: "CANCELLED" }, orderDate: { $gt: HARD_ANCHOR_DATE, $lt: start } } },
        { $addFields: { effectiveItems: { $cond: [{ $gt: [{ $size: { $ifNull: ["$invoiceItems", []] } }, 0] }, "$invoiceItems", "$items"] } } },
        { $unwind: "$effectiveItems" },
        { $match: { "effectiveItems.productId": productOid } },
        { $group: { _id: null, total: { $sum: "$effectiveItems.qty" } } }
      ]),
      DebitNote.aggregate([
        { $match: { branchId: branchOid, status: "Created", date: { $gt: HARD_ANCHOR_DATE, $lt: start } } },
        { $unwind: "$items" },
        { $match: { "items.productId": productOid } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$items.qty", "$items.returnedQty", 0] } } } }
      ]),
      CreditNote.aggregate([
        { $match: { branchId: branchOid, status: { $in: ["Created", "confirmed"] }, createdAt: { $gt: HARD_ANCHOR_DATE, $lt: start } } },
        { $addFields: { effectiveDate: { $ifNull: ["$date", "$createdAt"] } } },
        { $unwind: "$items" },
        { $match: { "items.productId": productOid } },
        { $group: { _id: null, total: { $sum: "$items.qty" } } }
      ]),
      PhysicalStockEntry.aggregate([
        { $match: { branchId: branchOid, status: "APPROVED", productId: productOid } },
        {
          $addFields: {
            effectiveDate: { $ifNull: ["$entryDate", "$createdAt"] }
          }
        },
        { $match: { effectiveDate: { $gt: HARD_ANCHOR_DATE, $lt: start } } },
        { $group: { _id: null, inward: { $sum: "$inwardQty" }, outward: { $sum: "$outwardQty" } } }
      ])
    ]);

    const openingBalance = (product.openingQty || 0) +
      (pBefore[0]?.total || 0) + (cnBefore[0]?.total || 0) + (psvBefore[0]?.inward || 0) -
      (sBefore[0]?.total || 0) - (dnBefore[0]?.total || 0) - (psvBefore[0]?.outward || 0);

    // 💸 2. Fetch Movements DURING Report Period
    const [sales, purchases, debitNotes, creditNotes, psvs] = await Promise.all([
      Invoice.aggregate([
        { $match: { branchId: branchOid, status: { $ne: "CANCELLED" }, invoiceDate: { $gte: start, $lte: end } } },
        { $unwind: "$items" },
        { $match: { "items.productId": productOid } },
        { $project: { type: "OUTWARD", date: "$invoiceDate", voucherType: { $literal: "Sales Invoice" }, invoiceId: "$invoiceNumber", particulars: "$customer.name", qty: "$items.qty", rate: "$items.sellingPrice", value: { $multiply: ["$items.qty", "$items.sellingPrice"] } } }
      ]),
      PurchaseInvoice.aggregate([
        { $match: { branchId: branchOid, invoiceDate: { $gte: start, $lte: end } } },
        { $unwind: "$items" },
        { $match: { "items.productId": productOid } },
        { $project: { type: "INWARD", date: "$invoiceDate", voucherType: { $literal: "Purchase Invoice" }, invoiceId: "$purchaseInvoiceId", particulars: "$vendor", qty: "$items.qty", rate: "$items.purchasePrice", value: { $multiply: ["$items.qty", "$items.purchasePrice"] } } }
      ]),
      DebitNote.aggregate([
        { $match: { branchId: branchOid, status: { $ne: "Cancelled" }, date: { $gte: start, $lte: end } } },
        { $unwind: "$items" },
        { $match: { "items.productId": productOid, $or: [{ "items.qty": { $gt: 0 } }, { "items.returnedQty": { $gt: 0 } }] } },
        {
          $project: {
            type: "OUTWARD",
            date: "$date",
            voucherType: { $literal: "Debit Note" },
            invoiceId: "$debitNoteId",
            particulars: { $literal: "Pur. Return" },
            qty: { $ifNull: ["$items.qty", "$items.returnedQty", 0] },
            rate: { $ifNull: ["$items.purchasePrice", 0] },
            value: { $multiply: [{ $ifNull: ["$items.qty", "$items.returnedQty", 0] }, { $ifNull: ["$items.purchasePrice", 0] }] }
          }
        }
      ]),
      CreditNote.aggregate([
        { $match: { branchId: branchOid, status: { $ne: "Cancelled" }, createdAt: { $gte: start, $lte: end } } },
        { $addFields: { effectiveDate: { $ifNull: ["$date", "$createdAt"] } } },
        { $unwind: "$items" },
        { $match: { "items.productId": productOid, $or: [{ "items.qty": { $gt: 0 } }, { "items.returnedQty": { $gt: 0 } }] } },
        {
          $project: {
            type: "INWARD",
            date: "$effectiveDate",
            voucherType: { $literal: "Credit Note" },
            invoiceId: "$creditNoteId",
            particulars: { $literal: "Sal. Return" },
            qty: { $ifNull: ["$items.qty", "$items.returnedQty", 0] },
            rate: { $ifNull: ["$items.sellingPrice", 0] },
            value: { $multiply: [{ $ifNull: ["$items.qty", "$items.returnedQty", 0] }, { $ifNull: ["$items.sellingPrice", 0] }] }
          }
        }
      ]),
      PhysicalStockEntry.aggregate([
        { $match: { branchId: branchOid, productId: productOid, status: "APPROVED" } },
        {
          $addFields: {
            effectiveDate: { $ifNull: ["$entryDate", "$createdAt"] }
          }
        },
        { $match: { effectiveDate: { $gte: start, $lte: end } } }
      ])
    ]);

    const psvTxns = psvs.map(p => ({
      type: p.inwardQty > 0 ? "INWARD" : "OUTWARD",
      date: p.effectiveDate || p.entryDate || p.createdAt,
      voucherType: "Stock Journal",
      invoiceId: p.sjId,
      particulars: `Stock Journal (${p.approvedBy?.username || 'Admin'})`,
      qty: p.inwardQty > 0 ? p.inwardQty : p.outwardQty,
      rate: 0,
      value: 0
    }));
    const unified = [...sales, ...purchases, ...debitNotes, ...creditNotes, ...psvTxns].sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      success: true,
      openingBalance,
      data: unified
    });
  } catch (err) {
    console.error("Ledger Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/apply-group-margin", async (req, res) => {
  try {
    const { branchId, productGroupId, productCategoryId, marginPercentage } = req.body;

    if (!branchId || !marginPercentage === undefined) {
      return res.status(400).json({
        success: false,
        message: "branchId and marginPercentage are required"
      });
    }

    if (!productGroupId && !productCategoryId) {
      return res.status(400).json({
        success: false,
        message: "Either productGroupId or productCategoryId is required"
      });
    }

    const query = { branchId };
    let updateMessage = "";

    if (productGroupId) {
      query.productGroup = productGroupId;
      updateMessage = "product group";
    } else if (productCategoryId) {
      query.productCategories = productCategoryId;
      updateMessage = "product category";
    }

    // Find all matching products and update their margin percentage
    const result = await Product.updateMany(
      query,
      {
        marginPercentage: marginPercentage,
        $set: {} // Let the pre-save hook handle margin/price calculations
      }
    );

    // Fetch updated products to trigger pre-save hooks for calculations
    const updatedProducts = await Product.find(query);

    // Round marginPercentage input
    const roundedMargin = Math.round(marginPercentage * 100) / 100;

    // Save each product to trigger pre-save hooks
    for (const product of updatedProducts) {
      product.marginPercentage = roundedMargin;
      await product.save();
    }

    res.status(200).json({
      success: true,
      message: `Applied ${roundedMargin}% margin to ${updatedProducts.length} products in the ${updateMessage}`,
      updatedCount: updatedProducts.length
    });
  } catch (error) {
    console.error("Apply group margin error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to apply group margin"
    });
  }
});

// GET: Calculate selling quantity for a product in last X days
router.get("/:productId/selling-qty/:days", async (req, res) => {
  try {
    const { productId, days } = req.params;
    const { branchId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const daysNum = parseInt(days);
    if (isNaN(daysNum) || daysNum <= 0) {
      return res.status(400).json({ success: false, message: "Days must be a positive number" });
    }

    // Calculate date range (last X days)
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - daysNum * 24 * 60 * 60 * 1000);

    // Query invoices for this branch and product in the date range
    const query = {
      branchId: mongoose.Types.ObjectId.isValid(branchId) ? branchId : undefined,
      invoiceDate: { $gte: startDate, $lte: endDate },
      "items.productId": mongoose.Types.ObjectId.isValid(productId) ? productId : undefined,
    };

    const invoices = await Invoice.find(query).lean();

    // Sum the quantity of this product from all invoices
    let totalQty = 0;
    invoices.forEach((invoice) => {
      if (Array.isArray(invoice.items)) {
        invoice.items.forEach((item) => {
          const itemProductId = item.productId?._id || item.productId;
          if (itemProductId && itemProductId.toString() === productId) {
            totalQty += item.qty || 0;
          }
        });
      }
    });

    res.status(200).json({
      success: true,
      productId,
      days: daysNum,
      sellingQtyInPeriod: totalQty,
      period: { startDate, endDate },
      invoiceCount: invoices.length,
    });
  } catch (error) {
    console.error("Calculate selling qty error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate selling quantity"
    });
  }
});

// PUT: Save/Update product restocking configuration
router.put("/:productId/restocking-config", async (req, res) => {
  try {
    const { productId } = req.params;
    const { salesPeriodDays, threshold, restockingQty, sellingQtyInPeriod } = req.body;

    console.log("📥 Backend received:", {
      productId,
      salesPeriodDays,
      threshold,
      restockingQty,
      sellingQtyInPeriod,
    });

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    // Validate inputs
    if (salesPeriodDays && salesPeriodDays <= 0) {
      return res.status(400).json({ success: false, message: "Sales period days must be positive" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Update restocking config
    product.restockingConfig = {
      salesPeriodDays: salesPeriodDays || product.restockingConfig?.salesPeriodDays || 7,
      sellingQtyInPeriod: sellingQtyInPeriod !== undefined ? sellingQtyInPeriod : product.restockingConfig?.sellingQtyInPeriod || 0,
      threshold: threshold !== undefined && threshold !== null ? parseInt(threshold) : (product.restockingConfig?.threshold || null),
      restockingQty: restockingQty !== undefined && restockingQty !== null ? parseInt(restockingQty) : (product.restockingConfig?.restockingQty || null),
    };

    console.log("💾 Saving to DB:", product.restockingConfig);

    await product.save();

    console.log("✅ Saved successfully!");

    res.status(200).json({
      success: true,
      message: "Restocking configuration updated",
      restockingConfig: product.restockingConfig,
    });
  } catch (error) {
    console.error("Update restocking config error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update restocking configuration"
    });
  }
});

// 🔄 RETROACTIVE PRICE SYNC: Rebuild price history from past Invoices (MOVED TO END FOR STABILITY)
router.post("/sync-past-prices", auth, async (req, res) => {
  try {
    const { branchId } = req.query;
    if (!branchId) return res.status(400).json({ message: "branchId required" });

    const PurchaseInvoice = (await import("../models/PurchaseInvoice.js")).default;
    const invoices = await PurchaseInvoice.find({ branchId }).sort({ invoiceDate: 1, createdAt: 1 });

    let updateCount = 0;
    let historyCount = 0;

    for (const inv of invoices) {
      if (!inv.items) continue;

      for (const item of inv.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          const newPPrice = Number(item.purchasePrice) || 0;
          const oldPPrice = Number(product.purchasingPrice) || 0;

          if (newPPrice > 0) {
            const oldSPrice = product.sellingPrice || 0;
            const alreadyLogged = (product.priceHistory || []).some(h => h.sourceVoucher === inv.purchaseInvoiceId);

            if (!alreadyLogged) {
              product.purchasingPrice = newPPrice;
              await product.save();

              product.priceHistory.push({
                oldPurchasingPrice: oldPPrice,
                newPurchasingPrice: newPPrice,
                oldSellingPrice: oldSPrice,
                newSellingPrice: product.sellingPrice,
                effectiveDate: inv.invoiceDate || inv.createdAt,
                sourceVoucher: inv.purchaseInvoiceId,
                type: oldPPrice === 0 ? "INITIAL" : (newPPrice > oldPPrice ? "INCREASE" : "DECREASE"),
                note: `Synced from past Purchase Invoice ${inv.purchaseInvoiceId}`
              });
              await product.save();
              historyCount++;
            }
            updateCount++;
          }
        }
      }
    }

    res.json({ success: true, message: `Successfully synced ${updateCount} item entries and created ${historyCount} history records.` });
  } catch (err) {
    console.error("Sync Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// POST: Reconcile Live Stock with Anchor-Aware Math
router.post("/reconcile-stock", async (req, res) => {
  try {
    const { branchId } = req.body;
    if (!branchId) return res.status(400).json({ success: false, message: "branchId is required" });

    const branchOid = new mongoose.Types.ObjectId(branchId);
    const HARD_ANCHOR_DATE = new Date("2026-03-31T23:59:59Z");

    // 1. Fetch all products for the branch
    const products = await Product.find({ branchId }).select("name openingQty totalQty").lean();

    // 2. Fetch ALL movements after the anchor
    const [purchases, sales, debitNotes, creditNotes] = await Promise.all([
      PurchaseOrder.aggregate([
        { $match: { branchId: branchOid, status: { $in: ["RECEIVED", "PARTIALLY_RETURNED", "FULLY_RETURNED", "INVOICED"] }, date: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: "$items" },
        { $match: { "items.qty": { $gt: 0 } } },
        { $group: { _id: "$items.productId", totalQty: { $sum: "$items.qty" } } }
      ]),
      SalesOrder.aggregate([
        { $match: { branchId: branchOid, invoiceGenerated: true, status: { $ne: "CANCELLED" }, orderDate: { $gt: HARD_ANCHOR_DATE } } },
        { $addFields: { effectiveItems: { $cond: [{ $gt: [{ $size: { $ifNull: ["$invoiceItems", []] } }, 0] }, "$invoiceItems", "$items"] } } },
        { $unwind: "$effectiveItems" },
        { $match: { "effectiveItems.qty": { $gt: 0 } } },
        { $group: { _id: "$effectiveItems.productId", totalQty: { $sum: "$effectiveItems.qty" } } }
      ]),
      DebitNote.aggregate([
        { $match: { branchId: branchOid, status: "Created", date: { $gt: HARD_ANCHOR_DATE } } },
        { $unwind: "$items" },
        { $match: { $or: [{ "items.qty": { $gt: 0 } }, { "items.returnedQty": { $gt: 0 } }] } },
        { $group: { _id: "$items.productId", totalQty: { $sum: { $ifNull: ["$items.qty", "$items.returnedQty", 0] } } } }
      ]),
      CreditNote.aggregate([
        { $match: { branchId: branchOid, status: { $in: ["Created", "confirmed"] }, createdAt: { $gt: HARD_ANCHOR_DATE } } },
        { $addFields: { effectiveDate: { $ifNull: ["$date", "$createdAt"] } } },
        { $unwind: "$items" },
        { $group: { _id: "$items.productId", totalQty: { $sum: "$items.qty" } } }
      ])
    ]);

    const pMap = new Map(purchases.map(x => [x._id.toString(), x.totalQty]));
    const sMap = new Map(sales.map(x => [x._id.toString(), x.totalQty]));
    const dnMap = new Map(debitNotes.map(x => [x._id.toString(), x.totalQty]));
    const cnMap = new Map(creditNotes.map(x => [x._id.toString(), x.totalQty]));

    // 3. Prepare Bulk Operations
    const bulkOps = products.map(product => {
      const pid = product._id.toString();
      const excelAnchor = product.openingQty || 0;
      const tIn = (pMap.get(pid) || 0) + (cnMap.get(pid) || 0);
      const tOut = (sMap.get(pid) || 0) + (dnMap.get(pid) || 0);

      const correctedQty = excelAnchor + tIn - tOut;

      return {
        updateOne: {
          filter: { _id: product._id },
          update: { $set: { totalQty: correctedQty } }
        }
      };
    });

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
    }

    res.json({ success: true, message: `Successfully synchronized ${bulkOps.length} products with anchor-based math.` });
  } catch (err) {
    console.error("Reconciliation Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

