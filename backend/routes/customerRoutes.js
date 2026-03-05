import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import XLSX from "xlsx";
import Customer from "../models/Customer.js";
import CustomerCategory from "../models/CustomerCategory.js";
import CustomerGroup from "../models/CustomerGroup.js";
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

    const { branchId } = req.body;
    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
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

    const allCustomerCategories = await CustomerCategory.find({});
    const customerCategoryMap = new Map(
      allCustomerCategories.map(cat => [cat.name.toLowerCase(), cat._id])
    );

    const allCustomerGroups = await CustomerGroup.find({});
    const customerGroupMap = new Map(
      allCustomerGroups.map(group => [group.name.toLowerCase(), group._id])
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
      const country = normalized.country || "India";
      const pincode = normalized.pincode || "";
      const registrationType = (normalized.registrationtype || "regular").toLowerCase();
      const gstin = normalized.gstin || "";
      const salesOwnerName = normalized.salesowner || "";
      const margin = parseFloat(normalized.margin) || 0;
      const credit = parseFloat(normalized.credit) || 0;
      const debit = parseFloat(normalized.debit) || 0;

      // Parse comma-separated categories and groups
      const customerCategoryNames = (normalized.customercategories || "")
        .split(",")
        .map(c => c.trim().toLowerCase())
        .filter(c => c);
      
      const customerGroupNames = (normalized.customergroups || "")
        .split(",")
        .map(g => g.trim().toLowerCase())
        .filter(g => g);

      // Bank Details
      const accountHolder = normalized.accountholder || "";
      const accountNumber = normalized.accountnumber || "";
      const ifsc = normalized.ifsc || "";
      const branch = normalized.branch || "";
      const upi = normalized.upi || "";

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

      // Lookup CustomerCategory IDs from map (optional, multiple)
      let customerCategoryIds = [];
      for (const categoryName of customerCategoryNames) {
        const categoryId = customerCategoryMap.get(categoryName);
        if (!categoryId) {
          skipped.push({ row, reason: `Customer Category "${categoryName}" not found` });
          continue;
        }
        customerCategoryIds.push(categoryId);
      }

      // Lookup CustomerGroup IDs from map (optional, multiple)
      let customerGroupIds = [];
      for (const groupName of customerGroupNames) {
        const groupId = customerGroupMap.get(groupName);
        if (!groupId) {
          skipped.push({ row, reason: `Customer Group "${groupName}" not found` });
          continue;
        }
        customerGroupIds.push(groupId);
      }

      // ✅ Valid record - add to bulk insert list
      customersToBulkInsert.push({
        branchId,
        name,
        whatsapp,
        email,
        address,
        district,
        state,
        country,
        pincode,
        registrationType: (registrationType === "unregistered" ? "unregistered" : "regular"),
        gstin,
        margin: Math.round(margin * 100) / 100,
        credit: Math.round(credit),
        debit: Math.round(debit),
        salesOwner: salesOwnerId,
        customerCategories: customerCategoryIds,
        customerGroups: customerGroupIds,
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
    const { page = 1, limit = 50, search = "", branchId } = req.query;
    
    console.log("🔍 GET /customers endpoint hit");
    console.log("Query params:", { page, limit, search, branchId });

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    // Convert string branchId to ObjectId for proper matching
    const branchObjectId = mongoose.Types.ObjectId.isValid(branchId)
      ? new mongoose.Types.ObjectId(branchId)
      : branchId;

    console.log("Converted branchObjectId:", branchObjectId);

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(10000, Math.max(1, parseInt(limit) || 50)); // Max 10000 per page
    const skip = (pageNum - 1) * pageSize;

    // Build search filter with branchId
    const filter = search
      ? {
          branchId: branchObjectId,
          $or: [
            { name: { $regex: search, $options: "i" } },
            { whatsapp: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { gstin: { $regex: search, $options: "i" } },
          ],
        }
      : { branchId: branchObjectId };

    // ⚡ Get total count
    const total = await Customer.countDocuments(filter);
    console.log(`📊 Total customers matching filter: ${total}`);

    // ⚡ Fetch paginated results with lean() for faster performance
    const customers = await Customer.find(filter)
      .populate('salesOwner', '_id name phone role')
      .populate('customerCategories', '_id name')
      .populate('customerGroups', '_id name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    console.log(`✅ Returned ${customers.length} customers for page ${pageNum}`);

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
      country,
      pincode,
      registrationType,
      gstin,
      margin,
      credit,
      debit,
      salesOwner,
      customerCategories,
      customerGroups,
      accountHolder,
      accountNumber,
      ifsc,
      branch,
      upi,
      branchId,
    } = req.body;

    // Basic validation - only name and branchId are required
    if (!name || !branchId) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing: Customer Name and Branch",
      });
    }

    // Optional: prevent duplicate WhatsApp if provided
    if (whatsapp) {
      const existing = await Customer.findOne({ branchId, whatsapp });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Customer already exists with this WhatsApp number in this branch",
        });
      }
    }

    const customer = new Customer({
      branchId,
      name,
      whatsapp,
      email,
      address,
      district,
      state,
      country: country || "India",
      pincode,
      registrationType: registrationType === "unregistered" ? "unregistered" : "regular",
      gstin,
      margin: Math.round(Number(margin) * 100) / 100 || 0,
      credit: Math.round(Number(credit)) || 0,
      debit: Math.round(Number(debit)) || 0,
      salesOwner,
      customerCategories: Array.isArray(customerCategories) ? customerCategories : [],
      customerGroups: Array.isArray(customerGroups) ? customerGroups : [],
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

    // Round numeric fields if provided
    if (updates.closingBalance !== undefined) {
      updates.closingBalance = Math.round(Number(updates.closingBalance));
    }
    if (updates.margin !== undefined) {
      updates.margin = Math.round(Number(updates.margin) * 100) / 100;
    }
    if (updates.totalBalance !== undefined) {
      updates.totalBalance = Math.round(Number(updates.totalBalance));
    }
    if (updates.credit !== undefined) {
      updates.credit = Math.round(Number(updates.credit));
    }
    if (updates.debit !== undefined) {
      updates.debit = Math.round(Number(updates.debit));
    }

    // Validate registrationType if provided
    if (updates.registrationType && !["regular", "unregistered"].includes(updates.registrationType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid registrationType. Must be 'regular' or 'unregistered'",
      });
    }

    // Ensure arrays stay as arrays
    if (updates.customerCategories && !Array.isArray(updates.customerCategories)) {
      updates.customerCategories = [updates.customerCategories];
    }
    if (updates.customerGroups && !Array.isArray(updates.customerGroups)) {
      updates.customerGroups = [updates.customerGroups];
    }

    const customer = await Customer.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
      .populate('customerCategories', '_id name')
      .populate('customerGroups', '_id name');

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

/* ========== CUSTOMER LOGIN ========== */
router.post("/login", async (req, res) => {
  try {
    const { whatsappNumber, password } = req.body;

    if (!whatsappNumber || !password) {
      return res.status(400).json({ message: "WhatsApp number and password are required" });
    }

    // Find customer by whatsapp number
    const customer = await Customer.findOne({
      whatsapp: whatsappNumber,
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Accept password (default: password123)
    // TODO: Implement proper password hashing with bcrypt
    if (password !== "password123") {
      return res.status(401).json({ message: "Invalid password" });
    }

    res.json({
      success: true,
      token: `customer_${customer._id}`,
      customer: {
        _id: customer._id,
        name: customer.name,
        whatsapp: customer.whatsapp,
        email: customer.email,
        address: customer.address,
        gstin: customer.gstin,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

export default router;
