import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import XLSX from "xlsx";
import Vendor from "../models/Vendor.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import Payment from "../models/Payment.js";
import DebitNote from "../models/DebitNote.js";

const router = express.Router();

// Configure multer with 50MB limit for bulk uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ✅ BULK UPLOAD Vendors from Excel (REFINED MODE - MAR 31 OPENING)
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  console.log("🔥 VENDOR BULK UPLOAD HIT (REFINED MODE - MAR 31 OPENING)");

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

    // 🚀 STEP 1: CALCULATE APRIL MOVEMENTS PER VENDOR
    
    // 1.1 April Purchases (Credits for us, increases liability)
    const aprilPurchases = await PurchaseOrder.find({
      branchId,
      status: "INVOICED",
      date: { $gte: startOfApril }
    }).select("vendor lastInvoicedGrandTotal grandTotal");

    const purchaseMap = {};
    aprilPurchases.forEach(po => {
      const vName = String(po.vendor || "").toLowerCase();
      if (!vName) return;
      const amt = po.lastInvoicedGrandTotal !== undefined ? po.lastInvoicedGrandTotal : (po.grandTotal || 0);
      purchaseMap[vName] = (purchaseMap[vName] || 0) + amt;
    });

    // 1.2 April Payments (Debits for us, decreases liability)
    const aprilPayments = await Payment.find({
      branchId,
      status: "completed",
      paymentDate: { $gte: startOfApril }
    }).select("vendor amount");

    const paymentMap = {};
    aprilPayments.forEach(p => {
      const vId = p.vendor?.vendorId?.toString();
      const vName = String(p.vendor?.name || "").toLowerCase();
      if (vId) paymentMap[vId] = (paymentMap[vId] || 0) + (p.amount || 0);
      if (vName) paymentMap[vName] = (paymentMap[vName] || 0) + (p.amount || 0);
    });

    // 1.3 April Debit Notes (Debits for us, decreases liability)
    const aprilDNs = await DebitNote.find({
      branchId,
      status: "Created",
      date: { $gte: startOfApril }
    }).select("vendor grandTotal");

    const dnMap = {};
    aprilDNs.forEach(dn => {
      const vId = dn.vendor?.vendorId?.toString();
      const vName = String(dn.vendor?.name || "").toLowerCase();
      if (vId) dnMap[vId] = (dnMap[vId] || 0) + (dn.grandTotal || 0);
      if (vName) dnMap[vName] = (dnMap[vName] || 0) + (dn.grandTotal || 0);
    });

    // 🏗️ STEP 2: PREPARE MASTER DATA
    const existingVendors = await Vendor.find({ branchId }, { name: 1, phone: 1 });
    const nameMap = new Map(existingVendors.map(v => [v.name.toLowerCase(), v._id]));

    let vendorsToBulkInsert = [];
    let vendorsToBulkUpdate = [];
    let skipped = [];

    // 🔄 STEP 3: PROCESS ROWS
    for (const row of rows) {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.replace(/[\s"\n\r]+/g, "").toLowerCase(),
          String(v || "").trim(),
        ])
      );

      const name = normalized.vendorname || normalized.suppliers || normalized.suppliername || normalized.name || normalized.vendor || "";
      if (!name) {
        skipped.push({ row, reason: "Missing vendor name" });
        continue;
      }

      let existingVendorId = nameMap.get(name.toLowerCase());
      let vendorData = { branchId, name };

      // Basic info
      if (normalized.phone !== undefined) vendorData.phone = normalized.phone;
      if (normalized.email !== undefined) vendorData.email = normalized.email;
      if (normalized.address !== undefined) vendorData.address = normalized.address;
      if (normalized.statename !== undefined) vendorData.stateName = normalized.statename;
      if (normalized.gstin !== undefined) vendorData.gstin = normalized.gstin;

      // 💰 FINANCIAL CALCULATIONS (SPECIALIZED FOR MAR 31 OPENING)
      const rawDebit = normalized.debit || normalized.dr || normalized.openingdebit || "";
      const rawCredit = normalized.credit || normalized.cr || normalized.openingcredit || "";
      
      if (rawDebit !== "" || rawCredit !== "") {
        const excelDebit = parseFloat(String(rawDebit || 0).replace(/[^0-9.-]+/g, "")) || 0;
        const excelCredit = parseFloat(String(rawCredit || 0).replace(/[^0-9.-]+/g, "")) || 0;

        // Calculate movements for this specific vendor
        const vKey = name.toLowerCase();
        const vIdStr = existingVendorId?.toString();
        
        const aprPurchases = purchaseMap[vKey] || 0;
        const aprPayments = (vIdStr ? paymentMap[vIdStr] : 0) || paymentMap[vKey] || 0;
        const aprDNs = (vIdStr ? dnMap[vIdStr] : 0) || dnMap[vKey] || 0;

        // Current totals = Excel Opening + April movements
        vendorData.debit = excelDebit + aprPayments + aprDNs;
        vendorData.credit = excelCredit + aprPurchases;
        
        // Fix opening balance field for snapshot logic
        // For creditors, Credit - Debit is the standard balance
        vendorData.openingBalance = excelCredit - excelDebit;
        vendorData.manualOpeningDate = new Date("2026-03-31T23:59:59.999Z");
        
        console.log(`📊 Adj Balance for ${name}: Excel[Cr:${excelCredit}/Dr:${excelDebit}] + April[Cr:${aprPurchases}/Dr:${aprPayments+aprDNs}] = Final[Cr:${vendorData.credit}/Dr:${vendorData.debit}]`);
      }

      if (existingVendorId) {
        vendorsToBulkUpdate.push({
          updateOne: {
            filter: { _id: existingVendorId },
            update: { $set: vendorData }
          }
        });
      } else {
        vendorsToBulkInsert.push(vendorData);
        nameMap.set(name.toLowerCase(), "pending_insert");
      }
    }

    let insertedCount = 0;
    if (vendorsToBulkInsert.length > 0) {
      const result = await Vendor.insertMany(vendorsToBulkInsert, { ordered: false });
      insertedCount = result.length;
    }

    let updatedCount = 0;
    if (vendorsToBulkUpdate.length > 0) {
      const result = await Vendor.bulkWrite(vendorsToBulkUpdate, { ordered: false });
      updatedCount = result.modifiedCount;
    }

    res.json({
      message: "Bulk vendor upload (Opening Balance mode) completed successfully",
      insertedCount,
      updatedCount,
      skippedCount: skipped.length,
      skipped,
      info: "Balances adjusted as of March 31st cutoff. April transactions were preserved."
    });
  } catch (err) {
    console.error("Bulk upload error:", err);
    res.status(500).json({ message: err.message });
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
    const vendors = await Vendor.find({ branchId }).sort({ name: 1 }).lean();
    const vendorIds = vendors.map(v => v._id);

    // 1. Fetch April Purchases (Credits)
    const aprilPurchases = await PurchaseOrder.find({
      branchId,
      status: "INVOICED",
      date: { $gte: startOfApril }
    }).select("vendor lastInvoicedGrandTotal grandTotal").lean();

    const purchaseMap = {};
    aprilPurchases.forEach(po => {
      const vName = String(po.vendor || "").toLowerCase();
      const amt = po.lastInvoicedGrandTotal !== undefined ? po.lastInvoicedGrandTotal : (po.grandTotal || 0);
      purchaseMap[vName] = (purchaseMap[vName] || 0) + amt;
    });

    // 2. Fetch April Payments (Debits)
    const aprilPayments = await Payment.find({
      branchId,
      status: "completed",
      paymentDate: { $gte: startOfApril }
    }).select("vendor amount").lean();

    const paymentMap = {};
    aprilPayments.forEach(p => {
      const vId = p.vendor?.vendorId?.toString();
      const vName = String(p.vendor?.name || "").toLowerCase();
      if (vId) paymentMap[vId] = (paymentMap[vId] || 0) + (p.amount || 0);
      if (vName) paymentMap[vName] = (paymentMap[vName] || 0) + (p.amount || 0);
    });

    // 3. Fetch April Debit Notes (Debits)
    const aprilDNs = await DebitNote.find({
      branchId,
      status: "Created",
      date: { $gte: startOfApril }
    }).select("vendor grandTotal").lean();

    const dnMap = {};
    aprilDNs.forEach(dn => {
      const vId = dn.vendor?.vendorId?.toString();
      const vName = String(dn.vendor?.name || "").toLowerCase();
      if (vId) dnMap[vId] = (dnMap[vId] || 0) + (dn.grandTotal || 0);
      if (vName) dnMap[vName] = (dnMap[vName] || 0) + (dn.grandTotal || 0);
    });

    const results = vendors.map(v => {
      const vKey = v.name.toLowerCase();
      const vIdStr = v._id.toString();

      const aprCr = purchaseMap[vKey] || 0;
      const aprDr = (paymentMap[vIdStr] || 0) + (paymentMap[vKey] || 0) + (dnMap[vIdStr] || 0) + (dnMap[vKey] || 0);

      // Snapshot = Current - (April Credits) + (April Debits)
      const snapshotBal = (v.credit - v.debit) - aprCr + aprDr;

      return {
        "Supplier Name": v.name,
        "GSTIN": v.gstin || "-",
        "Phone": v.phone || "-",
        "Debit (31-Mar-2026)": snapshotBal < 0 ? Math.abs(snapshotBal) : 0,
        "Credit (31-Mar-2026)": snapshotBal > 0 ? snapshotBal : 0
      };
    });

    res.json({ success: true, data: results });
  } catch (error) {
    console.error("Vendor March 31 Snapshot Error:", error);
    res.status(500).json({ success: false, message: error.message });
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

// ✅ GET all vendors (filtered by branchId and search)
router.get("/", async (req, res) => {
  try {
    const { branchId, search = "", page = 1, limit = 50 } = req.query;

    console.log("🔍 GET /vendors endpoint hit");
    console.log("Query params:", { branchId, search, page, limit });

    if (!branchId) {
      return res.status(400).json({ message: "branchId is required" });
    }

    // Convert string branchId to ObjectId for proper matching
    const branchObjectId = mongoose.Types.ObjectId.isValid(branchId)
      ? new mongoose.Types.ObjectId(branchId)
      : branchId;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(10000, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * pageSize;

    // Build search filter
    const filter = search
      ? {
          branchId: branchObjectId,
          isActive: true,
          $or: [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { gstin: { $regex: search, $options: "i" } },
          ],
        }
      : { branchId: branchObjectId, isActive: true };

    const total = await Vendor.countDocuments(filter);
    const vendors = await Vendor.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    console.log(`✅ Found ${vendors.length} vendors for branch ${branchObjectId}`);

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

    // Default dates: This month if not specified
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = startDate ? new Date(startDate) : firstDay;
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // 1. Get current balance (anchor for backwards calculation)
    const currentBalance = (vendor.credit || 0) - (vendor.debit || 0);

    // 2. Fetch ALL Purchase Invoices for this vendor after startDate
    //    Use PurchaseInvoice.createdAt (invoice generation date) — NOT PurchaseOrder.date (PO placement date)
    const pisAfterStart = await PurchaseInvoice.find({
      branchId: vendor.branchId,
      vendor: vendor.name,
      createdAt: { $gte: start }
    }).select("grandTotal createdAt purchaseInvoiceId poNumber").lean();

    // 3. Debits: Payments after startDate
    const paymentsAfterStart = await Payment.find({
      branchId: vendor.branchId,
      "vendor.vendorId": id,
      status: "completed",
      paymentDate: { $gte: start }
    }).select("amount paymentDate paymentId paymentMethod purchaseOrder.invoiceId").lean();

    // 4. Debits: Debit Notes after startDate
    const dnAfterStart = await DebitNote.find({
      branchId: vendor.branchId,
      "vendor.vendorId": id,
      status: "Created",
      createdAt: { $gte: start }
    }).select("grandTotal createdAt debitNoteId reason").lean();

    // Opening Balance = Current_Balance - (Credits after Start) + (Debits after Start)
    const totalCreditsAfterStart = pisAfterStart.reduce((sum, pi) => sum + (pi.grandTotal || 0), 0);
    const totalDebitsAfterStart =
      paymentsAfterStart.reduce((sum, p) => sum + (p.amount || 0), 0) +
      dnAfterStart.reduce((sum, dn) => sum + (dn.grandTotal || 0), 0);

    const openingBalance = currentBalance - totalCreditsAfterStart + totalDebitsAfterStart;

    // 5. Filter transactions within the [start, end] range
    const inRangePIs = pisAfterStart.filter(pi => new Date(pi.createdAt) <= end);
    const inRangePayments = paymentsAfterStart.filter(p => new Date(p.paymentDate) <= end);
    const inRangeDNs = dnAfterStart.filter(dn => new Date(dn.createdAt) <= end);

    // 6. Format all transactions
    const txns = [
      ...inRangePIs.map(pi => ({
        id: `pi-${pi._id}`,
        date: pi.createdAt,
        type: "INVOICE",
        particulars: `Purchase Invoice: ${pi.purchaseInvoiceId}${pi.poNumber ? ` (PO: ${pi.poNumber})` : ""}`,
        debit: 0,
        credit: pi.grandTotal || 0
      })),
      ...inRangePayments.map(p => ({
        id: `pay-${p._id}`,
        date: p.paymentDate,
        type: "PAYMENT",
        particulars: `Payment: ${p.paymentId} (${(p.paymentMethod || "CASH").toUpperCase()})${p.purchaseOrder?.invoiceId ? ` - for Inv: ${p.purchaseOrder.invoiceId}` : ""}`,
        debit: p.amount || 0,
        credit: 0
      })),
      ...inRangeDNs.map(dn => ({
        id: `dn-${dn._id}`,
        date: dn.createdAt,
        type: "DEBIT_NOTE",
        particulars: `Debit Note: ${dn.debitNoteId} (${dn.reason || "General"})`,
        debit: dn.grandTotal || 0,
        credit: 0
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    // 7. Calculate running balance
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
    console.error("Vendor Ledger Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


export default router;
