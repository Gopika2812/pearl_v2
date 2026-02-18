import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import XLSX from "xlsx";
import Product from "../models/Product.js";
import ProductGroup from "../models/ProductGroup.js";

const router = express.Router();

// Configure multer with 50MB limit for bulk uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// POST: Add New Product
router.post("/", async (req, res) => {
  try {
    const { productGroup, name, perQty, units, totalQty, purchasingPrice, sellingPrice, hsnCode, gst } = req.body;

    if (!productGroup || !name || !perQty || !units || hsnCode === undefined) {
      return res.status(400).json({
        success: false,
        message: "Product Group, Name, Per Qty, Units, and HSN Code are required",
      });
    }

    // Validate productGroup is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(productGroup)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Product Group ID",
      });
    }

    // Verify product group exists
    const groupExists = await ProductGroup.findById(productGroup);
    if (!groupExists) {
      return res.status(400).json({
        success: false,
        message: "Product Group not found",
      });
    }

    const product = new Product({
      productGroup,
      name,
      perQty,
      units,
      totalQty: totalQty || 0,
      purchasingPrice: purchasingPrice || 0,
      sellingPrice: sellingPrice || 0,
      hsnCode,
      gst: gst || 0,
    });

    const savedProduct = await product.save();
    const populated = await Product.findById(savedProduct._id).populate("productGroup", "name");

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
    const { page = 1, limit = 50, search = "" } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 50)); // Max 100 per page
    const skip = (pageNum - 1) * pageSize;

    // Build search filter
    const filter = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    // ⚡ Get total count
    const total = await Product.countDocuments(filter);

    // ⚡ Fetch paginated results with lean() for faster performance
    const products = await Product.find(filter)
      .populate("productGroup", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    res.json({
      success: true,
      data: products,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
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

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    console.log("📄 TOTAL ROWS:", rows.length);
    console.log("📄 FIRST ROW RAW:", rows[0]);

    // ⚡ OPTIMIZATION: Batch load all product groups ONCE
    const allProductGroups = await ProductGroup.find({});
    const productGroupMap = new Map(
      allProductGroups.map(group => [group.name.toLowerCase(), group._id])
    );

    // ⚡ OPTIMIZATION: Batch load all existing products
    const existingProducts = await Product.find({});
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
      const perQty = Number(normalized.perqty || 1); // Default to 1
      const units = normalized.units || "kg"; // Default to kg
      const totalQty = Number(normalized.totalqty || 0);
      const purchasingPrice = Number(normalized.purchasingprice || 0);
      const sellingPrice = Number(normalized.sellingprice || 0);
      const hsnCode = normalized.hsncode || "N/A"; // Default to N/A
      const gst = Number(normalized.gst || 0);

      // Only name and product group are mandatory
      if (!name || !groupName) {
        skipped.push({ row, reason: "Missing name or product group" });
        continue;
      }

      // Validate prices (skip if invalid)
      if (gst < 0 || gst > 28) {
        skipped.push({ row, reason: "Invalid GST value (0-28)" });
        continue;
      }

      if (purchasingPrice < 0 || sellingPrice < 0) {
        skipped.push({ row, reason: "Prices cannot be negative" });
        continue;
      }

      if (sellingPrice < purchasingPrice) {
        skipped.push({ row, reason: "Selling price less than purchase price" });
        continue;
      }

      // Lookup Product Group ID from map
      const groupId = productGroupMap.get(groupName.toLowerCase());
      if (!groupId) {
        skipped.push({ row, reason: `Product group "${groupName}" not found` });
        continue;
      }

      // Check if product already exists
      const productKey = `${name}|${groupId}`;
      if (existingProductSet.has(productKey)) {
        skipped.push({ row, reason: "Product already exists" });
        continue;
      }

      // ✅ Valid record - add to bulk insert list
      productsToBulkInsert.push({
        productGroup: groupId,
        name,
        perQty,
        units,
        totalQty,
        purchasingPrice,
        sellingPrice,
        hsnCode,
        gst,
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
    const { name, perQty, units, totalQty, purchasingPrice, sellingPrice, hsnCode, gst } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name,
        perQty,
        units,
        totalQty,
        purchasingPrice,
        sellingPrice,
        hsnCode,
        gst,
      },
      { new: true }
    ).populate("productGroup", "name");

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
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

export default router;
