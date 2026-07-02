import express from "express";
import { getIncentiveReport } from "../controllers/incentiveController.js";

const router = express.Router();

router.get("/report/:branchId", getIncentiveReport);

export default router;
