import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import Product from "../models/Product.js";
import ProductGroup from "../models/ProductGroup.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });


const extractUnit = (name = "") => {
  const match = name.match(/(\d+)\s*(ml|gm|kg|ltr|lit|g|pcs)/i);
  if (!match) return "1 units";
  return `${match[1]} ${match[2]}`;
};

// POST: Add New Product (minimal)
router.post("/", async (req, res) => {
  try {
    const { name, groupId, unit, hsncode } = req.body;

    if (!name || !groupId || !unit) {
      return res.status(400).json({
        success: false,
        message: "Name, Group and Unit are required",
      });
    }

    const product = new Product({
      name,
      groupId,
      unit,
      hsncode
    });

    const savedProduct = await product.save();

    res.status(201).json({
      success: true,
      message: "Product saved successfully",
      data: savedProduct,
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
    const products = await Product.find().sort({ createdAt: -1 });

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

      const name = normalized.name;
      const groupName = normalized.groupname;
      const hsncode = normalized.hsncode;

      if (!name || !groupName || !hsncode) {
        skipped.push({ row, reason: "Missing name / groupName / hsncode" });
        continue;
      }

      const group = await ProductGroup.findOne({
        name: new RegExp(`^${groupName}$`, "i"),
      });

      if (!group) {
        skipped.push({ row, reason: "Invalid group name" });
        continue;
      }

      const exists = await Product.findOne({
        name,
        groupId: group._id.toString(),
      });

      if (exists) {
        skipped.push({ row, reason: "Product already exists" });
        continue;
      }

      const unit = extractUnit(name); // ✅ derived automatically

      const product = await Product.create({
        name,
        groupId: group._id.toString(),
        unit,
        hsncode,
      });

      inserted.push(product);
    }

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



export default router;
