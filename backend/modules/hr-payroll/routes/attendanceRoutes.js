import express from "express";
import { markAttendance, getMonthlySummary, getDailyAttendance, approveAttendance, revertAttendance, getDetailedLogs } from "../controllers/attendanceController.js";
import auth from "../../../middleware/auth.js";

const router = express.Router();

console.log("🛣️ HR Attendance Routes registered");

// Apply auth middleware to all routes in this file
router.use(auth);

router.get("/logs", getDetailedLogs);
router.post("/revert", revertAttendance);
router.post("/mark", markAttendance);
router.post("/approve", approveAttendance);
router.get("/monthly-summary", getMonthlySummary);
router.get("/daily", getDailyAttendance);

export default router;
