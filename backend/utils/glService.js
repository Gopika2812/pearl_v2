import ChartOfAccounts from "../models/ChartOfAccounts.js";
import GeneralLedger from "../models/GeneralLedger.js";
import JournalEntry from "../models/JournalEntry.js";

/**
 * GL (General Ledger) Service
 * Handles all journal entry posting, GL updates, and financial reporting
 */

class GLService {
  /**
   * Generate unique Journal Entry ID
   */
  static async generateJEId() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    const count = await JournalEntry.countDocuments({
      journalDate: {
        $gte: new Date(today.getFullYear(), 0, 1),
        $lt: new Date(today.getFullYear() + 1, 0, 1)
      }
    });

    return `JE-${year}${month}${day}-${String(count + 1).padStart(4, "0")}`;
  }

  /**
   * Post Sales Order Journal Entry
   * SO creates: Debit AR (Accounts Receivable) / Credit Revenue
   * If GST: Debit AR / Credit Revenue / Credit GST Payable
   */
  static async postSalesOrderJE(salesOrder) {
    try {
      const jeId = await this.generateJEId();
      
      // Line items for journal entry
      const lineItems = [];
      let totalTax = 0;

      // Calculate tax from items
      salesOrder.items.forEach(item => {
        totalTax += (item.tax || 0);
      });

      // Debit: Accounts Receivable (Customer AR account)
      lineItems.push({
        accountCode: "1101", // AR account
        accountName: "Accounts Receivable",
        accountType: "ASSET",
        debit: salesOrder.grandTotal || salesOrder.grandTotalWithMargin || 0,
        credit: 0,
        remarks: `SO ${salesOrder.invoiceId} - ${salesOrder.customer?.name || "Customer"}`
      });

      // Credit: Sales Revenue (net of tax)
      const revenueAmount = (salesOrder.grandTotal || salesOrder.grandTotalWithMargin || 0) - totalTax;
      lineItems.push({
        accountCode: "3001", // Sales Revenue
        accountName: "Sales Revenue",
        accountType: "INCOME",
        debit: 0,
        credit: revenueAmount,
        remarks: `SO ${salesOrder.invoiceId} - Sales Revenue`
      });

      // Credit: GST Payable (if tax exists)
      if (totalTax > 0) {
        lineItems.push({
          accountCode: "2101", // GST Payable
          accountName: "GST Payable (Output GST)",
          accountType: "LIABILITY",
          debit: 0,
          credit: totalTax,
          gstAmount: totalTax,
          remarks: `SO ${salesOrder.invoiceId} - GST`
        });
      }

      // Create journal entry
      const journalEntry = new JournalEntry({
        jeId,
        referenceModule: "SALES_ORDER",
        referenceDocumentId: salesOrder._id,
        referenceDocumentNumber: salesOrder.invoiceId,
        journalDate: new Date(),
        description: `Sales Order ${salesOrder.invoiceId} created by ${salesOrder.customer?.name || "Customer"}`,
        lineItems,
        totalDebit: lineItems.reduce((sum, item) => sum + item.debit, 0),
        totalCredit: lineItems.reduce((sum, item) => sum + item.credit, 0),
        status: "POSTED",
        financialYear: salesOrder.financialYear || "2025-2026"
      });

      journalEntry.isBalanced = Math.abs(journalEntry.totalDebit - journalEntry.totalCredit) < 0.01;
      await journalEntry.save();

      // Update GL accounts
      await this.updateGLAccounts(journalEntry);

      return journalEntry;
    } catch (error) {
      console.error("Error posting SO JE:", error);
      throw error;
    }
  }

  /**
   * Post Sales Invoice Journal Entry (confirmation of invoice)
   * Invoice confirms the items selected and finalizes the amounts
   */
  static async postSalesInvoiceJE(salesInvoice) {
    try {
      const jeId = await this.generateJEId();
      
      const lineItems = [];
      let totalTax = 0;

      // Calculate tax from invoice items
      (salesInvoice.invoiceItems || salesInvoice.items || []).forEach(item => {
        totalTax += (item.tax || item.gst * item.qty * item.sellingPrice / 100 || 0);
      });

      // Debit: Accounts Receivable (Customer AR account)
      lineItems.push({
        accountCode: "1101", // AR account
        accountName: "Accounts Receivable",
        accountType: "ASSET",
        debit: salesInvoice.invoiceGrandTotal || salesInvoice.grandTotal || 0,
        credit: 0,
        remarks: `SI ${salesInvoice.invoiceId} - ${salesInvoice.customer?.name || "Customer"}`
      });

      // Credit: Sales Revenue (net of tax)
      const revenueAmount = (salesInvoice.invoiceGrandTotal || salesInvoice.grandTotal || 0) - totalTax;
      lineItems.push({
        accountCode: "3001", // Sales Revenue
        accountName: "Sales Revenue",
        accountType: "INCOME",
        debit: 0,
        credit: revenueAmount,
        remarks: `SI ${salesInvoice.invoiceId} - Sales Revenue`
      });

      // Credit: GST Payable (if tax exists)
      if (totalTax > 0) {
        lineItems.push({
          accountCode: "2101", // GST Payable
          accountName: "GST Payable (Output GST)",
          accountType: "LIABILITY",
          debit: 0,
          credit: totalTax,
          gstAmount: totalTax,
          remarks: `SI ${salesInvoice.invoiceId} - GST`
        });
      }

      // Create journal entry
      const journalEntry = new JournalEntry({
        jeId,
        referenceModule: "SALES_INVOICE",
        referenceDocumentId: salesInvoice._id,
        referenceDocumentNumber: salesInvoice.invoiceId,
        journalDate: new Date(),
        description: `Sales Invoice ${salesInvoice.invoiceId} confirmed for ${salesInvoice.customer?.name || "Customer"}`,
        lineItems,
        totalDebit: lineItems.reduce((sum, item) => sum + item.debit, 0),
        totalCredit: lineItems.reduce((sum, item) => sum + item.credit, 0),
        status: "POSTED",
        financialYear: salesInvoice.financialYear || "2025-2026"
      });

      journalEntry.isBalanced = Math.abs(journalEntry.totalDebit - journalEntry.totalCredit) < 0.01;
      await journalEntry.save();

      // Update GL accounts
      await this.updateGLAccounts(journalEntry);

      return journalEntry;
    } catch (error) {
      console.error("Error posting SI JE:", error);
      throw error;
    }
  }

  /**
   * Post Credit Note Journal Entry (reversal of SO)
   * CN creates: Debit Revenue / Debit GST / Credit AR
   */
  static async postCreditNoteJE(creditNote) {
    try {
      const jeId = await this.generateJEId();

      const lineItems = [];
      let totalTax = 0;

      // Calculate tax
      creditNote.items?.forEach(item => {
        totalTax += (item.tax || 0);
      });

      // Debit: Sales Revenue (reversal)
      const revenueAmount = (creditNote.grandTotal || 0) - totalTax;
      lineItems.push({
        accountCode: "3001",
        accountName: "Sales Revenue",
        accountType: "INCOME",
        debit: revenueAmount,
        credit: 0,
        remarks: `CN ${creditNote.creditNoteId} - Revenue Reversal`
      });

      // Debit: GST Payable (reversal - reduces liability)
      if (totalTax > 0) {
        lineItems.push({
          accountCode: "2101",
          accountName: "GST Payable (Output GST)",
          accountType: "LIABILITY",
          debit: totalTax,
          credit: 0,
          gstAmount: totalTax,
          remarks: `CN ${creditNote.creditNoteId} - GST Reversal`
        });
      }

      // Credit: Accounts Receivable (AR reduces)
      lineItems.push({
        accountCode: "1101",
        accountName: "Accounts Receivable",
        accountType: "ASSET",
        debit: 0,
        credit: creditNote.grandTotal || 0,
        remarks: `CN ${creditNote.creditNoteId} - ${creditNote.customer?.name || "Customer"}`
      });

      const journalEntry = new JournalEntry({
        jeId,
        referenceModule: "CREDIT_NOTE",
        referenceDocumentId: creditNote._id,
        referenceDocumentNumber: creditNote.creditNoteId,
        journalDate: new Date(),
        description: `Credit Note ${creditNote.creditNoteId} (reversal of SO)`,
        lineItems,
        totalDebit: lineItems.reduce((sum, item) => sum + item.debit, 0),
        totalCredit: lineItems.reduce((sum, item) => sum + item.credit, 0),
        status: "POSTED",
        financialYear: creditNote.financialYear || "2025-2026"
      });

      journalEntry.isBalanced = Math.abs(journalEntry.totalDebit - journalEntry.totalCredit) < 0.01;
      await journalEntry.save();

      await this.updateGLAccounts(journalEntry);

      return journalEntry;
    } catch (error) {
      console.error("Error posting CN JE:", error);
      throw error;
    }
  }

  /**
   * Post Purchase Order Journal Entry
   * PO creates: Debit Inventory / Debit GST Receivable / Credit AP (Accounts Payable)
   */
  static async postPurchaseOrderJE(purchaseOrder) {
    try {
      const jeId = await this.generateJEId();

      const lineItems = [];
      let totalTax = 0;
      let inventoryCost = 0;

      // Calculate inventory cost and tax
      purchaseOrder.items?.forEach(item => {
        const itemCost = (item.qty || 0) * (item.rate || 0);
        inventoryCost += itemCost;
        totalTax += (item.tax || 0);
      });

      // Debit: Inventory / Stock
      lineItems.push({
        accountCode: "1201", // Inventory
        accountName: "Inventory / Raw Materials",
        accountType: "ASSET",
        debit: inventoryCost,
        credit: 0,
        remarks: `PO ${purchaseOrder.invoiceId} - Inventory Purchase`
      });

      // Debit: GST Receivable (Input GST - reduces tax burden)
      if (totalTax > 0) {
        lineItems.push({
          accountCode: "1301", // GST Receivable
          accountName: "GST Receivable (Input GST)",
          accountType: "ASSET",
          debit: totalTax,
          credit: 0,
          gstAmount: totalTax,
          remarks: `PO ${purchaseOrder.invoiceId} - Input GST`
        });
      }

      // Credit: Accounts Payable (Vendor liability)
      lineItems.push({
        accountCode: "2001", // AP account
        accountName: "Accounts Payable",
        accountType: "LIABILITY",
        debit: 0,
        credit: purchaseOrder.grandTotal || 0,
        remarks: `PO ${purchaseOrder.invoiceId} - ${purchaseOrder.vendor?.name || "Vendor"}`
      });

      const journalEntry = new JournalEntry({
        jeId,
        referenceModule: "PURCHASE_ORDER",
        referenceDocumentId: purchaseOrder._id,
        referenceDocumentNumber: purchaseOrder.invoiceId,
        journalDate: new Date(),
        description: `Purchase Order ${purchaseOrder.invoiceId} created from ${purchaseOrder.vendor?.name || "Vendor"}`,
        lineItems,
        totalDebit: lineItems.reduce((sum, item) => sum + item.debit, 0),
        totalCredit: lineItems.reduce((sum, item) => sum + item.credit, 0),
        status: "POSTED",
        financialYear: purchaseOrder.financialYear || "2025-2026"
      });

      journalEntry.isBalanced = Math.abs(journalEntry.totalDebit - journalEntry.totalCredit) < 0.01;
      await journalEntry.save();

      await this.updateGLAccounts(journalEntry);

      return journalEntry;
    } catch (error) {
      console.error("Error posting PO JE:", error);
      throw error;
    }
  }

  /**
   * Post Debit Note Journal Entry (reversal of PO)
   * DN creates: Debit AP / Credit Inventory / Credit GST Receivable
   */
  static async postDebitNoteJE(debitNote) {
    try {
      const jeId = await this.generateJEId();

      const lineItems = [];
      let totalTax = 0;
      let inventoryCost = 0;

      // Calculate costs
      debitNote.items?.forEach(item => {
        const itemCost = (item.returnedQty || 0) * (item.rate || 0);
        inventoryCost += itemCost;
        totalTax += (item.tax || 0);
      });

      // Debit: Accounts Payable (AP reduces - vendor owes us less)
      lineItems.push({
        accountCode: "2001",
        accountName: "Accounts Payable",
        accountType: "LIABILITY",
        debit: debitNote.grandTotal || 0,
        credit: 0,
        remarks: `DN ${debitNote.debitNoteId} - ${debitNote.vendor?.name || "Vendor"}`
      });

      // Credit: Inventory (inventory reduces - return of goods)
      lineItems.push({
        accountCode: "1201",
        accountName: "Inventory / Raw Materials",
        accountType: "ASSET",
        debit: 0,
        credit: inventoryCost,
        remarks: `DN ${debitNote.debitNoteId} - Inventory Return`
      });

      // Credit: GST Receivable (reversal - increases GST burden)
      if (totalTax > 0) {
        lineItems.push({
          accountCode: "1301",
          accountName: "GST Receivable (Input GST)",
          accountType: "ASSET",
          debit: 0,
          credit: totalTax,
          gstAmount: totalTax,
          remarks: `DN ${debitNote.debitNoteId} - Input GST Reversal`
        });
      }

      const journalEntry = new JournalEntry({
        jeId,
        referenceModule: "DEBIT_NOTE",
        referenceDocumentId: debitNote._id,
        referenceDocumentNumber: debitNote.debitNoteId,
        journalDate: new Date(),
        description: `Debit Note ${debitNote.debitNoteId} (reversal of PO)`,
        lineItems,
        totalDebit: lineItems.reduce((sum, item) => sum + item.debit, 0),
        totalCredit: lineItems.reduce((sum, item) => sum + item.credit, 0),
        status: "POSTED",
        financialYear: debitNote.financialYear || "2025-2026"
      });

      journalEntry.isBalanced = Math.abs(journalEntry.totalDebit - journalEntry.totalCredit) < 0.01;
      await journalEntry.save();

      await this.updateGLAccounts(journalEntry);

      return journalEntry;
    } catch (error) {
      console.error("Error posting DN JE:", error);
      throw error;
    }
  }

  /**
   * Update GL Account balances based on journal entry
   */
  static async updateGLAccounts(journalEntry) {
    try {
      const financialYear = journalEntry.financialYear || "2025-2026";

      for (const lineItem of journalEntry.lineItems) {
        const glAccountCode = lineItem.accountCode;

        // Find or create GL account
        let glAccount = await GeneralLedger.findOne({
          accountCode: glAccountCode,
          financialYear: financialYear
        });

        if (!glAccount) {
          // Get account details from COA
          const coaAccount = await ChartOfAccounts.findOne({
            accountCode: glAccountCode,
            financialYear: financialYear
          });

          glAccount = new GeneralLedger({
            accountCode: glAccountCode,
            accountName: coaAccount?.accountName || lineItem.accountName,
            accountType: coaAccount?.accountType || lineItem.accountType,
            financialYear: financialYear,
            openingBalance: coaAccount?.openingBalance || 0,
            currentBalance: coaAccount?.openingBalance || 0
          });
        }

        // Update GL account
        glAccount.totalDebits += lineItem.debit || 0;
        glAccount.totalCredits += lineItem.credit || 0;
        glAccount.debitCount += lineItem.debit > 0 ? 1 : 0;
        glAccount.creditCount += lineItem.credit > 0 ? 1 : 0;

        // Calculate current balance based on account type
        // For Assets & Expenses: Debit increases, Credit decreases
        // For Liabilities, Equity & Income: Credit increases, Debit decreases
        const isNormalDebitAccount = ["ASSET", "EXPENSE"].includes(glAccount.accountType);
        glAccount.currentBalance = glAccount.openingBalance + 
          (isNormalDebitAccount ? 
            (glAccount.totalDebits - glAccount.totalCredits) : 
            (glAccount.totalCredits - glAccount.totalDebits));

        glAccount.lastTransactionDate = journalEntry.journalDate;
        glAccount.lastTransactionAmount = (lineItem.debit || 0) + (lineItem.credit || 0);

        await glAccount.save();
      }
    } catch (error) {
      console.error("Error updating GL accounts:", error);
      throw error;
    }
  }

  /**
   * Get Trial Balance (all GL accounts and their balances)
   */
  static async getTrialBalance(financialYear = "2025-2026") {
    try {
      const glAccounts = await GeneralLedger.find({ financialYear }).sort({ accountCode: 1 });

      const trialBalance = {
        totalDebits: 0,
        totalCredits: 0,
        accounts: []
      };

      glAccounts.forEach(account => {
        const isNormalDebitAccount = ["ASSET", "EXPENSE"].includes(account.accountType);
        const balance = account.currentBalance;

        if (isNormalDebitAccount) {
          if (balance >= 0) {
            trialBalance.totalDebits += balance;
          } else {
            trialBalance.totalCredits += Math.abs(balance);
          }
        } else {
          if (balance >= 0) {
            trialBalance.totalCredits += balance;
          } else {
            trialBalance.totalDebits += Math.abs(balance);
          }
        }

        trialBalance.accounts.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          accountType: account.accountType,
          debit: isNormalDebitAccount && balance >= 0 ? balance : (isNormalDebitAccount && balance < 0 ? 0 : Math.max(0, -balance)),
          credit: isNormalDebitAccount ? (balance < 0 ? Math.abs(balance) : 0) : (balance >= 0 ? balance : 0),
          balance: balance
        });
      });

      return trialBalance;
    } catch (error) {
      console.error("Error getting trial balance:", error);
      throw error;
    }
  }

  /**
   * Get Balance Sheet
   */
  static async getBalanceSheet(financialYear = "2025-2026") {
    try {
      const glAccounts = await GeneralLedger.find({ financialYear });

      const bs = {
        assets: {
          currentAssets: [],
          fixedAssets: [],
          totalAssets: 0
        },
        liabilities: {
          currentLiabilities: [],
          longTermLiabilities: [],
          totalLiabilities: 0
        },
        equity: {
          items: [],
          totalEquity: 0
        }
      };

      glAccounts.forEach(account => {
        if (account.accountType === "ASSET") {
          const item = { ...account.toObject(), balance: account.currentBalance };
          if (account.accountName?.includes("Current")) {
            bs.assets.currentAssets.push(item);
            bs.assets.totalAssets += account.currentBalance;
          } else {
            bs.assets.fixedAssets.push(item);
            bs.assets.totalAssets += account.currentBalance;
          }
        } else if (account.accountType === "LIABILITY") {
          const item = { ...account.toObject(), balance: account.currentBalance };
          if (account.accountName?.includes("Current")) {
            bs.liabilities.currentLiabilities.push(item);
            bs.liabilities.totalLiabilities += account.currentBalance;
          } else {
            bs.liabilities.longTermLiabilities.push(item);
            bs.liabilities.totalLiabilities += account.currentBalance;
          }
        } else if (account.accountType === "EQUITY") {
          bs.equity.items.push({ ...account.toObject(), balance: account.currentBalance });
          bs.equity.totalEquity += account.currentBalance;
        }
      });

      return bs;
    } catch (error) {
      console.error("Error getting balance sheet:", error);
      throw error;
    }
  }

  /**
   * Get Profit & Loss Statement
   */
  static async getProfitLoss(financialYear = "2025-2026") {
    try {
      const glAccounts = await GeneralLedger.find({ financialYear });

      const pl = {
        revenue: {
          items: [],
          total: 0
        },
        expenses: {
          items: [],
          total: 0
        },
        netProfitLoss: 0
      };

      glAccounts.forEach(account => {
        if (account.accountType === "INCOME") {
          pl.revenue.items.push({ ...account.toObject(), amount: account.currentBalance });
          pl.revenue.total += account.currentBalance;
        } else if (account.accountType === "EXPENSE") {
          pl.expenses.items.push({ ...account.toObject(), amount: account.currentBalance });
          pl.expenses.total += account.currentBalance;
        }
      });

      pl.netProfitLoss = pl.revenue.total - pl.expenses.total;

      return pl;
    } catch (error) {
      console.error("Error getting P&L:", error);
      throw error;
    }
  }
}

export default GLService;
