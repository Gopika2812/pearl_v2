import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import XLSX from "xlsx";
import Product from "../models/Product.js";
import ProductGroup from "../models/ProductGroup.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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

// GET: Fetch All Products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find()
      .populate("productGroup", "name")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products,
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

router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  console.log("🔥 BULK UPLOAD HIT");
  console.log(
    "📦 FILE:",
    req.file?.originalname,
    req.file?.size,
    req.file?.mimetype
  );

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Excel file required" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    console.log("📄 TOTAL ROWS:", rows.length);
    console.log("📄 FIRST ROW RAW:", rows[0]);

    let inserted = [];
    let skipped = [];

    for (const row of rows) {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.replace(/[\s"\n\r]+/g, "").toLowerCase(),
          String(v || "").trim(),
        ])
      );

      console.log("Processing row:", normalized);

      const name = normalized.name;
      const groupName = normalized.productgroup;
      const perQty = Number(normalized.perqty || 0);
      const units = normalized.units;
      const totalQty = Number(normalized.totalqty || 0);
      const purchasingPrice = Number(normalized.purchasingprice || 0);
      const sellingPrice = Number(normalized.sellingprice || 0);
      const hsnCode = normalized.hsncode;
      const gst = Number(normalized.gst || 0);

      if (!name || !groupName || !perQty || !units || !hsnCode) {
        skipped.push({ row, reason: "Missing name / product group / perQty / units / HSN code" });
        continue;
      }

      // Validate prices
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

      // Find product group
      const group = await ProductGroup.findOne({
        name: new RegExp(`^${groupName}$`, "i"),
      });

      if (!group) {
        skipped.push({ row, reason: `Product group "${groupName}" not found` });
        continue;
      }

      // Check if product exists
      const exists = await Product.findOne({
        name,
        productGroup: group._id,
      });

      if (exists) {
        skipped.push({ row, reason: "Product already exists" });
        continue;
      }

      try {
        const product = await Product.create({
          productGroup: group._id,
          name,
          perQty,
          units,
          totalQty,
          purchasingPrice,
          sellingPrice,
          hsnCode,
          gst,
        });

        console.log("✅ Created product:", product._id);
        inserted.push(product);
      } catch (createErr) {
        console.error("Error creating product:", createErr.message);
        skipped.push({ row, reason: `Error: ${createErr.message}` });
      }
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
