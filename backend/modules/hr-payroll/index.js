import express from "express";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";

const router = express.Router();

router.use("/attendance", attendanceRoutes);
router.use("/payroll", payrollRoutes);
router.use("/employees", employeeRoutes);

export default router;
