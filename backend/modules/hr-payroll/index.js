import express from "express";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";

const router = express.Router();

router.use("/attendance", attendanceRoutes);
router.use("/payroll", payrollRoutes);

export default router;
