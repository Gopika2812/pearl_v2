import express from "express";
import PurchaseOrder from "../models/PurchaseOrder.js";
import SalesOrder from "../models/SalesOrder.js";

const router = express.Router();

// Get Extra Expense Ledger data for a specific branch
router.get("/:branchId", async (req, res) => {
  const { branchId } = req.params;

  try {
    console.log(`📊 Fetching extra expense ledger for branch: ${branchId}`);

    // Fetch non-cancelled Purchase Orders with extra expenses
    const pos = await PurchaseOrder.find({
      branchId,
      status: { $ne: "CANCELLED" },
      "extraExpenses.0": { $exists: true },
    }).select("invoiceId date extraExpenses vendor grandTotal");

    // Fetch non-cancelled Sales Orders with extra expenses
    const sos = await SalesOrder.find({
      branchId,
      status: { $ne: "CANCELLED" },
      "extraExpenses.0": { $exists: true },
    }).select("invoiceId createdAt extraExpenses customer grandTotal");

    // Flatten results into a single list
    const purchaseData = pos.flatMap((po) =>
      (po.extraExpenses || []).map((exp) => ({
        _id: exp._id || Math.random().toString(36).substr(2, 9),
        type: "Purchase",
        invoiceId: po.invoiceId,
        partyName: po.vendor || "N/A",
        date: po.date,
        expenseName: exp.expenseName,
        basePrice: exp.basePrice || exp.amount || 0,
        gstPercent: exp.gstPercent || exp.gst || 0,
        gstAmount: exp.gstAmount || 0,
        totalPrice: exp.totalPrice || exp.amount || 0,
      }))
    );

    const salesData = sos.flatMap((so) =>
      (so.extraExpenses || []).map((exp) => ({
        _id: exp._id || Math.random().toString(36).substr(2, 9),
        type: "Sales",
        invoiceId: so.invoiceId,
        partyName: so.customer?.name || "N/A",
        date: so.createdAt,
        expenseName: exp.expenseName,
        basePrice: exp.basePrice || 0,
        gstPercent: exp.gstPercent || 0,
        gstAmount: exp.gstAmount || 0,
        totalPrice: exp.totalPrice || 0,
      }))
    );

    const combinedData = [...purchaseData, ...salesData].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    console.log(`✅ Found ${combinedData.length} extra expense entries`);

    res.status(200).json({
      success: true,
      data: combinedData,
    });
  } catch (error) {
    console.error("❌ Error fetching extra expense ledger:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching extra expense ledger",
      error: error.message,
    });
  }
});

export default router;
