import express from "express";
import mongoose from "mongoose";
import auth from "../middleware/auth.js";
import rbac from "../middleware/rbac.js";
import Branch from "../models/Branch.js";

const router = express.Router();

// GET: Fetch all active branches
router.get("/", async (req, res) => {
  try {
    const branches = await Branch.find({ status: "ACTIVE" }).sort({ isMainBranch: -1, createdAt: 1 });
    res.json({
      success: true,
      data: branches,
    });
  } catch (error) {
    console.error("Fetch Branches Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch branches",
      error: error.message,
    });
  }
});

// GET: Fetch single branch by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    const branch = await Branch.findById(id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    res.json({
      success: true,
      data: branch,
    });
  } catch (error) {
    console.error("Fetch Branch Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch branch",
      error: error.message,
    });
  }
});

// POST: Create new branch (SUPER_ADMIN only)
router.post("/", auth, rbac(["SUPER_ADMIN"]), async (req, res) => {
  try {
    const { name, code, location, address, phone, email, manager, logo, color, isMainBranch } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Branch name and code are required",
      });
    }

    // Check if code already exists
    const existingBranch = await Branch.findOne({ code: code.toUpperCase() });
    if (existingBranch) {
      return res.status(400).json({
        success: false,
        message: "Branch code already exists",
      });
    }

    const branch = new Branch({
      name,
      code: code.toUpperCase(),
      location,
      address,
      phone,
      email,
      manager,
      logo,
      color,
      isMainBranch: isMainBranch || false,
    });

    const savedBranch = await branch.save();

    res.status(201).json({
      success: true,
      message: "Branch created successfully",
      data: savedBranch,
    });
  } catch (error) {
    console.error("Create Branch Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create branch",
      error: error.message,
    });
  }
});

// PUT: Update branch (SUPER_ADMIN only)
router.put("/:id", auth, rbac(["SUPER_ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    // Check if code is being changed and if it already exists
    if (updates.code) {
      const existingBranch = await Branch.findOne({
        code: updates.code.toUpperCase(),
        _id: { $ne: id },
      });
      if (existingBranch) {
        return res.status(400).json({
          success: false,
          message: "Branch code already exists",
        });
      }
      updates.code = updates.code.toUpperCase();
    }

    const branch = await Branch.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    res.json({
      success: true,
      message: "Branch updated successfully",
      data: branch,
    });
  } catch (error) {
    console.error("Update Branch Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update branch",
      error: error.message,
    });
  }
});

// DELETE: Delete branch (SUPER_ADMIN only)
router.delete("/:id", auth, rbac(["SUPER_ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    const branch = await Branch.findByIdAndDelete(id);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    res.json({
      success: true,
      message: "Branch deleted successfully",
      data: branch,
    });
  } catch (error) {
    console.error("Delete Branch Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete branch",
      error: error.message,
    });
  }
});

export default router;
