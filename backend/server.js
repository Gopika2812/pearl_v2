import "./config/env.js";

import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import dns from "dns";

import agentRoutes from "./routes/agentRoutes.js";
import billingPersonRoutes from "./routes/billingPersonRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import pearlsBookRoutes from "./routes/pearlsBookRoutes.js";
import productGroupRoutes from "./routes/productGroupRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import purchaseOrderRoutes from "./routes/purchaseOrderRoutes.js";
import salesOrderRoutes from "./routes/salesOrderRoutes.js";
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

app.use(express.json());

// Routes
app.use("/api/vendors", vendorRoutes);
app.use("/api/product-groups", productGroupRoutes);
app.use("/api/products", productRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/billing-persons", billingPersonRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/voucher-types", voucherTypeRoutes);
app.use("/api/sales-orders", salesOrderRoutes);
app.use("/api/pearls-book", pearlsBookRoutes);



// MongoDB Connect
dns.setServers(["8.8.8.8", "1.1.1.1"]);
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("Mongo Error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
