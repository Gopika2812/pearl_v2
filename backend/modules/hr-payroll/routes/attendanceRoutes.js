import express from "express";
import { markAttendance, getMonthlySummary, getDailyAttendance, approveAttendance, revertAttendance, getDetailedLogs } from "../controllers/attendanceController.js";

const router = express.Router();

console.log("🛣️ HR Attendance Routes registered");

router.get("/logs", getDetailedLogs);
router.post("/revert", revertAttendance);
router.post("/mark", markAttendance);
router.post("/approve", approveAttendance);
router.get("/monthly-summary", getMonthlySummary);
router.get("/daily", getDailyAttendance);

export default router;
