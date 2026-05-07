import express from "express";
import ManualJournal from "../models/ManualJournal.js";
import Customer from "../models/Customer.js";
import Vendor from "../models/Vendor.js";
import TallyJournal from "../models/TallyJournal.js";
import auth from "../middleware/auth.js";
import mongoose from "mongoose";

const router = express.Router();

// Helper to get current financial year (e.g., 26-27)
const getFinancialYear = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    if (month < 4) return `${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
    return `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
};

// @desc    Get manual journals for a branch
// @route   GET /api/manual-journals
router.get("/", auth, async (req, res) => {
    try {
        const { fromDate, toDate, branchId, page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const effectiveBranchId = branchId || req.user.branch || req.user._id;

        if (!effectiveBranchId) {
            return res.status(400).json({ message: "Branch ID is required" });
        }

        const branchObjectId = mongoose.Types.ObjectId.isValid(effectiveBranchId)
            ? new mongoose.Types.ObjectId(effectiveBranchId)
            : effectiveBranchId;

        // Allow matching either ObjectId or string for legacy/flexibility
        let query = { 
            $or: [
                { branchId: branchObjectId },
                { branchId: effectiveBranchId }
            ]
        };

        if (fromDate || toDate) {
            query.journalDate = {};
            if (fromDate && fromDate !== "undefined") {
                const start = new Date(fromDate);
                start.setHours(0, 0, 0, 0);
                query.journalDate.$gte = start;
            }
            if (toDate && toDate !== "undefined") {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                query.journalDate.$lte = end;
            }
            if (Object.keys(query.journalDate).length === 0) delete query.journalDate;
        }

        const [journals, totalCount] = await Promise.all([
            ManualJournal.find(query)
                .sort({ journalDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            ManualJournal.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: journals,
            totalCount,
            page: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit))
        });
    } catch (error) {
        console.error("GET /manual-journals error:", error);
        res.status(500).json({ message: error.message });
    }
});

// @desc    Create manual journal and update balances
// @route   POST /api/manual-journals
router.post("/", auth, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { by, to, amount, paymentMode, narration, entryType, branchId } = req.body;
        const effectiveBranchId = branchId || req.user.branch || req.user._id;
        const finYear = getFinancialYear();

        if (!effectiveBranchId) throw new Error("Branch ID is required");

        // 1. Get Next Sequence Number for this branch
        const lastEntry = await ManualJournal.findOne({ branchId: effectiveBranchId }).sort({ sequenceNumber: -1 });
        const nextSeq = lastEntry ? lastEntry.sequenceNumber + 1 : 1;
        const journalId = `JE/${nextSeq.toString().padStart(3, '0')}/${finYear}`;

        // 2. Create the Journal Record
        const newJournal = new ManualJournal({
            journalId,
            sequenceNumber: nextSeq,
            branchId: effectiveBranchId,
            by,
            to,
            amount,
            entryType: entryType || "DEBIT",
            paymentMode,
            narration,
            userName: req.user.name || req.user.role || "Admin",
            createdBy: req.user.id || req.user._id,
            financialYear: finYear
        });

        await newJournal.save({ session });

        // 3. Update "BY" Balance (Debit side)
        if (by.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(by.partyId, { $inc: { debit: amount } }, { session });
        } else if (by.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(by.partyId, { $inc: { debit: amount } }, { session });
        } else if (by.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(by.partyId, { $inc: { debit: amount } }, { session });
        }

        // 4. Update "TO" Balance (Credit side)
        if (to.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(to.partyId, { $inc: { credit: amount } }, { session });
        } else if (to.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(to.partyId, { $inc: { credit: amount } }, { session });
        } else if (to.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(to.partyId, { $inc: { credit: amount } }, { session });
        }

        await session.commitTransaction();
        res.status(201).json(newJournal);
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: error.message });
    } finally {
        session.endSession();
    }
});

// @desc    Update manual journal and adjust balances
// @route   PUT /api/manual-journals/:id
router.put("/:id", auth, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { by, to, amount, paymentMode, narration, primaryCategory } = req.body;
        const oldJournal = await ManualJournal.findById(req.params.id);
        
        if (!oldJournal) throw new Error("Journal entry not found");

        // 1. REVERSE OLD IMPACT
        const oldAmt = oldJournal.amount;
        
        // Reverse Old BY (Debit)
        if (oldJournal.by.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(oldJournal.by.partyId, { $inc: { debit: -oldAmt } }, { session });
        } else if (oldJournal.by.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(oldJournal.by.partyId, { $inc: { debit: -oldAmt } }, { session });
        } else if (oldJournal.by.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(oldJournal.by.partyId, { $inc: { debit: -oldAmt } }, { session });
        }

        // Reverse Old TO (Credit)
        if (oldJournal.to.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(oldJournal.to.partyId, { $inc: { credit: -oldAmt } }, { session });
        } else if (oldJournal.to.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(oldJournal.to.partyId, { $inc: { credit: -oldAmt } }, { session });
        } else if (oldJournal.to.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(oldJournal.to.partyId, { $inc: { credit: -oldAmt } }, { session });
        }

        // 2. APPLY NEW IMPACT
        const newAmt = parseFloat(amount);

        // Apply New BY (Debit)
        if (by.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(by.partyId, { $inc: { debit: newAmt } }, { session });
        } else if (by.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(by.partyId, { $inc: { debit: newAmt } }, { session });
        } else if (by.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(by.partyId, { $inc: { debit: newAmt } }, { session });
        }

        // Apply New TO (Credit)
        if (to.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(to.partyId, { $inc: { credit: newAmt } }, { session });
        } else if (to.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(to.partyId, { $inc: { credit: newAmt } }, { session });
        } else if (to.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(to.partyId, { $inc: { credit: newAmt } }, { session });
        }

        // 3. Update the Journal Record
        oldJournal.by = by;
        oldJournal.to = to;
        oldJournal.amount = newAmt;
        oldJournal.paymentMode = paymentMode;
        oldJournal.narration = narration;
        oldJournal.primaryCategory = primaryCategory || oldJournal.primaryCategory;
        oldJournal.updatedBy = req.user.id || req.user._id;

        await oldJournal.save({ session });

        await session.commitTransaction();
        res.json({ success: true, data: oldJournal });
    } catch (error) {
        await session.abortTransaction();
        console.error("PUT /manual-journals/:id error:", error);
        res.status(500).json({ message: error.message });
    } finally {
        session.endSession();
    }
});

// @desc    Quick create ledger (Capital start, no duplicates)
// @route   POST /api/manual-journals/instant-ledger
router.post("/instant-ledger", auth, async (req, res) => {
    try {
        let { name, group, branchId } = req.body;
        const effectiveBranchId = branchId || req.user.branch || req.user._id;

        if (!name) return res.status(400).json({ message: "Name is required" });
        if (!effectiveBranchId) return res.status(400).json({ message: "Branch ID is required" });

        // Capitalize first letter
        name = name.charAt(0).toUpperCase() + name.slice(1);

        const branchObjectId = mongoose.Types.ObjectId.isValid(effectiveBranchId)
            ? new mongoose.Types.ObjectId(effectiveBranchId)
            : effectiveBranchId;

        const existing = await TallyJournal.findOne({ journalName: name, branch: branchObjectId });
        if (existing) return res.status(400).json({ message: "Ledger name already exists" });

        const newLedger = await TallyJournal.create({
            journalName: name,
            group: group || "Manual Journals",
            branch: branchObjectId,
            createdBy: req.user._id
        });

        res.status(201).json(newLedger);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
