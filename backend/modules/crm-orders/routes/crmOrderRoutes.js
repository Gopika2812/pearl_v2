import express from "express";
import auth from "../../../middleware/auth.js";
import {
    getFrequentCustomers,
    getRecommendedProducts,
    createSession,
    generateLink,
    getPublicOrder,
    getBranchProducts,
    confirmPublicOrder,
    getTasks,
    createTask,
    updateTask,
    deleteTask
} from "../controllers/crmOrderController.js";

const router = express.Router();

// Admin Routes (Protected)
router.get("/customers/suggest", auth, getFrequentCustomers);
router.get("/products/recommend/:customerId", auth, getRecommendedProducts);
router.post("/sessions", auth, createSession);
router.post("/links", auth, generateLink);

// Task Board Routes
router.get("/tasks", auth, getTasks);
router.post("/tasks", auth, createTask);
router.patch("/tasks/:taskId", auth, updateTask);
router.delete("/tasks/:taskId", auth, deleteTask);

// Public Routes (For Customers)
router.get("/public/order/:token", getPublicOrder);
router.get("/public/products", getBranchProducts);
router.post("/public/order/:token/confirm", confirmPublicOrder);

export default router;
