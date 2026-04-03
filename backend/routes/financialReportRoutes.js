import express from "express";
import ChartOfAccounts from "../models/ChartOfAccounts.js";
import Customer from "../models/Customer.js";
import GeneralLedger from "../models/GeneralLedger.js";
import JournalEntry from "../models/JournalEntry.js";
import Vendor from "../models/Vendor.js";
import GLService from "../utils/glService.js";
import SalesOrder from "../models/SalesOrder.js";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import Payment from "../models/Payment.js";
import DebitNote from "../models/DebitNote.js";
import Receipt from "../models/Receipt.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import mongoose from "mongoose";

const router = express.Router();

/**
 * Trial Balance Report
 * Shows debit and credit balance of all GL accounts
 */
router.get("/trial-balance", async (req, res) => {
  try {
    const { financialYear = "2025-2026" } = req.query;

    const trialBalance = await GLService.getTrialBalance(financialYear);

    return res.json({
      success: true,
      financialYear,
      reportDate: new Date().toLocaleDateString(),
      data: trialBalance
    });
  } catch (error) {
    console.error("Error generating trial balance:", error);
    return res.status(500).json({
      success: false,
      message: "Error generating trial balance"
    });
  }
});

/**
 * Balance Sheet Report
 * Shows Assets = Liabilities + Equity
 */
router.get("/balance-sheet", async (req, res) => {
  try {
    const { financialYear = "2025-2026" } = req.query;

    const balanceSheet = await GLService.getBalanceSheet(financialYear);

    // Format for presentation
    const formatted = {
      success: true,
      financialYear,
      reportDate: new Date().toLocaleDateString(),
      assets: {
        currentAssets: {
          items: balanceSheet.assets.currentAssets.map(a => ({
            accountCode: a.accountCode,
            accountName: a.accountName,
            balance: a.balance
          })),
          total: balanceSheet.assets.currentAssets.reduce((sum, a) => sum + a.balance, 0)
        },
        fixedAssets: {
          items: balanceSheet.assets.fixedAssets.map(a => ({
            accountCode: a.accountCode,
            accountName: a.accountName,
            balance: a.balance
          })),
          total: balanceSheet.assets.fixedAssets.reduce((sum, a) => sum + a.balance, 0)
        },
        totalAssets: balanceSheet.assets.totalAssets
      },
      liabilities: {
        currentLiabilities: {
          items: balanceSheet.liabilities.currentLiabilities.map(a => ({
            accountCode: a.accountCode,
            accountName: a.accountName,
            balance: a.balance
          })),
          total: balanceSheet.liabilities.currentLiabilities.reduce((sum, a) => sum + a.balance, 0)
        },
        longTermLiabilities: {
          items: balanceSheet.liabilities.longTermLiabilities.map(a => ({
            accountCode: a.accountCode,
            accountName: a.accountName,
            balance: a.balance
          })),
          total: balanceSheet.liabilities.longTermLiabilities.reduce((sum, a) => sum + a.balance, 0)
        },
        totalLiabilities: balanceSheet.liabilities.totalLiabilities
      },
      equity: {
        items: balanceSheet.equity.items.map(a => ({
          accountCode: a.accountCode,
          accountName: a.accountName,
          balance: a.balance
        })),
        totalEquity: balanceSheet.equity.totalEquity
      },
      balanceCheckout: {
        totalAssets: balanceSheet.assets.totalAssets,
        totalLiabilitiesAndEquity: balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity,
        isBalanced: Math.abs(balanceSheet.assets.totalAssets - (balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity)) < 0.01
      }
    };

    return res.json(formatted);
  } catch (error) {
    console.error("Error generating balance sheet:", error);
    return res.status(500).json({
      success: false,
      message: "Error generating balance sheet"
    });
  }
});

/**
 * Profit & Loss (Income Statement) Report
 * Shows Revenue - Expenses = Net Profit/Loss
 */
router.get("/profit-loss", async (req, res) => {
  try {
    const { financialYear = "2025-2026" } = req.query;

    const pl = await GLService.getProfitLoss(financialYear);

    const formatted = {
      success: true,
      financialYear,
      reportDate: new Date().toLocaleDateString(),
      revenue: {
        items: pl.revenue.items.map(r => ({
          accountCode: r.accountCode,
          accountName: r.accountName,
          amount: r.amount
        })),
        totalRevenue: pl.revenue.total
      },
      expenses: {
        items: pl.expenses.items.map(e => ({
          accountCode: e.accountCode,
          accountName: e.accountName,
          amount: e.amount
        })),
        totalExpenses: pl.expenses.total
      },
      summary: {
        totalRevenue: pl.revenue.total,
        totalExpenses: pl.expenses.total,
        netProfitLoss: pl.netProfitLoss,
        profitMarginPercent: pl.revenue.total > 0 ? ((pl.netProfitLoss / pl.revenue.total) * 100).toFixed(2) : 0
      }
    };

    return res.json(formatted);
  } catch (error) {
    console.error("Error generating P&L:", error);
    return res.status(500).json({
      success: false,
      message: "Error generating profit & loss statement"
    });
  }
});

/**
 * Accounts Receivable (Customer) Aging Report
 * Shows customer balances aged by days outstanding
 */
router.get("/ar-aging", async (req, res) => {
  try {
    const customers = await Customer.find({ closingBalance: { $gt: 0 } });

    const arAging = {
      success: true,
      reportDate: new Date().toLocaleDateString(),
      summary: {
        current0_30: 0,
        aging31_60: 0,
        aging61_90: 0,
        agingOver90: 0,
        totalAR: 0
      },
      customers: []
    };

    const today = new Date();

    customers.forEach(customer => {
      const daysOutstanding = Math.floor((today - new Date(customer.createdAt)) / (1000 * 60 * 60 * 24));
      const balance = customer.closingBalance || 0;

      let ageCategory = "current0_30";
      if (daysOutstanding > 90) ageCategory = "agingOver90";
      else if (daysOutstanding > 60) ageCategory = "aging61_90";
      else if (daysOutstanding > 30) ageCategory = "aging31_60";

      arAging.summary[ageCategory] += balance;
      arAging.summary.totalAR += balance;

      arAging.customers.push({
        customerId: customer._id,
        customerName: customer.name,
        balance: balance,
        daysOutstanding: daysOutstanding,
        ageCategory: ageCategory,
        lastOrderDate: customer.updatedAt
      });
    });

    return res.json(arAging);
  } catch (error) {
    console.error("Error generating AR aging:", error);
    return res.status(500).json({
      success: false,
      message: "Error generating AR aging report"
    });
  }
});

/**
 * Accounts Payable (Vendor) Aging Report
 * Shows vendor balances aged by days outstanding
 */
router.get("/ap-aging", async (req, res) => {
  try {
    const vendors = await Vendor.find({ closingBalance: { $gt: 0 } });

    const apAging = {
      success: true,
      reportDate: new Date().toLocaleDateString(),
      summary: {
        current0_30: 0,
        aging31_60: 0,
        aging61_90: 0,
        agingOver90: 0,
        totalAP: 0
      },
      vendors: []
    };

    const today = new Date();

    vendors.forEach(vendor => {
      const daysOutstanding = Math.floor((today - new Date(vendor.createdAt)) / (1000 * 60 * 60 * 24));
      const balance = vendor.closingBalance || 0;

      let ageCategory = "current0_30";
      if (daysOutstanding > 90) ageCategory = "agingOver90";
      else if (daysOutstanding > 60) ageCategory = "aging61_90";
      else if (daysOutstanding > 30) ageCategory = "aging31_60";

      apAging.summary[ageCategory] += balance;
      apAging.summary.totalAP += balance;

      apAging.vendors.push({
        vendorId: vendor._id,
        vendorName: vendor.name,
        balance: balance,
        daysOutstanding: daysOutstanding,
        ageCategory: ageCategory,
        lastOrderDate: vendor.updatedAt
      });
    });

    return res.json(apAging);
  } catch (error) {
    console.error("Error generating AP aging:", error);
    return res.status(500).json({
      success: false,
      message: "Error generating AP aging report"
    });
  }
});

/**
 * General Ledger (detailed account transactions)
 * Shows all transactions for a specific GL account
 */
router.get("/general-ledger/:accountCode", async (req, res) => {
  try {
    const { accountCode } = req.params;
    const { financialYear = "2025-2026" } = req.query;

    const glAccount = await GeneralLedger.findOne({
      accountCode,
      financialYear
    });

    if (!glAccount) {
      return res.status(404).json({
        success: false,
        message: "Account not found"
      });
    }

    return res.json({
      success: true,
      account: {
        accountCode: glAccount.accountCode,
        accountName: glAccount.accountName,
        accountType: glAccount.accountType,
        openingBalance: glAccount.openingBalance,
        currentBalance: glAccount.currentBalance,
        totalDebits: glAccount.totalDebits,
        totalCredits: glAccount.totalCredits
      }
    });
  } catch (error) {
    console.error("Error fetching GL account:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching account details"
    });
  }
});

/**
 * Chart of Accounts (list all accounts)
 */
router.get("/chart-of-accounts", async (req, res) => {
  try {
    const { financialYear = "2025-2026" } = req.query;

    const coa = await ChartOfAccounts.find({ financialYear, isActive: true })
      .sort({ accountCode: 1 });

    const formatted = {
      success: true,
      financialYear,
      reportDate: new Date().toLocaleDateString(),
      accountsByType: {
        ASSET: coa.filter(a => a.accountType === "ASSET"),
        LIABILITY: coa.filter(a => a.accountType === "LIABILITY"),
        EQUITY: coa.filter(a => a.accountType === "EQUITY"),
        INCOME: coa.filter(a => a.accountType === "INCOME"),
        EXPENSE: coa.filter(a => a.accountType === "EXPENSE")
      },
      total: coa.length
    };

    return res.json(formatted);
  } catch (error) {
    console.error("Error fetching COA:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching chart of accounts"
    });
  }
});

/**
 * DEBUG: Get all GL accounts with full data
 */
router.get("/debug/gl-accounts", async (req, res) => {
  try {
    const glAccounts = await GeneralLedger.find({});
    
    return res.json({
      success: true,
      count: glAccounts.length,
      accounts: glAccounts.map(acc => ({
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        financialYear: acc.financialYear,
        openingBalance: acc.openingBalance,
        currentBalance: acc.currentBalance,
        totalDebits: acc.totalDebits,
        totalCredits: acc.totalCredits,
        debitCount: acc.debitCount,
        creditCount: acc.creditCount,
        lastTransactionDate: acc.lastTransactionDate,
        lastTransactionAmount: acc.lastTransactionAmount
      }))
    });
  } catch (error) {
    console.error("Error fetching GL accounts:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching GL accounts"
    });
  }
});

/**
 * DEBUG: Get all Journal Entries
 */
router.get("/debug/journal-entries", async (req, res) => {
  try {
    const entries = await JournalEntry.find({}).sort({ journalDate: -1 }).limit(20);
    
    return res.json({
      success: true,
      count: entries.length,
      entries: entries.map(je => ({
        jeId: je.jeId,
        referenceModule: je.referenceModule,
        referenceDocumentNumber: je.referenceDocumentNumber,
        journalDate: je.journalDate,
        description: je.description,
        financialYear: je.financialYear,
        totalDebit: je.totalDebit,
        totalCredit: je.totalCredit,
        isBalanced: je.isBalanced,
        status: je.status,
        lineItemsCount: je.lineItems?.length || 0,
        lineItems: je.lineItems
      }))
    });
  } catch (error) {
    console.error("Error fetching JE:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching journal entries"
    });
  }
});

/**
 * Day Book Aggregation
 * Shows all Sales (Debit) and Purchase (Credit) transactions in one place
 */
router.get("/day-book", async (req, res) => {
  try {
    const { branchId, fromDate, toDate } = req.query;
    if (!branchId) {
      return res.status(400).json({ success: false, message: "Branch ID is required" });
    }

    const dateFilter = {};
    if (fromDate || toDate) {
      if (fromDate) {
        // Align to 00:00 IST (which is 18:30 UTC of previous day)
        const dateArr = fromDate.split("-").map(Number);
        const startIST = new Date(Date.UTC(dateArr[0], dateArr[1]-1, dateArr[2], 0, 0, 0));
        startIST.setMinutes(startIST.getMinutes() - 330); 
        dateFilter.$gte = startIST;
      }
      if (toDate) {
        // Align to 23:59:59 IST
        const dateArr = toDate.split("-").map(Number);
        const endIST = new Date(Date.UTC(dateArr[0], dateArr[1]-1, dateArr[2], 23, 59, 59, 999));
        endIST.setMinutes(endIST.getMinutes() - 330); 
        dateFilter.$lte = endIST;
      }
    }

    // 1. Fetch Sales Orders (excluding CANCELLED)
    const sales = await SalesOrder.find({
      branchId,
      status: { $ne: "CANCELLED" },
      ...(fromDate || toDate ? { orderDate: dateFilter } : {})
    }).select("invoiceId salesInvoiceId customer voucherType status grandTotal orderDate createdAt");

    // 2. Fetch Purchase Orders (using PO model if exists, or status logic)
    const PurchaseOrder = mongoose.model("PurchaseOrder");
    const purchaseOrders = await PurchaseOrder.find({
      branchId,
      status: { $ne: "CANCELLED" },
      ...(fromDate || toDate ? { date: dateFilter } : {})
    }).select("invoiceId purchaseInvoiceId vendor status grandTotal date createdAt");

    // 3. Fetch Purchase Invoices
    const purchaseInvoices = await PurchaseInvoice.find({
      branchId,
      ...(fromDate || toDate ? { 
        $or: [
          { vendorDate: dateFilter },
          { invoiceDate: dateFilter }
        ]
      } : {})
    }).select("purchaseInvoiceId vendor voucherType grandTotal vendorDate invoiceDate createdAt");

    // 4. Fetch Credit Notes (Sales Returns)
    const CreditNote = mongoose.model("CreditNote");
    const creditNotes = await CreditNote.find({
      ...(fromDate || toDate ? { createdAt: dateFilter } : {})
    }).populate({
      path: "originalSalesOrderId",
      match: { branchId } // Filtering by branch via the SO
    });
    // Filter out credit notes that don't belong to this branch
    const filteredCreditNotes = creditNotes.filter(cn => cn.originalSalesOrderId);

    // 5. Fetch Receipts
    const receipts = await Receipt.find({
      branchId,
      ...(fromDate || toDate ? { createdAt: dateFilter } : {})
    }).select("receiptId customer amount createdAt");

    // 6. Fetch Payments
    const payments = await Payment.find({
      branchId,
      ...(fromDate || toDate ? { createdAt: dateFilter } : {})
    }).select("paymentId vendor expenseDetails amount createdAt");

    // 7. Fetch Debit Notes (Purchase Returns)
    const debitNotes = await DebitNote.find({
      branchId,
      ...(fromDate || toDate ? { createdAt: dateFilter } : {})
    }).select("debitNoteId vendor grandTotal createdAt text");

    // Combine and Transform
    const dayBook = [
      ...sales.map(s => ({
        _id: s._id,
        date: s.orderDate || s.createdAt,
        name: s.customer?.name || "Cash Customer",
        voucherType: s.status === "INVOICED" ? "SI" : "SO",
        invoiceId: s.status === "INVOICED" ? s.salesInvoiceId || s.invoiceId : s.invoiceId,
        debit: s.grandTotal || 0,
        credit: 0,
        type: "SALE",
        status: s.status
      })),
      ...purchaseOrders.map(po => ({
        _id: po._id,
        date: po.date || po.createdAt,
        name: po.vendor || "Supplier",
        voucherType: po.status === "INVOICED" ? "PI" : "PO",
        invoiceId: po.status === "INVOICED" ? po.purchaseInvoiceId || po.invoiceId : po.invoiceId,
        debit: 0,
        credit: po.grandTotal || 0,
        type: "PURCHASE",
        status: po.status
      })),
      ...purchaseInvoices.map(p => ({
        _id: p._id,
        date: p.vendorDate || p.invoiceDate || p.createdAt,
        name: p.vendor || "N/A",
        voucherType: p.voucherType || "PI",
        invoiceId: p.purchaseInvoiceId,
        debit: 0,
        credit: p.grandTotal || 0,
        type: "PURCHASE",
        status: "INVOICED"
      })),
      ...filteredCreditNotes.map(cn => ({
        _id: cn._id,
        date: cn.createdAt,
        name: cn.customer?.name || "Customer",
        voucherType: "CN",
        invoiceId: cn.creditNoteId,
        debit: 0,
        credit: cn.grandTotal || 0, // A reduction in sales is a credit entry
        type: "CREDIT_NOTE"
      })),
      ...receipts.map(r => ({
        _id: r._id,
        date: r.createdAt,
        name: r.customer?.name || "Customer",
        voucherType: "REC",
        invoiceId: r.receiptId,
        debit: r.amount || 0,
        credit: 0,
        type: "RECEIPT"
      })),
      ...payments.map(p => ({
        _id: p._id,
        date: p.createdAt,
        name: p.vendor?.name || p.expenseDetails?.personName || "N/A",
        voucherType: "PAY",
        invoiceId: p.paymentId,
        debit: 0,
        credit: p.amount || 0,
        type: "PAYMENT"
      })),
      ...debitNotes.map(dn => ({
        _id: dn._id,
        date: dn.createdAt,
        name: dn.vendor?.name || "N/A",
        voucherType: "DN",
        invoiceId: dn.debitNoteId,
        debit: dn.grandTotal || 0, // A reduction in purchase is a debit entry
        credit: 0,
        type: "DEBIT_NOTE"
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      data: dayBook,
      count: dayBook.length
    });
  } catch (error) {
    console.error("Day Book Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch Day Book data",
      error: error.message 
    });
  }
});

/**
 * Upcoming Orders (Future Dated)
 * Fetches SOs and POs with date > today
 */
router.get("/upcoming-orders", async (req, res) => {
  try {
    const { branchId } = req.query;
    if (!branchId) return res.status(400).json({ success: false, message: "branchId is required" });

    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    const [upcomingSales, upcomingPurchases] = await Promise.all([
      SalesOrder.find({
        branchId,
        orderDate: { $gt: today },
        status: { $ne: "CANCELLED" }
      }).select("invoiceId customer orderDate status"),
      
      mongoose.model("PurchaseOrder").find({
        branchId,
        date: { $gt: today },
        status: { $ne: "CANCELLED" }
      }).select("invoiceId vendor date status")
    ]);

    const allUpcoming = [
      ...upcomingSales.map(s => ({
        id: s.invoiceId,
        _id: s._id,
        date: s.orderDate,
        name: s.customer?.name || "Customer",
        type: "SO",
        status: s.status
      })),
      ...upcomingPurchases.map(p => ({
        id: p.invoiceId,
        _id: p._id,
        date: p.date,
        name: p.vendor || "Supplier",
        type: "PO",
        status: p.status
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      success: true,
      data: allUpcoming
    });
  } catch (error) {
    console.error("Upcoming Orders Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch upcoming orders" });
  }
});

export default router;
