import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import XLSX from "xlsx";
import Vendor from "../models/Vendor.js";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import Payment from "../models/Payment.js";
import DebitNote from "../models/DebitNote.js";
import ManualJournal from "../models/ManualJournal.js";
import VoucherType from "../models/VoucherType.js";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();

// ✅ CREATE vendor
router.post("/", async (req, res) => {
  try {
    const { name, phone, email, address, stateName, gstRegistrationType, gstin, branchId, openingBalance, debit, credit } = req.body;

    if (!name || !branchId) {
      return res.status(400).json({ success: false, message: "Name and branchId are required" });
    }

    const newVendor = new Vendor({
      name,
      phone,
      email,
      address,
      stateName,
      gstRegistrationType,
      gstin,
      branchId,
      openingBalance: openingBalance || 0,
      debit: debit || 0,
      credit: credit || 0,
    });

    await newVendor.save();
    res.status(201).json({ success: true, message: "Vendor created successfully", data: newVendor });
  } catch (error) {
    console.error("Create Vendor Error:", error);
    res.status(500).json({ success: false, message: "Failed to create vendor", error: error.message });
  }
});

// ✅ GET all vendors (with pagination and branch filtering)
router.get("/", async (req, res) => {
  try {
    const { branchId, page = 1, limit = 50, search = "", includeLinked = "false" } = req.query;

    if (!branchId) {
      return res.status(400).json({ success: false, message: "branchId is required" });
    }

    const branchObjectId = new mongoose.Types.ObjectId(branchId);
    const pageNum = parseInt(page);
    const pageSize = parseInt(limit);

    const query = { branchId: branchObjectId };

    if (includeLinked !== "true") {
      const linkedCustomers = await mongoose.model("Customer").find({
        branchId: branchObjectId,
        linkedVendorId: { $exists: true, $ne: null }
      }).select("linkedVendorId").lean();
      const linkedVendorIds = linkedCustomers
        .map(c => c.linkedVendorId)
        .filter(id => id && mongoose.Types.ObjectId.isValid(id));
      if (linkedVendorIds.length > 0) {
        query._id = { $nin: linkedVendorIds };
      }
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { gstin: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Vendor.countDocuments(query);
    const vendors = await Vendor.find(query)
      .sort({ name: 1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize);

    res.json({
      success: true,
      data: vendors,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize)
      }
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
    const { name, phone, email, address, stateName, gstRegistrationType, gstin, debit, credit, openingBalance, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid vendor ID" });
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
        openingBalance,
        isActive,
      },
      { new: true }
    );

    if (!updatedVendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    res.json({ success: true, message: "Vendor updated successfully", data: updatedVendor });
  } catch (error) {
    console.error("Update Vendor Error:", error);
    res.status(500).json({ success: false, message: "Failed to update vendor", error: error.message });
  }
});

// ✅ DELETE vendor
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid vendor ID" });
    }
    const deletedVendor = await Vendor.findByIdAndDelete(id);
    if (!deletedVendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }
    res.json({ success: true, message: "Vendor deleted successfully", data: deletedVendor });
  } catch (error) {
    console.error("Delete Vendor Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete vendor", error: error.message });
  }
});

// ✅ GET vendor ledger (Historical Balance + Transactions)
router.get("/:id/ledger", async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid vendor ID" });
    }

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = startDate ? new Date(startDate) : firstDay;
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const currentBalance = (vendor.credit || 0) - (vendor.debit || 0);

    const pisAfterStart = await PurchaseInvoice.find({
      branchId: vendor.branchId,
      vendor: vendor.name,
      createdAt: { $gte: start }
    }).select("grandTotal createdAt purchaseInvoiceId poNumber").lean();

    const paymentsAfterStart = await Payment.find({
      branchId: vendor.branchId,
      $and: [
        { $or: [{ "vendor.vendorId": id }, { "vendor.name": vendor.name }] },
        { $or: [{ paymentDate: { $gte: start } }, { returnDate: { $gte: start } }] },
        { status: { $in: ["completed", "returned"] } }
      ]
    }).select("amount paymentDate paymentId paymentMethod purchaseOrder.invoiceId isReturned returnDate returnBank returnNarration").lean();

    const dnAfterStart = await DebitNote.find({
      branchId: vendor.branchId,
      $or: [{ "vendor.vendorId": id }, { "vendor.name": vendor.name }],
      status: "Created",
      createdAt: { $gte: start }
    }).select("grandTotal createdAt debitNoteId reason originalInvoiceId originalInvoiceDate").lean();

    const mjAfterBy = await ManualJournal.find({
      "by.partyType": "VENDOR",
      "by.partyId": id,
      journalDate: { $gte: start }
    }).select("amount journalDate journalId narration");
    
    const mjAfterTo = await ManualJournal.find({
      "to.partyType": "VENDOR",
      "to.partyId": id,
      journalDate: { $gte: start }
    }).select("amount journalDate journalId narration");

    const vendorObjectId = new mongoose.Types.ObjectId(id);
    const linkedCustomers = await mongoose.model("Customer").find({ linkedVendorId: vendorObjectId }).select("_id").lean();
    const customerIds = linkedCustomers.map(c => c._id);
    
    const salesInvoicesAfterStart = await mongoose.model("Invoice").find({
      "customer.customerId": { $in: customerIds },
      status: { $ne: "CANCELLED" },
      invoiceDate: { $gte: start }
    }).select("grandTotal invoiceDate invoiceNumber").lean();

    const creditNotesAfterStart = await mongoose.model("CreditNote").find({
      "customer.customerId": { $in: customerIds },
      status: "Created",
      createdAt: { $gte: start }
    }).select("grandTotal createdAt creditNoteId").lean();

    const receiptsAfterStart = await mongoose.model("Receipt").find({
      "customer.customerId": { $in: customerIds },
      status: "confirmed",
      createdAt: { $gte: start }
    }).select("amount createdAt receiptId").lean();

    const totalReturnsAfterStart = paymentsAfterStart
      .filter(p => p.isReturned && new Date(p.returnDate) >= start)
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const totalCreditsAfterStart = pisAfterStart.reduce((sum, pi) => sum + (pi.grandTotal || 0), 0) +
                                  mjAfterTo.reduce((sum, mj) => sum + (mj.amount || 0), 0) +
                                  totalReturnsAfterStart +
                                  creditNotesAfterStart.reduce((sum, cn) => sum + (cn.grandTotal || 0), 0) +
                                  receiptsAfterStart.reduce((sum, r) => sum + (r.amount || 0), 0);
    
    const totalDebitsAfterStart =
      paymentsAfterStart.filter(p => new Date(p.paymentDate) >= start).reduce((sum, p) => sum + (p.amount || 0), 0) +
      dnAfterStart.reduce((sum, dn) => sum + (dn.grandTotal || 0), 0) +
      mjAfterBy.reduce((sum, mj) => sum + (mj.amount || 0), 0) +
      salesInvoicesAfterStart.reduce((sum, si) => sum + (si.grandTotal || 0), 0);

    let openingBalance = currentBalance - totalCreditsAfterStart + totalDebitsAfterStart;

    // 🔒 STRICTOR RULE: If querying from the start of the financial year (April 1st, 2026) or earlier,
    // the opening balance is strictly bound to the imported/static opening balance field in the database.
    // This prevents subsequent backdated entries or calculations from altering the historical 31st March balance.
    const financialYearStart = new Date("2026-04-01T00:00:00.000Z");
    if (start <= financialYearStart) {
      openingBalance = vendor.openingBalance || 0;
    }

    const inRangePIs = pisAfterStart.filter(pi => new Date(pi.createdAt) <= end);
    const inRangePayments = paymentsAfterStart.filter(p => new Date(p.paymentDate) >= start && new Date(p.paymentDate) <= end);
    const inRangeDNs = dnAfterStart.filter(dn => new Date(dn.createdAt) <= end);
    const inRangeSIs = salesInvoicesAfterStart.filter(si => new Date(si.invoiceDate) <= end);
    const inRangeCNs = creditNotesAfterStart.filter(cn => new Date(cn.createdAt) <= end);
    const inRangeReceipts = receiptsAfterStart.filter(r => new Date(r.createdAt) <= end);
    const inRangeReturns = paymentsAfterStart.filter(p => p.isReturned && new Date(p.returnDate) >= start && new Date(p.returnDate) <= end);
    const mjInRangeBy = mjAfterBy.filter(mj => new Date(mj.journalDate) <= end);
    const mjInRangeTo = mjAfterTo.filter(mj => new Date(mj.journalDate) <= end);

    const txns = [
      ...inRangePIs.map(pi => ({
        id: `pi-${pi._id}`,
        date: pi.createdAt,
        type: "INVOICE",
        particulars: `Purchase Invoice: ${pi.purchaseInvoiceId}${pi.poNumber ? ` (PO: ${pi.poNumber})` : ""}`,
        debit: 0,
        credit: pi.grandTotal || 0
      })),
      ...inRangeSIs.map(si => ({
        id: `si-${si._id}`,
        date: si.invoiceDate,
        type: "SALES_INVOICE",
        particulars: `Sales Invoice: ${si.invoiceNumber} (Dual Role)`,
        debit: si.grandTotal || 0,
        credit: 0
      })),
      ...inRangeCNs.map(cn => ({
        id: `cn-${cn._id}`,
        date: cn.createdAt,
        type: "CREDIT_NOTE",
        particulars: `Sales Return: ${cn.creditNoteId} (Dual Role)`,
        debit: 0,
        credit: cn.grandTotal || 0
      })),
      ...inRangeReceipts.map(r => ({
        id: `rec-${r._id}`,
        date: r.createdAt,
        type: "CUSTOMER_RECEIPT",
        particulars: `Customer Receipt: ${r.receiptId} (Dual Role)`,
        debit: 0,
        credit: r.amount || 0
      })),
      ...inRangePayments.map(p => ({
        id: `pay-${p._id}`,
        date: p.paymentDate,
        type: "PAYMENT",
        particulars: `Payment: ${p.paymentId} (${(p.paymentMethod || "CASH").toUpperCase()})${p.purchaseOrder?.invoiceId ? ` - for Inv: ${p.purchaseOrder.invoiceId}` : ""}`,
        debit: p.amount || 0,
        credit: 0
      })),
      ...inRangeReturns.map(p => ({
        id: `ret-${p._id}`,
        date: p.returnDate,
        type: "PAYMENT_RETURN",
        particulars: `Payment Return: ${p.paymentId} (Bank: ${p.returnBank})${p.purchaseOrder?.invoiceId ? ` [Against PI: ${p.purchaseOrder.invoiceId}]` : ""} - ${p.returnNarration || "Returned"}`,
        debit: 0,
        credit: p.amount || 0
      })),
      ...inRangeDNs.map(dn => ({
        id: `dn-${dn._id}`,
        date: dn.createdAt,
        type: "DEBIT_NOTE",
        particulars: `Debit Note: ${dn.debitNoteId} (${dn.reason || "General"})${dn.originalInvoiceId ? ` [Against Inv: ${dn.originalInvoiceId}${dn.originalInvoiceDate ? ` Dt: ${new Date(dn.originalInvoiceDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })}` : ""}]` : ""}`,
        debit: dn.grandTotal || 0,
        credit: 0
      })),
      ...mjInRangeBy.map(mj => ({
        id: `mjb-${mj._id}`,
        date: mj.journalDate,
        type: "JOURNAL_DR",
        particulars: `Journal: ${mj.journalId} (DR) - ${mj.narration || "Manual Adjustment"}`,
        debit: mj.amount || 0,
        credit: 0
      })),
      ...mjInRangeTo.map(mj => ({
        id: `mjt-${mj._id}`,
        date: mj.journalDate,
        type: "JOURNAL_CR",
        particulars: `Journal: ${mj.journalId} (CR) - ${mj.narration || "Manual Adjustment"}`,
        debit: 0,
        credit: mj.amount || 0
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    let currentRunning = openingBalance;
    const txnsWithBalance = txns.map(t => {
      currentRunning = currentRunning + t.credit - t.debit;
      return { ...t, balance: currentRunning };
    });

    res.json({
      success: true,
      data: {
        vendorName: vendor.name,
        openingBalance,
        closingBalance: currentRunning,
        transactions: txnsWithBalance
      }
    });
  } catch (error) {
    console.error("Fetch Vendor Ledger Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch ledger", error: error.message });
  }
});

// Configure multer with 50MB limit for bulk uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Escape special regex characters
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * POST: Bulk Upload Vendors (Opening Balances / Info Update)
 */
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  const { branchId, updateMode = "opening_balance" } = req.body;
  console.log(`🔥 VENDOR BULK UPLOAD HIT (Mode: ${updateMode})`);

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
    let piMap = {};
    let paymentMap = { debit: {}, credit: {} };
    let dnMap = {};
    let mjMap = { debit: {}, credit: {} };

    if (updateMode === "opening_balance") {
      const aprilPIs = await PurchaseInvoice.find({
        branchId,
        createdAt: { $gte: startOfApril }
      }).select("vendor grandTotal").lean();

      aprilPIs.forEach(pi => {
        if (pi.vendor) {
          const key = pi.vendor.toLowerCase().trim();
          piMap[key] = (piMap[key] || 0) + (pi.grandTotal || 0);
        }
      });

      const aprilPayments = await Payment.find({
        branchId,
        status: { $in: ["completed", "returned"] },
        $or: [
          { paymentDate: { $gte: startOfApril } },
          { returnDate: { $gte: startOfApril } }
        ]
      }).select("vendor amount paymentDate isReturned returnDate").lean();

      aprilPayments.forEach(p => {
        const vId = p.vendor?.vendorId?.toString();
        const vName = p.vendor?.name?.toLowerCase().trim();
        
        if (p.isReturned && p.returnDate && new Date(p.returnDate) >= startOfApril) {
          if (vId) paymentMap.credit[vId] = (paymentMap.credit[vId] || 0) + (p.amount || 0);
          if (vName) paymentMap.credit[vName] = (paymentMap.credit[vName] || 0) + (p.amount || 0);
        }
        if (p.paymentDate && new Date(p.paymentDate) >= startOfApril) {
          if (vId) paymentMap.debit[vId] = (paymentMap.debit[vId] || 0) + (p.amount || 0);
          if (vName) paymentMap.debit[vName] = (paymentMap.debit[vName] || 0) + (p.amount || 0);
        }
      });

      const aprilDNs = await DebitNote.find({
        branchId,
        status: "Created",
        createdAt: { $gte: startOfApril }
      }).select("vendor grandTotal").lean();

      aprilDNs.forEach(dn => {
        const vId = dn.vendor?.vendorId?.toString();
        const vName = dn.vendor?.name?.toLowerCase().trim();
        if (vId) dnMap[vId] = (dnMap[vId] || 0) + (dn.grandTotal || 0);
        if (vName) dnMap[vName] = (dnMap[vName] || 0) + (dn.grandTotal || 0);
      });

      const aprilMJsBy = await ManualJournal.find({
        "by.partyType": "VENDOR",
        journalDate: { $gte: startOfApril }
      }).select("by.partyId amount").lean();

      const aprilMJsTo = await ManualJournal.find({
        "to.partyType": "VENDOR",
        journalDate: { $gte: startOfApril }
      }).select("to.partyId amount").lean();

      aprilMJsBy.forEach(mj => {
        const vId = mj.by?.partyId?.toString();
        if (vId) mjMap.debit[vId] = (mjMap.debit[vId] || 0) + (mj.amount || 0);
      });
      aprilMJsTo.forEach(mj => {
        const vId = mj.to?.partyId?.toString();
        if (vId) mjMap.credit[vId] = (mjMap.credit[vId] || 0) + (mj.amount || 0);
      });
    }

    // Fetch existing vendors to match by Name, Phone or Email
    const existingVendors = await Vendor.find({ branchId }, { name: 1, phone: 1, email: 1, openingBalance: 1, debit: 1, credit: 1 });
    const nameMap = new Map(existingVendors.map(v => [
      v.name.toLowerCase().replace(/\s+/g, " ").trim(),
      v._id
    ]));
    const phoneMap = new Map(existingVendors.filter(v => v.phone).map(v => [v.phone.replace(/\D/g, ""), v._id]));
    const emailMap = new Map(existingVendors.filter(v => v.email).map(v => [v.email.toLowerCase().trim(), v._id]));
    const existingDetailsMap = new Map(existingVendors.map(v => [
      v._id.toString(),
      {
        name: v.name,
        openingBalance: v.openingBalance || 0,
        debit: v.debit || 0,
        credit: v.credit || 0
      }
    ]));

    let vendorsToBulkInsert = [];
    let vendorsToBulkUpdate = [];
    let skipped = [];

    for (const row of rows) {
      const normalizedRow = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.replace(/[\s"\n\r]+/g, "").toLowerCase(),
          String(v || "").trim(),
        ])
      );

      const name = normalizedRow.vendorname || normalizedRow.name || normalizedRow.suppliername || 
                   normalizedRow.supplier || normalizedRow.suppliers || normalizedRow.vendors || 
                   normalizedRow.creditorname || normalizedRow.creditor || normalizedRow.creditors;
      const phone = normalizedRow.phone ? normalizedRow.phone.replace(/\D/g, "") : "";
      const email = normalizedRow.email ? normalizedRow.email.toLowerCase().trim() : "";

      if (!name) {
        skipped.push({ row, reason: "Missing vendor name" });
        continue;
      }

      const normalizedNameKey = name.toLowerCase().replace(/\s+/g, " ").trim();
      let existingVendorId = nameMap.get(normalizedNameKey) || 
                             (phone && phoneMap.get(phone)) || 
                             (email && emailMap.get(email));

      if (updateMode === "info_only" && !existingVendorId) {
        skipped.push({ row, name, reason: "Vendor not found in database (Skip in Safe Mode)" });
        continue;
      }

      let vendorData = { branchId };

      if (!existingVendorId) {
        vendorData.name = name;
      }

      if (normalizedRow.phone !== undefined) vendorData.phone = normalizedRow.phone;
      if (normalizedRow.email !== undefined) vendorData.email = normalizedRow.email;
      if (normalizedRow.address !== undefined) vendorData.address = normalizedRow.address;
      if (normalizedRow.state !== undefined || normalizedRow.statename !== undefined) {
        vendorData.stateName = normalizedRow.state || normalizedRow.statename;
      }
      if (normalizedRow.gstin !== undefined) vendorData.gstin = normalizedRow.gstin;
      if (normalizedRow.gstregistrationtype !== undefined) {
        vendorData.gstRegistrationType = normalizedRow.gstregistrationtype || "Regular";
      }

      // 💰 FINANCIAL CALCULATIONS (ONLY in opening_balance mode)
      if (updateMode === "opening_balance") {
        const debitAliases = [
          "debit", "debitbalance", "dr", "drbalance", "openingdebit", "openingdr", 
          "openingdrbalance", "amountdr", "debitamount", "de", "deb", "debt"
        ];
        const creditAliases = [
          "credit", "creditbalance", "cr", "crbalance", "openingcredit", "openingcr", 
          "openingcrbalance", "amountcr", "creditamount", "cre", "cred"
        ];
        const generalBalanceAliases = [
          "openingbalance", "balance", "outstanding", "amount", "netbalance", "closingbalance",
          "outstandingamount", "bal"
        ];

        const findVal = (aliases) => {
          for (const alias of aliases) {
            if (normalizedRow[alias] !== undefined && normalizedRow[alias] !== "") {
              return normalizedRow[alias];
            }
          }
          return undefined;
        };

        const rawDebitVal = findVal(debitAliases);
        const rawCreditVal = findVal(creditAliases);
        const rawGeneralVal = findVal(generalBalanceAliases);
        const rawTypeVal = normalizedRow.type || normalizedRow.balancetype || normalizedRow.drcr || normalizedRow.drdecr || "";

        let excelDebit = 0;
        let excelCredit = 0;
        let hasFinancialData = false;

        if (rawDebitVal !== undefined || rawCreditVal !== undefined) {
          excelDebit = parseFloat(String(rawDebitVal || 0).replace(/[^0-9.-]+/g, "")) || 0;
          excelCredit = parseFloat(String(rawCreditVal || 0).replace(/[^0-9.-]+/g, "")) || 0;
          hasFinancialData = true;
        } else if (rawGeneralVal !== undefined) {
          const rawStr = String(rawGeneralVal).trim();
          const numericVal = parseFloat(rawStr.replace(/[^0-9.-]+/g, "")) || 0;
          const isDrType = /dr|debit/i.test(rawStr) || /dr|debit/i.test(rawTypeVal);

          if (isDrType) {
            excelDebit = Math.abs(numericVal);
            excelCredit = 0;
          } else {
            // Default: Creditors / Vendors are positive credit unless explicitly debit
            excelCredit = Math.abs(numericVal);
            excelDebit = 0;
          }
          hasFinancialData = true;
        }

        if (hasFinancialData) {
          const vIdStr = existingVendorId?.toString();
          const vNameKey = name.toLowerCase().trim();

          const aprPIs = piMap[vNameKey] || 0;
          const aprReturns = (vIdStr && paymentMap.credit[vIdStr]) || paymentMap.credit[vNameKey] || 0;
          const aprPayments = (vIdStr && paymentMap.debit[vIdStr]) || paymentMap.debit[vNameKey] || 0;
          const aprMJsBy = (vIdStr && mjMap.debit[vIdStr]) || 0;
          const aprMJsTo = (vIdStr && mjMap.credit[vIdStr]) || 0;
          const aprDNs = (vIdStr && dnMap[vIdStr]) || dnMap[vNameKey] || 0;

          // Vendor credit normal: credit = excelCredit + April credits
          vendorData.credit = excelCredit + aprPIs + aprReturns + aprMJsTo;
          // Vendor debit: debit = excelDebit + April debits
          vendorData.debit = excelDebit + aprPayments + aprDNs + aprMJsBy;

          // Fix opening balance: credit - debit
          vendorData.openingBalance = excelCredit - excelDebit;
          vendorData.manualOpeningDate = new Date("2026-03-31T23:59:59.999Z");
        }
      }

      if (existingVendorId) {
        if (updateMode === "opening_balance" && vendorData.openingBalance !== undefined) {
          const existingDetails = existingDetailsMap.get(existingVendorId.toString());
          const oldOpening = existingDetails ? existingDetails.openingBalance : 0;
          const newOpening = vendorData.openingBalance;

          if (oldOpening !== newOpening) {
            const oldDebit = existingDetails ? existingDetails.debit : 0;
            const oldCredit = existingDetails ? existingDetails.credit : 0;

            await new AuditLog({
              user: req.user?._id || branchId,
              userModel: req.user?.role ? "BranchUser" : "SuperAdmin",
              username: "System",
              branchId,
              action: "VENDOR_FINANCIAL_UPDATE",
              targetId: existingVendorId,
              targetModel: "Vendor",
              description: `Financial details updated automatically via bulk upload for ${name}. Opening Bal: ${oldOpening} -> ${newOpening}.`,
              changes: {
                before: { openingBalance: oldOpening, debit: oldDebit, credit: oldCredit },
                after: {
                  openingBalance: newOpening,
                  debit: vendorData.debit !== undefined ? vendorData.debit : oldDebit,
                  credit: vendorData.credit !== undefined ? vendorData.credit : oldCredit
                }
              }
            }).save();
            console.log(`🔒 Security Audit Log created for automatic financial change on vendor ${name}`);
          }
        }

        vendorsToBulkUpdate.push({
          updateOne: {
            filter: { _id: existingVendorId },
            update: { $set: vendorData }
          }
        });
      } else {
        vendorsToBulkInsert.push(vendorData);
        nameMap.set(normalizedNameKey, "pending_insert");
      }
    }

    let insertedCount = 0;
    if (vendorsToBulkInsert.length > 0) {
      const inserted = await Vendor.insertMany(vendorsToBulkInsert, { ordered: false });
      insertedCount = inserted.length;
    }

    let updatedCount = 0;
    if (vendorsToBulkUpdate.length > 0) {
      const result = await Vendor.bulkWrite(vendorsToBulkUpdate, { ordered: false });
      updatedCount = result.modifiedCount;
    }

    if (insertedCount > 0 || updatedCount > 0) {
      await new AuditLog({
        user: req.user?._id || branchId,
        userModel: req.user?.role ? "BranchUser" : "SuperAdmin",
        username: req.user?.username || "Unknown",
        branchId,
        action: "VENDOR_BULK_UPLOAD",
        description: `Bulk vendor upload completed in ${updateMode} mode. Inserted: ${insertedCount}, Updated: ${updatedCount}.`,
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
        ? "Only vendor information was updated. Financial balances were NOT touched."
        : "Balances adjusted as of March 31st cutoff. April transactions were preserved."
    });
  } catch (err) {
    console.error("Vendor bulk upload error:", err);
    return res.status(500).json({
      success: false,
      message: "Bulk upload failed",
      error: err.message,
    });
  }
});

export default router;
