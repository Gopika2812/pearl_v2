import express from "express";
import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import auth from "../middleware/auth.js";

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

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const branchObjectId = new mongoose.Types.ObjectId(branchId);

    const invoices = await Invoice.find({
      branchId: branchObjectId,
      invoiceDate: { $gte: startDate, $lte: endDate },
      status: { $ne: "CANCELLED" }
    })
    .select("invoiceNumber invoiceDate grandTotal customer subtotal totalTax items.hsn items.name items.sellingPrice items.qty items.discountAmount items.total items.igst items.cgst items.sgst items.unit")
    .lean();

    const b2b = [];
    const b2c = [];
    const hsnSummary = {};
    const docSummary = {
      total: invoices.length,
      cancelled: 0,
      from: invoices.length > 0 ? invoices[0].invoiceNumber : "",
      to: invoices.length > 0 ? invoices[invoices.length - 1].invoiceNumber : ""
    };

    invoices.forEach(inv => {
      const gstin = inv.customer?.gstin || "";
      const isB2B = gstin.length === 15 && !gstin.includes("URP");
      
      // Categorize Items for HSN Summary
      inv.items.forEach(item => {
        const hsn = item.hsn || "9999";
        if (!hsnSummary[hsn]) {
          hsnSummary[hsn] = {
            hsn,
            description: item.name,
            uqc: item.unit || "NOS",
            totalQty: 0,
            totalValue: 0,
            taxableValue: 0,
            igst: 0,
            cgst: 0,
            sgst: 0
          };
        }
        const gross = (item.sellingPrice || 0) * (item.qty || 0);
        const taxable = gross - (item.discountAmount || 0);
        
        hsnSummary[hsn].totalQty += (item.qty || 0);
        hsnSummary[hsn].totalValue += item.total || 0;
        hsnSummary[hsn].taxableValue += taxable;
        hsnSummary[hsn].igst += (item.igst || 0);
        hsnSummary[hsn].cgst += (item.cgst || 0);
        hsnSummary[hsn].sgst += (item.sgst || 0);
      });

      if (isB2B) {
        b2b.push({
          gstin: inv.customer.gstin,
          customerName: inv.customer.name,
          invoiceNo: inv.invoiceNumber,
          date: inv.invoiceDate,
          value: inv.grandTotal,
          placeOfSupply: (inv.customer.stateCode || "33") + "-" + (inv.customer.state || "Tamil Nadu"),
          reverseCharge: "N",
          invoiceType: "Regular",
          taxableValue: inv.subtotal,
          igst: inv.totalTax?.igst || 0,
          cgst: inv.totalTax?.cgst || 0,
          sgst: inv.totalTax?.sgst || 0,
          cess: 0
        });
      } else {
        b2c.push({
          invoiceNo: inv.invoiceNumber,
          date: inv.invoiceDate,
          value: inv.grandTotal,
          placeOfSupply: (inv.customer.stateCode || "33") + "-" + (inv.customer.state || "Tamil Nadu"),
          taxableValue: inv.subtotal,
          igst: inv.totalTax?.igst || 0,
          cgst: inv.totalTax?.cgst || 0,
          sgst: inv.totalTax?.sgst || 0
        });
      }
    });

    res.json({
      success: true,
      data: {
        b2b,
        b2c,
        hsnSummary: Object.values(hsnSummary),
        docSummary
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

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const branchObjectId = new mongoose.Types.ObjectId(branchId);

    // 1. Outward Supplies (Sales)
    const sales = await Invoice.find({
      branchId: branchObjectId,
      invoiceDate: { $gte: startDate, $lte: endDate },
      status: { $ne: "CANCELLED" }
    })
    .select("subtotal totalTax")
    .lean();

    const outwardSupplies = {
      taxable: 0,
      igst: 0,
      cgst: 0,
      sgst: 0
    };

    sales.forEach(inv => {
      outwardSupplies.taxable += inv.subtotal || 0;
      outwardSupplies.igst += inv.totalTax?.igst || 0;
      outwardSupplies.cgst += inv.totalTax?.cgst || 0;
      outwardSupplies.sgst += inv.totalTax?.sgst || 0;
    });

    // 2. Inward Supplies (Purchases - for ITC)
    const purchases = await PurchaseInvoice.find({
      branchId: branchObjectId,
      invoiceDate: { $gte: startDate, $lte: endDate },
      status: { $ne: "CANCELLED" }
    })
    .select("subtotal totalTax")
    .lean();

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

    const branchObjectId = new mongoose.Types.ObjectId(branchId);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

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

export default router;
