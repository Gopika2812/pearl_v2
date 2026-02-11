import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import Customer from "../models/Customer.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  console.log("🔥 CUSTOMER BULK UPLOAD HIT");

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Excel file required" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    console.log("📄 TOTAL ROWS:", rows.length);
    console.log("📄 FIRST ROW RAW:", rows[0]);

    let inserted = [];
    let skipped = [];

    for (const row of rows) {
      // 🔄 normalize headers like product upload
      const normalized = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.replace(/[\s"\n\r]+/g, "").toLowerCase(),
          String(v || "").trim(),
        ])
      );

      const name = normalized.customername; 
      const whatsapp = String(normalized.whatsapp || "").trim(); 
      const email = normalized.email || "";
      const address = normalized.address || "";
      const district = normalized.district || "";
      const state = normalized.state || "";
      const pincode = normalized.pincode || "";
      const country = normalized.country || "India";
      const gstin = normalized.gstin || "";
      const salesOwner = normalized.salesowner || "";
      const margin = parseFloat(normalized.margin) || 0;
      const closingBalance = parseFloat(normalized.closingbalance) || 0;

      // Bank Details
      const accountHolder = normalized.accountholdername || "";
      const accountNumber = normalized.accountnumber || "";
      const ifsc = normalized.ifsc || "";
      const branch = normalized.branch || "";
      const upi = normalized.upi || "";

      // 💰 Parse "358062.12 Dr" if totalbalance exists
      let totalBalance = 0;
      let balanceType = "Dr";

      if (normalized.totalbalance) {
        const parts = normalized.totalbalance.split(" ");
        totalBalance = parseFloat(parts[0]) || 0;
        balanceType = parts[1] || "Dr";
      }

      if (!name) {
        skipped.push({ row, reason: "Missing customer name" });
        continue;
      }

      // 🔁 Duplicate check (WhatsApp OR Name)
      const exists = await Customer.findOne({
        name: new RegExp(`^${name}$`, "i"),
      });

      if (exists) {
        skipped.push({ row, reason: "Customer already exists" });
        continue;
      }

      const customer = await Customer.create({
        name,
        whatsapp,
        email,
        address,
        district,
        state,
        pincode,
        country,
        gstin,
        totalBalance,
        balanceType,
        closingBalance,
        margin,
        salesOwner,
        accountHolder,
        accountNumber,
        ifsc,
        branch,
        upi,
      });

      inserted.push(customer);
    }

    return res.json({
      message: "Bulk customer upload completed",
      insertedCount: inserted.length,
      skippedCount: skipped.length,
      skipped,
    });
  } catch (err) {
    console.error("Customer bulk upload error:", err);
    return res.status(500).json({
      message: "Bulk upload failed",
      error: err.message,
    });
  }
});


/**
 * POST: Add New Customer
 */
router.post("/", async (req, res) => {
  try {
    const {
      name,
      whatsapp,
      email,
      address,
      district,
      state,
      pincode,
      gstin,
      closingBalance,
      margin,
      salesOwner,
      accountHolder,
      accountNumber,
      ifsc,
      branch,
      upi,
    } = req.body;

    // Basic validation
    if (!name || !whatsapp || !accountHolder || !accountNumber || !ifsc || !branch) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    // Optional: prevent duplicate WhatsApp
    const existing = await Customer.findOne({ whatsapp });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Customer already exists with this WhatsApp number",
      });
    }

    const customer = new Customer({
      name,
      whatsapp,
      email,
      address,
      district,
      state,
      pincode,
      gstin,
      closingBalance: parseFloat(closingBalance) || 0,
      margin: parseFloat(margin) || 0,
      salesOwner,
      accountHolder,
      accountNumber,
      ifsc,
      branch,
      upi,
    });

    const savedCustomer = await customer.save();

    res.status(201).json({
      success: true,
      message: "Customer saved successfully",
      data: savedCustomer,
    });
  } catch (error) {
    console.error("Save Customer Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save customer",
      error: error.message,
    });
  }
});

/**
 * GET: Fetch All Customers
 */
router.get("/", async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error("Fetch Customer Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message,
    });
  }
});



export default router;
