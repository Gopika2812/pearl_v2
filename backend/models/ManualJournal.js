import mongoose from "mongoose";

const manualJournalSchema = new mongoose.Schema(
  {
    journalId: {
      type: String,
      required: true,
      description: "Branch-specific unique ID like JE/001/26-27"
    },
    sequenceNumber: {
      type: Number,
      required: true
    },
    journalDate: {
      type: Date,
      default: Date.now
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true
    },
    
    // THE "BY" SIDE (Debit)
    by: {
      partyType: { type: String, enum: ["VENDOR", "DEBTOR", "LEDGER"], required: true },
      partyId: { type: mongoose.Schema.Types.ObjectId, required: true },
      partyName: { type: String, required: true },
      partyGroup: { type: String }
    },
    
    // THE "TO" SIDE (Credit)
    to: {
      partyType: { type: String, enum: ["VENDOR", "DEBTOR", "LEDGER"], required: true },
      partyId: { type: mongoose.Schema.Types.ObjectId, required: true },
      partyName: { type: String, required: true },
      partyGroup: { type: String }
    },

    amount: {
      type: Number,
      required: true,
      min: [0, "Amount must be zero or more"]
    },

    tax: {
      type: Number,
      default: 0
    },

    taxPercentage: {
      type: Number,
      default: 0
    },

    grandTotal: {
      type: Number,
      required: true,
      min: [0.01, "Grand Total must be greater than zero"]
    },
    
    entryType: {
        type: String,
        enum: ["DEBIT", "CREDIT"],
        default: "DEBIT"
    },

    paymentMode: {
      type: String,
      enum: ["CASH", "UPI", "DEBIT_CARD", "CREDIT_CARD", "BANK_TRANSFER", "CHEQUE"],
      required: true
    },

    narration: {
      type: String,
      trim: true
    },

    userName: {
      type: String,
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BranchUser",
      required: true
    },
    financialYear: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

// Index for quick branch lookups
manualJournalSchema.index({ branchId: 1, sequenceNumber: 1 }, { unique: true });

const ManualJournal = mongoose.model("ManualJournal", manualJournalSchema);
export default ManualJournal;
