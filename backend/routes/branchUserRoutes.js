import express from "express";
import mongoose from "mongoose";
import Branch from "../models/Branch.js";
import BranchUser from "../models/BranchUser.js";

const router = express.Router();

// POST: Register new user for a branch
router.post("/register", async (req, res) => {
  try {
    const { username, password, email, branchId, role } = req.body;

    if (!username || !password || !branchId) {
      return res.status(400).json({
        success: false,
        message: "Username, password, and branch are required",
      });
    }

    // Check if user already exists
    const existingUser = await BranchUser.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
      });
    }

    // Verify branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    // Create new user
    const user = new BranchUser({
      username,
      password,
      email: email || "",
      branch: branchId,
      branchName: branch.name,
      role: role || "STAFF",
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        branch: user.branchName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Register User Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to register user",
      error: error.message,
    });
  }
});

// POST: Login user
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Find user
    const user = await BranchUser.findOne({ username }).populate("branch");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Check if user is active
    if (user.status !== "ACTIVE") {
      return res.status(401).json({
        success: false,
        message: "User account is inactive",
      });
    }

    // Check if branch is active
    if (user.branch.status !== "ACTIVE") {
      return res.status(401).json({
        success: false,
        message: "Branch is inactive",
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      message: "Login successful",
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        branch: {
          id: user.branch._id,
          name: user.branch.name,
          code: user.branch.code,
          location: user.branch.location,
        },
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
});

// GET: Fetch all users for a branch
router.get("/branch/:branchId", async (req, res) => {
  try {
    const { branchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }

    const users = await BranchUser.find({ branch: branchId })
      .select("-password")
      .populate("branch", "name code location");

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Fetch Users Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
});

// GET: Fetch single user
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await BranchUser.findById(id)
      .select("-password")
      .populate("branch");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Fetch User Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: error.message,
    });
  }
});

// PUT: Update user
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const updateData = {};
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;

    const user = await BranchUser.findByIdAndUpdate(id, updateData, {
      new: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Update User Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
});

// DELETE: Delete user
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await BranchUser.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete User Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
});

export default router;
