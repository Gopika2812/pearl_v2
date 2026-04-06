import mongoose from "mongoose";
import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import CustomerLockedPrice from "../models/CustomerLockedPrice.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/**
 * POST: Bulk Upload Customer Locked Prices
 */
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  console.log("🔥 BULK UPLOAD LOCKED PRICES HIT");

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Excel file required" });
    }

    const { branchId } = req.body;
    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    
    let sheetToProcess = null;
    let headerIndex = -1;
    let rows = [];

    // ⚡ SMART SHEET & HEADER DETECTION:
    for (const sheetName of workbook.SheetNames) {
      const currentSheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(currentSheet, { header: 1, defval: "" });
      
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i].map(cell => String(cell || "").trim().toLowerCase());
        // Header marker: Need both Customer and Product/Item Name
        const hasCustomer = row.includes("customer") || row.includes("customer name") || row.includes("party name");
        const hasProduct = row.includes("product") || row.includes("product name") || row.includes("item name") || row.includes("stock item");
        
        if (hasCustomer && hasProduct) {
          headerIndex = i;
          sheetToProcess = currentSheet;
          console.log(`✅ Found valid headers in sheet: "${sheetName}" at row ${i + 1}`);
          
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
      return res.status(400).json({ 
        success: false, 
        message: "Could not find a sheet with 'Customer Name' and 'Product Name' headers." 
      });
    }

    // ⚡ OPTIMIZATION: Load all Customers and Products for this branch once
    const [allCustomers, allProducts] = await Promise.all([
      Customer.find({ branchId }, { _id: 1, name: 1 }),
      Product.find({ branchId }, { _id: 1, name: 1 })
    ]);

    const customerMap = new Map(allCustomers.map(c => [c.name.toLowerCase().trim(), c._id]));
    const productMap = new Map(allProducts.map(p => [p.name.toLowerCase().trim(), p._id]));

    let bulkOps = [];
    let skipped = [];

    for (const row of rows) {
      // Normalize row keys
      const normalizedRow = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.replace(/[\s"\n\r]+/g, "").toLowerCase(),
          String(v || "").trim(),
        ])
      );

      const customerName = normalizedRow.customername || normalizedRow.customer || normalizedRow.partyname || "";
      const productName = normalizedRow.productname || normalizedRow.product || normalizedRow.itemname || normalizedRow.stockitem || "";
      const priceRaw = normalizedRow.lockedprice || normalizedRow.price || normalizedRow.specialprice || "";

      if (!customerName || !productName || !priceRaw) {
        skipped.push({ row, reason: "Missing Customer Name, Product Name, or Price" });
        continue;
      }

      const customerId = customerMap.get(customerName.toLowerCase());
      const productId = productMap.get(productName.toLowerCase());

      if (!customerId) {
        skipped.push({ row, reason: `Customer not found: ${customerName}` });
        continue;
      }
      if (!productId) {
        skipped.push({ row, reason: `Product not found: ${productName}` });
        continue;
      }

      const lockedPrice = parseFloat(priceRaw.replace(/[^\d.-]/g, ''));
      if (isNaN(lockedPrice)) {
        skipped.push({ row, reason: `Invalid Price: ${priceRaw}` });
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: { branchId, customerId, productId },
          update: { $set: { lockedPrice: Math.round(lockedPrice * 100) / 100 } },
          upsert: true
        }
      });
    }

    let updatedCount = 0;
    if (bulkOps.length > 0) {
      const result = await CustomerLockedPrice.bulkWrite(bulkOps, { ordered: false });
      updatedCount = result.upsertedCount + result.modifiedCount;
    }

    res.json({
      success: true,
      message: `Bulk upload completed. Updated/Added: ${updatedCount}, Skipped: ${skipped.length}`,
      updatedCount,
      skippedCount: skipped.length,
      skipped
    });

  } catch (error) {
    console.error("Bulk Upload Locked Prices Error:", error);
    res.status(500).json({ success: false, message: "Bulk upload failed", error: error.message });
  }
});


/**
 * POST: Save or Update Customer Locked Price
 */
router.post("/", async (req, res) => {
  try {
    const { branchId, customerId, productId, lockedPrice } = req.body;

    if (!branchId || !customerId || !productId || lockedPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: "branchId, customerId, productId, and lockedPrice are required",
      });
    }

    // Upsert: update existing or create new
    const result = await CustomerLockedPrice.findOneAndUpdate(
      { branchId, customerId, productId },
      { lockedPrice },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      data: result,
      message: "Customer locked price saved successfully",
    });
  } catch (error) {
    console.error("Save Customer Locked Price Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save customer locked price",
      error: error.message,
    });
  }
});

/**
 * GET: Fetch All Customer Locked Prices for a Branch
 */
router.get("/branch/:branchId", async (req, res) => {
  try {
    const { branchId } = req.params;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "branchId is required",
      });
    }

    const lockedPrices = await CustomerLockedPrice.find({ 
        branchId: new mongoose.Types.ObjectId(branchId) 
      })
      .populate("customerId", "name")
      .populate("productId", "name purchasingPrice sellingPrice")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: lockedPrices,
    });
  } catch (error) {
    console.error("Fetch Branch Locked Prices Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch branch locked prices",
      error: error.message,
    });
  }
});

/**
 * GET: Fetch Customer Locked Price
 */
router.get("/:customerId/:productId", async (req, res) => {
  try {
    const { customerId, productId } = req.params;
    const { branchId } = req.query;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "branchId is required",
      });
    }

    const lockedPriceEntry = await CustomerLockedPrice.findOne({
      branchId: new mongoose.Types.ObjectId(branchId),
      customerId,
      productId,
    });

    if (!lockedPriceEntry) {
      return res.status(404).json({
        success: false,
        message: "No locked price found for this customer and product",
      });
    }

    res.status(200).json({
      success: true,
      data: lockedPriceEntry,
    });
  } catch (error) {
    console.error("Fetch Customer Locked Price Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer locked price",
      error: error.message,
    });
  }
});

/**
 * DELETE: Remove Customer Locked Price
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await CustomerLockedPrice.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    res.status(200).json({ success: true, message: "Locked price removed" });
  } catch (error) {
    console.error("Delete Locked Price Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete" });
  }
});

export default router;
