import express from "express";
import Invoice from "../models/Invoice.js";
import gstzenService from "../utils/gstzenService.js";
import { createAuditLog } from "../utils/logUtil.js";
import { PDFDocument } from 'pdf-lib';

const router = express.Router();

/**
 * POST /api/einvoice/generate/:invoiceId
 * Generates E-Invoice IRN + E-Way Bill using GSTZen API
 */
router.post("/generate/:invoiceId", async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { userId, username } = req.body;

    const invoice = await Invoice.findById(invoiceId)
      .populate("branchId")
      .populate("customer.customerId")
      .populate("items.productId");

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    console.log(`\n🔄 Processing Invoice: ${invoice.invoiceNumber}`);

    // ========== STEP 1: UPDATE TRANSPORT DETAILS IF PROVIDED ==========
    if (req.body.transportDetails) {
      const { 
        vehicleNo, 
        transportMode, 
        transportDistance, 
        vehicleType, 
        transporterId, 
        transporterName 
      } = req.body.transportDetails;
      
      invoice.vehicleNo = vehicleNo || invoice.vehicleNo;
      invoice.transportMode = transportMode || invoice.transportMode || "1";
      invoice.transportDistance = Number(transportDistance || 50);
      invoice.vehicleType = vehicleType || invoice.vehicleType || "REGULAR";
      invoice.transporterId = transporterId || invoice.transporterId;
      invoice.transporterName = transporterName || invoice.transporterName;
      
      await invoice.save();
    }

    // ========== STEP 2: GENERATE E-INVOICE ==========
    let eInvoiceResult;
    try {
      eInvoiceResult = await gstzenService.generateEInvoice(invoice);
    } catch (gstError) {
      return res.status(400).json({
        success: false,
        message: "E-Invoice generation failed",
        error: gstError.message
      });
    }

    if (!eInvoiceResult || !eInvoiceResult.success) {
      return res.status(400).json({
        success: false,
        message: "Failed to generate E-Invoice",
        error: eInvoiceResult?.message || "Unknown error"
      });
    }

    // Update invoice with E-Invoice details
    invoice.einvoiceStatus = "GENERATED";
    invoice.irn = eInvoiceResult.irn;
    invoice.ackNo = eInvoiceResult.ackNo;
    invoice.ackDate = eInvoiceResult.ackDate;
    invoice.signedInvoice = eInvoiceResult.signedInvoice;
    invoice.signedQrCode = eInvoiceResult.signedQrCode;

    // E-Way Bill details
    if (eInvoiceResult.ewayBillNo) {
      invoice.ewayBillNo = eInvoiceResult.ewayBillNo;
      invoice.ewayBillDate = eInvoiceResult.ewayBillDate;
      invoice.ewayBillValidUntil = eInvoiceResult.ewayBillValidUntil;
    }

    // PDF & QR URLs
    invoice.invoicePdfUrl = eInvoiceResult.invoicePdfUrl;
    invoice.ewayBillPdfUrl = eInvoiceResult.ewayBillPdfUrl;
    invoice.qrCodeUrl = eInvoiceResult.qrCodeUrl;
    invoice.signedQrCodeImgUrl = eInvoiceResult.signedQrCodeImgUrl;

    await invoice.save();

    // ========== STEP 3: AUDIT LOG ==========
    await createAuditLog({
      userId: userId || "System",
      username: username || "System",
      branchId: invoice.branchId,
      action: "GENERATE_EINVOICE",
      description: `E-Invoice: ${invoice.invoiceNumber}, IRN: ${invoice.irn}`,
      targetId: invoice._id,
      targetModel: "Invoice"
    });

    res.json({
      success: true,
      message: "E-Invoice generated successfully",
      data: invoice
    });

  } catch (error) {
    console.error("❌ E-Invoice Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/einvoice/generate-ewb-only/:invoiceId
 * Generates only E-Way Bill for an already generated IRN
 */
router.post("/generate-ewb-only/:invoiceId", async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { transportDetails } = req.body;

    const invoice = await Invoice.findById(invoiceId).populate("branchId");
    if (!invoice || !invoice.irn) {
      return res.status(400).json({ message: "Valid IRN is required for E-Way Bill" });
    }

    if (transportDetails) {
      invoice.vehicleNo = transportDetails.vehicleNo || invoice.vehicleNo;
      invoice.transportMode = transportDetails.transportMode || invoice.transportMode || "1";
      invoice.transportDistance = Number(transportDetails.transportDistance || 50);
      invoice.vehicleType = transportDetails.vehicleType || invoice.vehicleType || "REGULAR";
      await invoice.save();
    }

    const ewbResult = await gstzenService.generateEWayBill(invoice, { irn: invoice.irn });

    if (ewbResult.success) {
      invoice.ewayBillNo = ewbResult.ewayBillNo;
      invoice.ewayBillDate = ewbResult.ewayBillDate;
      invoice.ewayBillValidUntil = ewbResult.ewayBillValidUntil;
      invoice.ewayBillPdfUrl = ewbResult.ewayBillPdfUrl;
      await invoice.save();

      res.json({
        success: true,
        message: "E-Way Bill generated successfully",
        data: invoice
      });
    } else {
      res.status(400).json({
        success: false,
        message: ewbResult.message || "E-Way Bill failed",
        details: ewbResult.raw
      });
    }
  } catch (error) {
    console.error("❌ EWB Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/einvoice/bulk-validate
 * Validates un-generated invoices for a given month and branch.
 */
router.post("/bulk-validate", async (req, res) => {
  try {
    const { branchId, month, year } = req.body;
    
    if (!branchId || !month || !year) {
      return res.status(400).json({ success: false, message: "Missing branchId, month, or year" });
    }

    // Calculate start and end dates for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const invoices = await Invoice.find({
      branchId,
      invoiceDate: { $gte: startDate, $lte: endDate },
      status: { $nin: ["DRAFT", "CANCELLED"] },
      einvoiceStatus: { $ne: "GENERATED" },
      "customer.gstin": { $exists: true, $ne: "", $not: /URP/i, $type: "string" }
    }).populate("customer.customerId").populate("items.productId");

    // We only want customers whose GSTIN length >= 15
    const gstInvoices = invoices.filter(inv => inv.customer?.gstin?.length >= 15);

    const readyInvoices = [];
    const errorInvoices = [];

    gstInvoices.forEach(inv => {
      const errors = [];
      
      // 1. Check HSN Codes
      inv.items.forEach(item => {
        if (!item.hsn || item.hsn.trim() === "") {
          errors.push(`Product '${item.name}' missing HSN code.`);
        }
      });

      // 2. Bill Math Check
      const taxTotal = typeof inv.totalTax === 'object' ? inv.totalTax?.total || 0 : inv.totalTax || 0;
      const expectedTotal = (inv.subtotal || 0) + taxTotal + (inv.extraExpenseAmount || 0) + (inv.transportCharge || 0) - (inv.commonDiscount || 0) - (inv.invoiceCommonDiscount || 0);
      const itemsTotal = inv.items.reduce((sum, item) => sum + (item.total || 0), 0);
      
      // Allow minor decimal mismatch (roundoff up to 2 rupees)
      if (Math.abs(expectedTotal - (inv.grandTotal || 0)) > 2 && Math.abs(itemsTotal - (inv.grandTotal || 0)) > 2) {
        errors.push(`Calculation mismatch: Expected ~${expectedTotal.toFixed(2)}, found ${inv.grandTotal}. Check math/roundoff.`);
      }

      if (errors.length > 0) {
        errorInvoices.push({
          invoiceId: inv._id,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customer?.name,
          grandTotal: inv.grandTotal,
          errors
        });
      } else {
        readyInvoices.push({
          invoiceId: inv._id,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customer?.name,
          grandTotal: inv.grandTotal
        });
      }
    });

    res.json({
      success: true,
      data: {
        ready: readyInvoices,
        errors: errorInvoices,
        totalFound: gstInvoices.length
      }
    });

  } catch (error) {
    console.error("Bulk Validate Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/einvoice/bulk-generate
 * Bulk generates E-Invoices for valid invoice IDs.
 */
router.post("/bulk-generate", async (req, res) => {
  try {
    const { invoiceIds, userId, username } = req.body;
    
    if (!invoiceIds || !Array.isArray(invoiceIds)) {
      return res.status(400).json({ success: false, message: "invoiceIds array required" });
    }

    const results = [];
    
    for (const invoiceId of invoiceIds) {
      try {
        const invoice = await Invoice.findById(invoiceId)
          .populate("branchId")
          .populate("customer.customerId")
          .populate("items.productId");

        if (!invoice || invoice.einvoiceStatus === "GENERATED") {
          results.push({ invoiceId, success: false, message: "Skipped (Generated or Not Found)" });
          continue;
        }

        const eInvoiceResult = await gstzenService.generateEInvoice(invoice);

        if (eInvoiceResult && eInvoiceResult.success) {
          invoice.einvoiceStatus = "GENERATED";
          invoice.irn = eInvoiceResult.irn;
          invoice.ackNo = eInvoiceResult.ackNo;
          invoice.ackDate = eInvoiceResult.ackDate;
          invoice.signedInvoice = eInvoiceResult.signedInvoice;
          invoice.signedQrCode = eInvoiceResult.signedQrCode;
          invoice.invoicePdfUrl = eInvoiceResult.invoicePdfUrl;
          invoice.ewayBillPdfUrl = eInvoiceResult.ewayBillPdfUrl;
          invoice.qrCodeUrl = eInvoiceResult.qrCodeUrl;
          invoice.signedQrCodeImgUrl = eInvoiceResult.signedQrCodeImgUrl;
          if (eInvoiceResult.ewayBillNo) {
            invoice.ewayBillNo = eInvoiceResult.ewayBillNo;
            invoice.ewayBillDate = eInvoiceResult.ewayBillDate;
            invoice.ewayBillValidUntil = eInvoiceResult.ewayBillValidUntil;
          }
          await invoice.save();
          
          await createAuditLog({
            userId: userId || "System",
            username: username || "System",
            branchId: invoice.branchId,
            action: "GENERATE_EINVOICE_BULK",
            description: `Bulk E-Invoice: ${invoice.invoiceNumber}, IRN: ${invoice.irn}`,
            targetId: invoice._id,
            targetModel: "Invoice"
          });

          results.push({ invoiceId, invoiceNumber: invoice.invoiceNumber, success: true });
        } else {
          results.push({ invoiceId, invoiceNumber: invoice.invoiceNumber, success: false, message: eInvoiceResult?.message || "Failed" });
        }
      } catch (err) {
        results.push({ invoiceId, success: false, message: err.message });
      }
    }

    res.json({
      success: true,
      message: "Bulk generation complete",
      results
    });

  } catch (error) {
    console.error("Bulk Generate Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/einvoice/bulk-pdf-download
 * Downloads and merges e-invoice PDFs for a given month and branch.
 */
router.post("/bulk-pdf-download", async (req, res) => {
  try {
    const { branchId, month, year } = req.body;
    
    if (!branchId || !month || !year) {
      return res.status(400).json({ success: false, message: "Missing branchId, month, or year" });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const invoices = await Invoice.find({
      branchId,
      invoiceDate: { $gte: startDate, $lte: endDate },
      einvoiceStatus: "GENERATED",
      invoicePdfUrl: { $exists: true, $ne: "" }
    }).sort({ invoiceDate: 1 });

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: "No generated E-Invoices found for this month." });
    }

    // Create a new empty PDF
    const mergedPdf = await PDFDocument.create();

    for (const inv of invoices) {
      try {
        const response = await fetch(inv.invoicePdfUrl);
        if (!response.ok) continue;
        const pdfBytes = await response.arrayBuffer();
        
        const invoiceDoc = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(invoiceDoc, invoiceDoc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } catch (err) {
        console.error(`Failed to fetch PDF for ${inv.invoiceNumber}:`, err.message);
      }
    }

    const mergedPdfBytes = await mergedPdf.save();
    
    const buffer = Buffer.from(mergedPdfBytes);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Merged_EInvoices_${month}_${year}.pdf`);
    res.send(buffer);

  } catch (error) {
    console.error("Bulk PDF Download Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
