import mongoose from "mongoose";

/**
 * Chart of Accounts (COA) Model
 * Defines all GL accounts used in the financial system
 * Follows standard Indian accounting (Assets, Liabilities, Equity, Income, Expenses)
 */

const ChartOfAccountsSchema = new mongoose.Schema(
  {
    // Account Code (GL Account Number) - e.g., "1001", "2001", "3001"
    accountCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      description: "Unique account code (e.g., 1001 for Cash, 3001 for Sales Revenue)"
    },

    // Account Name
    accountName: {
      type: String,
      required: true,
      trim: true,
      description: "Display name of the account"
    },

    // Account Type: Assets, Liabilities, Equity, Income, Expenses
    accountType: {
      type: String,
      enum: ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"],
      required: true,
      description: "Category of account for reporting"
    },

    // Sub-Type for detailed categorization
    subType: {
      type: String,
      enum: [
        // Asset subtypes
        "CURRENT_ASSET",
        "FIXED_ASSET",
        "CASH_BANK",
        "RECEIVABLES",
        "INVENTORY",
        // Liability subtypes
        "CURRENT_LIABILITY",
        "LONG_TERM_LIABILITY",
        "PAYABLES",
        // Equity subtypes
        "OWNER_CAPITAL",
        "RETAINED_EARNINGS",
        // Income subtypes
        "SALES_REVENUE",
        "SERVICE_REVENUE",
        "OTHER_INCOME",
        // Expense subtypes
        "COST_OF_GOODS_SOLD",
        "OPERATING_EXPENSE",
        "FINANCE_COST",
        "TAX",
        // GST specific
        "GST_PAYABLE",
        "GST_RECEIVABLE"
      ],
      required: true,
      description: "Sub-category for detailed financial reports"
    },

    // Opening Balance (for each financial year)
    openingBalance: {
      type: Number,
      default: 0,
      description: "Opening balance at start of financial year"
    },

    // Current Balance (auto-calculated from journal entries)
    currentBalance: {
      type: Number,
      default: 0,
      description: "Current account balance (auto-calculated)"
    },

    // Is this a GST account?
    isGstAccount: {
      type: Boolean,
      default: false,
      description: "Whether this is a GST-related account (SGST, CGST, IGST, GST Payable)"
    },

    // GST Type if applicable
    gstType: {
      type: String,
      enum: ["SGST", "CGST", "IGST", "OUTPUT_GST", "INPUT_GST", "GST_PAYABLE"],
      description: "Type of GST account if isGstAccount = true"
    },

    // Is this account active?
    isActive: {
      type: Boolean,
      default: true,
      description: "Whether account can be used in journal entries"
    },

    // Description
    description: {
      type: String,
      description: "Additional notes about this account"
    },

    // Financial Year
    financialYear: {
      type: String,
      default: () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1; // 0-indexed, so +1
        if (month < 4) return `${year - 1}-${year.toString().slice(-2)}`;
        return `${year}-${(year + 1).toString().slice(-2)}`;
      },
      description: "Financial year (e.g., 2025-26)"
    },

    createdBy: mongoose.Schema.Types.ObjectId,
    updatedBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

// Index for quick account lookup
ChartOfAccountsSchema.index({ accountCode: 1, financialYear: 1 }, { unique: true });
ChartOfAccountsSchema.index({ accountType: 1 });
ChartOfAccountsSchema.index({ isActive: 1 });

const ChartOfAccounts = mongoose.model("ChartOfAccounts", ChartOfAccountsSchema);
export default ChartOfAccounts;
