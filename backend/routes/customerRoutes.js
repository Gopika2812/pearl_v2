import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import XLSX from "xlsx";
import CreditNote from "../models/CreditNote.js";
import Customer from "../models/Customer.js";
import CustomerCategory from "../models/CustomerCategory.js";
import CustomerGroup from "../models/CustomerGroup.js";
import OtherTransaction from "../models/OtherTransaction.js";
import Receipt from "../models/Receipt.js";
import SalesOrder from "../models/SalesOrder.js";
import SalesOwner from "../models/SalesOwner.js";
import Invoice from "../models/Invoice.js";
import AuditLog from "../models/AuditLog.js";
import OverrideRequest from "../models/OverrideRequest.js";

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
  const { branchId, updateMode = "opening_balance" } = req.body;
  console.log(`🔥 CUSTOMER BULK UPLOAD HIT (Mode: ${updateMode})`);

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Excel file required" });
    }
    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" });

    console.log("📄 TOTAL ROWS:", rows.length);

    // 📅 DEFINE CUTOFF: Everything after March 31, 2026
    const startOfApril = new Date("2026-04-01T00:00:00.000Z");

    // 🚀 STEP 1: CALCULATE APRIL MOVEMENTS (Only if balancing mode)
    let salesMap = {};
    let receiptMap = { credit: {}, debit: {} };
    let cnMap = {};

    if (updateMode === "opening_balance") {
      const aprilSales = await SalesOrder.find({
        branchId,
        status: "INVOICED",
        createdAt: { $gte: startOfApril }
      }).select("customer.customerId lastInvoicedGrandTotal invoiceGrandTotal grandTotal");

      aprilSales.forEach(s => {
        const cId = s.customer?.customerId?.toString();
        if (!cId) return;
        const amt = s.lastInvoicedGrandTotal !== undefined ? s.lastInvoicedGrandTotal : (s.invoiceGrandTotal || s.grandTotal || 0);
        salesMap[cId] = (salesMap[cId] || 0) + amt;
      });

      const aprilReceipts = await Receipt.find({
        branchId,
        status: { $in: ["confirmed", "bounced"] },
        createdAt: { $gte: startOfApril }
      }).select("customer.customerId amount status");

      aprilReceipts.forEach(r => {
        const cId = r.customer?.customerId?.toString();
        if (!cId) return;
        if (r.status === "bounced") {
          receiptMap.debit[cId] = (receiptMap.debit[cId] || 0) + (r.amount || 0);
        } else {
          receiptMap.credit[cId] = (receiptMap.credit[cId] || 0) + (r.amount || 0);
        }
      });

      const aprilCNs = await CreditNote.find({
        branchId,
        status: "Created",
        createdAt: { $gte: startOfApril }
      }).select("customer.customerId grandTotal");

      aprilCNs.forEach(cn => {
        const cId = cn.customer?.customerId?.toString();
        if (!cId) return;
        cnMap[cId] = (cnMap[cId] || 0) + (cn.grandTotal || 0);
      });
    }

    // 🏗️ STEP 2: PREPARE MASTER DATA MAPS
    const allSalesOwners = await SalesOwner.find({});
    const salesOwnerMap = new Map(allSalesOwners.map(owner => [owner.name.toLowerCase(), owner._id]));
    const allCustomerCategories = await CustomerCategory.find({});
    const customerCategoryMap = new Map(allCustomerCategories.map(cat => [cat.name.toLowerCase(), cat._id]));
    const allCustomerGroups = await CustomerGroup.find({});
    const customerGroupMap = new Map(allCustomerGroups.map(group => [group.name.toLowerCase(), group._id]));

    // Fetch existing customers to match by Name or WhatsApp
    const existingCustomers = await Customer.find({ branchId }, { name: 1, whatsapp: 1 });
    // Normalize DB names: lowercase and collapse multiple spaces into one
    const nameMap = new Map(existingCustomers.map(c => [
      c.name.toLowerCase().replace(/\s+/g, " ").trim(),
      c._id
    ]));
    const whatsappMap = new Map(existingCustomers.filter(c => c.whatsapp).map(c => [c.whatsapp.replace(/\D/g, ""), c._id]));

    let customersToBulkInsert = [];
    let customersToBulkUpdate = [];
    let skipped = [];

    // 🔄 STEP 3: PROCESS ROWS
    for (const row of rows) {
      const normalizedRow = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.replace(/[\s"\n\r]+/g, "").toLowerCase(),
          String(v || "").trim(),
        ])
      );

      const name = normalizedRow.customername || normalizedRow.name;
      const whatsapp = normalizedRow.whatsapp ? normalizedRow.whatsapp.replace(/\D/g, "") : "";

      if (!name) {
        skipped.push({ row, reason: "Missing customer name" });
        continue;
      }

      // MATCHING LOGIC: WhatsApp first (if provided), then Name (Normalized)
      const normalizedNameKey = name.toLowerCase().replace(/\s+/g, " ").trim();
      let existingCustomerId = (whatsapp && whatsappMap.has(whatsapp))
        ? whatsappMap.get(whatsapp)
        : nameMap.get(normalizedNameKey);

      // [SKIP POLICY] If info_only mode and no match found, skip as per user instruction
      if (updateMode === "info_only" && !existingCustomerId) {
        skipped.push({ row, name, reason: "Customer not found in database (Skip in Safe Mode)" });
        continue;
      }

      // Initialize update data. We don't include Name in updates to avoid unique index collisions
      // (Safe Mode users usually want to update info like Groups/Limits, not rename customers).
      let customerData = { branchId };

      // Record the name for new inserts only
      if (!existingCustomerId) {
        customerData.name = name;
      }

      // Field normalization
      if (normalizedRow.whatsapp !== undefined) customerData.whatsapp = normalizedRow.whatsapp;
      if (normalizedRow.email !== undefined) customerData.email = normalizedRow.email;
      if (normalizedRow.address !== undefined) customerData.address = normalizedRow.address;
      if (normalizedRow.district !== undefined) customerData.district = normalizedRow.district;
      if (normalizedRow.state !== undefined) customerData.state = normalizedRow.state;
      if (normalizedRow.gstin !== undefined) customerData.gstin = normalizedRow.gstin;
      if (normalizedRow.creditlimit !== undefined) {
        const rawVal = String(normalizedRow.creditlimit).trim();
        if (rawVal === "") {
          customerData.creditLimit = 0; // Clear it if empty in Excel
        } else {
          const sanitizedVal = rawVal.replace(/[^0-9.-]+/g, "");
          customerData.creditLimit = parseFloat(sanitizedVal) || 0;
        }
      }
      if (normalizedRow.creditdays !== undefined || normalizedRow.creditlimitdays !== undefined) {
        const rawVal = (normalizedRow.creditdays || normalizedRow.creditlimitdays || "").trim();
        customerData.creditLimitDays = rawVal === "" ? 0 : (parseInt(rawVal) || 0);
      }

      // 💰 FINANCIAL CALCULATIONS (ONLY in opening_balance mode)
      if (updateMode === "opening_balance") {
        const rawDebit = normalizedRow.debit || normalizedRow.debitbalance || normalizedRow.dr;
        const rawCredit = normalizedRow.credit || normalizedRow.creditbalance || normalizedRow.cr;

        if (rawDebit !== undefined || rawCredit !== undefined) {
          const excelDebit = parseFloat(String(rawDebit || 0).replace(/[^0-9.-]+/g, "")) || 0;
          const excelCredit = parseFloat(String(rawCredit || 0).replace(/[^0-9.-]+/g, "")) || 0;

          // Calculate movements for this specific customer
          const cIdStr = existingCustomerId?.toString();
          const aprSales = salesMap[cIdStr] || 0;
          const aprBounced = receiptMap.debit[cIdStr] || 0;
          const aprConfirmed = receiptMap.credit[cIdStr] || 0;
          const aprCNs = cnMap[cIdStr] || 0;

          // Current totals = Excel Opening + April movements
          customerData.debit = excelDebit + aprSales + aprBounced;
          customerData.credit = excelCredit + aprConfirmed + aprCNs;

          // Fix opening balance field for ledger stability
          customerData.openingBalance = excelDebit - excelCredit;
          customerData.manualOpeningDate = new Date("2026-03-31T23:59:59.999Z");
        }
      }

      // Sales Owner mapping
      if (normalizedRow.salesowner && salesOwnerMap.has(normalizedRow.salesowner.toLowerCase())) {
        customerData.salesOwner = salesOwnerMap.get(normalizedRow.salesowner.toLowerCase());
      }

      // Category mapping
      const catKeyRaw = normalizedRow.customercategory || normalizedRow.customercategories || normalizedRow.category;
      if (catKeyRaw !== undefined) {
        const catKey = String(catKeyRaw).trim();
        if (catKey === "") {
          customerData.customerCategories = [];
          customerData.customerCategory = null;
        } else if (customerCategoryMap.has(catKey.toLowerCase())) {
          const catId = customerCategoryMap.get(catKey.toLowerCase());
          customerData.customerCategories = [catId];
          customerData.customerCategory = catId;
        }
      }

      // Group mapping
      const groupKeyRaw = normalizedRow.customergroup || normalizedRow.customergroups || normalizedRow.group;
      if (groupKeyRaw !== undefined) {
        const groupKey = String(groupKeyRaw).trim();
        if (groupKey === "") {
          customerData.customerGroups = [];
          customerData.customerGroup = null;
        } else if (customerGroupMap.has(groupKey.toLowerCase())) {
          const groupId = customerGroupMap.get(groupKey.toLowerCase());
          customerData.customerGroups = [groupId];
          customerData.customerGroup = groupId;
        }
      }

      if (existingCustomerId) {
        customersToBulkUpdate.push({
          updateOne: {
            filter: { _id: existingCustomerId },
            update: { $set: customerData }
          }
        });
      } else {
        // Only insert if NOT info_only mode
        const newCustomerData = {
          ...customerData,
          stateCode: normalizedRow.statecode || "33",
          country: customerData.country || "India",
          registrationType: normalizedRow.registrationtype || "regular",
        };
        customersToBulkInsert.push(newCustomerData);
        // Avoid duplicate inserts for same name in same file
        nameMap.set(name.toLowerCase(), "pending_insert");
      }
    }

    let insertedCount = 0;
    if (customersToBulkInsert.length > 0) {
      const inserted = await Customer.insertMany(customersToBulkInsert, { ordered: false });
      insertedCount = inserted.length;
    }

    let updatedCount = 0;
    if (customersToBulkUpdate.length > 0) {
      const result = await Customer.bulkWrite(customersToBulkUpdate, { ordered: false });
      updatedCount = result.modifiedCount;
    }

    // 3️⃣ Log the Bulk Action
    if (insertedCount > 0 || updatedCount > 0) {
      await new AuditLog({
        user: req.user?._id || branchId,
        userModel: req.user?.role ? "BranchUser" : "SuperAdmin",
        username: req.user?.username || "Unknown",
        branchId,
        action: "CUSTOMER_BULK_UPLOAD",
        description: `Bulk customer upload completed in ${updateMode} mode. Inserted: ${insertedCount}, Updated: ${updatedCount}.`,
      }).save();
    }

    return res.json({
      success: true,
      message: `Bulk upload (${updateMode}) completed successfully`,
      insertedCount,
      updatedCount,
      skippedCount: skipped.length,
      skipped,
      info: updateMode === "info_only"
        ? "Only customer information was updated. Financial balances were NOT touched."
        : "Balances adjusted as of March 31st cutoff. April transactions were preserved."
    });
  } catch (err) {
    console.error("Customer bulk upload error:", err);
    return res.status(500).json({
      success: false,
      message: "Bulk upload failed",
      error: err.message,
    });
  }
});

/**
 * POST: Bulk Update Customer Credit Limits
 * Matches by Name, updates limit/days if > 0 in Excel.
 */
router.post("/bulk-update-credit", upload.single("file"), async (req, res) => {
  try {
    if (!req.body) return res.status(400).json({ success: false, message: "Request body is missing. Ensure you are sending multipart/form-data." });
    const { branchId } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: "Excel file required" });
    if (!branchId) return res.status(400).json({ success: false, message: "branchId is required" });

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const summary = { updated: 0, skipped: 0, notFound: 0, total: rows.length };
    const updateOps = [];

    for (const row of rows) {
      // Find the name column dynamically
      const name = (row["Customer Name"] || row["customer name"] || row["Name"] || "").toString().trim();
      
      // Find limit and days
      const limit = parseFloat(row["Credit Limit (₹)"] || row["Credit Limit"] || row["limit"] || 0);
      const days = parseInt(row["Credit Days"] || row["days"] || 0);

      if (!name) {
        summary.skipped++;
        continue;
      }

      const updateFields = {};
      
      // Check if limit exists in row (even if it's 0)
      const limitRaw = row["Credit Limit (₹)"] ?? row["Credit Limit"] ?? row["limit"];
      if (limitRaw !== undefined && limitRaw !== "") {
        updateFields.creditLimit = parseFloat(limitRaw);
      }

      // Check if days exists in row (even if it's 0)
      const daysRaw = row["Credit Days"] ?? row["days"];
      if (daysRaw !== undefined && daysRaw !== "") {
        updateFields.creditLimitDays = parseInt(daysRaw);
      }

      // If nothing to update, skip
      if (Object.keys(updateFields).length === 0) {
        summary.skipped++;
        continue;
      }

      // Case-insensitive exact name match within branch
      const customer = await Customer.findOne({ 
        branchId, 
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") } 
      });
      
      if (customer) {
        updateOps.push({
          updateOne: {
            filter: { _id: customer._id },
            update: { $set: updateFields }
          }
        });
        summary.updated++;
      } else {
        summary.notFound++;
      }
    }

    if (updateOps.length > 0) {
      await Customer.bulkWrite(updateOps, { ordered: false });
      
      // Log the action
      await new AuditLog({
        user: req.user?._id || branchId,
        userModel: req.user?.role ? "BranchUser" : "SuperAdmin",
        username: req.user?.username || "Unknown",
        branchId,
        action: "CUSTOMER_BULK_CREDIT_UPDATE",
        description: `Bulk credit update completed. Updated: ${summary.updated}, Not Found: ${summary.notFound}, Total Rows: ${summary.total}.`,
      }).save();
    }

    res.json({
      success: true,
      message: `Bulk Credit Update: ${summary.updated} updated, ${summary.notFound} not found, ${summary.skipped} skipped.`,
      summary
    });

  } catch (err) {
    console.error("Bulk credit update error:", err);
    res.status(500).json({ success: false, message: "Server error during bulk update", error: err.message });
  }
});
/**
 * GET: Export Opening and Closing Balances for All Customers (Bulk)
 */
router.get("/export/opening-closing", async (req, res) => {
  try {
    const { branchId, date } = req.query;

    if (!branchId || !date) {
      return res.status(400).json({ success: false, message: "branchId and date are required" });
    }

    const branchObjectId = new mongoose.Types.ObjectId(branchId);

    const dateArr = date.split("-").map(Number);
    const startIST = new Date(Date.UTC(dateArr[0], dateArr[1] - 1, dateArr[2], 0, 0, 0));
    startIST.setMinutes(startIST.getMinutes() - 330);

    const customers = await Customer.find({ branchId: branchObjectId }).lean();
    const customerIds = customers.map(c => c._id);

    const salesAfterStart = await SalesOrder.find({
      branchId: branchObjectId,
      "customer.customerId": { $in: customerIds },
      status: "INVOICED",
      createdAt: { $gte: startIST }
    }).select("invoiceGrandTotal grandTotal customer.customerId createdAt").lean();

    const receiptsAfterStart = await Receipt.find({
      branchId: branchObjectId,
      "customer.customerId": { $in: customerIds },
      status: "confirmed",
      createdAt: { $gte: startIST }
    }).select("amount customer.customerId createdAt").lean();

    const cnAfterStart = await CreditNote.find({
      branchId: branchObjectId,
      "customer.customerId": { $in: customerIds },
      status: "Created",
      createdAt: { $gte: startIST }
    }).select("grandTotal customer.customerId createdAt").lean();

    const otherTxnsAfterStart = await OtherTransaction.find({
      branchId: branchObjectId,
      "customer.customerId": { $in: customerIds },
      createdAt: { $gte: startIST }
    }).select("amount type customer.customerId createdAt").lean();

    const salesMap = {};
    const receiptsMap = {};
    const cnMap = {};

    salesAfterStart.forEach(s => {
      const cid = s.customer.customerId.toString();
      salesMap[cid] = (salesMap[cid] || 0) + (s.invoiceGrandTotal || s.grandTotal || 0);
    });

    receiptsAfterStart.forEach(r => {
      const cid = r.customer.customerId.toString();
      receiptsMap[cid] = (receiptsMap[cid] || 0) + (r.amount || 0);
    });

    cnAfterStart.forEach(cn => {
      const cid = cn.customer.customerId.toString();
      cnMap[cid] = (cnMap[cid] || 0) + (cn.grandTotal || 0);
    });

    const otherReceiptsMap = {};
    const otherPaymentsMap = {};

    otherTxnsAfterStart.forEach(o => {
      const cid = o.customer.customerId.toString();
      if (o.type === "RECEIPT") {
        otherReceiptsMap[cid] = (otherReceiptsMap[cid] || 0) + (o.amount || 0);
      } else {
        otherPaymentsMap[cid] = (otherPaymentsMap[cid] || 0) + (o.amount || 0);
      }
    });

    const results = customers.map(c => {
      const cid = c._id.toString();
      const currentBalance = (c.debit || 0) - (c.credit || 0);

      const debitsAfter = (salesMap[cid] || 0) + (otherPaymentsMap[cid] || 0);
      const creditsAfter = (receiptsMap[cid] || 0) + (cnMap[cid] || 0) + (otherReceiptsMap[cid] || 0);

      const openingBalance = currentBalance - debitsAfter + creditsAfter;

      return {
        _id: c._id,
        name: c.name,
        gstin: c.gstin || "-",
        whatsapp: c.whatsapp || "-",
        openingBalance: Math.round(openingBalance * 100) / 100,
        closingBalance: Math.round(currentBalance * 100) / 100,
      };
    });

    res.json({ success: true, data: results });
  } catch (error) {
    console.error("Export Opening Balances Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET: Export a clean Snapshot of March 31st Balances only
 * DYNAMICALLY CALCULATED: Current - April Movements
 */
router.get("/export/snapshot-mar31", async (req, res) => {
  try {
    const { branchId } = req.query;
    if (!branchId) return res.status(400).json({ success: false, message: "branchId is required" });

    const startOfApril = new Date("2026-04-01T00:00:00.000Z");
    const customers = await Customer.find({ branchId }).sort({ name: 1 }).lean();
    const customerIds = customers.map(c => c._id);

    // 1. April Sales (Debits)
    const aprilSales = await SalesOrder.find({
      branchId,
      status: "INVOICED",
      createdAt: { $gte: startOfApril }
    }).select("customer.customerId lastInvoicedGrandTotal invoiceGrandTotal grandTotal").lean();

    const salesMap = {};
    aprilSales.forEach(s => {
      const cid = s.customer?.customerId?.toString();
      if (!cid) return;
      const amt = s.lastInvoicedGrandTotal !== undefined ? s.lastInvoicedGrandTotal : (s.invoiceGrandTotal || s.grandTotal || 0);
      salesMap[cid] = (salesMap[cid] || 0) + amt;
    });

    // 2. April Receipts (Credits)
    const aprilReceipts = await Receipt.find({
      branchId,
      status: { $in: ["confirmed", "bounced"] },
      createdAt: { $gte: startOfApril }
    }).select("customer.customerId amount status").lean();

    const receiptMap = { credit: {}, debit: {} };
    aprilReceipts.forEach(r => {
      const cid = r.customer?.customerId?.toString();
      if (!cid) return;
      if (r.status === "bounced") {
        receiptMap.debit[cid] = (receiptMap.debit[cid] || 0) + (r.amount || 0);
      } else {
        receiptMap.credit[cid] = (receiptMap.credit[cid] || 0) + (r.amount || 0);
      }
    });

    // 3. April Credit Notes (Credits)
    const aprilCNs = await CreditNote.find({
      branchId,
      status: "Created",
      createdAt: { $gte: startOfApril }
    }).select("customer.customerId grandTotal").lean();

    const cnMap = {};
    aprilCNs.forEach(cn => {
      const cid = cn.customer?.customerId?.toString();
      if (!cid) return;
      cnMap[cid] = (cnMap[cid] || 0) + (cn.grandTotal || 0);
    });
    const results = customers.map(c => {
      const cid = c._id.toString();
      // Customer Balance = Debit - Credit
      const currentBal = (c.debit || 0) - (c.credit || 0);

      const aprDr = (salesMap[cid] || 0) + (receiptMap.debit[cid] || 0);
      const aprCr = (receiptMap.credit[cid] || 0) + (cnMap[cid] || 0);

      // Snapshot = Current - (April Debits) + (April Credits)
      const snapshotsBal = currentBal - aprDr + aprCr;

      return {
        "Customer Name": c.name,
        "GSTIN": c.gstin || "-",
        "WhatsApp": c.whatsapp || "-",
        "Debit (31-Mar-2026)": snapshotsBal > 0 ? snapshotsBal : 0,
        "Credit (31-Mar-2026)": snapshotsBal < 0 ? Math.abs(snapshotsBal) : 0
      };
    });

    res.json({ success: true, data: results });
  } catch (error) {
    console.error("Customer March 31 Snapshot Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


/**
 * GET: Fetch All Customers with Pagination
 */
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10000, search = "", branchId, mini = false } = req.query;
    const isMini = mini === "true" || mini === true;

    console.log("🔍 GET /customers endpoint hit");
    console.log("Query params:", req.query);

    if (!branchId || branchId === "undefined" || branchId === "null") {
      return res.status(400).json({ message: "Valid branchId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: "Invalid branchId format" });
    }

    // Convert string branchId to ObjectId for proper matching
    const branchObjectId = new mongoose.Types.ObjectId(branchId);

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(10000, Math.max(1, parseInt(limit) || 10000)); // Max 10000 per page
    const skip = (pageNum - 1) * pageSize;

    // Build robust filter with branchId and optional multi-column criteria
    const {
      customerGroupId,
      customerCategoryId,
      riskStatus,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    const filter = { branchId: branchObjectId };
    const andConditions = [];

    // 1️⃣ Group Filter (Check both new plural and legacy singular fields)
    if (customerGroupId && customerGroupId !== "All") {
      const gId = new mongoose.Types.ObjectId(customerGroupId);
      andConditions.push({
        $or: [
          { customerGroups: gId },
          { customerGroup: gId }
        ]
      });
    }

    // 2️⃣ Category Filter (Check both new plural and legacy singular fields)
    if (customerCategoryId && customerCategoryId !== "All") {
      const cId = new mongoose.Types.ObjectId(customerCategoryId);
      andConditions.push({
        $or: [
          { customerCategories: cId },
          { customerCategory: cId }
        ]
      });
    }

    // 3️⃣ Zone / Risk Status Filter
    if (riskStatus && riskStatus !== "All") {
      if (riskStatus === "safe_zone") {
        // Safe Zone filter includes customers with explicit 'safe_zone' or missing status
        andConditions.push({
          $or: [
            { riskStatus: "safe_zone" },
            { riskStatus: { $exists: false } },
            { riskStatus: null },
            { riskStatus: "" }
          ]
        });
      } else {
        andConditions.push({ riskStatus });
      }
    }

    // 4️⃣ Search Filter
    if (search) {
      andConditions.push({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { whatsapp: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { gstin: { $regex: search, $options: "i" } },
        ]
      });
    }

    // Combine all conditions into the main filter
    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }


    // ⚡ Build the Aggregation Pipeline
    const pipeline = [];

    // 1. Initial Filtering
    pipeline.push({ $match: filter });

    // 2. Add Calculated Fields for Sorting
    pipeline.push({
      $addFields: {
        netBalance: {
          $subtract: [
            { $ifNull: ["$debit", 0] },
            { $ifNull: ["$credit", 0] }
          ]
        }
      }
    });

    const sort = {};
    const order = sortOrder === "desc" ? -1 : 1;

    switch (sortBy) {
      case "balance":
        sort.netBalance = order;
        break;
      case "limit":
        sort.creditLimit = order;
        break;
      case "days":
        sort.creditLimitDays = order;
        break;
      case "name":
        sort.name = order;
        break;
      case "createdAt":
        sort.createdAt = order;
        break;
      default:
        sort[sortBy] = order;
    }
    console.log("⚡ AGGREGATION SORT:", sort);
    pipeline.push({ $sort: sort });

    // 4. Pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: pageSize });

    // 5. Lookups (Population)
    pipeline.push(
      {
        $lookup: {
          from: "salesowners",
          localField: "salesOwner",
          foreignField: "_id",
          as: "salesOwner"
        }
      },
      { $unwind: { path: "$salesOwner", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "customercategories",
          localField: "customerCategories",
          foreignField: "_id",
          as: "customerCategories"
        }
      },
      {
        $lookup: {
          from: "customergroups",
          localField: "customerGroups",
          foreignField: "_id",
          as: "customerGroups"
        }
      }
    );

    // 6. Selection (Projection)
    if (isMini) {
      pipeline.push({
        $project: {
          name: 1,
          whatsapp: 1,
          email: 1,
          gstin: 1,
          branchId: 1,
          customerGroups: 1,
          customerCategories: 1,
          salesOwner: 1,
          riskStatus: 1,
          creditLimit: 1,
          creditLimitDays: 1,
          debit: 1,
          credit: 1,
          closingBalance: 1,
          netBalance: 1
        }
      });
    }

    // ⚡ Get total count
    const total = await Customer.countDocuments(filter);

    let totalGlobalDebit = 0;
    let totalGlobalCredit = 0;

    // ⚡ ONLY Calculate global totals if NOT in mini mode
    if (!isMini) {
      const totalsAggregation = await Customer.aggregate([
        { $match: { branchId: branchObjectId } },
        {
          $project: {
            netBalance: { $subtract: [{ $ifNull: ["$debit", 0] }, { $ifNull: ["$credit", 0] }] }
          }
        },
        {
          $group: {
            _id: null,
            totalGlobalDebit: {
              $sum: { $cond: [{ $gt: ["$netBalance", 0] }, "$netBalance", 0] }
            },
            totalGlobalCredit: {
              $sum: { $cond: [{ $lt: ["$netBalance", 0] }, { $abs: "$netBalance" }, 0] }
            }
          }
        }
      ]);
      totalGlobalDebit = totalsAggregation.length > 0 ? totalsAggregation[0].totalGlobalDebit : 0;
      totalGlobalCredit = totalsAggregation.length > 0 ? totalsAggregation[0].totalGlobalCredit : 0;
    }

    // ⚡ Execute Aggregation for Paginated Results
    const customers = await Customer.aggregate(pipeline);

    console.log(`✅ Returned ${customers.length} customers using aggregation for page ${pageNum}`);

    res.json({
      success: true,
      data: customers,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
        totalGlobalDebit,
        totalGlobalCredit
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
 * POST: Fetch Net Balances for a Batch of Customers
 * Performance optimization: used for two-stage loading
 */
router.post("/balances", async (req, res) => {
  try {
    const { customerIds, branchId } = req.body;
    if (!branchId || !customerIds || !Array.isArray(customerIds)) {
      return res.status(400).json({ success: false, message: "branchId and customerIds array required" });
    }

    const branchObjectId = new mongoose.Types.ObjectId(branchId);
    const objectIds = customerIds.map(id => new mongoose.Types.ObjectId(id));

    const balances = await Customer.aggregate([
      { $match: { _id: { $in: objectIds }, branchId: branchObjectId } },
      {
        $project: {
          _id: 1,
          debit: { $ifNull: ["$debit", 0] },
          credit: { $ifNull: ["$credit", 0] },
          netBalance: { $subtract: [{ $ifNull: ["$debit", 0] }, { $ifNull: ["$credit", 0] }] }
        }
      }
    ]);

    res.json({ success: true, data: balances });
  } catch (error) {
    console.error("Batch balance fetch error:", error);
    res.status(500).json({ success: false, message: error.message });
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
      isLockedPriceEnabled,
    } = req.body;

    // Basic validation - only name and branchId are required
    if (!name || !branchId || branchId === "undefined" || branchId === "null") {
      return res.status(400).json({
        success: false,
        message: "Required fields missing: Customer Name and Branch",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branchId format",
      });
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
      credit: Number(credit) || 0,
      debit: Number(debit) || 0,
      salesOwner: salesOwner || null,
      customerCategories: Array.isArray(customerCategories) ? customerCategories : [],
      customerGroups: Array.isArray(customerGroups) ? customerGroups : [],
      accountHolder,
      accountNumber,
      ifsc,
      branch,
      upi,
      isLockedPriceEnabled: isLockedPriceEnabled === true || isLockedPriceEnabled === "true",
      openingBalance: (Number(debit) || 0) - (Number(credit) || 0),
      manualOpeningDate: new Date(),
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
 * GET: Fetch Single Customer
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id)
      .populate('customerCategories', '_id name')
      .populate('customerGroups', '_id name')
      .populate('salesOwner', '_id name');

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    res.json(customer);
  } catch (error) {
    console.error("Fetch Single Customer Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch customer", error: error.message });
  }
});

/**
 * PUT: Update Customer
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log(`\n📝 UPDATING CUSTOMER: ${id}`);
    
    // 1️⃣ Fetch EXISTING customer for comparison
    const oldCustomer = await Customer.findById(id);
    if (!oldCustomer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // Round numeric fields if provided
    if (updates.openingBalance !== undefined) {
      updates.openingBalance = Math.round(Number(updates.openingBalance) * 100) / 100;
    }
    if (updates.closingBalance !== undefined) {
      updates.closingBalance = Math.round(Number(updates.closingBalance));
    }
    if (updates.margin !== undefined) {
      updates.margin = Math.round(Number(updates.margin) * 100) / 100;
    }
    if (updates.credit !== undefined) {
      updates.credit = Math.round(Number(updates.credit) * 100) / 100;
    }
    if (updates.debit !== undefined) {
      updates.debit = Math.round(Number(updates.debit) * 100) / 100;
    }

    // 2️⃣ Check for SENSITIVE changes (Financial Integrity)
    const hasOpeningBalChanged = updates.openingBalance !== undefined && updates.openingBalance !== oldCustomer.openingBalance;
    const hasDebitChanged = updates.debit !== undefined && updates.debit !== oldCustomer.debit;
    const hasCreditChanged = updates.credit !== undefined && updates.credit !== oldCustomer.credit;

    if (hasOpeningBalChanged || hasDebitChanged || hasCreditChanged) {
        // Create Security Audit Log
        const logEntry = new AuditLog({
            user: req.user?._id || id, // Fallback to customer ID if no user context
            userModel: req.user?.role ? "BranchUser" : "SuperAdmin",
            username: req.user?.username || "Unknown",
            branchId: oldCustomer.branchId,
            action: "CUSTOMER_FINANCIAL_UPDATE",
            targetId: oldCustomer._id,
            targetModel: "Customer",
            description: `Financial details updated for ${oldCustomer.name}.${hasOpeningBalChanged ? ` Opening Bal: ${oldCustomer.openingBalance} -> ${updates.openingBalance}.` : ''}`,
            changes: {
                before: {
                    openingBalance: oldCustomer.openingBalance,
                    debit: oldCustomer.debit,
                    credit: oldCustomer.credit
                },
                after: {
                    openingBalance: updates.openingBalance !== undefined ? updates.openingBalance : oldCustomer.openingBalance,
                    debit: updates.debit !== undefined ? updates.debit : oldCustomer.debit,
                    credit: updates.credit !== undefined ? updates.credit : oldCustomer.credit
                }
            }
        });
        await logEntry.save();
        console.log(`🔒 Security Audit Log created for financial change on customer ${oldCustomer.name}`);
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

    res.json({ success: true, data: customer });

    console.log(`✅ Customer Updated! StateCode: ${customer.stateCode}`);
    console.log(`✓ Complete Customer: ${JSON.stringify({ name: customer.name, stateCode: customer.stateCode })}\n`);

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
 * PATCH: Request Credit Limit Bypass
 */
router.patch("/:id/request-credit-bypass", async (req, res) => {
  try {
    const { id } = req.params;
    const { requestedBy, requestedById } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // 1. Calculate History Count to determine routing
    const historyCount = await OverrideRequest.countDocuments({ 
      customerId: id, 
      requestType: "CREDIT_LIMIT",
      status: "APPROVED" // Only count previously granted access
    });

    const requiresSuperAdmin = historyCount >= 3;

    // 2. Create the persistent record
    const newRequest = new OverrideRequest({
      branchId: customer.branchId,
      customerId: id,
      requestedBy: req.user?._id || customer.salesOwner || id, // Valid ObjectId
      requestedByModel: req.user?.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      requestType: "CREDIT_LIMIT",
      status: "PENDING",
      requiresSuperAdmin: requiresSuperAdmin // Flag for routing
    });
    await newRequest.save();

    // 3. Update Customer record with the request status and routing info
    customer.creditLimitRequestStatus = "PENDING";
    customer.creditLimitRequestBy = requestedBy || "Staff";
    customer.creditLimitRequestAt = new Date();
    customer.isCreditBypassed = false;
    customer.creditLimitRequiresSuperAdmin = requiresSuperAdmin;
    await customer.save();

    res.json({ 
      success: true, 
      message: requiresSuperAdmin 
        ? "Request sent to SUPER ADMIN (3+ prior approvals reached)" 
        : "Request sent to Branch Admin",
      requiresSuperAdmin
    });
  } catch (error) {
    console.error("Request Bypass Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH: Approve Credit Limit Bypass
 */
router.patch("/:id/approve-credit-bypass", async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Update the persistent record
    await OverrideRequest.findOneAndUpdate(
      { customerId: id, status: "PENDING", requestType: "CREDIT_LIMIT" },
      { 
        status: "APPROVED",
        approvedBy: req.user?._id
      },
      { sort: { createdAt: -1 } }
    );

    // 2. Update Customer record
    const customer = await Customer.findByIdAndUpdate(
      id,
      {
        isCreditBypassed: true,
        creditLimitRequestStatus: "APPROVED",
      },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    res.json({ success: true, message: "Credit bypass approved", data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH: Reject Credit Limit Bypass
 */
router.patch("/:id/reject-credit-bypass", async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Update the persistent record
    await OverrideRequest.findOneAndUpdate(
      { customerId: id, status: "PENDING", requestType: "CREDIT_LIMIT" },
      { 
        status: "REJECTED",
        approvedBy: req.user?._id
      },
      { sort: { createdAt: -1 } }
    );

    // 2. Update Customer record
    const customer = await Customer.findByIdAndUpdate(
      id,
      {
        isCreditBypassed: false,
        creditLimitRequestStatus: "REJECTED",
      },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    res.json({ success: true, message: "Credit bypass rejected", data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET: Fetch Pending Credit Bypass Requests for a Branch with History Count
 */
router.get("/credit-requests/branch/:branchId", async (req, res) => {
  try {
    const { branchId } = req.params;
    
    // Find customers with PENDING requests that DON'T require Super Admin
    const customers = await Customer.find({
      branchId,
      creditLimitRequestStatus: "PENDING",
      creditLimitRequiresSuperAdmin: false // Only Branch Admin level
    }).select("name whatsapp debit creditLimit creditLimitRequestBy creditLimitRequestAt");

    // Enhance with total request count from history
    const requestsWithHistory = await Promise.all(customers.map(async (c) => {
      const historyCount = await OverrideRequest.countDocuments({ 
        customerId: c._id, 
        requestType: "CREDIT_LIMIT" 
      });
      
      return {
        ...c.toObject(),
        historyCount
      };
    }));

    res.json({ success: true, data: requestsWithHistory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET: Fetch Total Pending Credit Bypass Requests Count (Global for Super Admin)
 */
router.get("/credit-requests/total-count", async (req, res) => {
  try {
    const count = await Customer.countDocuments({
      creditLimitRequestStatus: "PENDING",
      creditLimitRequiresSuperAdmin: true // Only those requiring Super Admin
    });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET: Fetch ALL Pending Credit Bypass Requests (Global for Super Admin)
 */
router.get("/credit-requests/all", async (req, res) => {
  try {
    const customers = await Customer.find({
      creditLimitRequestStatus: "PENDING",
      creditLimitRequiresSuperAdmin: true // Only High-Risk (4th time+)
    }).select("name whatsapp debit creditLimit creditLimitRequestBy creditLimitRequestAt branchId")
      .populate("branchId", "name code");

    const requestsWithHistory = await Promise.all(customers.map(async (c) => {
      const historyCount = await OverrideRequest.countDocuments({ 
        customerId: c._id, 
        requestType: "CREDIT_LIMIT" 
      });
      
      return {
        ...c.toObject(),
        historyCount
      };
    }));

    res.json({ success: true, data: requestsWithHistory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET: Check Customer Credit Status (Limit + Days)
 */
router.get("/:id/check-credit", async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

    const currentBalance = (customer.debit || 0) - (customer.credit || 0);
    const creditLimit = customer.creditLimit || 0;
    const creditLimitDays = customer.creditLimitDays || 0;

    // 1️⃣ Check Credit Limit (₹)
    const isLimitExceeded = currentBalance >= creditLimit && creditLimit > 0;

    // 2️⃣ Check Credit Days (Time)
    let isDaysExceeded = false;
    let oldestUnpaidInvoiceDate = null;
    let overdueDays = 0;

    if (currentBalance > 0 && creditLimitDays > 0) {
      // Find all invoices for this customer, oldest first
      const invoices = await SalesOrder.find({
        "customer.customerId": id,
        invoiceGenerated: true,
        status: "INVOICED"
      }).sort({ orderDate: 1 });

      let runningBalance = currentBalance;
      // Reverse logic: The current balance covers the MOST RECENT invoices first? 
      // No, usually payments cover oldest first. 
      // If balance is 10k, it means 10k is STILL UNPAID. 
      // These 10k must belong to the most recent invoices if old ones were paid.
      // So we check invoices from NEWEST to OLDEST. 
      // The moment the "Running Balance" (Unpaid Amount) reaches an invoice date, that's our oldest unpaid debt.
      
      const newestFirstInvoices = await SalesOrder.find({
        "customer.customerId": id,
        invoiceGenerated: true,
        status: "INVOICED"
      }).sort({ orderDate: -1 });

      let totalUnpaid = currentBalance;
      for (const inv of newestFirstInvoices) {
          totalUnpaid -= (inv.grandTotalWithMargin || inv.grandTotal || 0);
          oldestUnpaidInvoiceDate = inv.orderDate;
          if (totalUnpaid <= 0) break;
      }

      if (oldestUnpaidInvoiceDate) {
          const diffTime = Math.abs(new Date() - new Date(oldestUnpaidInvoiceDate));
          overdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (overdueDays > creditLimitDays) {
              isDaysExceeded = true;
          }
      }
    }

    res.json({
      success: true,
      data: {
        currentBalance,
        creditLimit,
        creditLimitDays,
        isLimitExceeded,
        isDaysExceeded,
        overdueDays,
        oldestUnpaidInvoiceDate,
        isBlocked: (isLimitExceeded || isDaysExceeded) && !customer.isCreditBypassed,
        isBypassed: customer.isCreditBypassed,
        requestStatus: customer.creditLimitRequestStatus
      }
    });
  } catch (error) {
    console.error("Check Credit Error:", error);
    res.status(500).json({ success: false, message: error.message });
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

/**
 * GET: Customer Ledger (Historical Balance + Transactions)
 */
router.get("/:id/ledger", async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid customer ID" });
    }

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }
    // Default dates: This month if not specified
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = startDate ? new Date(startDate) : firstDay;
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // 1. Get current balance (This is the anchor for our backwards calculation)
    const currentBalance = (customer.debit || 0) - (customer.credit || 0);

    // 2. Fetch ALL transactions after startDate to determine the opening balance
    // 🛡️ We remove branchId filter to show all transactions affecting the global balance.

    // Debits: Invoices after startDate (Using Invoice model as source of truth for finalized bills)
    const invoicesAfterStart = await Invoice.find({
      "customer.customerId": id,
      status: "FINALIZED",
      invoiceDate: { $gte: start }
    })
      .select("grandTotal invoiceDate invoiceNumber salesOrderId status generatedBy deliveryPerson")
      .populate({
        path: "salesOrderId",
        select: "deliveryMan billingPerson",
        populate: { path: "deliveryMan", select: "name" }
      });

    // Credits: Receipts after startDate
    const receiptsAfterStart = await Receipt.find({
      "customer.customerId": id,
      status: { $in: ["confirmed", "bounced", "cancelled"] },
      createdAt: { $gte: start }
    }).select("amount createdAt receiptId paymentMethod originalInvoiceId relatedOrders originalSalesOrderId status generatedBy cancelledBy cancelReason")
      .populate("generatedBy", "name")
      .populate("cancelledBy", "name")
      .populate("originalSalesOrderId", "salesInvoiceId invoiceId")
      .populate("relatedOrders.salesOrderId", "salesInvoiceId invoiceId");

    // Credits: Credit Notes after startDate
    const cnAfterStart = await CreditNote.find({
      "customer.customerId": id,
      status: "Created",
      date: { $gte: start }
    })
      .select("grandTotal date creditNoteId reasonForReturn");

    // 🧮 Opening Balance = Current_Balance - (Debits after Start) + (Credits after Start)
    const totalDebitsAfterStart = invoicesAfterStart.reduce((sum, s) => sum + (s.grandTotal || 0), 0);

    const totalCreditsAfterStart =
      receiptsAfterStart.reduce((sum, r) => {
        if (r.status === "cancelled") return sum;
        return sum + (r.status === "bounced" ? -(r.amount || 0) : (r.amount || 0));
      }, 0) +
      cnAfterStart.reduce((sum, cn) => sum + (cn.grandTotal || 0), 0);

    const openingBalance = currentBalance - totalDebitsAfterStart + totalCreditsAfterStart;

    // 3. Filter transactions within the [start, end] range
    const inRangeInvoices = invoicesAfterStart.filter(s => s.invoiceDate <= end);
    const inRangeReceipts = receiptsAfterStart.filter(r => r.createdAt <= end);
    const inRangeCNs = cnAfterStart.filter(cn => (cn.date || cn.createdAt) <= end);

    // Format all transactions
    const txns = [
      ...inRangeInvoices.map(s => {
        // PRIORITIZE data from SalesOrder as requested
        const user = s.salesOrderId?.billingPerson || s.generatedBy || "-";
        const dMan = s.salesOrderId?.deliveryMan?.name || s.deliveryPerson || "-";

        return {
          id: `inv-${s._id}`,
          date: s.createdAt || s.invoiceDate,
          type: "INVOICE",
          particulars: `Sales Invoice: ${s.invoiceNumber}`,
          debit: s.grandTotal || 0,
          credit: 0,
          user: user,
          deliveryMan: dMan
        };
      }),
      ...inRangeReceipts.map(r => {
        const creator = r.generatedBy?.name || "-";
        const canceller = r.cancelledBy?.name || "";
        
        return {
          id: `rcp-${r._id}`,
          date: r.createdAt,
          type: r.status === "bounced" ? "BOUNCED" : (r.status === "cancelled" ? "CANCELLED" : "RECEIPT"),
          particulars: `${r.status === "bounced" ? "BOUNCED: " : (r.status === "cancelled" ? "CANCELLED: " : "Receipt: ")}${r.receiptId} (${(r.paymentMethod || "CASH").toUpperCase()})${
            r.relatedOrders && r.relatedOrders.length > 0 
              ? ` - for Invoices: ${r.relatedOrders.map(ro => ro.salesOrderId?.salesInvoiceId || ro.salesOrderId?.invoiceId || ro.invoiceId).join(", ")}`
              : (r.originalSalesOrderId?.salesInvoiceId || r.originalSalesOrderId?.invoiceId || r.originalInvoiceId ? ` - for Inv: ${r.originalSalesOrderId?.salesInvoiceId || r.originalSalesOrderId?.invoiceId || r.originalInvoiceId}` : "")
          }${r.status === 'cancelled' ? ` [By: ${canceller}${r.cancelReason ? ` | Reason: ${r.cancelReason}` : ""}]` : ""}`,
          debit: r.status === "bounced" ? (r.amount || 0) : 0,
          credit: (r.status === "bounced" || r.status === "cancelled") ? 0 : (r.amount || 0),
          originalAmount: r.amount || 0,
          user: creator,
          deliveryMan: "-"
        };
      }),
      ...inRangeCNs.map(cn => ({
        id: `cn-${cn._id}`,
        date: cn.date || cn.createdAt,
        type: "CREDIT_NOTE",
        particulars: `Credit Note: ${cn.creditNoteId} (${cn.reasonForReturn || "Customer Return"})${cn.originalInvoiceId ? ` [Inv: ${cn.originalInvoiceId}${cn.originalInvoiceDate ? ` | ${new Date(cn.originalInvoiceDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })}` : ''}]` : ""}`,
        debit: 0,
        credit: cn.grandTotal || 0,
        user: "-",
        deliveryMan: "-"
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));



    // Calculate running balance for the range
    let currentRunning = openingBalance;
    const txnsWithBalance = txns.map(t => {
      currentRunning = currentRunning + t.debit - t.credit;
      return { ...t, balance: currentRunning };
    });

    res.json({
      success: true,
      data: {
        customerName: customer.name,
        openingBalance,
        closingBalance: currentRunning,
        transactions: txnsWithBalance
      }
    });
  } catch (error) {
    console.error("Customer Ledger Error:", error);
    res.status(500).json({ success: false, message: error.message });
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
