/**
 * Chart of Accounts Seed Data
 * Standard Indian COA with GST compliance
 * This seed creates all GL accounts needed for the ERP
 */

const standardChartOfAccounts = [
  // ============ ASSETS ============

  // Current Assets
  {
    accountCode: "1001",
    accountName: "Cash",
    accountType: "ASSET",
    subType: "CASH_BANK",
    openingBalance: 0,
    isGstAccount: false,
    description: "Physical cash in hand"
  },
  {
    accountCode: "1002",
    accountName: "Bank Account",
    accountType: "ASSET",
    subType: "CASH_BANK",
    openingBalance: 0,
    isGstAccount: false,
    description: "Money in bank accounts"
  },
  {
    accountCode: "1101",
    accountName: "Accounts Receivable",
    accountType: "ASSET",
    subType: "RECEIVABLES",
    openingBalance: 0,
    isGstAccount: false,
    description: "Money owed by customers (AR)"
  },
  {
    accountCode: "1201",
    accountName: "Inventory / Raw Materials",
    accountType: "ASSET",
    subType: "INVENTORY",
    openingBalance: 0,
    isGstAccount: false,
    description: "Stock of goods for resale"
  },
  {
    accountCode: "1301",
    accountName: "GST Receivable (Input GST)",
    accountType: "ASSET",
    subType: "GST_RECEIVABLE",
    openingBalance: 0,
    isGstAccount: true,
    gstType: "INPUT_GST",
    description: "GST paid on purchases (Input Tax Credit)"
  },

  // Fixed Assets
  {
    accountCode: "1401",
    accountName: "Plant & Machinery",
    accountType: "ASSET",
    subType: "FIXED_ASSET",
    openingBalance: 0,
    isGstAccount: false,
    description: "Equipment and machinery"
  },
  {
    accountCode: "1402",
    accountName: "Furniture & Fixtures",
    accountType: "ASSET",
    subType: "FIXED_ASSET",
    openingBalance: 0,
    isGstAccount: false,
    description: "Office furniture and fixtures"
  },
  {
    accountCode: "1403",
    accountName: "Accumulated Depreciation",
    accountType: "ASSET",
    subType: "FIXED_ASSET",
    openingBalance: 0,
    isGstAccount: false,
    description: "Depreciation against fixed assets"
  },

  // ============ LIABILITIES ============

  // Current Liabilities
  {
    accountCode: "2001",
    accountName: "Accounts Payable",
    accountType: "LIABILITY",
    subType: "PAYABLES",
    openingBalance: 0,
    isGstAccount: false,
    description: "Money owed to vendors (AP)"
  },
  {
    accountCode: "2101",
    accountName: "GST Payable (Output GST)",
    accountType: "LIABILITY",
    subType: "GST_PAYABLE",
    openingBalance: 0,
    isGstAccount: true,
    gstType: "OUTPUT_GST",
    description: "GST collected on sales (Output Tax)"
  },
  {
    accountCode: "2102",
    accountName: "SGST Payable",
    accountType: "LIABILITY",
    subType: "GST_PAYABLE",
    openingBalance: 0,
    isGstAccount: true,
    gstType: "SGST",
    description: "State GST payable"
  },
  {
    accountCode: "2103",
    accountName: "CGST Payable",
    accountType: "LIABILITY",
    subType: "GST_PAYABLE",
    openingBalance: 0,
    isGstAccount: true,
    gstType: "CGST",
    description: "Central GST payable"
  },
  {
    accountCode: "2104",
    accountName: "IGST Payable",
    accountType: "LIABILITY",
    subType: "GST_PAYABLE",
    openingBalance: 0,
    isGstAccount: true,
    gstType: "IGST",
    description: "Integrated GST payable"
  },
  {
    accountCode: "2201",
    accountName: "Short-term Loans",
    accountType: "LIABILITY",
    subType: "CURRENT_LIABILITY",
    openingBalance: 0,
    isGstAccount: false,
    description: "Short-term borrowing"
  },

  // Long-term Liabilities
  {
    accountCode: "2301",
    accountName: "Long-term Loans",
    accountType: "LIABILITY",
    subType: "LONG_TERM_LIABILITY",
    openingBalance: 0,
    isGstAccount: false,
    description: "Long-term debt"
  },

  // ============ EQUITY ============

  {
    accountCode: "3101",
    accountName: "Owner's Capital",
    accountType: "EQUITY",
    subType: "OWNER_CAPITAL",
    openingBalance: 0,
    isGstAccount: false,
    description: "Owner's initial investment"
  },
  {
    accountCode: "3102",
    accountName: "Retained Earnings",
    accountType: "EQUITY",
    subType: "RETAINED_EARNINGS",
    openingBalance: 0,
    isGstAccount: false,
    description: "Accumulated profits"
  },

  // ============ INCOME ============

  {
    accountCode: "4001",
    accountName: "Sales Revenue",
    accountType: "INCOME",
    subType: "SALES_REVENUE",
    openingBalance: 0,
    isGstAccount: false,
    description: "Revenue from product sales"
  },
  {
    accountCode: "4101",
    accountName: "Service Revenue",
    accountType: "INCOME",
    subType: "SERVICE_REVENUE",
    openingBalance: 0,
    isGstAccount: false,
    description: "Revenue from services"
  },
  {
    accountCode: "4201",
    accountName: "Other Income",
    accountType: "INCOME",
    subType: "OTHER_INCOME",
    openingBalance: 0,
    isGstAccount: false,
    description: "Miscellaneous income"
  },

  // ============ EXPENSES ============

  // Cost of Goods Sold
  {
    accountCode: "5001",
    accountName: "Cost of Goods Sold (COGS)",
    accountType: "EXPENSE",
    subType: "COST_OF_GOODS_SOLD",
    openingBalance: 0,
    isGstAccount: false,
    description: "Direct cost of inventory sold"
  },

  // Operating Expenses
  {
    accountCode: "5101",
    accountName: "Salaries & Wages",
    accountType: "EXPENSE",
    subType: "OPERATING_EXPENSE",
    openingBalance: 0,
    isGstAccount: false,
    description: "Employee salaries and wages"
  },
  {
    accountCode: "5102",
    accountName: "Rent Expense",
    accountType: "EXPENSE",
    subType: "OPERATING_EXPENSE",
    openingBalance: 0,
    isGstAccount: false,
    description: "Rent for premises"
  },
  {
    accountCode: "5103",
    accountName: "Utilities Expense",
    accountType: "EXPENSE",
    subType: "OPERATING_EXPENSE",
    openingBalance: 0,
    isGstAccount: false,
    description: "Electricity, water, telephone"
  },
  {
    accountCode: "5104",
    accountName: "Transportation Expense",
    accountType: "EXPENSE",
    subType: "OPERATING_EXPENSE",
    openingBalance: 0,
    isGstAccount: false,
    description: "Shipping and delivery costs"
  },
  {
    accountCode: "5105",
    accountName: "Office Supplies Expense",
    accountType: "EXPENSE",
    subType: "OPERATING_EXPENSE",
    openingBalance: 0,
    isGstAccount: false,
    description: "Stationery and office supplies"
  },
  {
    accountCode: "5106",
    accountName: "Marketing & Advertising",
    accountType: "EXPENSE",
    subType: "OPERATING_EXPENSE",
    openingBalance: 0,
    isGstAccount: false,
    description: "Promotional and advertising costs"
  },
  {
    accountCode: "5107",
    accountName: "Repairs & Maintenance",
    accountType: "EXPENSE",
    subType: "OPERATING_EXPENSE",
    openingBalance: 0,
    isGstAccount: false,
    description: "Upkeep of assets"
  },
  {
    accountCode: "5108",
    accountName: "Insurance Expense",
    accountType: "EXPENSE",
    subType: "OPERATING_EXPENSE",
    openingBalance: 0,
    isGstAccount: false,
    description: "Insurance premiums"
  },

  // Finance Costs
  {
    accountCode: "5201",
    accountName: "Interest Expense",
    accountType: "EXPENSE",
    subType: "FINANCE_COST",
    openingBalance: 0,
    isGstAccount: false,
    description: "Interest on loans"
  },
  {
    accountCode: "5202",
    accountName: "Bank Charges",
    accountType: "EXPENSE",
    subType: "FINANCE_COST",
    openingBalance: 0,
    isGstAccount: false,
    description: "Bank service charges"
  },

  // Taxes (Non-GST)
  {
    accountCode: "5301",
    accountName: "Income Tax Expense",
    accountType: "EXPENSE",
    subType: "TAX",
    openingBalance: 0,
    isGstAccount: false,
    description: "Income tax liability"
  },
  {
    accountCode: "5302",
    accountName: "Professional Tax",
    accountType: "EXPENSE",
    subType: "TAX",
    openingBalance: 0,
    isGstAccount: false,
    description: "Professional tax liability"
  },
];

export default standardChartOfAccounts;
