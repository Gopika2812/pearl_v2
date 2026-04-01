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
    const { userId, username, generateEWayBill } = req.body;

    const invoice = await Invoice.findById(invoiceId)
      .populate("branchId")
      .populate("customer.customerId")
      .populate("items.productId");

    console.log("\n📋 Invoice Data Loaded:");
    console.log("✓ Branch State Code:", invoice.branchId?.stateCode);
    console.log("✓ Customer State Code (from master):", invoice.customer?.customerId?.stateCode);
    console.log("✓ Customer State Code (from invoice):", invoice.customer?.stateCode);
    console.log("✓ Customer Name:", invoice.customer?.name);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // 🚀 ALLOW RE-GENERATION (Removed blocking check as per user request)
    /*
    if (invoice.einvoiceStatus === "GENERATED") {
      return res.status(400).json({ message: "E-Invoice already generated for this invoice" });
    }
    */

    // ========== STEP 0: VALIDATE REQUIRED FIELDS ==========
    console.log(`\n🔄 Processing Invoice: ${invoice.invoiceNumber}`);
    console.log(`📊 Invoice Amount: ₹${invoice.grandTotal}`);
    console.log(`👤 Customer: ${invoice.customer?.name}`);

    // Ensure branch has required fields
    if (!invoice.branchId?.gstin) {
      return res.status(400).json({
        success: false,
        message: "Branch GSTIN is missing",
        error: "The branch must have a GSTIN registered to generate E-Invoices"
      });
    }

    if (!invoice.branchId?.stateCode) {
      return res.status(400).json({
        success: false,
        message: "Branch State Code is missing",
        error: "The branch must have a state code (33, 32, 29, 27, etc.) to generate E-Invoices"
      });
    }

    // Ensure customer has required fields
    if (!invoice.customer?.stateCode) {
      console.warn("⚠️  Customer stateCode missing. Attempting to fetch from customer master...");
      
      // Try to fetch customer master data if available
      const customerMaster = await invoice.customer?.customerId;
      if (customerMaster?.stateCode) {
        invoice.customer.stateCode = customerMaster.stateCode;
        console.log(`✓ Customer stateCode fetched from master: ${customerMaster.stateCode}`);
      } else {
        // If customer is in Tamil Nadu, use state code 33 as default
        const stateCodeMap = {
          "tamil nadu": "33",
          "karnataka": "32",
          "maharashtra": "29",
          "telangana": "27",
          "andhra pradesh": "28"
        };
        const defaultCode = stateCodeMap[invoice.customer?.state?.toLowerCase()] || "33";
        invoice.customer.stateCode = defaultCode;
        console.log(`ℹ️  Using default state code based on state: ${defaultCode}`);
      }
    }

    // ========== STEP 1: GENERATE E-INVOICE ==========
    let eInvoiceResult;
    try {
      eInvoiceResult = await gstzenService.generateEInvoice(invoice);
    } catch (gstError) {
      console.error("❌ GSTZen Service Error:", gstError.message);
      return res.status(400).json({
        success: false,
        message: "E-Invoice generation failed",
        error: gstError.message,
        tip: "Check backend console for detailed error information",
        requiredFields: {
          branch: ["gstin", "city", "state", "stateCode", "pincode"],
          customer: ["name", "address", "state", "stateCode", "pincode"],
          items: ["hsn", "quantity", "rate", "gst %"]
        }
      });
    }

    if (!eInvoiceResult || !eInvoiceResult.success) {
      return res.status(400).json({
        success: false,
        message: "Failed to generate E-Invoice",
        error: eInvoiceResult?.message || "Unknown error",
        details: eInvoiceResult
      });
    }

    // Update invoice with E-Invoice details
    invoice.einvoiceStatus = "GENERATED";
    invoice.irn = eInvoiceResult.irn;
    invoice.ackNo = eInvoiceResult.ackNo;
    invoice.ackDate = eInvoiceResult.ackDate;
    invoice.signedInvoice = eInvoiceResult.signedInvoice;
    invoice.signedQrCode = eInvoiceResult.signedQrCode;

    console.log(`✅ E-Invoice Generated! IRN: ${eInvoiceResult.irn}`);

    // ========== STEP 2: GENERATE E-WAY BILL (Optional) ==========
    let eWayBillResult = null;

    if (generateEWayBill && invoice.grandTotal > 50000) {
      // E-Way Bill is mandatory for invoices > 50,000
      console.log("📦 Generating E-Way Bill...");
      
      try {
        eWayBillResult = await gstzenService.generateEWayBill(invoice, eInvoiceResult);

        if (eWayBillResult.success) {
          invoice.ewayBillNo = eWayBillResult.ewayBillNo;
          invoice.ewayBillDate = eWayBillResult.ewayBillDate;
          invoice.ewayBillValidUntil = eWayBillResult.ewayBillValidUntil;
          console.log(`✅ E-Way Bill Generated! No: ${eWayBillResult.ewayBillNo}`);
        }
      } catch (ewayError) {
        console.warn("⚠️  E-Way Bill generation failed:", ewayError.message);
        // Don't fail the whole request if e-way bill fails
        eWayBillResult = { success: false, message: ewayError.message };
      }
    }

    await invoice.save();

    // ========== STEP 3: AUDIT LOG ==========
    await createAuditLog({
      userId: userId || "System",
      username: username || "System",
      branchId: invoice.branchId,
      action: "GENERATE_EINVOICE",
      description: `E-Invoice: ${invoice.invoiceNumber}, IRN: ${invoice.irn}${
        invoice.ewayBillNo ? `, E-Way Bill: ${invoice.ewayBillNo}` : ""
      }`,
      targetId: invoice._id,
      targetModel: "Invoice"
    });

    res.json({
      success: true,
      message: "E-Invoice generated successfully",
      data: {
        invoiceNumber: invoice.invoiceNumber,
        irn: invoice.irn,
        ackNo: invoice.ackNo,
        ackDate: invoice.ackDate,
        ewayBillNo: invoice.ewayBillNo || null,
        ewayBillValidUntil: invoice.ewayBillValidUntil || null,
        eInvoiceStatus: invoice.einvoiceStatus,
        qrCodeUrl: invoice.signedQrCode
      }
    });

  } catch (error) {
    console.error("❌ E-Invoice Generation Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate E-Invoice",
      error: error.message
    });
  }
});

/**
 * POST /api/einvoice/cancel/:invoiceId
 * Cancel generated e-invoice
 */
router.post("/cancel/:invoiceId", async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { userId, username, reason } = req.body;

    const invoice = await Invoice.findById(invoiceId).populate("branchId");

    if (!invoice || !invoice.irn) {
      return res.status(404).json({ message: "E-Invoice not found for this invoice" });
    }

    // Call GSTZen to cancel
    const result = await gstzenService.cancelEInvoice(invoice.irn, reason || "User cancelled");

    // Update invoice status
    invoice.einvoiceStatus = "CANCELLED";
    await invoice.save();

    await createAuditLog({
      userId: userId || "System",
      username: username || "System",
      branchId: invoice.branchId,
      action: "CANCEL_EINVOICE",
      description: `Cancelled E-Invoice: ${invoice.invoiceNumber}, IRN: ${invoice.irn}`,
      targetId: invoice._id,
      targetModel: "Invoice"
    });

    res.json({
      success: true,
      message: "E-Invoice cancelled successfully",
      data: result
    });

  } catch (error) {
    console.error("❌ Cancel E-Invoice Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to cancel E-Invoice"
    });
  }
});

/**
 * GET /api/einvoice/test
 * Test GSTZen API connection
 */
router.get("/test", async (req, res) => {
  try {
    const apiKey = process.env.GSTZEN_API_KEY;
    const baseUrl = process.env.GSTZEN_BASE_URL;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: "GSTZEN_API_KEY not set in .env",
        tips: [
          "1. Add GSTZEN_API_KEY=your_api_key to backend/.env",
          "2. Restart backend (npm start)"
        ]
      });
    }

    res.json({
      success: true,
      message: "GSTZen Configuration Status",
      config: {
        apiKeySet: !!apiKey,
        apiKeyFormat: apiKey ? apiKey.substring(0, 8) + "..." : "NOT SET",
        baseUrl: baseUrl || "Not configured (using default)",
        defaultUrl: "https://gstzen.in/api"
      },
      nextSteps: [
        "1. Verify API Key is correct from GSTZen",
        "2. Check if GSTZen API is online",
        "3. Try generating E-Invoice from frontend",
        "4. Check backend console for detailed logs"
      ]
    });

  } catch (error) {
    console.error("❌ Test Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
