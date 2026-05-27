import "./config/env.js";

import cors from "cors";
import compression from "compression";
import dns from "dns";
import express from "express";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { fixInvoiceIndex } from "./utils/fixInvoiceIndex.js";
import { fixPurchaseInvoiceIndex } from "./utils/fixPurchaseInvoiceIndex.js";
import { fixPurchaseOrderIndex } from "./utils/fixPurchaseOrderIndex.js";
import { fixSalesOrderIndex } from "./utils/fixSalesOrderIndex.js";
import fixVendorIndex from "./utils/fixVendorIndex.js";
import fixVoucherTypeIndex from "./utils/fixVoucherTypeIndex.js";
import fixTokenIndex from "./utils/fixTokenIndex.js";

import auditLogRoutes from "./routes/auditLogRoutes.js";
import branchRoutes from "./routes/branchRoutes.js";
import branchUserRoutes from "./routes/branchUserRoutes.js";
import chartOfAccountsRoutes from "./routes/chartOfAccountsRoutes.js";
import commissionRuleRoutes from "./routes/commissionRuleRoutes.js";
import creditNoteRoutes from "./routes/creditNoteRoutes.js";
import customerCategoryRoutes from "./routes/customerCategoryRoutes.js";
import customerGroupRoutes from "./routes/customerGroupRoutes.js";
import customerLockedPriceRoutes from "./routes/customerLockedPriceRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import debitNoteRoutes from "./routes/debitNoteRoutes.js";
import deliveryManRoutes from "./routes/deliveryManRoutes.js";
import eInvoiceRoutes from "./routes/eInvoiceRoutes.js";
import extraExpenseLedgerRoutes from "./routes/extraExpenseLedgerRoutes.js";
import extraExpenseMasterRoutes from "./routes/extraExpenseMasterRoutes.js";
import extraExpenseRoutes from "./routes/extraExpenseRoutes.js";
import financialReportRoutes from "./routes/financialReportRoutes.js";
import gstRoutes from "./routes/gstRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import otherTransactionRoutes from "./routes/otherTransactionRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import pearlsBookRoutes from "./routes/pearlsBookRoutes.js";
import priceRequestRoutes from "./routes/priceRequestRoutes.js";
import productCategoryRoutes from "./routes/productCategoryRoutes.js";
import productGroupRoutes from "./routes/productGroupRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import purchaseInvoiceRoutes from "./routes/purchaseInvoiceRoutes.js";
import purchaseOrderRoutes from "./routes/purchaseOrderRoutes.js";
import receiptRoutes from "./routes/receiptRoutes.js";
import reorderingRoutes from "./routes/reorderingRoutes.js";
import salesManRoutes from "./routes/salesManRoutes.js";
import salesOrderRoutes from "./routes/salesOrderRoutes.js";
import salesOwnerRoutes from "./routes/salesOwnerRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import tallyJournalRoutes from "./routes/tallyJournalRoutes.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import voucherTypeRoutes from "./routes/voucherTypeRoutes.js";
import warehouseRoutes from "./routes/warehouseRoutes.js";
import ledgerRoutes from "./routes/ledgerRoutes.js";
import tokenRoutes from "./routes/tokenRoutes.js";
import followUpRoutes from "./routes/followUpRoutes.js";
import deliveryReceiptRoutes from "./routes/deliveryReceiptRoutes.js";
import hrPayrollRoutes from "./modules/hr-payroll/index.js";
import crmOrderRoutes from "./modules/crm-orders/index.js";
import physicalStockRoutes from "./routes/physicalStockRoutes.js";
import manualJournalRoutes from "./routes/manualJournalRoutes.js";
import aiBotRoutes from "./modules/ai-bot/index.js";
import gstReportRoutes from "./routes/gstReportRoutes.js";
import spottedCustomerLedgerRoutes from "./routes/spottedCustomerLedgerRoutes.js";
import aiProcurementRoutes from "./modules/ai-procurement/index.js";



const app = express();
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "https://pearlsfrontend.web.app",
        "https://pearlsfrontend.firebaseapp.com"
      ];
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(compression());

// Increase payload size limit for bulk uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve static files from public folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, "../public");
app.use(express.static(publicPath));

// Global Logger - See every request hitting the server
app.use((req, res, next) => {
  console.log(`🌍 [GLOBAL] ${req.method} ${req.url}`);
  next();
});

// Routes - CRM and HR Modules prioritized
app.use("/api/ai-bot", aiBotRoutes);
app.use("/api/crm-orders", crmOrderRoutes);
app.use("/api/hr", hrPayrollRoutes);
app.use("/api/super-admin/ai-procurement", aiProcurementRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/branch-users", branchUserRoutes);
app.use("/api/chart-of-accounts", chartOfAccountsRoutes);
app.use("/api/financial-reports", financialReportRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/product-groups", productGroupRoutes);
app.use("/api/product-categories", productCategoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/customer-categories", customerCategoryRoutes);
app.use("/api/customer-groups", customerGroupRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/purchase-invoices", purchaseInvoiceRoutes);
app.use("/api/debit-notes", debitNoteRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/expenses", extraExpenseRoutes);
app.use("/api/voucher-types", voucherTypeRoutes);
app.use("/api/sales-orders", salesOrderRoutes);
app.use("/api/sales-invoices", invoiceRoutes); // Frontend calls this
app.use("/api/invoices", invoiceRoutes); // Legacy support
app.use("/api/credit-notes", creditNoteRoutes);
app.use("/api/receipts", receiptRoutes);
app.use("/api/pearls-book", pearlsBookRoutes);
app.use("/api/sales-owners", salesOwnerRoutes);
app.use("/api/sales-men", salesManRoutes);
app.use("/api/delivery-men", deliveryManRoutes);
app.use("/api/commission-rules", commissionRuleRoutes);
app.use("/api/reordering", reorderingRoutes);
app.use("/api/tally-journals", tallyJournalRoutes);
app.use("/api/manual-journals", manualJournalRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/gst", gstRoutes);
app.use("/api/gst-reports", gstReportRoutes);
app.use("/api/customer-locked-prices", customerLockedPriceRoutes);
app.use("/api/einvoice", eInvoiceRoutes);
app.use("/api/other-transactions", otherTransactionRoutes);
app.use("/api/extra-expense-ledger", extraExpenseLedgerRoutes);
app.use("/api/extra-expense-master", extraExpenseMasterRoutes);
app.use("/api/price-requests", priceRequestRoutes);
app.use("/api/ledgers", ledgerRoutes);
app.use("/api/tokens", tokenRoutes);
app.use("/api/follow-ups", followUpRoutes);
app.use("/api/delivery-receipts", deliveryReceiptRoutes);
// HR module moved to top
app.get("/api/hr-ping", (req, res) => res.json({ msg: "HR module reachable" }));
app.use("/api/physical-stock", physicalStockRoutes);
app.use("/api/spotted-customer-ledger", spottedCustomerLedgerRoutes);



// MongoDB Connect
dns.setServers(["8.8.8.8", "1.1.1.1"]);
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB Connected");
    // Fix VoucherType and Vendor indexes to allow same name in different branches
    await fixVoucherTypeIndex();
    await fixVendorIndex();
    await fixPurchaseOrderIndex();
    await fixPurchaseInvoiceIndex();
    await fixSalesOrderIndex();
    await fixInvoiceIndex();
    await fixTokenIndex();
    // await fixVoucherTypes(); // Commented out to prevent auto-recreation
  })
  .catch((err) => console.error("Mongo Error:", err));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date(), uptime: process.uptime() });
});

// 404 Handler for /api routes
app.use(/^\/api\/.*/, (req, res) => {
  res.status(404).json({ success: false, message: `Endpoint not found: ${req.originalUrl}` });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 [ANTIGRAVITY-v4.1] Server running on ${PORT}`));
