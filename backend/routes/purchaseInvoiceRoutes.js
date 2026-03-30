import express from "express";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import { getFinancialYear } from "../utils/financialYear.js";

const router = express.Router();

// GET ALL PURCHASE INVOICES (Finalized Bills)
router.get("/", async (req, res) => {
  try {
    const { branchId, search } = req.query;
    const query = {};
    if (branchId) query.branchId = branchId;
    if (search) {
      query.$or = [
        { purchaseInvoiceId: { $regex: search, $options: "i" } },
        { vendor: { $regex: search, $options: "i" } },
        { "items.name": { $regex: search, $options: "i" } },
      ];
    }
    const invoices = await PurchaseInvoice.find(query).sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET SINGLE PURCHASE INVOICE
router.get("/:id", async (req, res) => {
  try {
    const invoice = await PurchaseInvoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
