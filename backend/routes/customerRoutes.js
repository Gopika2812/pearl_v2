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
    const rows = XLSX.utils.sheet_to_json(sheet, { raw: false });

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

    const existingCustomers = await Customer.find({ branchId }, { name: 1 });
    const existingCustomersMap = new Map(
      existingCustomers.map(c => [c.name.toLowerCase(), c._id])
    );

    let customersToBulkInsert = [];
    let customersToBulkUpdate = [];
    let skipped = [];

    // 🔄 First pass: Validate and collect all valid records
    for (const row of rows) {
      const normalizedKeys = Object.keys(row).map(k => k.replace(/[\s"\n\r]+/g, "").toLowerCase());
      const normalizedRow = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.replace(/[\s"\n\r]+/g, "").toLowerCase(),
          String(v || "").trim(),
        ])
      );

      const name = normalizedRow.customername || normalizedRow.name || normalizedRow.debtorname;
      if (!name) {
        skipped.push({ row, reason: "Missing customer name" });
        continue;
      }

      // Check if customer already exists (case-insensitive)
      const existingCustomerId = existingCustomersMap.get(name.toLowerCase());

      // Prepare data object - only include fields present in normalizedRow
      let customerData = { branchId, name };

      // Optional fields logic: only add to customerData if present in Excel
      if (normalizedRow.whatsapp !== undefined) customerData.whatsapp = normalizedRow.whatsapp;
      if (normalizedRow.email !== undefined) customerData.email = normalizedRow.email;
      if (normalizedRow.address !== undefined) customerData.address = normalizedRow.address;
      if (normalizedRow.district !== undefined) customerData.district = normalizedRow.district;
      if (normalizedRow.state !== undefined) customerData.state = normalizedRow.state;
      if (normalizedRow.country !== undefined) customerData.country = normalizedRow.country || "India";
      if (normalizedRow.pincode !== undefined) customerData.pincode = normalizedRow.pincode;
      if (normalizedRow.statecode !== undefined) {
        let sc = normalizedRow.statecode || "33";
        // Ensure state code is at least 2 digits (e.g., "7" -> "07")
        if (/^\d{1}$/.test(sc)) sc = sc.padStart(2, '0');
        customerData.stateCode = sc;
      }
      if (normalizedRow.gstin !== undefined) customerData.gstin = normalizedRow.gstin;
      if (normalizedRow.registrationtype !== undefined) {
        customerData.registrationType = (normalizedRow.registrationtype.toLowerCase() === "unregistered" ? "unregistered" : "regular");
      }

      // Financials
      const rawDebit = normalizedRow.debit || normalizedRow.debitbalance || normalizedRow["debit(₹)"] || normalizedRow.dr;
      if (rawDebit !== undefined) {
        const val = parseFloat(String(rawDebit).replace(/[^0-9.-]+/g, "")) || 0;
        customerData.debit = val;
        customerData.openingBalance = val; // Also set as the starting point for ledgers
      }

      const rawCredit = normalizedRow.credit || normalizedRow.creditbalance || normalizedRow["credit(₹)"] || normalizedRow.cr;
      if (rawCredit !== undefined) {
        const val = parseFloat(String(rawCredit).replace(/[^0-9.-]+/g, "")) || 0;
        customerData.credit = val;
        // If credit is provided, the net opening balance is debit - credit
        customerData.openingBalance = (customerData.debit || 0) - val;
      }

      if (normalizedRow.margin !== undefined) {
        let margin = parseFloat(String(normalizedRow.margin).replace(/[^0-9.-]+/g, "")) || 0;
        if (margin !== 0 && Math.abs(margin) < 1) {
          margin = margin * 100;
        }
        customerData.margin = Math.round(margin * 100) / 100;
      }

      // Sales Owner
      if (normalizedRow.salesowner !== undefined) {
        const salesOwnerName = normalizedRow.salesowner;
        if (salesOwnerName) {
          const salesOwnerId = salesOwnerMap.get(salesOwnerName.toLowerCase());
          if (salesOwnerId) {
            customerData.salesOwner = salesOwnerId;
          } else {
            skipped.push({ row, reason: `Sales Owner "${salesOwnerName}" not found` });
            continue;
          }
        } else {
          customerData.salesOwner = null;
        }
      }

      // Categories & Groups (Comma separated)
      if (normalizedRow.customercategories !== undefined || normalizedRow.customercategory !== undefined) {
        const catStr = normalizedRow.customercategories || normalizedRow.customercategory || "";
        const catNames = catStr.split(",").map(c => c.trim().toLowerCase()).filter(c => c);
        let categoryIds = [];
        let catMissing = false;
        for (const cName of catNames) {
          const cId = customerCategoryMap.get(cName);
          if (!cId) { catMissing = true; break; }
          categoryIds.push(cId);
        }
        if (catMissing) {
          skipped.push({ row, reason: `One or more customer categories not found` });
          continue;
        }
        customerData.customerCategories = categoryIds;
      }

      if (normalizedRow.customergroups !== undefined || normalizedRow.customergroup !== undefined) {
        const grpStr = normalizedRow.customergroups || normalizedRow.customergroup || "";
        const grpNames = grpStr.split(",").map(g => g.trim().toLowerCase()).filter(g => g);
        let groupIds = [];
        let grpMissing = false;
        for (const gName of grpNames) {
          const gId = customerGroupMap.get(gName);
          if (!gId) { grpMissing = true; break; }
          groupIds.push(gId);
        }
        if (grpMissing) {
          skipped.push({ row, reason: `One or more customer groups not found` });
          continue;
        }
        customerData.customerGroups = groupIds;
      }

      // Bank Details
      if (normalizedRow.accountholder !== undefined) customerData.accountHolder = normalizedRow.accountholder;
      if (normalizedRow.accountnumber !== undefined) customerData.accountNumber = normalizedRow.accountnumber;
      if (normalizedRow.ifsc !== undefined) customerData.ifsc = normalizedRow.ifsc;
      if (normalizedRow.branch !== undefined) customerData.branch = normalizedRow.branch;
      if (normalizedRow.upi !== undefined) customerData.upi = normalizedRow.upi;

      if (existingCustomerId) {
        // Queue for update
        customersToBulkUpdate.push({
          updateOne: {
            filter: { _id: existingCustomerId },
            update: { $set: customerData }
          }
        });
      } else {
        // Queue for insert (for new, ensure essential defaults)
        const newCustomerData = {
          ...customerData,
          stateCode: customerData.stateCode || "33",
          country: customerData.country || "India",
          registrationType: customerData.registrationType || "regular",
        };
        customersToBulkInsert.push(newCustomerData);
        existingCustomersMap.set(name.toLowerCase(), "pending_insert");
      }
    }

    // ⚡ OPTIMIZATION: Bulk insert all at once instead of one-by-one
    let insertedCount = 0;
    if (customersToBulkInsert.length > 0) {
      const inserted = await Customer.insertMany(customersToBulkInsert, { ordered: false });
      insertedCount = inserted.length;
    }

    // 🔄 Third pass: Bulk update all existing records
    let updatedCount = 0;
    if (customersToBulkUpdate.length > 0) {
      const result = await Customer.bulkWrite(customersToBulkUpdate, { ordered: false });
      updatedCount = result.modifiedCount;
    }

    return res.json({
      message: "Bulk customer upload completed",
      insertedCount,
      updatedCount,
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
    
    // Parse input date (it comes in as YYYY-MM-DD from the frontend picker)
    // To get the opening balance of March 1st IST, we need all transactions 
    // from March 1st 00:00 IST onwards.
    // IST is UTC + 5:30. So March 1st 00:00 IST = Feb 28th 18:30 UTC.
    const dateArr = date.split("-").map(Number); // [2026, 3, 1]
    const startIST = new Date(Date.UTC(dateArr[0], dateArr[1]-1, dateArr[2], 0, 0, 0));
    // Subtract 5.5 hours to align UTC with IST midnight
    startIST.setMinutes(startIST.getMinutes() - 330); 

    // 1. Get ALL customers for this branch
    const customers = await Customer.find({ branchId: branchObjectId }).lean();
    const customerIds = customers.map(c => c._id);

    // 2. Fetch ALL transactions after 'startIST' for ALL relevant customers at once

    // Debits: Sales Invoices after 'startIST'
    const salesAfterStart = await SalesOrder.find({
      branchId: branchObjectId,
      "customer.customerId": { $in: customerIds },
      status: "INVOICED",
      createdAt: { $gte: startIST }
    }).select("invoiceGrandTotal grandTotal customer.customerId createdAt").lean();

    // Credits: Receipts after 'startIST'
    const receiptsAfterStart = await Receipt.find({
      branchId: branchObjectId,
      "customer.customerId": { $in: customerIds },
      status: "confirmed",
      createdAt: { $gte: startIST }
    }).select("amount customer.customerId createdAt").lean();

    // Credits: Credit Notes after 'startIST'
    const cnAfterStart = await CreditNote.find({
      branchId: branchObjectId,
      "customer.customerId": { $in: customerIds },
      status: "Created",
      createdAt: { $gte: startIST }
    }).select("grandTotal customer.customerId createdAt").lean();

    // 2.5 Credits/Debits: Other Transactions (Receipts/Payments) after 'startIST'
    const otherTxnsAfterStart = await OtherTransaction.find({
      branchId: branchObjectId,
      "customer.customerId": { $in: customerIds },
      createdAt: { $gte: startIST }
    }).select("amount type customer.customerId createdAt").lean();

    // 3. Map transactions to customers for quick lookup
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

    // 4. Calculate balances
    const results = customers.map(c => {
      const cid = c._id.toString();
      const currentBalance = (c.debit || 0) - (c.credit || 0);
      
      const debitsAfter = (salesMap[cid] || 0) + (otherPaymentsMap[cid] || 0);
      const creditsAfter = (receiptsMap[cid] || 0) + (cnMap[cid] || 0) + (otherReceiptsMap[cid] || 0);

      // Opening Balance = Current - (Debits after) + (Credits after)
      const openingBalance = currentBalance - debitsAfter + creditsAfter;

      return {
        _id: c._id,
        name: c.name,
        gstin: c.gstin || "-",
        whatsapp: c.whatsapp || "-",
        openingBalance: Math.round(openingBalance * 100) / 100,
        closingBalance: Math.round(currentBalance * 100) / 100, // Re-mapped to current as 'Closing'
      };
    });

    res.json({ success: true, data: results });
  } catch (error) {
    console.error("Export Opening Balances Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
