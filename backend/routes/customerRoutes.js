import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import Customer from "../models/Customer.js";
import SalesOwner from "../models/SalesOwner.js";

const router = express.Router();

// Configure multer with 50MB limit for bulk uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, 
});
// Escape special regex characters
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * POST: Bulk Upload Customers
 */
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  console.log("🔥 CUSTOMER BULK UPLOAD HIT");

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Excel file required" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    console.log("📄 TOTAL ROWS:", rows.length);
    console.log("📄 FIRST ROW RAW:", rows[0]);

    const allSalesOwners = await SalesOwner.find({});
    const salesOwnerMap = new Map(
      allSalesOwners.map(owner => [owner.name.toLowerCase(), owner._id])
    );

    const existingCustomers = await Customer.find({}, { name: 1 });
    const existingNames = new Set(
      existingCustomers.map(c => c.name.toLowerCase())
    );

    let customersToBulkInsert = [];
    let skipped = [];

    // 🔄 First pass: Validate and collect all valid records
    for (const row of rows) {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.replace(/[\s"\n\r]+/g, "").toLowerCase(),
          String(v || "").trim(),
        ])
      );

      const name = normalized.customername;
      const whatsapp = String(normalized.whatsapp || "").trim();
      const email = normalized.email || "";
      const address = normalized.address || "";
      const district = normalized.district || "";
      const state = normalized.state || "";
      const pincode = normalized.pincode || "";
      const country = normalized.country || "India";
      const gstin = normalized.gstin || "";
      const salesOwnerName = normalized.salesowner || "";
      const margin = parseFloat(normalized.margin) || 0;
      const closingBalance = parseFloat(normalized.closingbalance) || 0;

      // Bank Details
      const accountHolder = normalized.accountholdername || "";
      const accountNumber = normalized.accountnumber || "";
      const ifsc = normalized.ifsc || "";
      const branch = normalized.branch || "";
      const upi = normalized.upi || "";

      // 💰 Parse "358062.12 Dr" if totalbalance exists
      let totalBalance = 0;
      let balanceType = "Dr";

      if (normalized.totalbalance) {
        const parts = normalized.totalbalance.split(" ");
        totalBalance = parseFloat(parts[0]) || 0;
        balanceType = parts[1] || "Dr";
      }

      // ❌ Validation checks
      if (!name) {
        skipped.push({ row, reason: "Missing customer name" });
        continue;
      }

      // Check if customer already exists (case-insensitive)
      if (existingNames.has(name.toLowerCase())) {
        skipped.push({ row, reason: "Customer already exists" });
        continue;
      }

      // Lookup SalesOwner ID from map
      let salesOwnerId = null;
      if (salesOwnerName) {
        salesOwnerId = salesOwnerMap.get(salesOwnerName.toLowerCase());
        if (!salesOwnerId) {
          skipped.push({ row, reason: `Sales Owner "${salesOwnerName}" not found` });
          continue;
        }
      }

      // ✅ Valid record - add to bulk insert list
      customersToBulkInsert.push({
        name,
        whatsapp,
        email,
        address,
        district,
        state,
        pincode,
        country,
        gstin,
        totalBalance,
        balanceType,
        closingBalance,
        margin,
        salesOwner: salesOwnerId,
        accountHolder,
        accountNumber,
        ifsc,
        branch,
        upi,
      });
    }

    // ⚡ OPTIMIZATION: Bulk insert all at once instead of one-by-one
    let inserted = [];
    if (customersToBulkInsert.length > 0) {
      inserted = await Customer.insertMany(customersToBulkInsert);
    }

    return res.json({
      message: "Bulk customer upload completed",
      insertedCount: inserted.length,
      skippedCount: skipped.length,
      skipped,
    });
  } catch (err) {
    console.error("Customer bulk upload error:", err);
    return res.status(500).json({
      message: "Bulk upload failed",
      error: err.message,
    });
  }
});

/**
 * GET: Fetch All Customers with Pagination
 */
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 50, search = "" } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 50)); // Max 100 per page
    const skip = (pageNum - 1) * pageSize;

    // Build search filter
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { whatsapp: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { gstin: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    // ⚡ Get total count
    const total = await Customer.countDocuments(filter);

    // ⚡ Fetch paginated results with lean() for faster performance
    const customers = await Customer.find(filter)
      .populate('salesOwner', 'name phone role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    res.json({
      success: true,
      data: customers,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Fetch Customer Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message,
    });
  }
});

/**
 * POST: Add New Customer
 */
router.post("/", async (req, res) => {
  try {
    const {
      name,
      whatsapp,
      email,
      address,
      district,
      state,
      pincode,
      gstin,
      closingBalance,
      margin,
      salesOwner,
      accountHolder,
      accountNumber,
      ifsc,
      branch,
      upi,
    } = req.body;

    // Basic validation
    if (!name || !whatsapp || !accountHolder || !accountNumber || !ifsc || !branch) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    // Optional: prevent duplicate WhatsApp
    const existing = await Customer.findOne({ whatsapp });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Customer already exists with this WhatsApp number",
      });
    }

    const customer = new Customer({
      name,
      whatsapp,
      email,
      address,
      district,
      state,
      pincode,
      gstin,
      closingBalance: parseFloat(closingBalance) || 0,
      margin: parseFloat(margin) || 0,
      salesOwner,
      accountHolder,
      accountNumber,
      ifsc,
      branch,
      upi,
    });

    const savedCustomer = await customer.save();

    res.status(201).json({
      success: true,
      message: "Customer saved successfully",
      data: savedCustomer,
    });
  } catch (error) {
    console.error("Save Customer Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save customer",
      error: error.message,
    });
  }
});

/**
 * PUT: Update Customer
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const customer = await Customer.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.json({
      success: true,
      message: "Customer updated successfully",
      data: customer,
    });
  } catch (error) {
    console.error("Update Customer Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update customer",
      error: error.message,
    });
  }
});

/**
 * DELETE: Delete Customer
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findByIdAndDelete(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.json({
      success: true,
      message: "Customer deleted successfully",
      data: customer,
    });
  } catch (error) {
    console.error("Delete Customer Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete customer",
      error: error.message,
    });
  }
});

export default router;
