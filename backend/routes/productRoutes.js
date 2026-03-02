import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import XLSX from "xlsx";
import Product from "../models/Product.js";
import ProductCategory from "../models/ProductCategory.js";
import ProductGroup from "../models/ProductGroup.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import SalesOrder from "../models/SalesOrder.js";
import Warehouse from "../models/Warehouse.js";

const router = express.Router();

// Configure multer with 50MB limit for bulk uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// POST: Add New Product
router.post("/", async (req, res) => {
  try {
    const { productGroup, productCategories = [], name, perQty, units, totalQty, purchasingPrice, sellingPrice, hsnCode, gst, branchId } = req.body;

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

    const product = new Product({
      branchId,
      productGroup: productGroup || null,
      productCategories: validCategoryIds,
      name,
      perQty: Math.round(Number(perQty) || 0),
      units,
      totalQty: Math.round(Number(totalQty) || 0),
      purchasingPrice: Math.round(Number(purchasingPrice) || 0),
      sellingPrice: Math.round(Number(sellingPrice) || 0),
      hsnCode,
      gst: Math.round(Number(gst) || 0),
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

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(10000, Math.max(1, parseInt(limit) || 50)); 
    const skip = (pageNum - 1) * pageSize;

    // Build search filter with branchId
    const filter = search
      ? { branchId, name: { $regex: search, $options: "i" } }
      : { branchId };

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

    // ⚡ Get all PO data aggregated by product in one query
    const poData = await PurchaseOrder.aggregate([
      {
        $match: {
          status: { $in: ["RECEIVED", "PARTIALLY_RETURNED"] }  // Only count received, not PLACED orders
        }
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          totalReceivedQty: { $sum: "$items.qty" }
        }
      }
    ]);

    // ⚡ Get all invoiced data aggregated by product in one query
    const invoicedData = await SalesOrder.aggregate([
      { $unwind: "$invoiceItems" },
      {
        $group: {
          _id: "$invoiceItems.productId",
          totalInvoicedQty: { $sum: "$invoiceItems.qty" }
        }
      }
    ]);

    // Create maps for O(1) lookup
    const poDataMap = new Map();
    for (const po of poData) {
      poDataMap.set(po._id.toString(), po.totalReceivedQty);
    }

    const invoicedDataMap = new Map();
    for (const invoiced of invoicedData) {
      invoicedDataMap.set(invoiced._id.toString(), invoiced.totalInvoicedQty);
    }

    // Enhance products with totalQty and availableQty calculation
    const enhancedProducts = products.map((product) => {
      const productIdStr = product._id.toString();
      const bulkQty = product.totalQty || 0;
      const poQty = poDataMap.get(productIdStr) || 0;
      const invoicedQty = invoicedDataMap.get(productIdStr) || 0;
      const stockReceived = bulkQty + poQty;
      const availableQty = Math.max(0, stockReceived - invoicedQty);
      
      return {
        ...product,
        totalQty: stockReceived,  // Combined: Bulk + PO (for display as "Total Qty")
        availableQty: availableQty  // True available: (Bulk + PO) - Invoiced
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
  console.log("🔥 BULK UPLOAD HIT");

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Excel file required" });
    }

    const { branchId } = req.body;
    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    console.log("📄 TOTAL ROWS:", rows.length);
    console.log("📄 FIRST ROW RAW:", rows[0]);

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
    const existingProducts = await Product.find({ branchId });
    const existingProductSet = new Set(
      existingProducts.map(p => `${p.name}|${p.productGroup}`)
    );

    let productsToBulkInsert = [];
    let skipped = [];

    // 🔄 First pass: Validate and collect all valid records
    for (const row of rows) {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.replace(/[\s"\n\r]+/g, "").toLowerCase(),
          String(v || "").trim(),
        ])
      );

      const name = normalized.name || "";
      const groupName = normalized.productgroup || "";
      const categoriesStr = normalized.productcategories || ""; // Comma-separated list
      const warehouseName = normalized.warehouse || ""; // NEW: Extract warehouse name
      const perQty = Number(normalized.perqty || 1); // Default to 1
      const units = normalized.units || "kg"; // Default to kg
      const totalQty = Number(normalized.totalqty || 0);
      
      // ✅ Better number parsing with fallback and validation
      let purchasingPrice = 0;
      if (normalized.purchasingprice) {
        const parsed = parseFloat(normalized.purchasingprice.toString().replace(/[^\d.-]/g, ''));
        purchasingPrice = isNaN(parsed) ? 0 : parsed;
      }
      
      let sellingPrice = 0;
      if (normalized.sellingprice) {
        const parsed = parseFloat(normalized.sellingprice.toString().replace(/[^\d.-]/g, ''));
        sellingPrice = isNaN(parsed) ? 0 : parsed;
      }
      
      // 💰 Calculate sellingPrice from margin if sellingPrice not provided
      let margin = 0;
      if (normalized.margin) {
        const parsed = parseFloat(normalized.margin.toString().replace(/[^\d.-]/g, ''));
        margin = isNaN(parsed) ? 0 : parsed;
      }
      
      // If sellingPrice is 0 but margin is provided, calculate it
      if (sellingPrice === 0 && margin > 0 && purchasingPrice > 0) {
        sellingPrice = purchasingPrice + (purchasingPrice * margin / 100);
        console.log(`💰 Auto-calculated sellingPrice from margin: ${purchasingPrice} + ${margin}% = ${sellingPrice}`);
      }
      
      const hsnCode = normalized.hsncode || "N/A"; // Default to N/A
      
      let gst = 0;
      if (normalized.gst) {
        const parsed = parseFloat(normalized.gst.toString().replace(/[^\d.-]/g, ''));
        gst = isNaN(parsed) ? 0 : parsed;
      }

      // Only name and product group are mandatory
      if (!name || !groupName) {
        skipped.push({ row, reason: "Missing name or product group" });
        continue;
      }

      // Validate prices
      if (gst < 0 || gst > 28) {
        skipped.push({ row, reason: "Invalid GST value (0-28)" });
        continue;
      }

      // Skip if prices are invalid (but allow 0 for free items)
      if (isNaN(purchasingPrice) || isNaN(sellingPrice)) {
        skipped.push({ row, reason: "Invalid purchasing or selling price" });
        continue;
      }

      if (purchasingPrice < 0 || sellingPrice < 0) {
        skipped.push({ row, reason: "Prices cannot be negative" });
        continue;
      }

      // Only validate selling >= purchasing IF both are provided (not 0)
      if (sellingPrice > 0 && purchasingPrice > 0 && sellingPrice < purchasingPrice) {
        skipped.push({ row, reason: "Selling price less than purchase price" });
        continue;
      }

      // Lookup Product Group ID from map
      const groupId = productGroupMap.get(groupName.toLowerCase());
      if (!groupId) {
        skipped.push({ row, reason: `Product group "${groupName}" not found` });
        continue;
      }

      // Lookup Product Category IDs from map (optional, comma-separated)
      const categoryIds = [];
      if (categoriesStr) {
        const categoryNames = categoriesStr.split(',').map(c => c.trim()).filter(c => c);
        for (const catName of categoryNames) {
          const catId = productCategoryMap.get(catName.toLowerCase());
          if (!catId) {
            skipped.push({ row, reason: `Product category "${catName}" not found` });
            continue;
          }
          categoryIds.push(catId);
        }
        // Skip entire row if any category is invalid
        if (categoryIds.length !== categoryNames.length) {
          continue;
        }
      }

      // Lookup Warehouse ID from map (optional)
      let warehouseId = null;
      if (warehouseName) {
        warehouseId = warehouseMap.get(warehouseName.toLowerCase());
        if (!warehouseId) {
          skipped.push({ row, reason: `Warehouse "${warehouseName}" not found` });
          continue;
        }
      }

      // Check if product already exists
      const productKey = `${name}|${groupId}`;
      if (existingProductSet.has(productKey)) {
        skipped.push({ row, reason: "Product already exists" });
        continue;
      }

      // ✅ Valid record - add to bulk insert list with branchId
      productsToBulkInsert.push({
        branchId,
        productGroup: groupId,
        productCategories: categoryIds,
        warehouse: warehouseId, // NEW: Add warehouse ID
        name,
        perQty: Math.round(perQty),
        units,
        totalQty: Math.round(totalQty),
        purchasingPrice: Math.round(purchasingPrice),
        sellingPrice: Math.round(sellingPrice),
        hsnCode,
        gst: Math.round(gst),
      });
    }

    // ⚡ OPTIMIZATION: Bulk insert all at once
    let inserted = [];
    if (productsToBulkInsert.length > 0) {
      inserted = await Product.insertMany(productsToBulkInsert);
    }

    console.log(`✅ Uploaded: ${inserted.length}, ⚠️ Skipped: ${skipped.length}`);

    return res.json({
      message: "Bulk product upload completed",
      insertedCount: inserted.length,
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

/**
 * PUT: Update Product
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, productGroup, productCategories = [], perQty, units, totalQty, purchasingPrice, sellingPrice, margin, hsnCode, gst, branchId } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
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
    if (productGroup && branchId) {
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

        if (branchId) {
          const categoryExists = await ProductCategory.findOne({ _id: catId, branchId });
          if (!categoryExists) {
            return res.status(400).json({
              success: false,
              message: `Product Category not found or does not belong to this branch: ${catId}`,
            });
          }
        }
        validCategoryIds.push(catId);
      }
    }

    // Prepare update object - only include provided fields
    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (productGroup !== undefined) updateData.productGroup = productGroup || null;
    if (productCategories !== undefined) updateData.productCategories = validCategoryIds;
    if (perQty !== undefined) updateData.perQty = Math.round(Number(perQty));
    if (units !== undefined) updateData.units = units;
    if (totalQty !== undefined) updateData.totalQty = Math.round(Number(totalQty));
    if (hsnCode !== undefined) updateData.hsnCode = hsnCode;
    if (gst !== undefined) updateData.gst = Math.round(Number(gst));
    if (purchasingPrice !== undefined) updateData.purchasingPrice = Math.round(Number(purchasingPrice));
    if (sellingPrice !== undefined) updateData.sellingPrice = Math.round(Number(sellingPrice));
    if (margin !== undefined) updateData.margin = Math.round(Number(margin));

    console.log("📝 Updating product", id, "with data:", updateData);

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("productGroup", "name")
      .populate("productCategories", "name")
      .populate("warehouse", "name");

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    console.log("✅ Product updated:", {
      id: updatedProduct._id,
      purchasingPrice: updatedProduct.purchasingPrice,
      sellingPrice: updatedProduct.sellingPrice,
      margin: updatedProduct.margin,
    });

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

    // 1️⃣ Get PO qty for this product
    const poItems = await PurchaseOrder.aggregate([
      {
        $match: {
          status: { $in: ["RECEIVED", "PARTIALLY_RETURNED"] }  // Only count received, not PLACED orders
        }
      },
      { $unwind: "$items" },
      {
        $match: {
          "items.productId": new mongoose.Types.ObjectId(productId)
        }
      },
      {
        $group: {
          _id: "$items.productId",
          totalReceivedQty: { $sum: "$items.qty" }
        }
      }
    ]);

    // 2️⃣ Get invoiced qty from SalesOrders for this product
    const invoicedItems = await SalesOrder.aggregate([
      { $unwind: "$invoiceItems" },
      {
        $match: {
          "invoiceItems.productId": new mongoose.Types.ObjectId(productId)
        }
      },
      {
        $group: {
          _id: "$invoiceItems.productId",
          totalInvoicedQty: { $sum: "$invoiceItems.qty" }
        }
      }
    ]);

    const poQty = poItems.length > 0 ? poItems[0].totalReceivedQty : 0;
    const bulkQty = product.totalQty || 0;
    const invoicedQty = invoicedItems.length > 0 ? invoicedItems[0].totalInvoicedQty : 0;
    
    // 3️⃣ Calculate: Available = (Bulk + PO) - Invoiced
    const stockReceived = bulkQty + poQty;
    const availableQty = stockReceived - invoicedQty;

    res.json({
      success: true,
      data: {
        productId,
        productName: product.name,
        bulkQty,
        poQty,
        invoicedQty,
        stockReceived,
        availableQty: Math.max(0, availableQty) // Never show negative
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

export default router;

