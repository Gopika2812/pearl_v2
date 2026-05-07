import express from "express";
import mongoose from "mongoose";
import TallyJournalGroup from "../models/TallyJournalGroup.js";
import TallyJournal from "../models/TallyJournal.js";
import Ledger from "../models/Ledger.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// --- GROUPS ---

// @desc    Get all journal groups for a branch
// @route   GET /api/tally-journals/groups
// @access  Private/Branch Area
router.get("/groups", auth, async (req, res) => {
  try {
    const branchId = req.user.branch || req.user._id;

    const groups = await TallyJournalGroup.find({ branch: branchId }).sort({ name: 1 });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Upload bulk journal groups
// @route   POST /api/tally-journals/groups/bulk
// @access  Private/Branch Area
router.post("/groups/bulk", auth, async (req, res) => {
  try {
    const { groups } = req.body; // Array of objects mapping CSV fields
    const branchId = req.user.branch || req.user._id;

    if (!groups || !Array.isArray(groups)) {
      return res.status(400).json({ message: "Please provide an array of groups" });
    }

    let successCount = 0;
    let errors = [];

    for (const group of groups) {
      if (!group.name) {
        errors.push({ group, error: "Name is required" });
        continue;
      }

      try {
        await TallyJournalGroup.findOneAndUpdate(
          { name: group.name, branch: branchId },
          { name: group.name, branch: branchId, createdBy: req.user._id },
          { upsert: true, new: true, runValidators: true }
        );
        successCount++;
      } catch (err) {
        errors.push({ group, error: err.message });
      }
    }

    res.status(201).json({
      message: `Successfully uploaded ${successCount} groups`,
      successCount,
      errorCount: errors.length,
      errors: errors.slice(0, 10), // Return sample of errors
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- JOURNALS ---

// @desc    Get all journals/ledgers
// @route   GET /api/tally-journals
// @access  Private/Branch Area
router.get("/", auth, async (req, res) => {
  try {
    const { fromDate, toDate, branchId } = req.query;
    const effectiveBranchId = (branchId || req.user.branch || req.user._id)?.toString();

    if (!effectiveBranchId) {
      return res.status(400).json({ message: "Branch ID is required" });
    }

    const branchObjectId = mongoose.Types.ObjectId.isValid(effectiveBranchId)
      ? new mongoose.Types.ObjectId(effectiveBranchId)
      : null;

    // 1. Fetch from TallyJournal (Manual Masters) with branch filter
    let tallyQuery = {
      $or: [
        { branch: effectiveBranchId },
        { branchId: effectiveBranchId }
      ]
    };
    if (branchObjectId) {
      tallyQuery.$or.push({ branch: branchObjectId });
      tallyQuery.$or.push({ branchId: branchObjectId });
    }

    if (fromDate || toDate) {
      tallyQuery.createdAt = {};
      if (fromDate && fromDate !== "undefined") tallyQuery.createdAt.$gte = new Date(fromDate);
      if (toDate && toDate !== "undefined") tallyQuery.createdAt.$lte = new Date(toDate);
      if (Object.keys(tallyQuery.createdAt).length === 0) delete tallyQuery.createdAt;
    }

    const journals = await TallyJournal.find(tallyQuery).sort({ journalName: 1 }).lean();
    
    // 2. Fetch from Ledger (Standard Masters) with branch filter
    const ledgerQuery = {
      $or: [
        { branchId: effectiveBranchId },
        { branchId: branchObjectId }
      ]
    };
    const standardLedgers = await Ledger.find(ledgerQuery).sort({ name: 1 }).lean();

    // 3. Merge them together
    const merged = [
      ...journals.map(j => ({ ...j, isTally: true })),
      ...standardLedgers.map(l => ({ ...l, journalName: l.name, isStandard: true }))
    ];

    res.json({
      success: true,
      data: merged,
      count: merged.length
    });
  } catch (error) {
    console.error("GET /tally-journals error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Create a single journal
// @route   POST /api/tally-journals
// @access  Private/Branch Area
router.post("/", auth, async (req, res) => {
  try {
    const { group, journalName, address, state, registrationType, gstin, credit, debit } = req.body;
    const branchId = req.user.branch || req.user._id;

    const existing = await TallyJournal.findOne({ journalName, branch: branchId });
    if (existing) {
      return res.status(400).json({ message: `Journal with name ${journalName} already exists` });
    }

    const journal = await TallyJournal.create({
      group,
      journalName,
      address,
      state,
      registrationType,
      gstin,
      credit: credit || 0,
      debit: debit || 0,
      branch: branchId,
      createdBy: req.user._id,
    });

    res.status(201).json(journal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Upload bulk journals
// @route   POST /api/tally-journals/bulk
// @access  Private/Branch Area
router.post("/bulk", auth, async (req, res) => {
  try {
    const { journals } = req.body;
    const branchId = req.user.branch || req.user._id;

    if (!journals || !Array.isArray(journals)) {
      return res.status(400).json({ message: "Please provide an array of journals" });
    }

    let successCount = 0;
    let errors = [];

    for (const journal of journals) {
      if (!journal.journalName || !journal.group) {
        errors.push({ journal, error: "Journal Name and Group are required" });
        continue;
      }

      try {
        await TallyJournal.findOneAndUpdate(
          { journalName: journal.journalName, branch: branchId },
          {
            group: journal.group,
            journalName: journal.journalName,
            address: journal.address || "",
            state: journal.state || "",
            registrationType: journal.registrationType || "",
            gstin: journal.gstin || "",
            credit: parseFloat(journal.credit) || 0,
            debit: parseFloat(journal.debit) || 0,
            branch: branchId,
            createdBy: req.user._id,
          },
          { upsert: true, new: true, runValidators: true }
        );
        successCount++;
      } catch (err) {
        errors.push({ journal, error: err.message });
      }
    }

    res.status(201).json({
      message: `Successfully uploaded ${successCount} journals`,
      successCount,
      errorCount: errors.length,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a journal
// @route   DELETE /api/tally-journals/:id
// @access  Private/Branch Area
router.delete("/:id", auth, async (req, res) => {
  try {
    const journal = await TallyJournal.findById(req.params.id);
    
    if (!journal) {
      return res.status(404).json({ message: "Journal not found" });
    }

    await journal.deleteOne();
    res.json({ message: "Journal removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
