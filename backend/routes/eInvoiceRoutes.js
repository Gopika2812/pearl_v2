import express from "express";
import Invoice from "../models/Invoice.js";
import masterGstService from "../utils/masterGstService.js";
import { createAuditLog } from "../utils/logUtil.js";

const router = express.Router();

/**
 * POST /api/einvoice/generate/:invoiceId
 * Generates E-Invoice IRN for a finalized invoice
 */
router.post("/generate/:invoiceId", async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { userId, username } = req.body;

    const invoice = await Invoice.findById(invoiceId)
      .populate("branchId")
      .populate("customer.customerId");

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.einvoiceStatus === "GENERATED") {
      return res.status(400).json({ message: "E-Invoice already generated for this invoice" });
    }

    // Call MasterGST Service
    const result = await masterGstService.generateEInvoice(invoice);

    if (result && result.Success === "Y") {
      // Update Invoice with IRN details
      invoice.einvoiceStatus = "GENERATED";
      invoice.irn = result.Data.Irn;
      invoice.ackNo = result.Data.AckNo;
      invoice.ackDate = result.Data.AckDt;
      invoice.signedInvoice = result.Data.SignedInvoice;
      invoice.signedQrCode = result.Data.SignedQrCode;
      
      // Update E-Way Bill if generated
      if (result.Data.EwbNo) {
        invoice.ewayBillNo = result.Data.EwbNo;
        invoice.ewayBillDate = result.Data.EwbDt;
        invoice.ewayBillValidUntil = result.Data.EwbValidTill;
      }

      await invoice.save();

      // Log the action
      await createAuditLog({
        userId: userId || "System",
        username: username || "System",
        branchId: invoice.branchId,
        action: "GENERATE_EINVOICE",
        description: `Generated E-Invoice for ${invoice.invoiceNumber}. IRN: ${invoice.irn}`,
        targetId: invoice._id,
        targetModel: "Invoice"
      });

      res.json({
        success: true,
        message: "E-Invoice generated successfully",
        data: {
          irn: invoice.irn,
          ackNo: invoice.ackNo,
          ewayBillNo: invoice.ewayBillNo
        }
      });
    } else {
      // Handle MasterGST error response
      const errorMessage = result.ErrorDetails?.[0]?.ErrorMessage || "Unknown error from GST portal";
      res.status(400).json({
        success: false,
        message: errorMessage,
        errors: result.ErrorDetails
      });
    }
  } catch (error) {
    console.error("E-Invoice Route Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate E-Invoice"
    });
  }
});

export default router;
