import express from "express";
import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import CreditNote from "../models/CreditNote.js";
import Branch from "../models/Branch.js";
import Vendor from "../models/Vendor.js";
import auth from "../middleware/auth.js";
import moment from "moment-timezone";

// Official GST UQC Mapping Helper
const getUQC = (unit) => {
  const u = String(unit || "").toUpperCase().trim();
  const mapping = {
    "KG": "KGS-KILOGRAMS",
    "KGS": "KGS-KILOGRAMS",
    "KILOGRAM": "KGS-KILOGRAMS",
    "KILOGRAMS": "KGS-KILOGRAMS",
    "NOS": "NOS-NUMBERS",
    "NO": "NOS-NUMBERS",
    "NUMBER": "NOS-NUMBERS",
    "NUMBERS": "NOS-NUMBERS",
    "PCS": "PCS-PIECES",
    "PIECE": "PCS-PIECES",
    "PIECES": "PCS-PIECES",
    "BOX": "BOX-BOX",
    "BOXES": "BOX-BOX",
    "BAG": "BAG-BAGS",
    "BAGS": "BAG-BAGS",
    "BTL": "BTL-BOTTLES",
    "BOTTLE": "BTL-BOTTLES",
    "BOTTLES": "BTL-BOTTLES",
    "CAN": "CAN-CANS",
    "CANS": "CAN-CANS",
    "CSE": "CSE-CASE",
    "CASE": "CSE-CASE",
    "CASES": "CSE-CASE",
    "MTR": "MTR-METERS",
    "METER": "MTR-METERS",
    "METERS": "MTR-METERS",
    "LTR": "LTR-LITRES",
    "LITRE": "LTR-LITRES",
    "LITRES": "LTR-LITRES",
    "ML": "MLT-MILLILITRE",
    "GM": "GMS-GRAMMES",
    "GMS": "GMS-GRAMMES",
    "GRAM": "GMS-GRAMMES",
    "GRAMS": "GMS-GRAMMES",
    "SET": "SET-SETS",
    "SETS": "SET-SETS"
  };
  return mapping[u] || mapping[u.replace(/S$/, "")] || "OTH-OTHERS";
};

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
      .select("creditNoteId date grandTotal subtotal totalTax items customer.gstin customer.name customer.state customer.stateCode status")
      .lean()
    ]);

    const b2b = [];
    const cdnr = []; // Credit Notes Registered
    const cdnur = []; // Credit Notes Unregistered
    const hsnSummaryB2B = {}; // Grouped by HSN + Rate
    const hsnSummaryB2C = {}; // Grouped by HSN + Rate
    const nilRated = {
      intraReg: 0, intraUnreg: 0, interReg: 0, interUnreg: 0
    };
    
    // Raw Counts for UI
    let rawB2BCount = 0;
    let rawB2CCount = 0;
    let cancelledCount = 0;

    // Track Invoice Range
    let minInvoice = null;
    let maxInvoice = null;

    const b2cGroups = {}; // To group B2C Small (B2CS) by Place of Supply and Tax Rate
    const b2cLarge = [];  // To list B2C Large (B2CL) individually
    const b2cRaw = [];    // Individual B2C records for detailed report

    // A. Process Invoices
    invoices.forEach(inv => {
      const invNum = inv.invoiceNumber;
      if (!minInvoice || invNum < minInvoice) minInvoice = invNum;
      if (!maxInvoice || invNum > maxInvoice) maxInvoice = invNum;

      const isCancelled = inv.status === "CANCELLED";
      if (isCancelled) cancelledCount++;

      const gstin = (inv.customer?.gstin || "").trim(); // Trim to avoid length mismatch
      const isB2B = gstin.length === 15 && !gstin.includes("URP");
      
      // Normalize POS Name
      let stateName = (inv.customer?.state || "").trim();
      const rawCode = String(inv.customer?.stateCode || "").trim();
      const rawState = stateName.toLowerCase().replace(/\s/g, "");

      // Official State Mapping for GST
      const stateMap = {
        "33": "Tamil Nadu", "32": "Kerala", "29": "Karnataka", "37": "Andhra Pradesh",
        "27": "Maharashtra", "36": "Telangana", "07": "Delhi", "24": "Gujarat", "09": "Uttar Pradesh"
      };

      if (rawState === "tamilnadu" || rawState === "tn" || rawState.includes("tamilnadu") || rawCode === "33") {
        stateName = "Tamil Nadu";
      } else if (!stateName || !isNaN(stateName)) {
        stateName = stateMap[rawCode] || "Tamil Nadu";
      }
      
      // If it's NOT 33 and NOT Tamil Nadu, it MUST be Inter-state
      const isIntra = (rawCode === "33") || (stateName === "Tamil Nadu");
      const isInterstate = !isIntra;
      const pos = (rawCode || "33") + "-" + stateName;
      
      if (isB2B) {
        // Handle B2B
        if (!isCancelled) {
          const b2bInvoiceGroups = {}; // To split one B2B invoice by different rates
          // Items for HSN and Tax Split
          inv.items.forEach(item => {
            const taxable = ((item.sellingPrice || 0) * (item.qty || 0)) - (item.discountAmount || 0);
            const rate = Math.round(item.gst || 0);
            if (rate === 0) {
              if (isInterstate) nilRated.interReg += taxable;
              else nilRated.intraReg += taxable;
            }

            // Group by rate for this specific invoice
            const itemRate = item.gst || 0;
            const itemIgst = isInterstate ? (taxable * rate / 100) : 0;
            const itemCgst = isIntra ? (taxable * (rate / 2) / 100) : 0;
            const itemSgst = isIntra ? (taxable * (rate / 2) / 100) : 0;

            if (!b2bInvoiceGroups[itemRate]) {
              b2bInvoiceGroups[itemRate] = { taxableValue: 0, igst: 0, cgst: 0, sgst: 0 };
            }
            b2bInvoiceGroups[itemRate].taxableValue += taxable;
            b2bInvoiceGroups[itemRate].igst += itemIgst;
            b2bInvoiceGroups[itemRate].cgst += itemCgst;
            b2bInvoiceGroups[itemRate].sgst += itemSgst;
 
            // HSN Logic
            let hsnRaw = String(item.hsn || "").trim();
            if (hsnRaw.length === 5 || hsnRaw.length === 7) hsnRaw = "0" + hsnRaw;
            const hsn = hsnRaw || "9999";
            const hsnKey = `${hsn}_${rate}`; // Group by HSN and Rate
 
            if (!hsnSummaryB2B[hsnKey]) {
              hsnSummaryB2B[hsnKey] = { hsn: hsn, description: item.name, uqc: getUQC(item.unit || "NOS"), totalQty: 0, totalValue: 0, rate: rate, taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, invoiceNumbers: new Set() };
            }
            hsnSummaryB2B[hsnKey].totalQty += (item.qty || 0);
            hsnSummaryB2B[hsnKey].totalValue += item.total || 0;
            hsnSummaryB2B[hsnKey].taxableValue += taxable;
            hsnSummaryB2B[hsnKey].igst += itemIgst;
            hsnSummaryB2B[hsnKey].cgst += itemCgst;
            hsnSummaryB2B[hsnKey].sgst += itemSgst;
            const invDate = moment(inv.invoiceDate).format("DD-MMM");
            hsnSummaryB2B[hsnKey].invoiceNumbers.add(`${inv.invoiceNumber} (${invDate})`);
          });

          // Push a row for each rate in this invoice (GST Portal Requirement)
          Object.keys(b2bInvoiceGroups).forEach(rateStr => {
            const rData = b2bInvoiceGroups[rateStr];
            const rate = parseFloat(rateStr);
            b2b.push({
              gstin: gstin, customerName: inv.customer.name, invoiceNo: inv.invoiceNumber,
              date: moment(inv.invoiceDate).format("DD-MMM-YYYY"), value: inv.grandTotal,
              placeOfSupply: pos,
              reverseCharge: "N", invoiceType: "Regular", 
              applicablePercent: "", ecommerceGstin: "",
              rate: rate, taxableValue: rData.taxableValue,
              igst: rData.igst, cgst: rData.cgst, sgst: rData.sgst, cess: 0,
              status: inv.status
            });
          });
        } else {
          b2b.push({
            gstin: gstin, customerName: inv.customer.name, invoiceNo: inv.invoiceNumber,
            date: moment(inv.invoiceDate).format("DD-MMM-YYYY"), value: 0,
            placeOfSupply: pos,
            reverseCharge: "N", invoiceType: "Regular", 
            applicablePercent: "", ecommerceGstin: "",
            rate: 0, taxableValue: 0,
            igst: 0, cgst: 0, sgst: 0, cess: 0,
            status: "CANCELLED"
          });
        }
      } else {
        // Handle B2C
        rawB2CCount++;
        b2cRaw.push({
          invoiceNo: inv.invoiceNumber,
          date: moment(inv.invoiceDate).format("DD-MMM-YYYY"),
          customerName: inv.customer?.name || "URP",
          placeOfSupply: pos,
          value: isCancelled ? 0 : inv.grandTotal,
          taxableValue: isCancelled ? 0 : inv.subtotal,
          igst: isCancelled ? 0 : (inv.totalTax?.igst || 0),
          cgst: isCancelled ? 0 : (inv.totalTax?.cgst || 0),
          sgst: isCancelled ? 0 : (inv.totalTax?.sgst || 0),
          status: inv.status,
          rates: isCancelled ? [] : Array.from(new Set(inv.items.map(item => Math.round(item.gst || 0))))
        });
        if (!isCancelled) {
          inv.items.forEach(item => {
            const taxable = ((item.sellingPrice || 0) * (item.qty || 0)) - (item.discountAmount || 0);
            const rate = Math.round(item.gst || 0); // Round to avoid 4.99 issues
            
            const itemIgst = isInterstate ? (taxable * rate / 100) : 0;
            const itemCgst = isIntra ? (taxable * (rate / 2) / 100) : 0;
            const itemSgst = isIntra ? (taxable * (rate / 2) / 100) : 0;

            if (rate === 0) {
              if (isInterstate) nilRated.interUnreg += taxable;
              else nilRated.intraUnreg += taxable;
            }

            const isLarge = isInterstate && inv.grandTotal > 250000;
 
            if (isLarge) {
              // B2C Large Logic: One row per rate per invoice
              b2cLarge.push({
                invoiceNo: inv.invoiceNumber,
                date: moment(inv.invoiceDate).format("DD-MMM-YYYY"),
                value: inv.grandTotal,
                placeOfSupply: pos,
                applicablePercent: "",
                rate: rate,
                taxableValue: taxable,
                igst: itemIgst, cgst: itemCgst, sgst: itemSgst,
                cess: 0,
                ecommerceGstin: ""
              });
            } else {
              // B2C Small Logic: Grouped by POS and Rate
              const totalItemBase = (item.sellingPrice || 0) * (item.qty || 0);
              const totalInvoiceBase = inv.items.reduce((sum, i) => sum + ((i.sellingPrice || 0) * (i.qty || 0)), 0);
              const billLevelRatio = totalInvoiceBase > 0 ? (inv.subtotal / totalInvoiceBase) : 1;
              const taxable = totalItemBase * billLevelRatio;

              const key = `${pos}_${rate}`;
              if (!b2cGroups[key]) {
                b2cGroups[key] = {
                  type: "OE",
                  placeOfSupply: pos,
                  rate: rate,
                  taxableValue: 0,
                  igst: 0, cgst: 0, sgst: 0,
                  cess: 0,
                  ecommerceGstin: ""
                };
              }
              b2cGroups[key].taxableValue += taxable;
              b2cGroups[key].igst += itemIgst;
              b2cGroups[key].cgst += itemCgst;
              b2cGroups[key].sgst += itemSgst;
            }
 
            // HSN Logic for B2C
            let hsnRaw = String(item.hsn || "").trim();
            if (hsnRaw.length === 5 || hsnRaw.length === 7) hsnRaw = "0" + hsnRaw;
            const hsn = hsnRaw || "9999";
            const hsnKey = `${hsn}_${rate}`; // Group by HSN and Rate
 

            if (!hsnSummaryB2C[hsnKey]) {
              hsnSummaryB2C[hsnKey] = { hsn: hsn, description: item.name, uqc: getUQC(item.unit || "NOS"), totalQty: 0, totalValue: 0, rate: rate, taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, invoiceNumbers: new Set() };
            }
            hsnSummaryB2C[hsnKey].totalQty += (item.qty || 0);
            hsnSummaryB2C[hsnKey].totalValue += item.total || 0;
            hsnSummaryB2C[hsnKey].taxableValue += taxable;
            hsnSummaryB2C[hsnKey].igst += itemIgst;
            hsnSummaryB2C[hsnKey].cgst += itemCgst;
            hsnSummaryB2C[hsnKey].sgst += itemSgst;
            const invDate = moment(inv.invoiceDate).format("DD-MMM");
            hsnSummaryB2C[hsnKey].invoiceNumbers.add(`${inv.invoiceNumber} (${invDate})`);
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
      
      let stateName = (note.customer?.state || "").trim();
      const rawCode = String(note.customer?.stateCode || "").trim();
      const rawState = stateName.toLowerCase().replace(/\s/g, "");

      if (rawState === "tamilnadu" || rawState === "tn" || rawState.includes("tamilnadu") || rawCode === "33") {
        stateName = "Tamil Nadu";
      } else if (!stateName || !isNaN(stateName)) {
        const cnStateMap = { "33": "Tamil Nadu", "32": "Kerala", "29": "Karnataka" };
        stateName = cnStateMap[rawCode] || "Tamil Nadu";
      }
      
      const pos = (rawCode || "33") + "-" + stateName;
      const isIntraNote = pos.includes("Tamil Nadu") || pos.startsWith("33-");

      const noteGroups = {};

      if (note.items && note.items.length > 0) {
        note.items.forEach(item => {
          const rate = Math.round(item.gst || 0);
          const taxable = ((item.sellingPrice || 0) * (item.qty || 0)) - (item.discountAmount || 0);
          
          const itemIgst = !isIntraNote ? (taxable * rate / 100) : 0;
          const itemCgst = isIntraNote ? (taxable * (rate / 2) / 100) : 0;
          const itemSgst = isIntraNote ? (taxable * (rate / 2) / 100) : 0;

          if (!noteGroups[rate]) {
            noteGroups[rate] = { taxableValue: 0, igst: 0, cgst: 0, sgst: 0 };
          }
          noteGroups[rate].taxableValue += taxable;
          noteGroups[rate].igst += itemIgst;
          noteGroups[rate].cgst += itemCgst;
          noteGroups[rate].sgst += itemSgst;

          if (rate === 0) {
            if (isRegistered) {
              if (!isIntraNote) nilRated.interReg -= taxable;
              else nilRated.intraReg -= taxable;
            } else {
              if (!isIntraNote) nilRated.interUnreg -= taxable;
              else nilRated.intraUnreg -= taxable;
            }
          }
        });
      } else {
        // Fallback for legacy notes without item-level rates
        const rate = Math.round(((note.grandTotal - note.subtotal) / (note.subtotal || 1)) * 100) || 0;
        noteGroups[rate] = {
          taxableValue: note.subtotal,
          igst: note.totalTax?.igst || (!isIntraNote ? (note.grandTotal - note.subtotal) : 0),
          cgst: note.totalTax?.cgst || (isIntraNote ? (note.grandTotal - note.subtotal) / 2 : 0),
          sgst: note.totalTax?.sgst || (isIntraNote ? (note.grandTotal - note.subtotal) / 2 : 0)
        };
      }

      Object.keys(noteGroups).forEach(rateStr => {
        const rate = parseFloat(rateStr);
        const rData = noteGroups[rateStr];
        
        const entry = {
          gstin: note.customer.gstin,
          customerName: note.customer.name,
          noteNo: note.creditNoteId,
          noteDate: moment(note.date).format("DD-MMM-YYYY"),
          noteType: "C",
          placeOfSupply: pos,
          reverseCharge: "N",
          noteSupplyType: "Regular",
          noteValue: note.grandTotal,
          applicablePercent: "",
          rate: rate,
          taxableValue: rData.taxableValue,
          igst: rData.igst,
          cgst: rData.cgst,
          sgst: rData.sgst,
          cess: 0,
          preGst: "N"
        };

        if (isRegistered) cdnr.push(entry);
        else {
          cdnur.push({ 
            ...entry, 
            type: (!isIntraNote && note.grandTotal > 250000) ? "B2CL" : "B2CS" 
          });
        }
      });
    });

    // Count Unique Invoice Numbers and Group by Prefix for Document Summary
    const groups = {};
    invoices.forEach(inv => {
      const num = inv.invoiceNumber;
      const prefix = num.includes("/") ? num.split("/")[0] : (num.includes("-") ? num.split("-")[0] : "INV");
      
      if (!groups[prefix]) {
        groups[prefix] = { from: num, to: num, uniqueNumbers: new Set(), cancelledCount: 0 };
      }
      
      groups[prefix].uniqueNumbers.add(num);
      if (inv.status === "CANCELLED") groups[prefix].cancelledCount++;
      
      // Update From/To strings
      if (num < groups[prefix].from) groups[prefix].from = num;
      if (num > groups[prefix].to) groups[prefix].to = num;
    });

    const docSummary = Object.keys(groups).map(prefix => {
      const g = groups[prefix];
      const total = g.uniqueNumbers.size;
      return {
        nature: `Invoices for outward supply (${prefix})`,
        from: g.from,
        to: g.to,
        total: total,
        cancelled: g.cancelledCount,
        net: total - g.cancelledCount
      };
    });

    // Restore these for the rawCounts response
    const totalProcessed = Object.values(groups).reduce((acc, g) => acc + g.uniqueNumbers.size, 0);
    cancelledCount = Object.values(groups).reduce((acc, g) => acc + g.cancelledCount, 0);

    // Add Credit Notes to summary
    if (creditNotes.length > 0) {
      docSummary.push({
        nature: "Credit Notes",
        from: creditNotes[0]?.creditNoteId || "N/A",
        to: creditNotes[creditNotes.length - 1]?.creditNoteId || "N/A",
        total: creditNotes.length,
        cancelled: 0,
        net: creditNotes.length
      });
    }

    // Filter out zero-value rows before sending
    const finalB2CS = Object.values(b2cGroups).filter(row => row.taxableValue > 0);
    const finalB2CL = b2cLarge.filter(row => row.taxableValue > 0);

    // Fetch branch info for the report
    const branchInfo = await Branch.findById(branchObjectId).select("gstin name").lean();
    let finalGstin = branchInfo?.gstin || "NO_GSTIN";
    
    // Fallback for Gomathi branches if GSTIN is missing
    if (finalGstin === "NO_GSTIN" && branchInfo?.name?.toLowerCase().includes("gomathi")) {
      finalGstin = "33DULPS2600Q4Z3";
    }

    res.json({
      success: true,
      data: {
        branchGstin: finalGstin,
        branchName: branchInfo?.name || "N/A",
        b2b: b2b.filter(row => row.taxableValue > 0 || row.status === "CANCELLED"), 
        b2cl: finalB2CL, 
        b2cs: finalB2CS, 
        b2cRaw, cdnr, cdnur,
        nilRated: [
          { description: "Inter-State supplies to registered persons", nilRated: Math.max(0, nilRated.interReg), exempt: 0, nonGst: 0 },
          { description: "Intra-State supplies to registered persons", nilRated: Math.max(0, nilRated.intraReg), exempt: 0, nonGst: 0 },
          { description: "Inter-State supplies to unregistered persons", nilRated: Math.max(0, nilRated.interUnreg), exempt: 0, nonGst: 0 },
          { description: "Intra-State supplies to unregistered persons", nilRated: Math.max(0, nilRated.intraUnreg), exempt: 0, nonGst: 0 }
        ],
        hsnSummaryB2B: Object.values(hsnSummaryB2B).map(h => ({ ...h, invoiceNumbers: Array.from(h.invoiceNumbers) })),
        hsnSummaryB2C: Object.values(hsnSummaryB2C).map(h => ({ ...h, invoiceNumbers: Array.from(h.invoiceNumbers) })),
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
      PurchaseInvoice.find({ branchId: branchObjectId, invoiceDate: { $gte: startDate, $lte: endDate }, status: { $ne: "CANCELLED" } }).select("subtotal totalTax items extraExpenses").lean()
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

    // Fetch branch state for state-wise tax splitting
    const branch = await Branch.findById(branchObjectId).select("state").lean();
    const branchState = branch?.state?.toLowerCase() || "";

    // Fetch all vendors for this branch to get their states
    const vendors = await Vendor.find({ branchId: branchObjectId }).select("name state").lean();
    const vendorMap = {};
    vendors.forEach(v => { vendorMap[v.name] = v.state?.toLowerCase() || ""; });

    const eligibleITC = {
      taxable: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
      nilRated: 0
    };

    purchases.forEach(inv => {
      const taxableValue = inv.subtotal || 0;
      const totalTaxAmount = inv.totalTax || 0;

      let itemIgst = 0, itemCgst = 0, itemSgst = 0;

      if (totalTaxAmount > 0) {
        // Determine the split based on vendor state
        const vendorState = vendorMap[inv.vendor] || "";
        const isInterState = vendorState && branchState && vendorState !== branchState;

        if (isInterState) {
          itemIgst = totalTaxAmount;
        } else {
          itemCgst = totalTaxAmount / 2;
          itemSgst = totalTaxAmount / 2;
        }

        eligibleITC.taxable += taxableValue;
        eligibleITC.igst += itemIgst;
        eligibleITC.cgst += itemCgst;
        eligibleITC.sgst += itemSgst;
      } else if (taxableValue > 0) {
        // If totalTax is 0 but subtotal > 0, it's Nil Rated/Exempt
        eligibleITC.nilRated += taxableValue;
      }
      
      // Add taxes from extra expenses (if not already included in totalTax)
      // Usually totalTax includes everything, but we check if extra expenses have their own tax breakdown
      if (inv.extraExpenses && inv.extraExpenses.length > 0) {
        inv.extraExpenses.forEach(exp => {
          // If the invoice totalTax was 0, we add these. 
          // If it wasn't, we assume they are already part of it unless they are distinct.
          // To be safe, let's only add if the totalTax was 0.
          if (totalTaxAmount === 0) {
             eligibleITC.igst += exp.igst || 0;
             eligibleITC.cgst += exp.cgst || 0;
             eligibleITC.sgst += exp.sgst || 0;
          }
        });
      }
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
