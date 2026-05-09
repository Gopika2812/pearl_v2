import express from "express";
import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import CreditNote from "../models/CreditNote.js";
import auth from "../middleware/auth.js";
import moment from "moment-timezone";

const router = express.Router();

/**
 * GET /api/gst/reports/gstr1
 * Fetches data formatted for GSTR-1 filing
 */
router.get("/gstr1", auth, async (req, res) => {
  try {
    const { branchId, month, year } = req.query;
    if (!branchId || !month || !year) {
      return res.status(400).json({ message: "branchId, month, and year are required" });
    }

    const IST = "Asia/Kolkata";
    const startDate = moment.tz(`${year}-${month}-01`, "YYYY-MM-DD", IST).startOf("month").toDate();
    const endDate = moment.tz(`${year}-${month}-01`, "YYYY-MM-DD", IST).endOf("month").toDate();

    const branchObjectId = new mongoose.Types.ObjectId(branchId);

    // 1. Fetch Invoices and Credit Notes - Optimized with field selection
    const [invoices, creditNotes] = await Promise.all([
      Invoice.find({
        branchId: branchObjectId,
        invoiceDate: { $gte: startDate, $lte: endDate }
        // Removed status: { $ne: "CANCELLED" } to include ALL invoices
      })
      .select("invoiceNumber invoiceDate grandTotal subtotal totalTax items.hsn items.name items.sellingPrice items.qty items.discountAmount items.total items.gst items.igst items.cgst items.sgst items.unit customer.gstin customer.name customer.state customer.stateCode status")
      .lean(),
      CreditNote.find({
        branchId: branchObjectId,
        date: { $gte: startDate, $lte: endDate }
      })
      .select("creditNoteId date grandTotal subtotal totalTax customer.gstin customer.name customer.state customer.stateCode status")
      .lean()
    ]);

    const b2b = [];
    const cdnr = []; // Credit Notes Registered
    const cdnur = []; // Credit Notes Unregistered
    const hsnSummary = {};
    const nilRated = {
      taxable: 0,
      exempt: 0,
      nilRated: 0,
      nonGst: 0
    };
    
    // Raw Counts for UI
    let rawB2BCount = 0;
    let rawB2CCount = 0;
    let cancelledCount = 0;

    // Track Invoice Range
    let minInvoice = null;
    let maxInvoice = null;

    const b2cGroups = {}; // To group B2C by Place of Supply and Tax Rate

    // A. Process Invoices
    invoices.forEach(inv => {
      const invNum = inv.invoiceNumber;
      if (!minInvoice || invNum < minInvoice) minInvoice = invNum;
      if (!maxInvoice || invNum > maxInvoice) maxInvoice = invNum;

      const isCancelled = inv.status === "CANCELLED";
      if (isCancelled) cancelledCount++;

      const gstin = (inv.customer?.gstin || "").trim(); // Trim to avoid length mismatch
      const isB2B = gstin.length === 15 && !gstin.includes("URP");
      const pos = (inv.customer.stateCode || "33") + "-" + (inv.customer.state || "Tamil Nadu");
      
      if (isB2B) {
        // Handle B2B
        if (!isCancelled) {
          // Items for HSN and Tax Split
          inv.items.forEach(item => {
            const taxable = ((item.sellingPrice || 0) * (item.qty || 0)) - (item.discountAmount || 0);
            const rate = item.gst || 0;
            if (rate === 0) nilRated.nilRated += taxable;

            // HSN Logic
            let hsnRaw = String(item.hsn || "").trim();
            if (hsnRaw.length === 5 || hsnRaw.length === 7) hsnRaw = "0" + hsnRaw;
            const hsn = hsnRaw || "9999";

            if (!hsnSummary[hsn]) {
              hsnSummary[hsn] = { hsn: hsn, description: item.name, uqc: item.unit || "NOS", totalQty: 0, totalValue: 0, taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
            }
            hsnSummary[hsn].totalQty += (item.qty || 0);
            hsnSummary[hsn].totalValue += item.total || 0;
            hsnSummary[hsn].taxableValue += taxable;
            hsnSummary[hsn].igst += (item.igst || 0);
            hsnSummary[hsn].cgst += (item.cgst || 0);
            hsnSummary[hsn].sgst += (item.sgst || 0);
          });

          b2b.push({
            gstin: gstin, customerName: inv.customer.name, invoiceNo: inv.invoiceNumber,
            date: moment(inv.invoiceDate).format("DD-MMM-YYYY"), value: inv.grandTotal,
            placeOfSupply: pos,
            reverseCharge: "N", invoiceType: "Regular", taxableValue: inv.subtotal,
            igst: inv.totalTax?.igst || 0, cgst: inv.totalTax?.cgst || 0, sgst: inv.totalTax?.sgst || 0, cess: 0,
            status: inv.status
          });
        } else {
          b2b.push({
            gstin: gstin, customerName: inv.customer.name, invoiceNo: inv.invoiceNumber,
            date: moment(inv.invoiceDate).format("DD-MMM-YYYY"), value: 0,
            placeOfSupply: pos,
            reverseCharge: "N", invoiceType: "Regular", taxableValue: 0,
            igst: 0, cgst: 0, sgst: 0, cess: 0,
            status: "CANCELLED"
          });
        }
      } else {
        // Handle B2C
        rawB2CCount++;
        if (!isCancelled) {
          inv.items.forEach(item => {
            const taxable = ((item.sellingPrice || 0) * (item.qty || 0)) - (item.discountAmount || 0);
            const rate = item.gst || 0;
            if (rate === 0) nilRated.nilRated += taxable;

            // Group B2C by POS and Rate (For actual filing)
            const key = `${pos}_${rate}`;
            if (!b2cGroups[key]) {
              b2cGroups[key] = {
                type: "OE",
                placeOfSupply: pos,
                rate: rate,
                taxableValue: 0,
                cess: 0
              };
            }
            b2cGroups[key].taxableValue += taxable;

            // HSN Logic for B2C
            let hsnRaw = String(item.hsn || "").trim();
            if (hsnRaw.length === 5 || hsnRaw.length === 7) hsnRaw = "0" + hsnRaw;
            const hsn = hsnRaw || "9999";

            if (!hsnSummary[hsn]) {
              hsnSummary[hsn] = { hsn: hsn, description: item.name, uqc: item.unit || "NOS", totalQty: 0, totalValue: 0, taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
            }
            hsnSummary[hsn].totalQty += (item.qty || 0);
            hsnSummary[hsn].totalValue += item.total || 0;
            hsnSummary[hsn].taxableValue += taxable;
            hsnSummary[hsn].igst += (item.igst || 0);
            hsnSummary[hsn].cgst += (item.cgst || 0);
            hsnSummary[hsn].sgst += (item.sgst || 0);
          });
        }
      }
    });

    // Update Raw Counts to be 100% accurate
    rawB2BCount = b2b.length;

    const b2c = Object.values(b2cGroups);

    // B. Process Credit Notes
    creditNotes.forEach(note => {
      const isCancelled = note.status === "Cancelled" || note.status === "CANCELLED";
      if (isCancelled) return;

      const gstin = note.customer?.gstin || "";
      const isRegistered = gstin.length === 15 && !gstin.includes("URP");

      const entry = {
        gstin: note.customer.gstin,
        customerName: note.customer.name,
        noteNo: note.creditNoteId,
        noteDate: moment(note.date).format("DD-MMM-YYYY"),
        noteType: "C",
        placeOfSupply: (note.customer.stateCode || "33") + "-" + (note.customer.state || "Tamil Nadu"),
        noteValue: note.grandTotal,
        taxableValue: note.subtotal,
        igst: note.totalTax?.igst || 0,
        cgst: note.totalTax?.cgst || 0,
        sgst: note.totalTax?.sgst || 0,
        cess: 0,
        preGst: "N"
      };

      if (isRegistered) cdnr.push(entry);
      else cdnur.push({ ...entry, type: "B2CL" }); // Standard B2C Return label
    });

    // Update Raw Counts to be 100% accurate from final arrays
    // Total = All B2B (including cancelled) + All B2C (raw bill count)
    const totalProcessed = b2b.length + rawB2CCount;

    const docSummary = [
      { nature: "Invoices for outward supply", from: minInvoice || "N/A", to: maxInvoice || "N/A", total: totalProcessed, cancelled: cancelledCount, net: totalProcessed - cancelledCount },
      { nature: "Credit Notes", from: creditNotes[0]?.creditNoteId || "N/A", to: creditNotes[creditNotes.length-1]?.creditNoteId || "N/A", total: creditNotes.length, cancelled: 0, net: creditNotes.length }
    ];

    res.json({
      success: true,
      data: {
        b2b, b2c, cdnr, cdnur,
        nilRated: [{ description: "Intra-state supplies", nilRated: nilRated.nilRated, exempt: 0, nonGst: 0 }],
        hsnSummary: Object.values(hsnSummary),
        docSummary,
        rawCounts: {
          b2b: b2b.length,
          b2c: rawB2CCount,
          cancelled: cancelledCount,
          total: totalProcessed
        }
      }
    });
  } catch (error) {
    console.error("GSTR-1 Report Error:", error);
    res.status(500).json({ message: "Failed to generate GSTR-1 report" });
  }
});

/**
 * GET /api/gst/reports/gstr3b
 * Fetches data formatted for GSTR-3B filing
 */
router.get("/gstr3b", auth, async (req, res) => {
  try {
    const { branchId, month, year } = req.query;
    if (!branchId || !month || !year) {
      return res.status(400).json({ message: "branchId, month, and year are required" });
    }

    const IST = "Asia/Kolkata";
    const startDate = moment.tz(`${year}-${month}-01`, "YYYY-MM-DD", IST).startOf("month").toDate();
    const endDate = moment.tz(`${year}-${month}-01`, "YYYY-MM-DD", IST).endOf("month").toDate();
    const branchObjectId = new mongoose.Types.ObjectId(branchId);

    // Fetch Sales, Returns, and Purchases - Optimized
    const [sales, returns, purchases] = await Promise.all([
      Invoice.find({ branchId: branchObjectId, invoiceDate: { $gte: startDate, $lte: endDate }, status: { $ne: "CANCELLED" } }).select("subtotal totalTax").lean(),
      CreditNote.find({ branchId: branchObjectId, date: { $gte: startDate, $lte: endDate }, status: { $ne: "Cancelled" } }).select("subtotal totalTax").lean(),
      PurchaseInvoice.find({ branchId: branchObjectId, invoiceDate: { $gte: startDate, $lte: endDate }, status: { $ne: "CANCELLED" } }).select("subtotal totalTax").lean()
    ]);

    const outwardSupplies = { taxable: 0, igst: 0, cgst: 0, sgst: 0, nilRated: 0 };
    sales.forEach(inv => {
      const tax = (inv.totalTax?.igst || 0) + (inv.totalTax?.cgst || 0) + (inv.totalTax?.sgst || 0);
      if (tax === 0) outwardSupplies.nilRated += inv.subtotal || 0;
      else outwardSupplies.taxable += inv.subtotal || 0;
      outwardSupplies.igst += inv.totalTax?.igst || 0;
      outwardSupplies.cgst += inv.totalTax?.cgst || 0;
      outwardSupplies.sgst += inv.totalTax?.sgst || 0;
    });

    // Deduct Returns from Outward
    returns.forEach(note => {
      outwardSupplies.taxable -= note.subtotal || 0;
      outwardSupplies.igst -= note.totalTax?.igst || 0;
      outwardSupplies.cgst -= note.totalTax?.cgst || 0;
      outwardSupplies.sgst -= note.totalTax?.sgst || 0;
    });

    const eligibleITC = {
      taxable: 0,
      igst: 0,
      cgst: 0,
      sgst: 0
    };

    purchases.forEach(inv => {
      eligibleITC.taxable += inv.subtotal || 0;
      eligibleITC.igst += inv.totalTax?.igst || 0;
      eligibleITC.cgst += inv.totalTax?.cgst || 0;
      eligibleITC.sgst += inv.totalTax?.sgst || 0;
    });

    res.json({
      success: true,
      data: {
        outwardSupplies,
        eligibleITC
      }
    });
  } catch (error) {
    console.error("GSTR-3B Report Error:", error);
    res.status(500).json({ message: "Failed to generate GSTR-3B report" });
  }
});

/**
 * POST /api/gst-reports/bulk-fix-hsn
 * Updates HSN in Product Master AND all invoices for a specific month
 */
router.post("/bulk-fix-hsn", auth, async (req, res) => {
  try {
    const { branchId, productName, oldHsn, newHsn, month, year } = req.body;
    
    if (!branchId || !productName || !newHsn) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const IST = "Asia/Kolkata";
    const startDate = moment.tz(`${year}-${month}-01`, "YYYY-MM-DD", IST).startOf("month").toDate();
    const endDate = moment.tz(`${year}-${month}-01`, "YYYY-MM-DD", IST).endOf("month").toDate();

    // 1. Update Product Master
    const Product = mongoose.model("Product");
    await Product.updateMany(
      { branch: branchObjectId, name: productName },
      { $set: { hsnCode: newHsn } }
    );

    // 2. Prepare Bulk Update for Invoices in this month that have this product
    const invoices = await Invoice.find({
      branchId: branchObjectId,
      invoiceDate: { $gte: startDate, $lte: endDate },
      "items.name": productName
    }).lean(); // Use lean for faster fetching

    if (invoices.length > 0) {
      const bulkOps = invoices.map(inv => {
        const updatedItems = inv.items.map(item => {
          if (item.name === productName) {
            return { ...item, hsn: newHsn };
          }
          return item;
        });

        return {
          updateOne: {
            filter: { _id: inv._id },
            update: { $set: { items: updatedItems } }
          }
        };
      });

      await Invoice.bulkWrite(bulkOps);
    }

    res.json({
      success: true,
      message: `Successfully updated HSN to ${newHsn} for ${productName} in Master and ${invoices.length} Invoices.`
    });

  } catch (error) {
    console.error("Bulk HSN Fix Error:", error);
    res.status(500).json({ message: "Failed to perform bulk HSN fix" });
  }
});

// 🛠️ HIGH PERFORMANCE BULK FIX: Sync Invoice Dates with original SO creation dates
// Optimized with bulkWrite for Zero-Lag performance on live systems
router.post("/bulk-fix-dates", auth, async (req, res) => {
  try {
    const { branchId } = req.body;
    if (!branchId) return res.status(400).json({ message: "Branch ID required" });

    const SalesOrder = mongoose.model("SalesOrder");
    const branchObjectId = new mongoose.Types.ObjectId(branchId);
    
    // 1. Only scan invoices from the last 60 days to keep the system FAST
    const sixtyDaysAgo = moment().subtract(60, 'days').toDate();
    const invoices = await Invoice.find({ 
      branchId: branchObjectId,
      createdAt: { $gte: sixtyDaysAgo }
    }).select("invoiceNumber invoiceDate salesOrderId createdAt status invoiceType lastInvoicedItems items").lean();

    const bulkOps = [];

    for (const inv of invoices) {
      // Skip cancelled
      if (inv.status === "CANCELLED") continue;

      let so = null;
      if (inv.salesOrderId) so = await SalesOrder.findById(inv.salesOrderId).select("createdAt").lean();
      if (!so) so = await SalesOrder.findOne({ salesInvoiceId: inv.invoiceNumber }).select("createdAt").lean();

      const truth = so?.createdAt || inv.createdAt;
      if (truth) {
        const tDate = new Date(truth);
        const iDate = new Date(inv.invoiceDate);

        const updateData = {};
        let needsUpdate = false;

        // A. Fix Date Mismatch
        if (tDate.getMonth() !== iDate.getMonth() || tDate.getFullYear() !== iDate.getFullYear()) {
          updateData.invoiceDate = tDate;
          needsUpdate = true;
        }

        // B. Force Visibility / Taxonomy Fix
        if (inv.status !== "DRAFT") {
          if (inv.invoiceType !== "TAX_INVOICE") {
            updateData.invoiceType = "TAX_INVOICE";
            needsUpdate = true;
          }
          if (inv.status !== "FINALIZED" && inv.status !== "PRINTED" && inv.status !== "SENT") {
            updateData.status = "FINALIZED";
            needsUpdate = true;
          }
        }

        // C. Data Recovery (Fix for 003)
        if ((!inv.items || inv.items.length === 0) && inv.lastInvoicedItems && inv.lastInvoicedItems.length > 0) {
          updateData.items = inv.lastInvoicedItems;
          needsUpdate = true;
        }

        if (needsUpdate) {
          bulkOps.push({
            updateOne: {
              filter: { _id: inv._id },
              update: { $set: updateData }
            }
          });
        }
      }
    }

    if (bulkOps.length > 0) {
      await Invoice.bulkWrite(bulkOps);
    }

    res.json({ success: true, message: `Successfully optimized ${bulkOps.length} invoices.` });
  } catch (error) {
    console.error("Performance fix error:", error);
    res.status(500).json({ success: false, message: "System Busy - Try again in 1 minute" });
  }
});

/**
 * GET /api/gst/reports/db-stats
 * Diagnostic tool to check total storage usage
 */
router.get("/db-stats", auth, async (req, res) => {
  try {
    const stats = await mongoose.connection.db.stats();
    const storageMB = (stats.storageSize / (1024 * 1024)).toFixed(2);
    const dataMB = (stats.dataSize / (1024 * 1024)).toFixed(2);
    const indexMB = (stats.indexSize / (1024 * 1024)).toFixed(2);

    res.json({
      success: true,
      database: stats.db,
      totalStorageUsed: `${storageMB} MB`,
      actualDataSize: `${dataMB} MB`,
      indexSize: `${indexMB} MB`,
      collections: stats.collections,
      objects: stats.objects,
      avgObjectSize: `${(stats.avgObjSize / 1024).toFixed(2)} KB`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch stats" });
  }
});

/**
 * POST /api/gst/reports/super-repair
 * High-power fixing for thousands of bills: Dates, Types, and Items
 */
router.post("/super-repair", auth, async (req, res) => {
  try {
    const { month, year } = req.body; // Ignore branchId for the search
    
    const IST = "Asia/Kolkata";
    const startDate = moment.tz(`${year}-${month}-01`, "YYYY-MM-DD", IST).startOf("month").toDate();
    const endDate = moment.tz(`${year}-${month}-01`, "YYYY-MM-DD", IST).endOf("month").toDate();

    // 1. Search the WHOLE database for GEK bills in April
    const invoices = await Invoice.find({
      invoiceNumber: { $regex: /^GEK/i },
      invoiceDate: { $gte: startDate, $lte: endDate }
    }).select("invoiceNumber branchId invoiceDate status invoiceType lastInvoicedItems items").lean();

    const bulkOps = [];
    let count = 0;

    for (const inv of invoices) {
      const updateData = {};
      let needsUpdate = false;

      // Force TAX_INVOICE
      if (inv.invoiceType !== "TAX_INVOICE") {
        updateData.invoiceType = "TAX_INVOICE";
        needsUpdate = true;
      }
      
      // Force FINALIZED
      if (inv.status !== "FINALIZED" && inv.status !== "PRINTED" && inv.status !== "SENT") {
        updateData.status = "FINALIZED";
        needsUpdate = true;
      }

      // Recover items
      if ((!inv.items || inv.items.length === 0) && inv.lastInvoicedItems && inv.lastInvoicedItems.length > 0) {
        updateData.items = inv.lastInvoicedItems;
        needsUpdate = true;
      }

      if (needsUpdate) {
        bulkOps.push({
          updateOne: {
            filter: { _id: inv._id },
            update: { $set: updateData }
          }
        });
        count++;
      }
    }

    if (bulkOps.length > 0) {
      await Invoice.bulkWrite(bulkOps);
    }

    res.json({ success: true, message: `RESCUED ${count} BILLS! They should appear now.` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/gst/reports/search-and-rescue
 * Scans the WHOLE database for a prefix (like GEK) to find where bills are hiding
 */
router.get("/search-and-rescue", auth, async (req, res) => {
  try {
    const { prefix } = req.query;
    if (!prefix) return res.status(400).json({ message: "Prefix required" });

    // Search for any invoice starting with the prefix
    const invoices = await Invoice.find({
      invoiceNumber: { $regex: new RegExp(`^${prefix}`, "i") }
    }).select("invoiceNumber branchId invoiceDate status invoiceType createdAt items").lean();

    // Group them by Branch ID and check for EMPTY items
    const summary = {};
    invoices.forEach(inv => {
      const bId = inv.branchId.toString();
      if (!summary[bId]) summary[bId] = { count: 0, status: {}, emptyItems: 0, samples: [] };
      summary[bId].count++;
      summary[bId].status[inv.status] = (summary[bId].status[inv.status] || 0) + 1;
      
      const isEmpty = !inv.items || inv.items.length === 0;
      if (isEmpty) summary[bId].emptyItems++;

      if (summary[bId].samples.length < 5) {
        summary[bId].samples.push({
          no: inv.invoiceNumber,
          items: inv.items?.length || 0,
          date: inv.invoiceDate
        });
      }
    });

    res.json({ success: true, totalFound: invoices.length, branchSplit: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
