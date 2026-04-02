import express from "express";
import Invoice from "../models/Invoice.js";
import gstzenService from "../utils/gstzenService.js";
import { createAuditLog } from "../utils/logUtil.js";

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

    // PDF URLs
    invoice.invoicePdfUrl = eInvoiceResult.invoicePdfUrl;
    invoice.ewayBillPdfUrl = eInvoiceResult.ewayBillPdfUrl;

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

export default router;
