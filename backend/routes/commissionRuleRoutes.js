import express from "express";
import CommissionRule from "../models/CommissionRule.js";
import DeliveryMan from "../models/DeliveryMan.js";
import SalesMan from "../models/SalesMan.js";
import SalesOwner from "../models/SalesOwner.js";

const router = express.Router();

// GET all commission rules
router.get("/", async (req, res) => {
  try {
    const rules = await CommissionRule.find()
      .sort({ effectiveFrom: -1 });

    res.json({ success: true, data: rules });
  } catch (error) {
    console.error("Fetch error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch commission rules" });
  }
});

// GET commission rules for specific person
router.get("/:roleType/:personId", async (req, res) => {
  try {
    const { roleType, personId } = req.params;
    const rules = await CommissionRule.find({
      roleType,
      personId,
      isActive: true,
    }).sort({ minimumOrderValue: 1 });

    res.json({ success: true, data: rules });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch rules" });
  }
});

// POST create new commission rule
router.post("/", async (req, res) => {
  try {
    const {
      roleType,
      personId,
      minimumOrderValue,
      commissionPercentage,
      effectiveFrom,
    } = req.body;

    if (!roleType || !personId || minimumOrderValue === undefined || !commissionPercentage) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Get person data based on role type
    let person;
    if (roleType === "SalesOwner") {
      person = await SalesOwner.findById(personId);
    } else if (roleType === "SalesMan") {
      person = await SalesMan.findById(personId);
    } else if (roleType === "DeliveryMan") {
      person = await DeliveryMan.findById(personId);
    }

    if (!person) {
      return res
        .status(404)
        .json({ success: false, message: `${roleType} not found` });
    }

    const rule = new CommissionRule({
      roleType,
      personId,
      personName: person.name,
      minimumOrderValue: Number(minimumOrderValue),
      commissionPercentage: Number(commissionPercentage),
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      isActive: true,
    });

    await rule.save();

    res.status(201).json({
      success: true,
      message: "Commission rule created",
      data: rule,
    });
  } catch (error) {
    console.error("Create error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to create rule" });
  }
});

// PUT update commission rule
router.put("/:id", async (req, res) => {
  try {
    const { minimumOrderValue, commissionPercentage, effectiveFrom, isActive } =
      req.body;

    const rule = await CommissionRule.findByIdAndUpdate(
      req.params.id,
      {
        minimumOrderValue: minimumOrderValue !== undefined ? Number(minimumOrderValue) : undefined,
        commissionPercentage: commissionPercentage !== undefined ? Number(commissionPercentage) : undefined,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
      { new: true }
    );

    if (!rule) {
      return res
        .status(404)
        .json({ success: false, message: "Rule not found" });
    }

    res.json({ success: true, message: "Rule updated", data: rule });
  } catch (error) {
    console.error("Update error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update rule" });
  }
});

// DELETE commission rule
router.delete("/:id", async (req, res) => {
  try {
    const rule = await CommissionRule.findByIdAndDelete(req.params.id);

    if (!rule) {
      return res
        .status(404)
        .json({ success: false, message: "Rule not found" });
    }

    res.json({ success: true, message: "Rule deleted" });
  } catch (error) {
    console.error("Delete error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete rule" });
  }
});

export default router;
