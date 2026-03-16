import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import XLSX from "xlsx";
import Vendor from "../models/Vendor.js";

const router = express.Router();

// Configure multer with 50MB limit for bulk uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ✅ BULK UPLOAD Vendors from Excel
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  console.log("🔥 VENDOR BULK UPLOAD HIT");
  console.log("📋 Request body:", req.body);

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Excel file required" });
    }

    const { branchId } = req.body;
    console.log("🔍 Received branchId:", branchId);
    
    if (!branchId || branchId === "undefined" || String(branchId).trim() === "") {
      return res.status(400).json({ 
        message: "branchId is required", 
        received: branchId,
        type: typeof branchId 
      });
    }

    // Validate branchId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ 
        message: "Invalid branchId format",
        received: branchId 
      });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    console.log("📄 TOTAL ROWS:", rows.length);
    console.log("📄 FIRST ROW RAW:", rows[0]);
    
    // Debug: Show normalized column names
    if (rows[0]) {
      const normalizedKeys = Object.keys(Object.fromEntries(
        Object.entries(rows[0]).map(([k, v]) => [
          k.replace(/[\s"\n\r]+/g, "").toLowerCase(),
          String(v || "").trim(),
        ])
      ));
      console.log("📄 NORMALIZED KEYS:", normalizedKeys);
    }

    const existingVendors = await Vendor.find({ branchId }, { name: 1 });
    const existingNames = new Set(
      existingVendors.map(v => v.name.toLowerCase())
    );

    let vendorsToBulkInsert = [];
    let skipped = [];

// 🔄 First pass: Validate and collect all valid records
    for (const row of rows) {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.replace(/[\s"\n\r]+/g, "").toLowerCase(),
          String(v || "").trim(),
        ])
      );

      // Try to find vendor name from multiple possible column names
      const name = normalized.vendorname || normalized.suppliers || normalized.suppliername || "";
      const phone = String(normalized.phone || "").trim();
      const email = normalized.email || "";
      const address = normalized.address || "";
      const stateName = normalized.statename || normalized.state || "";
      const gstRegistrationType = (normalized.gstregistrationtype || normalized.gstregistrationtype || "Regular").toLowerCase().includes("unreg") ? "Unregistered/Consumer" : "Regular";
      // Try to find GSTIN from multiple possible column names (including the slash version)
      const gstin = normalized.gstin || normalized.gstin_uin || normalized.gstinuin || normalized["gstin/uin"] || "";
      const debit = parseFloat(normalized.debit) || 0;
      const credit = parseFloat(normalized.credit) || 0;

      // ❌ Validation checks
      if (!name) {
        skipped.push({ row, reason: "Missing vendor name" });
        continue;
      }

      console.log(`✅ Processing vendor: "${name}" | State: "${stateName}" | GST: "${gstin}"`);

      // Check if vendor already exists (case-insensitive)
      if (existingNames.has(name.toLowerCase())) {
        skipped.push({ row: name, reason: "Vendor already exists in this branch" });
        console.log(`⚠️  Skipped: "${name}" - Already exists`);
        continue;
      }

      // ✅ Valid record - add to bulk insert list
      vendorsToBulkInsert.push({
        branchId: new mongoose.Types.ObjectId(branchId),
        name,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        stateName: stateName || undefined,
        gstRegistrationType,
        gstin: gstin || undefined,
        debit,
        credit,
        isActive: true,
      });

      // Add to existing names to prevent duplicates in same batch
      existingNames.add(name.toLowerCase());
    }

    // 🔄 Second pass: Bulk insert all valid records
    let insertedCount = 0;
    if (vendorsToBulkInsert.length > 0) {
      console.log(`🔄 Attempting to insert ${vendorsToBulkInsert.length} vendors...`);
      console.log("📦 First vendor to insert:", JSON.stringify(vendorsToBulkInsert[0], null, 2));
      try {
        const result = await Vendor.insertMany(vendorsToBulkInsert, { ordered: false });
        insertedCount = result.length;
        console.log(`✅ Successfully inserted ${insertedCount} vendors`);
        console.log("Inserted IDs:", result.map(doc => doc._id));
      } catch (err) {
        // Handle duplicate errors gracefully (with ordered: false, some might insert before error)
        console.error("Bulk insert error:", err.message);
        if (err.insertedDocs && err.insertedDocs.length > 0) {
          insertedCount = err.insertedDocs.length;
          console.log(`⚠️  Partially inserted ${insertedCount} vendors before error`);
        } else {
          console.error("❌ No vendors inserted. Error details:", err.code, err.keyPattern);
        }
      }
    } else {
      console.log(`⚠️  No vendors to insert (all skipped)`);
    }

    console.log(`\n📊 UPLOAD SUMMARY:\n   ✅ Inserted: ${insertedCount}\n   ⚠️  Skipped: ${skipped.length}`);
    console.log("Skipped reasons:", skipped.map(s => `${s.row} - ${s.reason}`).join(", "));

    res.status(201).json({
      message: "Bulk vendor upload completed",
      insertedCount,
      skippedCount: skipped.length,
      skipped,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Bulk upload error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ CREATE vendor
router.post("/", async (req, res) => {
   console.log("POST /api/vendors", req.body);
  try {
    const { name, phone, email, address, stateName, gstRegistrationType, gstin, debit, credit, branchId } = req.body;

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const exists = await Vendor.findOne({ branchId, name });
    if (exists) {
      return res.status(400).json({ message: "Vendor already exists in this branch" });
    }

    const vendor = new Vendor({
      branchId,
      name,
      phone,
      email,
      address,
      stateName,
      gstRegistrationType,
      gstin,
      debit: debit || 0,
      credit: credit || 0,
      isActive: true,
    });

    await vendor.save();
    res.status(201).json(vendor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ GET all vendors (filtered by branchId)
router.get("/", async (req, res) => {
  try {
    const { branchId } = req.query;

    console.log("🔍 GET /vendors endpoint hit");
    console.log("Query branchId (string):", branchId);

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    // Convert string branchId to ObjectId for proper matching
    const branchObjectId = mongoose.Types.ObjectId.isValid(branchId)
      ? new mongoose.Types.ObjectId(branchId)
      : branchId;

    console.log("Converted branchObjectId:", branchObjectId);

    const vendors = await Vendor.find({ branchId: branchObjectId, isActive: true }).sort({
      createdAt: -1,
    });

    console.log(`✅ Found ${vendors.length} vendors for branch ${branchObjectId}`);

    res.json({
      success: true,
      data: vendors,
    });
  } catch (err) {
    console.error("❌ Fetch Vendor Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vendors",
      error: err.message,
    });
  }
});

// ✅ UPDATE vendor
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, stateName, gstRegistrationType, gstin, debit, credit, isActive } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID",
      });
    }

    const updatedVendor = await Vendor.findByIdAndUpdate(
      id,
      {
        name,
        phone,
        email,
        address,
        stateName,
        gstRegistrationType,
        gstin,
        debit,
        credit,
        isActive,
      },
      { new: true }
    );

    if (!updatedVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.json({
      success: true,
      message: "Vendor updated successfully",
      data: updatedVendor,
    });
  } catch (error) {
    console.error("Update Vendor Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update vendor",
      error: error.message,
    });
  }
});

// ✅ DELETE vendor
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID",
      });
    }

    const deletedVendor = await Vendor.findByIdAndDelete(id);

    if (!deletedVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.json({
      success: true,
      message: "Vendor deleted successfully",
      data: deletedVendor,
    });
  } catch (error) {
    console.error("Delete Vendor Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete vendor",
      error: error.message,
    });
  }
});

export default router;
