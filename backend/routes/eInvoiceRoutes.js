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
      invoice.einvoiceStatus = "FAILED";
      invoice.einvoiceError = gstError.message;
      await invoice.save();

      return res.status(400).json({
        success: false,
        message: "E-Invoice generation failed",
        error: gstError.message
      });
    }

    if (!eInvoiceResult || !eInvoiceResult.success) {
      invoice.einvoiceStatus = "FAILED";
      invoice.einvoiceError = eInvoiceResult?.message || "Unknown error";
      await invoice.save();

      return res.status(400).json({
        success: false,
        message: "Failed to generate E-Invoice",
        error: eInvoiceResult?.message || "Unknown error"
      });
    }

    // Update invoice with E-Invoice details
    invoice.einvoiceStatus = "GENERATED";
    invoice.einvoiceError = null; // Clear previous error
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
    }).lean();

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

      // 3. Include previous failure message if any
      if (inv.einvoiceStatus === "FAILED" && inv.einvoiceError) {
        errors.push(`Last Attempt Error: ${inv.einvoiceError}`);
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
          invoice.einvoiceError = null;
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
          await Invoice.updateOne(
            { _id: invoiceId },
            { 
              $set: { 
                einvoiceStatus: "FAILED", 
                einvoiceError: eInvoiceResult?.message || "Failed" 
              } 
            }
          );
          results.push({ invoiceId, invoiceNumber: invoice.invoiceNumber, success: false, message: eInvoiceResult?.message || "Failed" });
        }
      } catch (err) {
        // 🛡️ GUARANTEED PERSISTENCE: Use direct update to bypass full document validation
        try {
          await Invoice.updateOne(
            { _id: invoiceId },
            { 
              $set: { 
                einvoiceStatus: "FAILED", 
                einvoiceError: err.message 
              } 
            }
          );
        } catch (saveErr) {
          console.error("Failed to update error status for invoice:", invoiceId, saveErr);
        }
        results.push({ 
          invoiceId, 
          success: false, 
          message: err.message 
        });
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
 * POST /api/einvoice/bulk-pdf-count
 * Returns the total count of generated invoices for a given month, for pagination.
 */
router.post("/bulk-pdf-count", async (req, res) => {
  try {
    const { branchId, month, year } = req.body;
    if (!branchId || !month || !year) {
      return res.status(400).json({ success: false, message: "Missing branchId, month, or year" });
    }
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const total = await Invoice.countDocuments({
      branchId,
      invoiceDate: { $gte: startDate, $lte: endDate },
      einvoiceStatus: "GENERATED",
      invoicePdfUrl: { $exists: true, $ne: "" }
    }).lean(); // lean count is slightly faster and lighter

    res.json({ success: true, total });
  } catch (error) {
    console.error("Bulk PDF Count Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/einvoice/bulk-pdf-download
 * Downloads and merges e-invoice PDFs for a given month and branch.
 * Supports pagination via `page` and `batchSize` body params (default: page=1, batchSize=10).
 */
router.post("/bulk-pdf-download", async (req, res) => {
  try {
    const { branchId, month, year, page = 1, batchSize = 10 } = req.body;
    
    if (!branchId || !month || !year) {
      return res.status(400).json({ success: false, message: "Missing branchId, month, or year" });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const skip = (parseInt(page) - 1) * parseInt(batchSize);

    const invoices = await Invoice.find({
      branchId,
      invoiceDate: { $gte: startDate, $lte: endDate },
      einvoiceStatus: "GENERATED",
      invoicePdfUrl: { $exists: true, $ne: "" }
    })
      .sort({ invoiceDate: 1 })
      .skip(skip)
      .limit(parseInt(batchSize))
      .lean();

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: "No generated E-Invoices found for this batch." });
    }

    // Create a new empty PDF
    const mergedPdf = await PDFDocument.create();

    for (const inv of invoices) {
      let pdfBytes = null;
      try {
        let pdfUrl = inv.invoicePdfUrl;
        if (pdfUrl.startsWith("/")) {
          pdfUrl = `${gstzenService.baseUrl}${pdfUrl}`;
        }
        
        const response = await fetch(pdfUrl);
        if (!response.ok) {
          console.error(`Failed to fetch PDF for ${inv.invoiceNumber}: Status ${response.status}`);
          continue;
        }
        pdfBytes = await response.arrayBuffer();
        
        const invoiceDoc = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(invoiceDoc, invoiceDoc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
        
        // 🧹 Clear references to help Garbage Collection
        pdfBytes = null; 
      } catch (err) {
        console.error(`Failed to fetch PDF for ${inv.invoiceNumber}:`, err.message);
      }
    }

    const mergedPdfBytes = await mergedPdf.save();
    const buffer = Buffer.from(mergedPdfBytes);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=EInvoices_${month}_${year}_Part${page}.pdf`);
    res.send(buffer);

    // 🧹 Final Cleanup
    res.on('finish', () => {
      mergedPdfBytes.buffer = null; 
    });

  } catch (error) {
    console.error("Bulk PDF Download Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/einvoice/convert-to-b2c/:invoiceId
 * Converts a B2B invoice (with GSTIN) to B2C by removing GSTIN.
 * Also updates the customer record to prevent future issues.
 */
router.post("/convert-to-b2c/:invoiceId", async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { userId, username } = req.body;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const oldGstin = invoice.customer?.gstin;

    // 1. Update Invoice to B2C (remove GSTIN)
    invoice.customer.gstin = "";
    invoice.einvoiceStatus = "NOT_GENERATED"; // Reset status
    invoice.einvoiceError = null; // Clear error
    await invoice.save();

    // 2. Update Customer Record (if linked)
    if (invoice.customer?.customerId) {
      await mongoose.model("Customer").findByIdAndUpdate(invoice.customer.customerId, {
        gstin: "",
        registrationType: "unregistered"
      });
    }

    // 3. Audit Log
    await createAuditLog({
      userId: userId || "System",
      username: username || "System",
      branchId: invoice.branchId,
      action: "CONVERT_TO_B2C",
      description: `Invoice ${invoice.invoiceNumber} converted to B2C. Removed GSTIN: ${oldGstin}`,
      targetId: invoice._id,
      targetModel: "Invoice"
    });

    res.json({
      success: true,
      message: "Invoice converted to B2C successfully. It will no longer require an E-Invoice.",
    });

  } catch (error) {
    console.error("Convert to B2C Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🔄 CONVERT TO B2C: Handles invoices with cancelled/invalid GSTINs
router.post("/convert-to-b2c", async (req, res) => {
  try {
    const { invoiceId, reason } = req.body;
    if (!invoiceId) return res.status(400).json({ message: "Invoice ID required" });

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    // 1. Clear GSTIN from the invoice snapshot
    const oldGstin = invoice.customer?.gstin;
    if (invoice.customer) {
      invoice.customer.gstin = ""; // Clear to make it B2C
    }

    // 2. Clear E-Invoice Status/Errors
    invoice.einvoiceStatus = "NOT_GENERATED";
    invoice.einvoiceError = `Converted to B2C: ${reason || "Cancelled GSTIN"}`;
    
    await invoice.save();

    // 3. Log the action
    await createAuditLog({
      userId: req.user.id,
      userModel: req.user.role === "SUPER_ADMIN" ? "SuperAdmin" : "BranchUser",
      username: req.user.username,
      branchId: invoice.branchId,
      action: "CONVERT_TO_B2C",
      description: `Converted Invoice ${invoice.invoiceNumber} to B2C (Old GSTIN: ${oldGstin}). Reason: ${reason || "Manual Conversion"}`,
      targetId: invoice._id,
      targetModel: "Invoice",
    });

    res.json({ success: true, message: "Invoice converted to B2C successfully." });
  } catch (error) {
    console.error("B2C conversion error:", error);
    res.status(500).json({ success: false, message: "Failed to convert to B2C" });
  }
});

export default router;
