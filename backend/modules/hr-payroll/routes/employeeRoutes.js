import express from "express";
import { getHREmployees } from "../controllers/employeeController.js";
import auth from "../../../middleware/auth.js";

const router = express.Router();

router.get("/list", auth, getHREmployees);

export default router;
