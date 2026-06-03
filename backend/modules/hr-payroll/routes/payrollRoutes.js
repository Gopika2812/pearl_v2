import express from "express";
import { 
  generatePayroll, 
  updatePayrollStatus, 
  getSalaryStructure, 
  updateSalaryStructure,
  getPayrollHistory,
  updatePayrollAdjustments,
  getAllSalaryStructures,
  revertPayrollStatus,
  exportSalaryStructures,
  bulkImportSalaryStructures
} from "../controllers/payrollController.js";
import auth from "../../../middleware/auth.js";

const router = express.Router();

router.use(auth);

router.post("/generate", generatePayroll);
router.patch("/status/:payrollId", updatePayrollStatus);
router.post("/revert/:payrollId", revertPayrollStatus);
router.patch("/adjustments/:payrollId", updatePayrollAdjustments);
router.get("/structures", getAllSalaryStructures);
router.get("/export-structures", exportSalaryStructures);
router.post("/bulk-import", bulkImportSalaryStructures);
router.get("/structure/:employeeId", getSalaryStructure);
router.post("/structure", updateSalaryStructure);
router.get("/history", getPayrollHistory);

export default router;
