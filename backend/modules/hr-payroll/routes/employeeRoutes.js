import express from "express";
import { getHREmployees } from "../controllers/employeeController.js";

const router = express.Router();

router.get("/list", getHREmployees);

export default router;
