import express from "express";
import { markAttendance, getMonthlySummary, getDailyAttendance, approveAttendance, revertAttendance, getDetailedLogs } from "../controllers/attendanceController.js";
import auth from "../../../middleware/auth.js";

const router = express.Router();

console.log("🛣️ HR Attendance Routes registered");

// Apply auth middleware to all routes in this file
router.use(auth);

// FINGERPRINT LOG: See every request hitting this module
router.use((req, res, next) => {
  console.log(`📡 [Attendance Route] ${req.method} ${req.originalUrl}`);
  next();
});

router.get("/logs", getDetailedLogs);
router.post("/revert", revertAttendance);
router.post("/mark", markAttendance);
router.post("/approve", approveAttendance);
router.get("/monthly-summary", getMonthlySummary);
router.get("/daily", getDailyAttendance);

export default router;
