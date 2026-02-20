import "./config/env.js";

import cors from "cors";
import dns from "dns";
import express from "express";
import mongoose from "mongoose";


import commissionRuleRoutes from "./routes/commissionRuleRoutes.js";
import creditNoteRoutes from "./routes/creditNoteRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import debitNoteRoutes from "./routes/debitNoteRoutes.js";
import deliveryManRoutes from "./routes/deliveryManRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import pearlsBookRoutes from "./routes/pearlsBookRoutes.js";
import productGroupRoutes from "./routes/productGroupRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import purchaseOrderRoutes from "./routes/purchaseOrderRoutes.js";
import salesManRoutes from "./routes/salesManRoutes.js";
import salesOrderRoutes from "./routes/salesOrderRoutes.js";
import salesOwnerRoutes from "./routes/salesOwnerRoutes.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import voucherTypeRoutes from "./routes/voucherTypeRoutes.js";
import warehouseRoutes from "./routes/warehouseRoutes.js";


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

// Routes
app.use("/api/vendors", vendorRoutes);
app.use("/api/product-groups", productGroupRoutes);
app.use("/api/products", productRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/debit-notes", debitNoteRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/voucher-types", voucherTypeRoutes);
app.use("/api/sales-orders", salesOrderRoutes);
app.use("/api/credit-notes", creditNoteRoutes);
app.use("/api/pearls-book", pearlsBookRoutes);
app.use("/api/sales-owners", salesOwnerRoutes);
app.use("/api/sales-men", salesManRoutes);
app.use("/api/delivery-men", deliveryManRoutes);
app.use("/api/commission-rules", commissionRuleRoutes);



// MongoDB Connect
dns.setServers(["8.8.8.8", "1.1.1.1"]);
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("Mongo Error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
