import express from "express";
import { markAttendance, getMonthlySummary, getDailyAttendance } from "../controllers/attendanceController.js";

const router = express.Router();

router.post("/mark", markAttendance);
router.get("/monthly-summary", getMonthlySummary);
router.get("/daily", getDailyAttendance);

export default router;
