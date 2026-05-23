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
    const runWithoutTransaction = async () => {
        const { by, to, amount, tax, taxPercentage, grandTotal, paymentMode, narration, entryType, branchId } = req.body;
        const effectiveBranchId = branchId || req.user.branch || req.user._id;
        const finYear = getFinancialYear();

        if (!effectiveBranchId) throw new Error("Branch ID is required");

        const lastEntry = await ManualJournal.findOne({ branchId: effectiveBranchId }).sort({ sequenceNumber: -1 });
        const nextSeq = lastEntry ? lastEntry.sequenceNumber + 1 : 1;
        const journalId = `JE/${nextSeq.toString().padStart(3, '0')}/${finYear}`;

        const newJournal = new ManualJournal({
            journalId,
            sequenceNumber: nextSeq,
            branchId: effectiveBranchId,
            by,
            to,
            amount: parseFloat(amount) || 0,
            tax: parseFloat(tax) || 0,
            taxPercentage: parseFloat(taxPercentage) || 0,
            grandTotal: grandTotal || (parseFloat(amount || 0) + parseFloat(tax || 0)),
            entryType: entryType || "DEBIT",
            paymentMode,
            narration,
            userName: req.user.name || req.user.role || "Admin",
            createdBy: req.user.id || req.user._id,
            financialYear: finYear
        });

        await newJournal.save();

        const totalToImpact = newJournal.grandTotal;
        if (by.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(by.partyId, { $inc: { debit: totalToImpact } });
        } else if (by.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(by.partyId, { $inc: { debit: totalToImpact } });
        } else if (by.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(by.partyId, { $inc: { debit: totalToImpact } });
        }

        if (to.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(to.partyId, { $inc: { credit: totalToImpact } });
        } else if (to.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(to.partyId, { $inc: { credit: totalToImpact } });
        } else if (to.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(to.partyId, { $inc: { credit: totalToImpact } });
        }

        return newJournal;
    };

    let session = null;
    try {
        session = await mongoose.startSession();
        session.startTransaction();

        const { by, to, amount, tax, taxPercentage, grandTotal, paymentMode, narration, entryType, branchId } = req.body;
        const effectiveBranchId = branchId || req.user.branch || req.user._id;
        const finYear = getFinancialYear();

        if (!effectiveBranchId) throw new Error("Branch ID is required");

        const lastEntry = await ManualJournal.findOne({ branchId: effectiveBranchId }).sort({ sequenceNumber: -1 });
        const nextSeq = lastEntry ? lastEntry.sequenceNumber + 1 : 1;
        const journalId = `JE/${nextSeq.toString().padStart(3, '0')}/${finYear}`;

        const newJournal = new ManualJournal({
            journalId,
            sequenceNumber: nextSeq,
            branchId: effectiveBranchId,
            by,
            to,
            amount: parseFloat(amount) || 0,
            tax: parseFloat(tax) || 0,
            taxPercentage: parseFloat(taxPercentage) || 0,
            grandTotal: grandTotal || (parseFloat(amount || 0) + parseFloat(tax || 0)),
            entryType: entryType || "DEBIT",
            paymentMode,
            narration,
            userName: req.user.name || req.user.role || "Admin",
            createdBy: req.user.id || req.user._id,
            financialYear: finYear
        });

        await newJournal.save({ session });

        const totalToImpact = newJournal.grandTotal;
        if (by.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(by.partyId, { $inc: { debit: totalToImpact } }, { session });
        } else if (by.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(by.partyId, { $inc: { debit: totalToImpact } }, { session });
        } else if (by.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(by.partyId, { $inc: { debit: totalToImpact } }, { session });
        }

        if (to.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(to.partyId, { $inc: { credit: totalToImpact } }, { session });
        } else if (to.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(to.partyId, { $inc: { credit: totalToImpact } }, { session });
        } else if (to.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(to.partyId, { $inc: { credit: totalToImpact } }, { session });
        }

        await session.commitTransaction();
        res.status(201).json(newJournal);
    } catch (error) {
        if (session) {
            try {
                await session.abortTransaction();
            } catch (abortErr) {
                // ignore abort errors
            }
        }

        const isReplicaSetError = 
            error.message.includes("Transaction numbers are only allowed") ||
            error.message.includes("does not support retryable writes") ||
            error.codeName === "IllegalOperation";

        if (isReplicaSetError) {
            console.warn("MongoDB standalone fallback: Executing manual journal without session transaction.");
            try {
                const newJournal = await runWithoutTransaction();
                return res.status(201).json(newJournal);
            } catch (fallbackError) {
                return res.status(500).json({ message: fallbackError.message });
            }
        }
        res.status(500).json({ message: error.message });
    } finally {
        if (session) {
            session.endSession();
        }
    }
});

// @desc    Update manual journal and adjust balances
// @route   PUT /api/manual-journals/:id
router.put("/:id", auth, async (req, res) => {
    const runWithoutTransaction = async () => {
        const { by, to, amount, tax, taxPercentage, grandTotal, paymentMode, narration, primaryCategory } = req.body;
        const oldJournal = await ManualJournal.findById(req.params.id);
        
        if (!oldJournal) throw new Error("Journal entry not found");

        const oldImpact = oldJournal.grandTotal || oldJournal.amount;
        
        if (oldJournal.by.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(oldJournal.by.partyId, { $inc: { debit: -oldImpact } });
        } else if (oldJournal.by.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(oldJournal.by.partyId, { $inc: { debit: -oldImpact } });
        } else if (oldJournal.by.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(oldJournal.by.partyId, { $inc: { debit: -oldImpact } });
        }

        if (oldJournal.to.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(oldJournal.to.partyId, { $inc: { credit: -oldImpact } });
        } else if (oldJournal.to.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(oldJournal.to.partyId, { $inc: { credit: -oldImpact } });
        } else if (oldJournal.to.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(oldJournal.to.partyId, { $inc: { credit: -oldImpact } });
        }

        const newAmt = parseFloat(amount);
        const newTax = parseFloat(tax || 0);
        const newTotal = grandTotal ? parseFloat(grandTotal) : (newAmt + newTax);

        if (by.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(by.partyId, { $inc: { debit: newTotal } });
        } else if (by.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(by.partyId, { $inc: { debit: newTotal } });
        } else if (by.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(by.partyId, { $inc: { debit: newTotal } });
        }

        if (to.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(to.partyId, { $inc: { credit: newTotal } });
        } else if (to.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(to.partyId, { $inc: { credit: newTotal } });
        } else if (to.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(to.partyId, { $inc: { credit: newTotal } });
        }

        oldJournal.by = by;
        oldJournal.to = to;
        oldJournal.amount = newAmt;
        oldJournal.tax = newTax;
        oldJournal.taxPercentage = parseFloat(req.body.taxPercentage || 0);
        oldJournal.grandTotal = newTotal;
        oldJournal.paymentMode = paymentMode;
        oldJournal.narration = narration;
        oldJournal.primaryCategory = primaryCategory || oldJournal.primaryCategory;
        oldJournal.updatedBy = req.user.id || req.user._id;

        await oldJournal.save();
        return oldJournal;
    };

    let session = null;
    try {
        session = await mongoose.startSession();
        session.startTransaction();

        const { by, to, amount, tax, taxPercentage, grandTotal, paymentMode, narration, primaryCategory } = req.body;
        const oldJournal = await ManualJournal.findById(req.params.id);
        
        if (!oldJournal) throw new Error("Journal entry not found");

        const oldImpact = oldJournal.grandTotal || oldJournal.amount;
        
        if (oldJournal.by.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(oldJournal.by.partyId, { $inc: { debit: -oldImpact } }, { session });
        } else if (oldJournal.by.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(oldJournal.by.partyId, { $inc: { debit: -oldImpact } }, { session });
        } else if (oldJournal.by.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(oldJournal.by.partyId, { $inc: { debit: -oldImpact } }, { session });
        }

        if (oldJournal.to.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(oldJournal.to.partyId, { $inc: { credit: -oldImpact } }, { session });
        } else if (oldJournal.to.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(oldJournal.to.partyId, { $inc: { credit: -oldImpact } }, { session });
        } else if (oldJournal.to.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(oldJournal.to.partyId, { $inc: { credit: -oldImpact } }, { session });
        }

        const newAmt = parseFloat(amount);
        const newTax = parseFloat(tax || 0);
        const newTotal = grandTotal ? parseFloat(grandTotal) : (newAmt + newTax);

        if (by.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(by.partyId, { $inc: { debit: newTotal } }, { session });
        } else if (by.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(by.partyId, { $inc: { debit: newTotal } }, { session });
        } else if (by.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(by.partyId, { $inc: { debit: newTotal } }, { session });
        }

        if (to.partyType === "DEBTOR") {
            await Customer.findByIdAndUpdate(to.partyId, { $inc: { credit: newTotal } }, { session });
        } else if (to.partyType === "VENDOR") {
            await Vendor.findByIdAndUpdate(to.partyId, { $inc: { credit: newTotal } }, { session });
        } else if (to.partyType === "LEDGER") {
            await TallyJournal.findByIdAndUpdate(to.partyId, { $inc: { credit: newTotal } }, { session });
        }

        oldJournal.by = by;
        oldJournal.to = to;
        oldJournal.amount = newAmt;
        oldJournal.tax = newTax;
        oldJournal.taxPercentage = parseFloat(req.body.taxPercentage || 0);
        oldJournal.grandTotal = newTotal;
        oldJournal.paymentMode = paymentMode;
        oldJournal.narration = narration;
        oldJournal.primaryCategory = primaryCategory || oldJournal.primaryCategory;
        oldJournal.updatedBy = req.user.id || req.user._id;

        await oldJournal.save({ session });

        await session.commitTransaction();
        res.json({ success: true, data: oldJournal });
    } catch (error) {
        if (session) {
            try {
                await session.abortTransaction();
            } catch (abortErr) {
                // ignore
            }
        }
        
        const isReplicaSetError = 
            error.message.includes("Transaction numbers are only allowed") ||
            error.message.includes("does not support retryable writes") ||
            error.codeName === "IllegalOperation";

        if (isReplicaSetError) {
            console.warn("MongoDB standalone fallback: Executing manual journal update without session transaction.");
            try {
                const oldJournal = await runWithoutTransaction();
                return res.json({ success: true, data: oldJournal });
            } catch (fallbackError) {
                return res.status(500).json({ message: fallbackError.message });
            }
        }
        console.error("PUT /manual-journals/:id error:", error);
        res.status(500).json({ message: error.message });
    } finally {
        if (session) {
            session.endSession();
        }
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
