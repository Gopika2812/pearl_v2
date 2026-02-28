import mongoose from "mongoose";

/**
 * General Ledger (GL) Model
 * Stores aggregated balance for each GL account
 * Auto-updated whenever journal entries are posted
 */

const GeneralLedgerSchema = new mongoose.Schema(
  {
    // GL Account Code
    accountCode: {
      type: String,
      required: true,
      index: true,
      description: "GL Account code"
    },

    // GL Account Name
    accountName: {
      type: String,
      required: true,
      description: "Account name"
    },

    // Account Type
    accountType: {
      type: String,
      enum: ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"],
      required: true
    },

    // Opening Balance (start of FY)
    openingBalance: {
      type: Number,
      default: 0,
      description: "Balance at start of financial year"
    },

    // Current Balance (opening + all debits - all credits)
    currentBalance: {
      type: Number,
      default: 0,
      description: "Current account balance"
    },

    // Period-wise breakdown (for fast reporting)
    periodBalances: {
      april: Number,
      may: Number,
      june: Number,
      july: Number,
      august: Number,
      september: Number,
      october: Number,
      november: Number,
      december: Number,
      january: Number,
      february: Number,
      march: Number
    },

    // Transaction counts
    debitCount: {
      type: Number,
      default: 0,
      description: "Number of debit entries"
    },

    creditCount: {
      type: Number,
      default: 0,
      description: "Number of credit entries"
    },

    // Total debits and credits posted
    totalDebits: {
      type: Number,
      default: 0,
      description: "Sum of all debits"
    },

    totalCredits: {
      type: Number,
      default: 0,
      description: "Sum of all credits"
    },

    // Last transaction details
    lastTransactionDate: {
      type: Date,
      description: "Date of most recent transaction"
    },

    lastTransactionAmount: {
      type: Number,
      description: "Amount of last transaction"
    },

    // For AR/AP accounts, track aging
    aged0_30: {
      type: Number,
      default: 0,
      description: "Amount due within 0-30 days"
    },

    aged31_60: {
      type: Number,
      default: 0,
      description: "Amount due 31-60 days"
    },

    aged61_90: {
      type: Number,
      default: 0,
      description: "Amount due 61-90 days"
    },

    agedOver90: {
      type: Number,
      default: 0,
      description: "Amount due over 90 days"
    },

    // Financial Year
    financialYear: {
      type: String,
      required: true,
      index: true,
      default: () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        if (month < 4) return `${year - 1}-${year.toString().slice(-2)}`;
        return `${year}-${(year + 1).toString().slice(-2)}`;
      }
    },

    // Is this a control account? (summary account with sub-accounts)
    isControlAccount: {
      type: Boolean,
      default: false
    },

    // Sub-accounts if control account
    subAccounts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GeneralLedger"
      }
    ],

    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Unique index on account code per financial year
GeneralLedgerSchema.index({ accountCode: 1, financialYear: 1 }, { unique: true });

const GeneralLedger = mongoose.model("GeneralLedger", GeneralLedgerSchema);
export default GeneralLedger;
