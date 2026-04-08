import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import XLSX from "xlsx";
import CreditNote from "../models/CreditNote.js";
import DebitNote from "../models/DebitNote.js";
import Invoice from "../models/Invoice.js";
import Product from "../models/Product.js";
import ProductCategory from "../models/ProductCategory.js";
import ProductGroup from "../models/ProductGroup.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import SalesOrder from "../models/SalesOrder.js";
import Warehouse from "../models/Warehouse.js";

import auth from "../middleware/auth.js";
import { createAuditLog } from "../utils/logUtil.js";

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
    const { page = 1, limit = 50, search = "", diag = "", branchId } = req.query;

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
    const pageSize = Math.min(10000, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * pageSize;

    // Build search filter with branchId (using ObjectId)
    const filter = search
      ? { branchId: branchObjectId, name: { $regex: search, $options: "i" } }
      : { branchId: branchObjectId };

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

    // ⚡ Return product with current ground-truth totalQty from DB
    const enhancedProducts = products.map((product) => {
      return {
        ...product,
        availableQty: product.totalQty || 0  // Use DB ground truth
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

    console.log(`✅ Found ${products.length} products for group ${productGroupId}`);

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
    const existingProducts = await Product.find({ branchId }, { _id: 1, name: 1, productGroup: 1 });
    const existingProductNameMap = new Map(
      existingProducts.map(p => [p.name.toLowerCase(), p._id])
    );

    let productsToBulkInsert = [];
    let productsToBulkUpdate = [];
    let skipped = [];

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
      const existingProductId = existingProductNameMap.get(name.toLowerCase());

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

      if (existingProductId) {
        // ONLY update if we actually have fields to update AND skipExisting is false
        if (!skipExisting && Object.keys(productData).length > 0) {
          productsToBulkUpdate.push({
            updateOne: {
              filter: { _id: existingProductId },
              update: { $set: productData }
            }
          });
        } else if (skipExisting) {
          console.log(`⏩ Skipping existing product: "${name}"`);
        }
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
    }

    console.log(`✅ Uploaded: ${insertedCount}, 🔄 Updated: ${updatedCount}, ⚠️ Skipped: ${skipped.length}`);

    return res.json({
      message: "Bulk product upload completed",
      insertedCount,
      updatedCount,
      skippedCount: skipped.length,
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

// PUT: Update Product
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, productGroup, productCategories = [], perQty, units, totalQty, purchasingPrice, sellingPrice, adminMargin, marginPercentage, lockedPrice, margin, hsnCode, gst, branchId, unitConversion } = req.body;

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
    if (totalQty !== undefined) updateData.totalQty = Math.round(Number(totalQty) * 100) / 100;
    if (hsnCode !== undefined) updateData.hsnCode = hsnCode;
    if (gst !== undefined) updateData.gst = Math.round(Number(gst) * 100) / 100;
    if (purchasingPrice !== undefined) updateData.purchasingPrice = Math.round(Number(purchasingPrice) * 100) / 100;
    if (sellingPrice !== undefined) updateData.sellingPrice = Math.round(Number(sellingPrice) * 100) / 100;
    if (adminMargin !== undefined) updateData.adminMargin = Math.round(Number(adminMargin) * 100) / 100;
    if (marginPercentage !== undefined) updateData.marginPercentage = Math.round(Number(marginPercentage) * 100) / 100;
    if (lockedPrice !== undefined) updateData.lockedPrice = Math.round(Number(lockedPrice) * 100) / 100;
    if (margin !== undefined) updateData.margin = Math.round(Number(margin) * 100) / 100;
    if (unitConversion !== undefined) updateData.unitConversion = unitConversion;

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("productGroup", "name")
      .populate("productCategories", "name")
      .populate("warehouse", "name");

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

// GET: Fetch available qty for a specific product (for Sales Order)
// Formula: Available = (Product.totalQty + PO qty) - SalesOrder invoiced qty
router.get("/available/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ⚡ Logic: The Product.totalQty field in the DB is already updated by Invoice/Purchase triggers.
    // Manual aggregation of POs and SalesOrders is redundant and causes discrepancies.
    const currentStock = product.totalQty || 0;

    res.json({
      success: true,
      data: {
        productId,
        productName: product.name,
        availableQty: currentStock // Direct ground truth from DB
      }
    });
  } catch (error) {
    console.error("Fetch available qty Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available qty"
    });
  }
});

// POST: Apply group margin percentage to all products in a group or category

// GET: Stock Journal Report (Opening vs Closing)
router.get("/stock-journal", async (req, res) => {
  try {
    const { branchId, startDate, endDate } = req.query;

    if (!branchId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "branchId, startDate, and endDate are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // End of the day

    console.log(`📊 Generating Stock Journal: ${branchId} | ${start.toDateString()} - ${end.toDateString()}`);

    // 1️⃣ Fetch All Products for the Branch
    const products = await Product.find({ branchId }).lean();
    if (!products.length) {
      return res.json({ success: true, data: [] });
    }

    const branchOid = new mongoose.Types.ObjectId(branchId);

    // 2️⃣ Aggregate Purchase Orders (Inbound)
    const purchases = await PurchaseOrder.aggregate([
      {
        $match: {
          branchId: branchOid,
          status: { $in: ["RECEIVED", "PARTIALLY_RETURNED", "INVOICED"] },
          // We need everything created AFTER the start date to back-calculate opening
          createdAt: { $gte: start },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          afterStart: { $sum: "$items.qty" },
          afterEnd: {
            $sum: {
              $cond: [{ $gt: ["$createdAt", end] }, "$items.qty", 0],
            },
          },
          duringPeriod: {
            $sum: {
              $cond: [{ $lte: ["$createdAt", end] }, "$items.qty", 0],
            },
          },
        },
      },
    ]);

    // 3️⃣ Aggregate Sales Orders (Outbound)
    const sales = await SalesOrder.aggregate([
      {
        $match: {
          branchId: branchOid,
          invoiceGenerated: true,
          createdAt: { $gte: start },
        },
      },
      { $unwind: "$invoiceItems" },
      {
        $group: {
          _id: "$invoiceItems.productId",
          afterStart: { $sum: "$invoiceItems.qty" },
          afterEnd: {
            $sum: {
              $cond: [{ $gt: ["$createdAt", end] }, "$invoiceItems.qty", 0],
            },
          },
          duringPeriod: {
            $sum: {
              $cond: [{ $lte: ["$createdAt", end] }, "$invoiceItems.qty", 0],
            },
          },
        },
      },
    ]);

    // 4️⃣ Aggregate Debit Notes (Outbound - Purchase Return)
    const debitNotes = await DebitNote.aggregate([
      {
        $match: {
          branchId: branchOid,
          status: "confirmed",
          createdAt: { $gte: start },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          afterStart: { $sum: "$items.returnedQty" },
          afterEnd: {
            $sum: {
              $cond: [{ $gt: ["$createdAt", end] }, "$items.returnedQty", 0],
            },
          },
          duringPeriod: {
            $sum: {
              $cond: [{ $lte: ["$createdAt", end] }, "$items.returnedQty", 0],
            },
          },
        },
      },
    ]);

    // 5️⃣ Aggregate Credit Notes (Inbound - Sales Return)
    const creditNotes = await CreditNote.aggregate([
      {
        $match: {
          branchId: branchOid,
          status: { $in: ["Created", "confirmed"] },
          createdAt: { $gte: start },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          afterStart: { $sum: "$items.qty" },
          afterEnd: {
            $sum: {
              $cond: [{ $gt: ["$createdAt", end] }, "$items.qty", 0],
            },
          },
          duringPeriod: {
            $sum: {
              $cond: [{ $lte: ["$createdAt", end] }, "$items.qty", 0],
            },
          },
        },
      },
    ]);

    // Maps for O(1) lookup
    const pMap = new Map(purchases.map(p => [p._id.toString(), p]));
    const sMap = new Map(sales.map(s => [s._id.toString(), s]));
    const dnMap = new Map(debitNotes.map(dn => [dn._id.toString(), dn]));
    const cnMap = new Map(creditNotes.map(cn => [cn._id.toString(), cn]));

    // 6️⃣ Calculate Journal for each Product
    const journalData = products.map((product) => {
      const pid = product._id.toString();
      const p = pMap.get(pid) || { afterStart: 0, afterEnd: 0, duringPeriod: 0 };
      const s = sMap.get(pid) || { afterStart: 0, afterEnd: 0, duringPeriod: 0 };
      const dn = dnMap.get(pid) || { afterStart: 0, afterEnd: 0, duringPeriod: 0 };
      const cn = cnMap.get(pid) || { afterStart: 0, afterEnd: 0, duringPeriod: 0 };

      const totalQty = product.totalQty || 0;

      // 🔄 BACK-CALCULATION LOGIC:
      // Opening Qty (at Start) = Current - (In since Start) + (Out since Start)
      const afterIn = p.afterStart + cn.afterStart;
      const afterOut = s.afterStart + dn.afterStart;
      const openingQty = totalQty - afterIn + afterOut;

      // Closing Qty (at End) = Current - (In since End) + (Out since End)
      const endIn = p.afterEnd + cn.afterEnd;
      const endOut = s.afterEnd + dn.afterEnd;
      const closingQty = totalQty - endIn + endOut;

      return {
        productId: pid,
        productName: product.name,
        branchId: product.branchId, // Inclusion of BranchId for diagnostics
        opening: {
          qty: Math.max(0, openingQty),
          rate: product.purchasingPrice || 0,
          amount: Math.round(Math.max(0, openingQty) * (product.purchasingPrice || 0) * 100) / 100,
        },
        closing: {
          qty: Math.max(0, closingQty),
          rate: product.sellingPrice || 0,
          amount: Math.round(Math.max(0, closingQty) * (product.sellingPrice || 0) * 100) / 100,
        },
        purchasesInPeriod: p.duringPeriod + cn.duringPeriod, // Total "In" (Purchases + Returns to us)
        salesInPeriod: s.duringPeriod + dn.duringPeriod,    // Total "Out" (Sales + Returns to supplier)
      };
    });

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

export default router;

