# Zoho ERP Finance Flow - Complete Implementation Guide

## 📊 Overview

This document explains the complete Zoho-like ERP finance flow implemented in Pearls ERP system. The system automates all financial transactions, journal entry posting, and financial report generation.

---

## 🏗️ Architecture & Components

### 1. **Core Models Created**

#### ChartOfAccounts (GL Account Master)
- Contains all GL accounts in the system
- Fields: accountCode, accountName, accountType, openingBalance, currentBalance
- Account Types: ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
- Sub-Types for detailed categorization (CURRENT_ASSET, CASH_BANK, INVENTORY, etc.)
- GST support: isGstAccount, gstType (SGST, CGST, IGST)
- Financial Year tracking

#### JournalEntry
- Records all debit/credit entries posted to GL
- Linked to source documents (SO, CN, PO, DN)
- Contains lineItems array with complete transaction details
- Status tracking: DRAFT, POSTED
- Automatic balance validation (debit = credit)

#### GeneralLedger
- Aggregated balance for each GL account
- Maintains: openingBalance, currentBalance, totalDebits, totalCredits
- Period-wise breakdown for monthly reports
- AR/AP aging information
- Last transaction tracking

### 2. **Finance Service (GLService)**

Comprehensive utility service for all GL operations:

**Key Methods:**
- `postSalesOrderJE()` - Post SO to GL
- `postCreditNoteJE()` - Post CN reversal
- `postPurchaseOrderJE()` - Post PO to GL
- `postDebitNoteJE()` - Post DN reversal
- `getTrialBalance()` - Generate trial balance report
- `getBalanceSheet()` - Generate balance sheet
- `getProfitLoss()` - Generate P&L statement

---

## 💰 Complete Transaction Flow

### **SCENARIO 1: Sales Order (SO) - Customer purchases goods**

#### Before: Issues Fixed
- ❌ Inventory was NOT reduced
- ❌ Customer balance was NOT updated
- ❌ GL entries were NOT posted

#### After: Complete Implementation

**STEP 1: Create Sales Order**
```
Inputs:
- Customer ID
- Items (productId, qty, rate, tax)
- Grand Total = ₹1000 (net of tax)
- Tax = ₹180 (GST)

Process:
1. Reduce Inventory by order quantity
   Product.totalQty -= 100 units

2. Update Customer Balance (AR)
   Customer.closingBalance += ₹1000
   (openingBalance was ₹0, now ₹1000 = AR owed by customer)

3. POST JOURNAL ENTRY:
   Debit:  AR Account (1101)          ₹1080 (including GST)
   Credit: Sales Revenue (4001)       ₹1000
   Credit: Output GST Payable (2101)  ₹80
   
   Result: GL entries created automatically
```

**GL Impact:**
```
Assets:        AR increases by ₹1080 (customer owes money)
Liabilities:   GST Payable increases by ₹80 (must pay government)
Income:        Sales Revenue increases by ₹1000 (recognized)
Inventory:     Stock decreases by 100 units (Physical verification)
```

---

### **SCENARIO 2: Credit Note (CN) - Customer returns goods**

#### Transaction: Customer returns ₹500 worth of goods

**Process:**
```
1. Increase Inventory by returned quantity
   Product.totalQty += 50 units

2. Reduce Customer Balance (AR reversal)
   reducedBalance = ₹1000 - ₹500 = ₹500
   Customer.closingBalance = ₹500

3. POST REVERSAL JOURNAL ENTRY:
   Debit:  Sales Revenue (4001)           ₹500 (reverse revenue)
   Debit:  Output GST Payable (2101)      ₹40  (reverse tax)
   Credit: AR Account (1101)              ₹540 (reduce customer debt)
   
   Effect: Reverses the SO entry proportionally
```

**GL Impact:**
```
Assets:        AR decreases by ₹540 (customer owes less)
Liabilities:   GST Payable decreases by ₹40 (less tax to pay)
Income:        Sales Revenue decreases by ₹500 (revenue reversed)
Inventory:     Stock increases by 50 units
```

**Result: SO and CN balance each other perfectly**
- SO: +₹1000 revenue, +₹1080 AR
- CN: -₹500 revenue, -₹540 AR
- Net: ₹500 revenue, ₹540 AR ✓

---

### **SCENARIO 3: Purchase Order (PO) - Buying goods from vendor**

#### Transaction: Purchase ₹2000 goods from vendor (₹160 GST)

**Process:**
```
1. Increase Inventory (Asset)
   Product.totalQty += 200 units

2. UPDATE VENDOR BALANCE (AP - new feature!)
   openingBalance was ₹0, now:
   Vendor.closingBalance += ₹2000
   (we owe vendor ₹2000)

3. POST JOURNAL ENTRY:
   Debit:  Inventory (1201)              ₹2000 (purchase assets)
   Debit:  Input GST Receivable (1301)   ₹160  (tax credit)
   Credit: AP Account (2001)             ₹2160 (vendor liability)
   
   Effect: Standard purchase accounting entry
```

**GL Impact:**
```
Assets:        Inventory increases by ₹2000
Assets:        GST Receivable increases by ₹160 (we can claim credit)
Liabilities:   AP increases by ₹2160 (we owe vendor)
```

---

### **SCENARIO 4: Debit Note (DN) - Returning purchased goods**

#### Transaction: Return ₹1000 goods to vendor (₹80 GST)

**Process:**
```
1. Reduce Inventory
   Product.totalQty -= 100 units

2. REDUCE VENDOR BALANCE (AP reversal)
   newClosingBalance = ₹2000 - ₹1000 = ₹1000
   Vendor.closingBalance = ₹1000

3. POST REVERSAL JOURNAL ENTRY:
   Debit:  AP Account (2001)             ₹1080 (reduce liability)
   Credit: Inventory (1201)              ₹1000 (reverse asset)
   Credit: Input GST Receivable (1301)   ₹80   (reverse tax credit)
   
   Effect: Reverses the PO entry
```

**GL Impact:**
```
Assets:        Inventory decreases by ₹1000
Assets:        GST Receivable decreases by ₹80
Liabilities:   AP decreases by ₹1080 (we owe less)
```

---

## 📊 Financial Reports Generated

### **1. Trial Balance**
- Lists all GL accounts with debit/credit balances
- Validates: Total Debits = Total Credits
- Used for financial statement preparation

**Example Output:**
```json
{
  "accounts": [
    {
      "accountCode": "1001",
      "accountName": "Cash",
      "accountType": "ASSET",
      "debit": 50000,
      "credit": 0,
      "balance": 50000
    },
    {
      "accountCode": "1101",
      "accountName": "Accounts Receivable",
      "accountType": "ASSET",
      "debit": 540,
      "credit": 0,
      "balance": 540
    },
    {
      "accountCode": "4001",
      "accountName": "Sales Revenue",
      "accountType": "INCOME",
      "debit": 0,
      "credit": 500,
      "balance": -500
    }
  ],
  "totalDebits": 50540,
  "totalCredits": 50540
}
```

### **2. Balance Sheet (Assets = Liabilities + Equity)**

**Current Assets:**
- Cash & Bank: ₹50,000
- Accounts Receivable: ₹540
- Inventory: ₹3,000
- GST Receivable: ₹80

**Current Liabilities:**
- Accounts Payable: ₹1,080
- Output GST Payable: ₹40

**Equity:**
- Owner's Capital: ₹50,000
- Retained Earnings: ₹2,500

**Validation:** Assets (₹53,620) = Liabilities (₹1,120) + Equity (₹52,500) ✓

### **3. Profit & Loss Statement**

**Revenue:**
- Sales Revenue: ₹500 (after CR Note reversal)

**Expenses:**
- None (for this scenario)

**Net Profit:** ₹500 ✓

### **4. AR Aging (Customer Receivables)**

```json
{
  "summary": {
    "current0_30": 540,      // Due within 30 days
    "aging31_60": 0,         // Due 31-60 days
    "aging61_90": 0,         // Due 61-90 days
    "agingOver90": 0,        // Due over 90 days
    "totalAR": 540
  },
  "customers": [
    {
      "customerId": "...",
      "customerName": "ABC Corp",
      "balance": 540,
      "daysOutstanding": 15,
      "ageCategory": "current0_30"
    }
  ]
}
```

### **5. AP Aging (Vendor Payables)**

```json
{
  "summary": {
    "current0_30": 1080,     // Pay within 30 days
    "totalAP": 1080
  },
  "vendors": [
    {
      "vendorId": "...",
      "vendorName": "XYZ Supplies",
      "balance": 1080,
      "daysOutstanding": 10,
      "ageCategory": "current0_30"
    }
  ]
}
```

---

## 🔄 API Endpoints

### **Chart of Accounts:**
```
POST   /api/chart-of-accounts/initialize     Initialize COA for FY
GET    /api/chart-of-accounts/by-type/:type  Get accounts by type
GET    /api/chart-of-accounts/:accountCode   Get single account
POST   /api/chart-of-accounts                Create custom account
```

### **Financial Reports:**
```
GET    /api/financial-reports/trial-balance  Trial Balance
GET    /api/financial-reports/balance-sheet  Balance Sheet
GET    /api/financial-reports/profit-loss    P&L Statement
GET    /api/financial-reports/ar-aging       AR Aging Report
GET    /api/financial-reports/ap-aging       AP Aging Report
GET    /api/financial-reports/chart-of-accounts  COA List
```

### **Transaction Endpoints (Updated):**
```
POST   /api/sales-orders                      Create SO (with GL posting)
POST   /api/credit-notes                      Create CN (with GL posting)
POST   /api/purchase-orders                   Create PO (with GL posting)
POST   /api/debit-notes                       Create DN (with GL posting)
```

---

## 🚀 Quick Start Implementation

### **Step 1: Initialize Chart of Accounts**
```bash
POST /api/chart-of-accounts/initialize
Body: { "financialYear": "2025-26" }
```

### **Step 2: Create SO**
```bash
POST /api/sales-orders
Body: {
  "customer": { "id": "...", "name": "ABC Corp" },
  "items": [{ "productId": "...", "qty": 100, "rate": 10 }],
  "voucherType": "sales_order",
  ...
}

Auto-triggered:
1. Inventory reduced
2. Customer balance updated
3. Journal entry posted to GL
```

### **Step 3: View Financial Reports**
```bash
GET /api/financial-reports/trial-balance?financialYear=2025-26
GET /api/financial-reports/balance-sheet?financialYear=2025-26
GET /api/financial-reports/profit-loss?financialYear=2025-26
GET /api/financial-reports/ar-aging
GET /api/financial-reports/ap-aging
```

---

## ✅ Implementation Checklist

- [x] **Model Creation**
  - [x] ChartOfAccounts model
  - [x] JournalEntry model
  - [x] GeneralLedger model

- [x] **GL Service**
  - [x] SO journal entry posting
  - [x] CN reversal posting
  - [x] PO journal entry posting
  - [x] DN reversal posting
  - [x] Trial Balance generation
  - [x] Balance Sheet generation
  - [x] P&L generation

- [x] **SO Route Updates**
  - [x] Inventory reduction on SO create
  - [x] Customer balance update
  - [x] GL posting integration

- [x] **CN Route Updates**
  - [x] GL posting for reversals

- [x] **PO Route Updates**
  - [x] Vendor AP balance tracking (NEW!)
  - [x] GL posting integration

- [x] **DN Route Updates**
  - [x] Vendor AP balance reduction
  - [x] GL posting integration

- [x] **Report Routes**
  - [x] Trial Balance endpoint
  - [x] Balance Sheet endpoint
  - [x] P&L endpoint
  - [x] AR Aging endpoint
  - [x] AP Aging endpoint
  - [x] COA List endpoint

- [x] **COA Routes**
  - [x] Initialize COA
  - [x] Get accounts by type
  - [x] Create custom account

- [x] **Server Integration**
  - [x] New routes registered
  - [x] Imports configured

---

## 📈 Accounting Principles Applied

### **Double-Entry Bookkeeping**
Every transaction has equal debit and credit entries.

**Example SO:**
- Debit: AR (Asset increased) = ₹1080
- Credit: Sales Revenue = ₹1000
- Credit: GST Payable = ₹80

### **Account Classification**
- **Normal Debit Accounts:** Assets, Expenses
- **Normal Credit Accounts:** Liabilities, Equity, Income

### **Balance Calculation**
- Assets: Debit - Credit = Balance
- Liabilities: Credit - Debit = Balance
- Equity: Credit - Debit = Balance
- Income: Credit - Debit = Balance
- Expenses: Debit - Credit = Balance

### **GST Compliance**
- Input GST (on purchases): Asset (can claim credit)
- Output GST (on sales): Liability (must pay government)
- Automatic GST tracking and reconciliation

---

## 🔒 Features Included

✅ **Automatic GL Posting:** Journal entries created automatically on transaction creation
✅ **Balance Tracking:** Real-time customer AR and vendor AP balances
✅ **Inventory Sync:** Automatic inventory updates on SO/PO/CN/DN
✅ **Financial Reports:** Trial Balance, BS, P&L fully automated
✅ **AR/AP Aging:** Know which customers/vendors are overdue
✅ **GST Compliance:** Separate tracking of input and output GST
✅ **Audit Trail:** Complete journal entry history
✅ **Multi-FY Support:** Handle multiple financial years
✅ **Error Handling:** Non-blocking GL failures don't stop transactions
✅ **Reversing Entries:** CN and DN automatically reverse GL entries

---

## 🎯 Next Steps

### Phase 2 (Not yet implemented):
- [ ] Payment reconciliation (match payments to AR/AP)
- [ ] Bank reconciliation
- [ ] GSTR reports (GST return filing)
- [ ] RBAC (Role-Based Access Control)
- [ ] Approval workflows
- [ ] Budget vs. Actual analysis
- [ ] Cash flow forecasting
- [ ] Recurring transactions
- [ ] Multi-currency support

---

## 📞 Support

For questions or issues with the finance flow, refer to:
1. GLService utility (/backend/utils/glService.js)
2. Individual route handlers
3. Model definitions for database schema

The system is production-ready for basic ERP finance needs and can be extended as required.
