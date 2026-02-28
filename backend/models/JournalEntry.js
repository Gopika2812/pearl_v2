import mongoose from "mongoose";

/**
 * Journal Entry Model
 * Stores all debit/credit entries posted to GL accounts
 * Every transaction (SO, PO, CN, DN, Payment, etc.) creates journal entries
 */

const JournalEntrySchema = new mongoose.Schema(
  {
    // Journal Entry ID - Auto-generated unique identifier
    jeId: {
      type: String,
      required: true,
      unique: true,
      description: "Journal Entry ID (e.g., JE-2026-001)"
    },

    // Reference Document Type and ID (what triggered this entry)
    referenceModule: {
      type: String,
      enum: ["SALES_ORDER", "CREDIT_NOTE", "PURCHASE_ORDER", "DEBIT_NOTE", "PAYMENT", "OPENING_BALANCE"],
      required: true,
      description: "Type of document that created this entry"
    },

    referenceDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      description: "ID of the SO/CN/PO/DN/Payment document"
    },

    referenceDocumentNumber: {
      type: String,
      description: "Document number (e.g., INV-2026-001, CN-2026-001)"
    },

    // Journal Date
    journalDate: {
      type: Date,
      default: Date.now,
      description: "Date on which entry is recorded"
    },

    // Journal Description
    description: {
      type: String,
      required: true,
      description: "Description of the journal entry (e.g., 'Sales Order SO-001 created')"
    },

    // Line Items (Debit/Credit entries)
    lineItems: [
      {
        accountCode: {
          type: String,
          required: true,
          description: "GL Account code (e.g., 1001, 3001)"
        },

        accountName: {
          type: String,
          required: true,
          description: "Account name"
        },

        accountType: {
          type: String,
          enum: ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"],
          required: true
        },

        debit: {
          type: Number,
          default: 0,
          description: "Debit amount (positive)"
        },

        credit: {
          type: Number,
          default: 0,
          description: "Credit amount (positive)"
        },

        // Optional: for GST tracking
        gstAmount: {
          type: Number,
          default: 0,
          description: "GST component if applicable"
        },

        // Optional: for tracking cost center allocation
        costCenter: {
          type: String,
          description: "Cost center allocation"
        },

        remarks: {
          type: String,
          description: "Additional notes for this line item"
        }
      }
    ],

    // Total Debit and Credit (should always match)
    totalDebit: {
      type: Number,
      default: 0,
      description: "Sum of all debit entries"
    },

    totalCredit: {
      type: Number,
      default: 0,
      description: "Sum of all credit entries"
    },

    // Is entry balanced? (Debit = Credit)
    isBalanced: {
      type: Boolean,
      default: false,
      description: "Whether debit total equals credit total"
    },

    // Post Status
    status: {
      type: String,
      enum: ["DRAFT", "POSTED"],
      default: "POSTED",
      description: "DRAFT = not posted to GL, POSTED = already in GL"
    },

    // Post Date and User
    postedDate: {
      type: Date,
      description: "Date when entry was posted to GL"
    },

    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      description: "User who posted the entry"
    },

    // Financial Year
    financialYear: {
      type: String,
      default: () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        if (month < 4) return `${year - 1}-${year.toString().slice(-2)}`;
        return `${year}-${(year + 1).toString().slice(-2)}`;
      },
      description: "Financial year (e.g., 2025-26)"
    },

    // Reversal Entry? (for ReversingJE)
    isReversing: {
      type: Boolean,
      default: false,
      description: "Is this a reversal entry?"
    },

    reversalOfJeId: {
      type: String,
      description: "Reference to original JE being reversed"
    },

    // Approval workflow
    approvalStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "APPROVED",
      description: "Approval status (auto-approved for system entries)"
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      description: "User who approved the entry"
    },

    createdBy: mongoose.Schema.Types.ObjectId,
    updatedBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

// Indexes for quick lookup
// Note: jeId already has unique index from schema definition
JournalEntrySchema.index({ referenceModule: 1, referenceDocumentId: 1 });
JournalEntrySchema.index({ journalDate: 1 });
JournalEntrySchema.index({ financialYear: 1 });
JournalEntrySchema.index({ status: 1 });

const JournalEntry = mongoose.model("JournalEntry", JournalEntrySchema);
export default JournalEntry;
