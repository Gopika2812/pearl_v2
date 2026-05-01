import express from "express";
import { 
  generatePayroll, 
  updatePayrollStatus, 
  getSalaryStructure, 
  updateSalaryStructure,
  getPayrollHistory
} from "../controllers/payrollController.js";

const router = express.Router();

router.post("/generate", generatePayroll);
router.patch("/status/:payrollId", updatePayrollStatus);
router.get("/structure/:employeeId", getSalaryStructure);
router.post("/structure", updateSalaryStructure);
router.get("/history", getPayrollHistory);

export default router;
