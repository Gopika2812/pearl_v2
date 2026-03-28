import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import CustomerGroup from "../models/CustomerGroup.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST: Bulk Upload Customer Groups
 */
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  console.log("🔥 CUSTOMER GROUP BULK UPLOAD HIT");

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
      const name = normalized.name || normalized.customergroupname || normalized.customergroup || normalized.customergroups;
      const description = normalized.description || "";

      if (!name) {
        skipped.push({ row, reason: "Missing customer group name" });
        continue;
      }

      const exists = await CustomerGroup.findOne({
        branchId,
        name: name,
      });

      if (exists) {
        console.log(`Customer Group "${name}" already exists`);
        skipped.push({ row, reason: "Already exists" });
        continue;
      }

      try {
        const group = await CustomerGroup.create({
          branchId,
          name,
          description,
        });
        console.log("Created customer group:", group);
        inserted.push(group);
      } catch (createErr) {
        console.error("Error creating customer group:", createErr.message);
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

// 🔹 CREATE Customer Group
router.post("/", async (req, res) => {
  try {
    const { name, description, branchId } = req.body;

    if (!name || !branchId) {
      return res.status(400).json({ message: "Customer group name and branchId are required" });
    }

    const exists = await CustomerGroup.findOne({
      branchId,
      name,
    });

    if (exists) {
      return res.status(400).json({ message: "Customer group already exists" });
    }

    const group = await CustomerGroup.create({
      branchId,
      name,
      description,
    });

    res.json({
      success: true,
      message: "Customer group created successfully",
      data: group,
    });
  } catch (error) {
    console.error("Create customer group error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create customer group",
    });
  }
});

// 🔹 GET ALL Customer Groups
router.get("/", async (req, res) => {
  try {
    const { branchId, page = 1, limit = 50 } = req.query;

    let filter = {};
    if (branchId) {
      filter.branchId = branchId;
    }

    const skip = (page - 1) * limit;

    const groups = await CustomerGroup.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const totalCount = await CustomerGroup.countDocuments(filter);

    res.json({
      success: true,
      data: groups,
      pagination: {
        currentPage: page,
        limit,
        totalRecords: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Get customer groups error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch customer groups",
    });
  }
});

// 🔹 GET ONE Customer Group
router.get("/:id", async (req, res) => {
  try {
    const group = await CustomerGroup.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: "Customer group not found" });
    }

    res.json({
      success: true,
      data: group,
    });
  } catch (error) {
    console.error("Get customer group error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch customer group",
    });
  }
});

// 🔹 UPDATE Customer Group
router.put("/:id", async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Customer group name is required" });
    }

    const group = await CustomerGroup.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: "Customer group not found" });
    }

    // Check if name already exists (excluding current)
    const exists = await CustomerGroup.findOne({
      branchId: group.branchId,
      name,
      _id: { $ne: req.params.id },
    });

    if (exists) {
      return res.status(400).json({ message: "Customer group name already exists" });
    }

    group.name = name;
    group.description = description || group.description;

    await group.save();

    res.json({
      success: true,
      message: "Customer group updated successfully",
      data: group,
    });
  } catch (error) {
    console.error("Update customer group error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update customer group",
    });
  }
});

// 🔹 DELETE Customer Group
router.delete("/:id", async (req, res) => {
  try {
    const group = await CustomerGroup.findByIdAndDelete(req.params.id);

    if (!group) {
      return res.status(404).json({ message: "Customer group not found" });
    }

    res.json({
      success: true,
      message: "Customer group deleted successfully",
      data: group,
    });
  } catch (error) {
    console.error("Delete customer group error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete customer group",
    });
  }
});

export default router;
