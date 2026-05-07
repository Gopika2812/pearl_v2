import express from "express";
import { queryBot } from "../controllers/aiBotController.js";
import protect from "../../../middleware/auth.js";

const router = express.Router();

// All AI queries are protected and require a branch context
router.post("/query", protect, queryBot);

router.get("/ping", (req, res) => res.json({ success: true, message: "AI Bot module is online" }));

export default router;
