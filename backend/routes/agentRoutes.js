import express from "express";
import Agent from "../models/Agent.js";

const router = express.Router();

// Create new agent
router.post("/", async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    if (!name || !phone) {
      return res
        .status(400)
        .json({ message: "Name and phone are required" });
    }

    const agent = new Agent({ name, phone, email });
    const savedAgent = await agent.save();

    res.status(201).json(savedAgent);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error saving agent", error: err.message });
  }
});

// Get all agents
router.get("/", async (req, res) => {
  try {
    const agents = await Agent.find().sort({ createdAt: -1 });
    res.json(agents);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching agents", error: err.message });
  }
});

export default router;
