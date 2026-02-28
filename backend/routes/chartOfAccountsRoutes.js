import express from "express";
import ChartOfAccounts from "../models/ChartOfAccounts.js";
import standardChartOfAccounts from "../utils/chartOfAccountsSeed.js";
import { getFinancialYear } from "../utils/financialYear.js";

const router = express.Router();

/**
 * Initialize Chart of Accounts for a financial year
 * Creates all standard GL accounts if they don't exist
 */
router.post("/initialize", async (req, res) => {
  try {
    const financialYear = req.body.financialYear || getFinancialYear();

    // Check if COA already exists for this FY
    const existingCount = await ChartOfAccounts.countDocuments({ financialYear });
    if (existingCount > 0) {
      return res.json({
        success: true,
        message: `Chart of Accounts already initialized for FY ${financialYear}. Found ${existingCount} accounts.`,
        count: existingCount
      });
    }

    // Create accounts for this financial year
    const accountsToCreate = standardChartOfAccounts.map(account => ({
      ...account,
      financialYear,
      currentBalance: account.openingBalance || 0
    }));

    const createdAccounts = await ChartOfAccounts.insertMany(accountsToCreate);

    return res.status(201).json({
      success: true,
      message: `Chart of Accounts initialized for FY ${financialYear}`,
      count: createdAccounts.length,
      accounts: createdAccounts.map(a => ({
        accountCode: a.accountCode,
        accountName: a.accountName,
        accountType: a.accountType
      }))
    });
  } catch (error) {
    console.error("COA initialization error:", error);
    return res.status(500).json({
      success: false,
      message: "Error initializing Chart of Accounts",
      error: error.message
    });
  }
});

/**
 * Get all accounts by type
 */
router.get("/by-type/:accountType", async (req, res) => {
  try {
    const { accountType } = req.params;
    const { financialYear = getFinancialYear() } = req.query;

    const accounts = await ChartOfAccounts.find({
      accountType: accountType.toUpperCase(),
      financialYear,
      isActive: true
    }).sort({ accountCode: 1 });

    return res.json({
      success: true,
      accountType,
      financialYear,
      count: accounts.length,
      accounts
    });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching accounts"
    });
  }
});

/**
 * Get single account details
 */
router.get("/:accountCode", async (req, res) => {
  try {
    const { accountCode } = req.params;
    const { financialYear = getFinancialYear() } = req.query;

    const account = await ChartOfAccounts.findOne({
      accountCode,
      financialYear
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: `Account ${accountCode} not found for FY ${financialYear}`
      });
    }

    return res.json({
      success: true,
      account
    });
  } catch (error) {
    console.error("Error fetching account:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching account"
    });
  }
});

/**
 * Create custom account
 */
router.post("/", async (req, res) => {
  try {
    const {
      accountCode,
      accountName,
      accountType,
      subType,
      description,
      openingBalance = 0
    } = req.body;

    const financialYear = req.body.financialYear || getFinancialYear();

    // Validate required fields
    if (!accountCode || !accountName || !accountType) {
      return res.status(400).json({
        success: false,
        message: "accountCode, accountName, and accountType are required"
      });
    }

    // Check if account already exists
    const existing = await ChartOfAccounts.findOne({
      accountCode,
      financialYear
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Account code ${accountCode} already exists for FY ${financialYear}`
      });
    }

    const account = new ChartOfAccounts({
      accountCode,
      accountName,
      accountType,
      subType,
      description,
      openingBalance,
      currentBalance: openingBalance,
      financialYear,
      isActive: true
    });

    await account.save();

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      account
    });
  } catch (error) {
    console.error("Error creating account:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating account",
      error: error.message
    });
  }
});

export default router;
