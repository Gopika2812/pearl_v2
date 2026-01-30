import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

// POST: Add New Product (minimal)
router.post("/", async (req, res) => {
  try {
    const { name, groupId, unit, hsncode} = req.body;

    if (!name || !groupId || !unit) {
      return res.status(400).json({
        success: false,
        message: "Name, Group and Unit are required",
      });
    }

    const product = new Product({
      name,
      groupId,
      unit,
      hsncode
    });

    const savedProduct = await product.save();

    res.status(201).json({
      success: true,
      message: "Product saved successfully",
      data: savedProduct,
    });
  } catch (error) {
    console.error("Save Product Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save product",
      error: error.message,
    });
  }
});

// GET: Fetch All Products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Fetch Product Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
});

export default router;
