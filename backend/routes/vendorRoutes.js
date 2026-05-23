import express from "express";
import mongoose from "mongoose";
import Vendor from "../models/Vendor.js";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import Payment from "../models/Payment.js";
import DebitNote from "../models/DebitNote.js";
import ManualJournal from "../models/ManualJournal.js";
import VoucherType from "../models/VoucherType.js";

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
    const { branchId, page = 1, limit = 50, search = "" } = req.query;

    if (!branchId) {
      return res.status(400).json({ success: false, message: "branchId is required" });
    }

    const branchObjectId = new mongoose.Types.ObjectId(branchId);
    const pageNum = parseInt(page);
    const pageSize = parseInt(limit);

    const query = { branchId: branchObjectId };
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

export default router;
