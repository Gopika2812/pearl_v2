import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import CustomerCategory from "../models/CustomerCategory.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  console.log("FILE RECEIVED:", req.file);
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Excel file required" });
    }

    const { branchId } = req.body;
    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    // Read Excel
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    console.log("Raw rows from Excel:", JSON.stringify(rows, null, 2));
    console.log("Total rows to process:", rows.length);

    let inserted = [];
    let skipped = [];

    for (const row of rows) {
      console.log("Processing row:", row);
      const normalized = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.replace(/[\s"\n\r]+/g, "").toLowerCase(),
          String(v || "").trim(),
        ])
      );

      console.log("Normalized row:", normalized);
      const name = normalized.name || normalized.customercategory || normalized.customercategories;
      const description = normalized.description || "";

      if (!name) {
        skipped.push({ row, reason: "Missing customer category name" });
        continue;
      }

      const exists = await CustomerCategory.findOne({
        branchId,
        name: name,
      });

      if (exists) {
        console.log(`Customer Category "${name}" already exists`);
        skipped.push({ row, reason: "Already exists" });
        continue;
      }

      try {
        const category = await CustomerCategory.create({
          branchId,
          name,
          description,
        });
        console.log("Created customer category:", category);
        inserted.push(category);
      } catch (createErr) {
        console.error("Error creating customer category:", createErr.message);
        skipped.push({ row, reason: `Error: ${createErr.message}` });
      }
    }

    console.log("Upload summary - Inserted:", inserted.length, "Skipped:", skipped.length);

    return res.json({
      message: "Bulk upload completed",
      insertedCount: inserted.length,
      skippedCount: skipped.length,
      skipped,
    });
  } catch (err) {
    console.error("Bulk upload error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 🔹 CREATE Customer Category
router.post("/", async (req, res) => {
  try {
    const { name, description, branchId } = req.body;

    if (!name || !branchId) {
      return res.status(400).json({ message: "Customer category name and branchId are required" });
    }

    const exists = await CustomerCategory.findOne({
      branchId,
      name: name.trim(),
    });

    if (exists) {
      return res
        .status(400)
        .json({ message: "Customer Category already exists in this branch" });
    }

    const category = new CustomerCategory({
      branchId,
      name: name.trim(),
      description: description || "",
    });

    await category.save();

    return res.status(201).json(category);
  } catch (err) {
    console.error("Customer Category save error:", err);
    return res.status(500).json({ message: err.message });
  }
});

// 🔹 GET ALL Customer Categories (filtered by branchId)
router.get("/", async (req, res) => {
  try {
    const { branchId } = req.query;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    console.log(`🔍 Fetching CustomerCategories for branchId: ${branchId}`);

    const categories = await CustomerCategory.find({ branchId })
      .sort({ createdAt: -1 })
      .lean();

    console.log(`✅ Found ${categories.length} CustomerCategories:`, categories.map(c => ({ _id: c._id, name: c.name, branchId: c.branchId })));

    return res.json(categories);
  } catch (err) {
    console.error("Customer Category fetch error:", err);
    return res.status(500).json({ message: err.message });
  }
});

// 🔹 GET Single Customer Category
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const category = await CustomerCategory.findById(id);

    if (!category) {
      return res.status(404).json({ message: "Customer Category not found" });
    }

    return res.json(category);
  } catch (err) {
    console.error("Customer Category fetch error:", err);
    return res.status(500).json({ message: err.message });
  }
});

// 🔹 UPDATE Customer Category
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const category = await CustomerCategory.findByIdAndUpdate(
      id,
      { name: name.trim(), description: description || "" },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ message: "Customer Category not found" });
    }

    return res.json(category);
  } catch (err) {
    console.error("Customer Category update error:", err);
    return res.status(500).json({ message: err.message });
  }
});

// 🔹 DELETE Customer Category
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const category = await CustomerCategory.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).json({ message: "Customer Category not found" });
    }

    return res.json({ message: "Customer Category deleted successfully" });
  } catch (err) {
    console.error("Customer Category delete error:", err);
    return res.status(500).json({ message: err.message });
  }
});

export default router;
