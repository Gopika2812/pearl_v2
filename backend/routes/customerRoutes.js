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
  console.log("🔥 CUSTOMER BULK UPLOAD HIT (REFINED MODE - MAR 31 OPENING)");

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
    const rows = XLSX.utils.sheet_to_json(sheet, { raw: false });

    console.log("📄 TOTAL ROWS:", rows.length);

    // 📅 DEFINE CUTOFF: Everything after March 31, 2026
    const startOfApril = new Date("2026-04-01T00:00:00.000Z");

    // 🚀 STEP 1: CALCULATE APRIL MOVEMENTS PER CUSTOMER
    // This ensures that if we upload Mar 31 balances, we don't lose April sales/receipts.

    // 1.1 April Sales (Debits)
    const aprilSales = await SalesOrder.find({
      branchId,
      status: "INVOICED",
      createdAt: { $gte: startOfApril }
    }).select("customer.customerId lastInvoicedGrandTotal invoiceGrandTotal grandTotal");

    const salesMap = {};
    aprilSales.forEach(s => {
      const cId = s.customer?.customerId?.toString();
      if (!cId) return;
      const amt = s.lastInvoicedGrandTotal !== undefined ? s.lastInvoicedGrandTotal : (s.invoiceGrandTotal || s.grandTotal || 0);
      salesMap[cId] = (salesMap[cId] || 0) + amt;
    });

    // 1.2 April Receipts (Credits/Bounced)
    const aprilReceipts = await Receipt.find({
      branchId,
      status: { $in: ["confirmed", "bounced"] },
      createdAt: { $gte: startOfApril }
    }).select("customer.customerId amount status");

    const receiptMap = { credit: {}, debit: {} };
    aprilReceipts.forEach(r => {
      const cId = r.customer?.customerId?.toString();
      if (!cId) return;
      if (r.status === "bounced") {
        receiptMap.debit[cId] = (receiptMap.debit[cId] || 0) + (r.amount || 0);
      } else {
        receiptMap.credit[cId] = (receiptMap.credit[cId] || 0) + (r.amount || 0);
      }
    });

    // 1.3 April Credit Notes (Credits)
    const aprilCNs = await CreditNote.find({
      branchId,
      status: "Created",
      createdAt: { $gte: startOfApril }
    }).select("customer.customerId grandTotal");

    const cnMap = {};
    aprilCNs.forEach(cn => {
      const cId = cn.customer?.customerId?.toString();
      if (!cId) return;
      cnMap[cId] = (cnMap[cId] || 0) + (cn.grandTotal || 0);
    });

    // 🏗️ STEP 2: PREPARE MASTER DATA MAPS
    const allSalesOwners = await SalesOwner.find({});
    const salesOwnerMap = new Map(allSalesOwners.map(owner => [owner.name.toLowerCase(), owner._id]));
    const allCustomerCategories = await CustomerCategory.find({});
    const customerCategoryMap = new Map(allCustomerCategories.map(cat => [cat.name.toLowerCase(), cat._id]));
    const allCustomerGroups = await CustomerGroup.find({});
    const customerGroupMap = new Map(allCustomerGroups.map(group => [group.name.toLowerCase(), group._id]));

    // Fetch existing customers to match by Name or WhatsApp
    const existingCustomers = await Customer.find({ branchId }, { name: 1, whatsapp: 1 });
    const nameMap = new Map(existingCustomers.map(c => [c.name.toLowerCase(), c._id]));
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

      // MATCHING LOGIC: WhatsApp first (if provided), then Name
      let existingCustomerId = (whatsapp && whatsappMap.has(whatsapp))
        ? whatsappMap.get(whatsapp)
        : nameMap.get(name.toLowerCase());

      let customerData = { branchId, name };

      // Field normalization
      if (normalizedRow.whatsapp !== undefined) customerData.whatsapp = normalizedRow.whatsapp;
      if (normalizedRow.email !== undefined) customerData.email = normalizedRow.email;
      if (normalizedRow.address !== undefined) customerData.address = normalizedRow.address;
      if (normalizedRow.district !== undefined) customerData.district = normalizedRow.district;
      if (normalizedRow.state !== undefined) customerData.state = normalizedRow.state;
      if (normalizedRow.gstin !== undefined) customerData.gstin = normalizedRow.gstin;
      if (normalizedRow.creditlimit !== undefined) customerData.creditLimit = parseFloat(normalizedRow.creditlimit) || 200000;

      // 💰 FINANCIAL CALCULATIONS (SPECIALIZED FOR MAR 31 OPENING)
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

        console.log(`📊 Adj Balance for ${name}: Excel[Dr:${excelDebit}/Cr:${excelCredit}] + April[Dr:${aprSales + aprBounced}/Cr:${aprConfirmed + aprCNs}] = Final[Dr:${customerData.debit}/Cr:${customerData.credit}]`);
      }

      // Sales Owner, Categories, Groups mapping
      if (normalizedRow.salesowner && salesOwnerMap.has(normalizedRow.salesowner.toLowerCase())) {
        customerData.salesOwner = salesOwnerMap.get(normalizedRow.salesowner.toLowerCase());
      }
      if (normalizedRow.customercategory && customerCategoryMap.has(normalizedRow.customercategory.toLowerCase())) {
        customerData.customerCategories = [customerCategoryMap.get(normalizedRow.customercategory.toLowerCase())];
      }

      if (existingCustomerId) {
        customersToBulkUpdate.push({
          updateOne: {
            filter: { _id: existingCustomerId },
            update: { $set: customerData }
          }
        });
      } else {
        const newCustomerData = {
          ...customerData,
          stateCode: customerData.stateCode || "33",
          country: customerData.country || "India",
          registrationType: customerData.registrationType || "regular",
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

    return res.json({
      message: "Bulk upload (Opening Balance mode) completed successfully",
      insertedCount,
      updatedCount,
      skippedCount: skipped.length,
      skipped,
      info: "Balances adjusted as of March 31st cutoff. April transactions were preserved."
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
    const { page = 1, limit = 50, search = "", branchId } = req.query;

    console.log("🔍 GET /customers endpoint hit");
    console.log("Query params:", { page, limit, search, branchId });

    if (!branchId || branchId === "undefined" || branchId === "null") {
      return res.status(400).json({ message: "Valid branchId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: "Invalid branchId format" });
    }

    // Convert string branchId to ObjectId for proper matching
    const branchObjectId = new mongoose.Types.ObjectId(branchId);

    console.log("Converted branchObjectId:", branchObjectId);

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(10000, Math.max(1, parseInt(limit) || 50)); // Max 10000 per page
    const skip = (pageNum - 1) * pageSize;

    // Build search filter with branchId
    const { customerGroupId } = req.query;
    const filter = { branchId: branchObjectId };
    
    if (customerGroupId) {
      filter.customerGroups = customerGroupId;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { whatsapp: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { gstin: { $regex: search, $options: "i" } },
      ];
    }

    // ⚡ Get total count
    const total = await Customer.countDocuments(filter);
    console.log(`📊 Total customers matching filter: ${total}`);

    // ⚡ Get global totals (Netted per customer, then summed)
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

    const totalGlobalDebit = totalsAggregation.length > 0 ? totalsAggregation[0].totalGlobalDebit : 0;
    const totalGlobalCredit = totalsAggregation.length > 0 ? totalsAggregation[0].totalGlobalCredit : 0;

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
    console.log(`Received Fields:`, Object.keys(updates));

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
      updates.credit = Number(updates.credit) || 0;
    }
    if (updates.debit !== undefined) {
      updates.debit = Number(updates.debit) || 0;
    }

    // Validate registrationType if provided
    if (updates.registrationType && !["regular", "unregistered"].includes(updates.registrationType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid registrationType. Must be 'regular' or 'unregistered'",
      });
    }

    // Validate and normalize stateCode if provided
    if (updates.stateCode !== undefined) {
      updates.stateCode = String(updates.stateCode || "33").trim();
      console.log(`✓ Setting stateCode to: ${updates.stateCode}`);
    }

    if (updates.salesOwner === "") {
      updates.salesOwner = null;
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
    const { requestedBy } = req.body;

    const customer = await Customer.findByIdAndUpdate(
      id,
      {
        creditLimitRequestStatus: "PENDING",
        creditLimitRequestBy: requestedBy || "Unknown Staff",
        creditLimitRequestAt: new Date(),
      },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    res.json({ success: true, message: "Credit bypass requested", data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH: Approve Credit Limit Bypass
 */
router.patch("/:id/approve-credit-bypass", async (req, res) => {
  try {
    const { id } = req.params;
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
 * GET: Fetch Pending Credit Bypass Requests for a Branch
 */
router.get("/credit-requests/branch/:branchId", async (req, res) => {
  try {
    const { branchId } = req.params;
    const requests = await Customer.find({
      branchId,
      creditLimitRequestStatus: "PENDING"
    }).select("name whatsapp debit creditLimit creditLimitRequestBy creditLimitRequestAt");

    res.json({ success: true, data: requests });
  } catch (error) {
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
    // For a customer (debtor), Balance = Debit - Credit
    const currentBalance = (customer.debit || 0) - (customer.credit || 0);

    // 2. Fetch ALL transactions after startDate to determine the opening balance

    // Debits: Sales Invoices after startDate
    const salesAfterStart = await SalesOrder.find({
      branchId: customer.branchId,
      "customer.customerId": id,
      status: "INVOICED",
      createdAt: { $gte: start }
    }).select("grandTotal invoiceGrandTotal lastInvoicedGrandTotal createdAt invoiceId");

    // Credits: Receipts after startDate
    const receiptsAfterStart = await Receipt.find({
      branchId: customer.branchId,
      "customer.customerId": id,
      status: { $in: ["confirmed", "bounced"] },
      createdAt: { $gte: start }
    }).select("amount createdAt receiptId paymentMethod originalInvoiceId status");

    // Credits: Credit Notes after startDate
    const cnAfterStart = await CreditNote.find({
      branchId: customer.branchId,
      "customer.customerId": id,
      status: "Created",
      createdAt: { $gte: start }
    }).select("grandTotal createdAt creditNoteId reasonForReturn");

    // Opening Balance = Current_Balance - (Debits after Start) + (Credits after Start)
    // 🛡️ CRITICAL: We MUST use the LAST FINALIZED amount (lastInvoicedGrandTotal) for ledger stability.
    // If we use the "Draft" grandTotal, the Opening Balance will shift incorrectly during edits.
    const totalDebitsAfterStart = salesAfterStart.reduce((sum, s) => {
      const finalizedAmount = s.lastInvoicedGrandTotal !== undefined ? s.lastInvoicedGrandTotal : (s.invoiceGrandTotal || s.grandTotal || 0);
      return sum + finalizedAmount;
    }, 0);

    const totalCreditsAfterStart =
      receiptsAfterStart.reduce((sum, r) => {
        // If bounced, it's effectively a debit (removes credit), so we subtract it from credit total
        return sum + (r.status === "bounced" ? -(r.amount || 0) : (r.amount || 0));
      }, 0) +
      cnAfterStart.reduce((sum, cn) => sum + (cn.grandTotal || 0), 0);

    const openingBalance = currentBalance - totalDebitsAfterStart + totalCreditsAfterStart;

    // 3. Filter transactions within the [start, end] range
    const inRangeSales = salesAfterStart.filter(s => s.createdAt <= end);
    const inRangeReceipts = receiptsAfterStart.filter(r => r.createdAt <= end);
    const inRangeCNs = cnAfterStart.filter(cn => cn.createdAt <= end);

    // Format all transactions
    const txns = [
      ...inRangeSales.map(s => ({
        id: `si-${s._id}`,
        date: s.createdAt,
        type: "INVOICE",
        particulars: `Sales Invoice: ${s.invoiceId}`,
        // 🛡️ Use finalized amount for the report line item
        debit: s.lastInvoicedGrandTotal !== undefined ? s.lastInvoicedGrandTotal : (s.invoiceGrandTotal || s.grandTotal || 0),
        credit: 0
      })),
      ...inRangeReceipts.map(r => ({
        id: `rcp-${r._id}`,
        date: r.createdAt,
        type: r.status === "bounced" ? "BOUNCED" : "RECEIPT",
        particulars: `${r.status === "bounced" ? "BOUNCED: " : "Receipt: "}${r.receiptId} (${(r.paymentMethod || "CASH").toUpperCase()})${r.originalInvoiceId ? ` - for Inv: ${r.originalInvoiceId}` : ""}`,
        debit: r.status === "bounced" ? (r.amount || 0) : 0,
        credit: r.status === "bounced" ? 0 : (r.amount || 0)
      })),
      ...inRangeCNs.map(cn => ({
        id: `cn-${cn._id}`,
        date: cn.createdAt,
        type: "CREDIT_NOTE",
        particulars: `Credit Note: ${cn.creditNoteId} (${cn.reasonForReturn || "General"})`,
        debit: 0,
        credit: cn.grandTotal || 0
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
