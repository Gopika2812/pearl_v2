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
    const existingVendorsMap = new Map(
      existingVendors.map(v => [v.name.toLowerCase(), v._id])
    );

    let vendorsToBulkInsert = [];
    let vendorsToBulkUpdate = [];
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
      const name = normalized.vendorname || normalized.suppliers || normalized.suppliername || normalized.name || normalized.vendor || "";
      const phone = String(normalized.phone || normalized.whatsapp || normalized.mobilenumber || "").trim();
      const email = normalized.email || "";
      const address = normalized.address || "";
      const stateName = normalized.statename || normalized.state || "";
      const gstRegistrationType = (normalized.gstregistrationtype || normalized.registrationtype || "Regular").toLowerCase().includes("unreg") ? "Unregistered/Consumer" : "Regular";
      
      // Try to find GSTIN from multiple possible column names
      const gstin = normalized.gstin || normalized.gstin_uin || normalized.gstinuin || normalized["gstin/uin"] || "";
      
      // Parse debit/credit fields more robustly
      const rawDebit = normalized.debit || normalized.debitbalance || normalized["debit(₹)"] || normalized.dr || normalized.openingdebit || "";
      const rawCredit = normalized.credit || normalized.creditbalance || normalized["credit(₹)"] || normalized.cr || normalized.openingcredit || "";
      
      const debit = parseFloat(String(rawDebit).replace(/[^0-9.-]+/g, "")) || 0;
      const credit = parseFloat(String(rawCredit).replace(/[^0-9.-]+/g, "")) || 0;

      // ❌ Validation checks
      if (!name) {
        skipped.push({ row, reason: "Missing vendor name (Checked: vendorname, suppliers, suppliername, name, vendor)" });
        continue;
      }

      // Check if vendor already exists (case-insensitive)
      const existingVendorId = existingVendorsMap.get(name.toLowerCase());

      const vendorData = {
        branchId: new mongoose.Types.ObjectId(branchId),
        name,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        stateName: stateName || undefined,
        gstRegistrationType,
        gstin: gstin || undefined,
        debit: Math.round(debit * 100) / 100,
        credit: Math.round(credit * 100) / 100,
        isActive: true,
      };

      if (existingVendorId && existingVendorId !== "pending_insert") {
        // Queue for update
        vendorsToBulkUpdate.push({
          updateOne: {
            filter: { _id: existingVendorId },
            update: { $set: vendorData }
          }
        });
        console.log(`🔄 Queued for update: "${name}"`);
      } else {
        // Queue for insert
        vendorsToBulkInsert.push(vendorData);
        // Add to map to prevent duplicates in same batch creating multiple inserts
        existingVendorsMap.set(name.toLowerCase(), "pending_insert");
      }
    }

    // 🔄 Second pass: Bulk insert all valid new records
    let insertedCount = 0;
    if (vendorsToBulkInsert.length > 0) {
      console.log(`🔄 Attempting to insert ${vendorsToBulkInsert.length} new vendors...`);
      try {
        const result = await Vendor.insertMany(vendorsToBulkInsert, { ordered: false });
        insertedCount = result.length;
        console.log(`✅ Successfully inserted ${insertedCount} vendors`);
      } catch (err) {
        console.error("Bulk insert error:", err.message);
        if (err.insertedDocs && err.insertedDocs.length > 0) {
          insertedCount = err.insertedDocs.length;
          console.log(`⚠️  Partially inserted ${insertedCount} vendors before error`);
        }
      }
    }

    // 🔄 Third pass: Bulk update all existing records
    let updatedCount = 0;
    if (vendorsToBulkUpdate.length > 0) {
      console.log(`🔄 Attempting to update ${vendorsToBulkUpdate.length} existing vendors...`);
      try {
        const result = await Vendor.bulkWrite(vendorsToBulkUpdate, { ordered: false });
        updatedCount = result.modifiedCount;
        console.log(`✅ Successfully updated ${updatedCount} vendors`);
      } catch (err) {
        console.error("Bulk update error:", err.message);
      }
    }

    console.log(`\n📊 UPLOAD SUMMARY:\n   ✅ Inserted: ${insertedCount}\n   🔄 Updated: ${updatedCount}\n   ⚠️  Skipped: ${skipped.length}`);
    console.log("Skipped reasons:", skipped.map(s => `${s.row} - ${s.reason}`).join(", "));

    res.status(201).json({
      message: "Bulk vendor upload completed",
      insertedCount,
      updatedCount,
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

// ✅ GET single vendor
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid vendor ID" });
    }

    const vendor = await Vendor.findById(id);

    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    res.json(vendor);
  } catch (error) {
    console.error("Fetch Single Vendor Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch vendor", error: error.message });
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
