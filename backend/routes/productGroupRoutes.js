import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import ProductGroup from "../models/ProductGroup.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  console.log("FILE RECEIVED:", req.file);
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Excel file required" });
    }

    // Read Excel
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    console.log("Raw rows from Excel:", JSON.stringify(rows, null, 2));
    console.log("Total rows to process:", rows.length);

    let inserted = [];
    let skipped = [];

    console.log("PARSED ROWS:", rows);

    for (const row of rows) {
      console.log("Processing row:", row);
      const normalized = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.trim().toLowerCase(),
          String(v).trim(),
        ])
      );

      console.log("Normalized row:", normalized);
      const name = normalized.name;

      if (!name) {
        skipped.push({ row, reason: "Missing product group name" });
        continue;
      }

      const exists = await ProductGroup.findOne({
        name: name,
      });

      if (exists) {
        console.log(`Product "${name}" already exists`);
        skipped.push({ row, reason: "Already exists" });
        continue;
      }

      try {
        const group = await ProductGroup.create({
          name,
        });
        console.log("Created product group:", group);
        inserted.push(group);
      } catch (createErr) {
        console.error("Error creating product group:", createErr.message);
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

// 🔹 CREATE Product Group
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Product group name is required" });
    }

    const exists = await ProductGroup.findOne({
      name: name.trim(),
    });

    if (exists) {
      return res
        .status(400)
        .json({ message: "Product Group already exists" });
    }

    const group = new ProductGroup({
      name: name.trim(),
    });

    await group.save();

    return res.status(201).json(group);
  } catch (err) {
    console.error("Product Group save error:", err);
    return res.status(500).json({ message: err.message });
  }
});

// 🔹 GET ALL Product Groups
router.get("/", async (req, res) => {
  try {
    const groups = await ProductGroup.find()
      .sort({ createdAt: -1 });

    return res.json(groups);
  } catch (err) {
    console.error("Product Group fetch error:", err);
    return res.status(500).json({ message: err.message });
  }
});

export default router;



