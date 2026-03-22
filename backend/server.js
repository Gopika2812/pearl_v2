import "./config/env.js";

import cors from "cors";
import dns from "dns";
import express from "express";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import auth from "./middleware/auth.js";
import rbac from "./middleware/rbac.js";
import fixVoucherTypeIndex from "./utils/fixVoucherTypeIndex.js";

import branchRoutes from "./routes/branchRoutes.js";
import branchUserRoutes from "./routes/branchUserRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import chartOfAccountsRoutes from "./routes/chartOfAccountsRoutes.js";
import commissionRuleRoutes from "./routes/commissionRuleRoutes.js";
import creditNoteRoutes from "./routes/creditNoteRoutes.js";
import customerCategoryRoutes from "./routes/customerCategoryRoutes.js";
import customerGroupRoutes from "./routes/customerGroupRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import debitNoteRoutes from "./routes/debitNoteRoutes.js";
import deliveryManRoutes from "./routes/deliveryManRoutes.js";
import extraExpenseRoutes from "./routes/extraExpenseRoutes.js";
import financialReportRoutes from "./routes/financialReportRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import pearlsBookRoutes from "./routes/pearlsBookRoutes.js";
import productCategoryRoutes from "./routes/productCategoryRoutes.js";
import productGroupRoutes from "./routes/productGroupRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import purchaseOrderRoutes from "./routes/purchaseOrderRoutes.js";
import receiptRoutes from "./routes/receiptRoutes.js";
import reorderingRoutes from "./routes/reorderingRoutes.js";
import salesManRoutes from "./routes/salesManRoutes.js";
import salesOrderRoutes from "./routes/salesOrderRoutes.js";
import salesOwnerRoutes from "./routes/salesOwnerRoutes.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import voucherTypeRoutes from "./routes/voucherTypeRoutes.js";
import warehouseRoutes from "./routes/warehouseRoutes.js";
import tallyJournalRoutes from "./routes/tallyJournalRoutes.js";
import auditLogRoutes from "./routes/auditLogRoutes.js";


const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://pearlsfrontend.web.app",
    ],
    credentials: true,
  })
);

// Increase payload size limit for bulk uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve static files from public folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, "../public");
app.use(express.static(publicPath));

// Routes
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
app.use("/api/audit-logs", auditLogRoutes);

// MongoDB Connect
dns.setServers(["8.8.8.8", "1.1.1.1"]);
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB Connected");
    // Fix VoucherType indexes to allow same name in different branches
    await fixVoucherTypeIndex();
  })
  .catch((err) => console.error("Mongo Error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
