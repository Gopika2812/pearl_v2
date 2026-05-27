import express from "express";
import {
  getDashboardData,
  getSuggestions,
  handleChatQuery,
  getChatHistory,
  confirmAndCreatePO
} from "../controllers/aiProcurementController.js";
import auth from "../../../middleware/auth.js";
import rbac from "../../../middleware/rbac.js";

const router = express.Router();

// All routes are guarded by auth and rbac SUPER_ADMIN checks
router.get("/dashboard", auth, rbac(["SUPER_ADMIN"]), getDashboardData);
router.get("/suggestions", auth, rbac(["SUPER_ADMIN"]), getSuggestions);
router.post("/chat", auth, rbac(["SUPER_ADMIN"]), handleChatQuery);
router.get("/chat-history", auth, rbac(["SUPER_ADMIN"]), getChatHistory);
router.post("/create-po", auth, rbac(["SUPER_ADMIN"]), confirmAndCreatePO);

export default router;
