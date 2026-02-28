# 🎨 Pearls ERP - UI & Flow Architecture

## Current UI Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    PEARLS ERP FRONTEND (React)                  │
│                     src/ Directory Structure                    │
└─────────────────────────────────────────────────────────────────┘

src/
├── App.jsx ............................ Main router & layout
├── api.js ............................. API endpoints config
├── main.jsx ........................... React entry point
├── index.css .......................... Global styles
├── App.css ............................ App styles
│
├── pages/ ............................ All page components
│   ├── Home.jsx ....................... Dashboard home
│   ├── HrLogin.jsx .................... HR staff login
│   ├── CustomerLogin.jsx .............. Customer portal login
│   ├── HRControlPanel.jsx ............. HR management
│   ├── EmployeesBookPage.jsx .......... Employees ledger
│   ├── EmployeeDashboardPage.jsx ...... Employee dashboard
│   ├── CRMPage.jsx .................... CRM module
│   ├── DispatchSheetPage.jsx .......... Dispatch tracking
│   ├── PearlsBookPage.jsx ............. General ledger view
│   ├── PearlsShopping.jsx ............. Customer shopping portal
│   ├── ProductSummary.jsx ............. Product reports
│   ├── CustomerSummary.jsx ............ Customer reports
│   ├── VendorSummary.jsx .............. Vendor reports
│   ├── ProductGroupSummary.jsx ........ Product group reports
│   ├── VoucherTypeSummary.jsx ......... Voucher type reports
│   ├── WarehouseSummary.jsx ........... Warehouse reports
│   ├── OthersSummary.jsx .............. Other summaries
│   │
│   └── inventory/ ..................... Transaction entry pages
│       ├── InventorySalesOrder.jsx .... SO creation & entry
│       └── InventoryPurchaseOrder.jsx . PO creation & entry
│
├── components/ ....................... All React components
│   ├── Sidebar.jsx .................... Left navigation menu
│   ├── Topbar.jsx ..................... Header bar
│   ├── ProductCard.jsx ................ Product display card
│   │
│   └── inventory/ ..................... Transaction modals & forms
│       ├── InventorySalesOrderHeader.jsx ... SO header form
│       ├── InventorySalesOrderEntry.jsx ... SO item entry rows
│       ├── InventoryPurchaseOrderHeader.jsx  PO header form
│       ├── InventoryPurchaseOrderEntry.jsx  PO item entry rows
│       ├── CreditNoteModal.jsx ........ CN creation dialog
│       ├── DebitNoteModal.jsx ......... DN creation dialog
│       ├── PaymentModal.jsx ........... Payment entry dialog
│       ├── SalesReceiptModal.jsx ...... Sales receipt dialog
│       ├── InventoryAddCustomerModal.jsx ... Add customer dialog
│       ├── InventoryAddProductModal.jsx ... Add product dialog
│       ├── InventoryAddVendorModal.jsx ... Add vendor dialog
│       ├── InventoryAddProductGroupModal.jsx
│       ├── InventoryAddVoucherTypeModal.jsx
│       ├── InventoryAddWarehouseModal.jsx
│       ├── InventoryAddSalesManModal.jsx
│       ├── InventoryAddDeliveryManModal.jsx
│       └── InventoryAddSalesOwnerModal.jsx
│
└── context/ .......................... State management
    └── InventoryContext.jsx .......... Shared inventory state
```

---

## 🔄 Complete User Flow - Current Implementation

```
┌──────────────────┐
│   USER LANDS     │
│   home page      │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│    SIDEBAR NAVIGATION (Left Menu)    │
├──────────────────────────────────────┤
│                                      │
│ ├─ 📊 Dashboard (Home)              │
│ ├─ 📦 Inventory                     │
│ │  ├─ Sales Order                   │
│ │  └─ Purchase Order                │
│ ├─ 👥 Sales CRM                     │
│ ├─ 📋 Dispatch Sheet                │
│ ├─ 👨 HR Control                    │
│ ├─ 📚 Employees Book                │
│ ├─ 🛒 Pearls Shopping               │
│ └─ 📑 Reports                       │
│    ├─ Products                      │
│    ├─ Customers                     │
│    ├─ Vendors                       │
│    ├─ Product Groups                │
│    └─ Voucher Types                 │
│                                      │
└──────────────────────────────────────┘
         │
         ▼
    [USER SELECTS MODULE]
         │
    ┌────┴────┬─────────┬──────────┬─────────────┐
    │          │         │          │             │
    ▼          ▼         ▼          ▼             ▼
  Sales      Orders   Dispatch   HR Panel    Reports
  Order      (PO)     Sheet      Module      Summaries
```

---

## 📊 Sales Order Flow (Currently Implemented)

```
User goes to "Inventory" → "Sales Order"
                               │
                               ▼
┌─────────────────────────────────────────────┐
│     InventorySalesOrder Page                │
│     (src/pages/inventory/...)               │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 1. SO HEADER (Top Section)          │   │
│  │ InventorySalesOrderHeader.jsx       │   │
│  │                                     │   │
│  │ ├─ Invoice Number (Auto-gen)        │   │
│  │ ├─ Warehouse Selection              │   │
│  │ ├─ Voucher Type (SO-2026-001)       │   │
│  │ ├─ Customer Selection               │   │
│  │ ├─ Salesman Selection               │   │
│  │ ├─ Order Date                       │   │
│  │ ├─ Delivery Address                 │   │
│  │ └─ Notes                            │   │
│  └─────────────────────────────────────┘   │
│           │                                 │
│           ▼                                 │
│  ┌─────────────────────────────────────┐   │
│  │ 2. SO LINE ITEMS (Bottom Section)   │   │
│  │ InventorySalesOrderEntry.jsx        │   │
│  │ (Multiple Rows)                     │   │
│  │                                     │   │
│  │ Each Row:                           │   │
│  │ ├─ Product Selection                │   │
│  │ ├─ Quantity                         │   │
│  │ ├─ Unit Price (auto-populate)       │   │
│  │ ├─ Tax %                            │   │
│  │ └─ Amount (auto-calculate)          │   │
│  │                                     │   │
│  │ Totals (Bottom):                    │   │
│  │ ├─ Subtotal                         │   │
│  │ ├─ Tax Total                        │   │
│  │ └─ Grand Total                      │   │
│  └─────────────────────────────────────┘   │
│           │                                 │
└───────────┼─────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────┐
│  3. USER CLICKS "SAVE & POST"               │
│     (or one click option)                   │
└─────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────┐
│  BACKEND PROCESSING (Node.js)               │
│  salesOrderRoutes.js (POST /sales-orders)   │
├─────────────────────────────────────────────┤
│                                             │
│  ✓ Save SO document to DB                  │
│  ✓ Reduce Product inventory (qty)          │
│  ✓ Update Customer AR balance              │
│  ✓ Post Journal Entry to GL                │
│    • Debit AR (Accounts Receivable)         │
│    • Credit Sales Revenue                  │
│    • Credit GST Payable                    │
│  ✓ Return success response                 │
│                                             │
└─────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────┐
│  4. CONFIRMATION MESSAGE                    │
│  "SO-2026-001 Created Successfully!"        │
│                                             │
│  ✓ SO in DB with inventory reduced         │
│  ✓ Customer AR balance increased           │
│  ✓ GL Posted (Debit=Credit ✓)              │
│  ✓ Ready for Credit Note or Invoice Print  │
└─────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────┐
│  5. AVAILABLE ACTIONS (Modal Buttons)       │
│                                             │
│  ├─ 📄 Print Invoice                       │
│  ├─ 📝 Create Credit Note                  │
│  │   (CreditNoteModal.jsx opens)          │
│  ├─ 🔄 Create Return                       │
│  ├─ 💰 Record Payment                      │
│  └─ ❌ Cancel Order                        │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 💳 Credit Note Flow (Currently Implemented)

```
User opens SO → Click "Create Credit Note"
            │
            ▼
┌────────────────────────────────────┐
│  CreditNoteModal.jsx opens         │
├────────────────────────────────────┤
│                                    │
│  ┌──────────────────────────────┐  │
│  │ Credit Note Form:            │  │
│  │                              │  │
│  │ ├─ SO Reference (auto-fill)  │  │
│  │ ├─ CN Voucher Type           │  │
│  │ ├─ CN Date                   │  │
│  │ ├─ Reason for Return         │  │
│  │ └─ Items to Return (select)  │  │
│  │    ├─ Product 1: -50 units   │  │
│  │    └─ Product 2: -30 units   │  │
│  │                              │  │
│  │ CN Total (calc auto)         │  │
│  └──────────────────────────────┘  │
│           │                         │
└───────────┼─────────────────────────┘
            │
            ▼
     User clicks "Save CN"
            │
            ▼
┌────────────────────────────────────┐
│  BACKEND PROCESSING                │
│  creditNoteRoutes.js               │
├────────────────────────────────────┤
│                                    │
│  ✓ Create CN document              │
│  ✓ Increase Product inventory      │
│  ✓ Reduce Customer AR balance      │
│  ✓ Post GL Reversal Entry          │
│    • Debit Sales Revenue (reverse) │
│    • Debit GST Payable (reverse)   │
│    • Credit AR (reverse)           │
│  ✓ Return response                 │
│                                    │
└────────────────────────────────────┘
            │
            ▼
      ✅ CN Created & Posted
```

---

## ❌ Purchase Order Flow (Currently Implemented)

```
User navigates to "Inventory" → "Purchase Order"
            │
            ▼
     InventoryPurchaseOrder Page
            │
            ▼
┌────────────────────────────────────┐
│  1. PO HEADER (Top)                │
│  InventoryPurchaseOrderHeader.jsx  │
├────────────────────────────────────┤
│  ├─ PO Number (auto-gen)           │
│  ├─ Vendor Selection               │
│  ├─ Warehouse                      │
│  ├─ Order Date                     │
│  └─ Delivery Terms                 │
└────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────┐
│  2. PO LINE ITEMS                  │
│  InventoryPurchaseOrderEntry.jsx   │
├────────────────────────────────────┤
│  Multiple rows:                    │
│  ├─ Product                        │
│  ├─ Quantity                       │
│  ├─ Unit Price (from vendor)       │
│  └─ Amount                         │
└────────────────────────────────────┘
            │
            ▼
     User clicks "Save PO"
            │
            ▼
┌────────────────────────────────────┐
│  BACKEND PROCESSING                │
│  purchaseOrderRoutes.js            │
├────────────────────────────────────┤
│                                    │
│  ✓ Save PO document                │
│  ✓ Increase Product inventory      │
│  ✓ Update Vendor AP balance        │
│  ✓ Post GL Entry                   │
│    • Debit Inventory               │
│    • Debit GST Receivable          │
│    • Credit AP (Payables)          │
│  ✓ Return response                 │
│                                    │
└────────────────────────────────────┘
            │
            ▼
     ✅ PO Created & Posted
```

---

## 💰 Debit Note Flow (Currently Implemented)

```
User opens PO → Click "Create Debit Note"
            │
            ▼
┌────────────────────────────────────┐
│  DebitNoteModal.jsx opens          │
├────────────────────────────────────┤
│  DN Form:                          │
│  ├─ PO Reference                   │
│  ├─ Items to Return (select)       │
│  └─ Reason                         │
└────────────────────────────────────┘
            │
            ▼
     User clicks "Save DN"
            │
            ▼
┌────────────────────────────────────┐
│  BACKEND PROCESSING                │
│  debitNoteRoutes.js                │
├────────────────────────────────────┤
│                                    │
│  ✓ Create DN document              │
│  ✓ Decrease Product inventory      │
│  ✓ Reduce Vendor AP balance        │
│  ✓ Post GL Reversal Entry          │
│    • Debit AP (reverse)            │
│    • Credit Inventory (reverse)    │
│    • Credit GST Receivable         │
│  ✓ Return response                 │
│                                    │
└────────────────────────────────────┘
            │
            ▼
      ✅ DN Created & Posted
```

---

## 📊 MISSING UI - Financial Reports

```
❌ NOT YET IMPLEMENTED - Need to Create These Pages:

Backend API Endpoints Created: ✓
├─ /api/financial-reports/trial-balance
├─ /api/financial-reports/balance-sheet
├─ /api/financial-reports/profit-loss
├─ /api/financial-reports/ar-aging
├─ /api/financial-reports/ap-aging
├─ /api/financial-reports/general-ledger/:accountCode
└─ /api/chart-of-accounts

Frontend Pages Needed: ❌
├─ TrialBalancePage.jsx
│  └─ Display all GL accounts with Debit/Credit columns
│     Verify Total Debit = Total Credit
│
├─ BalanceSheetPage.jsx
│  └─ Display Assets / Liabilities / Equity sections
│     Verify Assets = Liabilities + Equity equation
│
├─ ProfitLossPage.jsx
│  └─ Show Revenue items, Expense items
│     Calculate Net Profit/Loss
│     Show Profit Margin %
│
├─ ARAgingPage.jsx
│  └─ Show customer balances aged by days
│     Buckets: 0-30, 31-60, 61-90, 90+
│     Total due per customer
│
└─ APAgingPage.jsx
   └─ Show vendor balances aged by days
      Buckets: 0-30, 31-60, 61-90, 90+
      Total payable per vendor
```

---

## 🎯 Current UI Implementation Status

### ✅ IMPLEMENTED (Fully Working)

| Feature | Location | Status |
|---------|----------|--------|
| Sales Order Entry | `InventorySalesOrder.jsx` + components | ✅ Working |
| Purchase Order Entry | `InventoryPurchaseOrder.jsx` + components | ✅ Working |
| Credit Note Modal | `CreditNoteModal.jsx` | ✅ Working |
| Debit Note Modal | `DebitNoteModal.jsx` | ✅ Working |
| Customer Management | Modals in inventory | ✅ Working |
| Product Management | Modals in inventory | ✅ Working |
| Vendor Management | Modals in inventory | ✅ Working |
| Sidebar Navigation | `Sidebar.jsx` | ✅ Working |
| Topbar Header | `Topbar.jsx` | ✅ Working |
| Product Reports | `ProductSummary.jsx` | ✅ Working |
| Customer Reports | `CustomerSummary.jsx` | ✅ Working |
| Vendor Reports | `VendorSummary.jsx` | ✅ Working |

### ❌ MISSING (Need to Build)

| Feature | Status | Priority |
|---------|--------|----------|
| Trial Balance Report Page | ❌ Missing | HIGH |
| Balance Sheet Page | ❌ Missing | HIGH |
| Profit & Loss Page | ❌ Missing | HIGH |
| AR Aging Report Page | ❌ Missing | HIGH |
| AP Aging Report Page | ❌ Missing | HIGH |
| GL Account Viewer | ❌ Missing | MEDIUM |
| Journal Entry Viewer | ❌ Missing | MEDIUM |
| Payment Matching UI | ❌ Missing | MEDIUM |
| Bank Reconciliation UI | ❌ Missing | LOW |
| Financial Dashboard | ❌ Missing | MEDIUM |

---

## 🔗 Data Flow Diagram

```
┌─────────────┐
│   Browser   │
│  (React UI) │
└──────┬──────┘
       │ HTTP Request
       │ (JSON data)
       ▼
┌────────────────────────────┐
│  Express Server (Node.js)  │
│  (Port 5000)               │
└──────┬──────────────────────┘
       │
       ├─────────────────────────┐
       │                         │
       ▼                         ▼
┌────────────┐          ┌─────────────────┐
│ MongoDB    │          │ GL Service      │
│ Collections│          │ (Node Utility)  │
└────────────┘          └─────────────────┘
       │                         │
       │  SO/PO/CN/DN           │ GL Posting
       │  saved                 │ JE Creation
       │                         │ GL Updates
       ▼                         ▼
   Transaction DB         GL Accounts DB
   ├─ SalesOrders         ├─ ChartOfAccounts
   ├─ PurchaseOrders      ├─ JournalEntries
   ├─ CreditNotes         └─ GeneralLedger
   └─ DebitNotes
```

---

## 📍 How to Use Current UI

### 1️⃣ **Create Sales Order**
   - Navigate: Sidebar → Inventory → Sales Order
   - Fill Header (Customer, Warehouse, Date)
   - Add Line Items (Products, Qty, Price)
   - Click Save
   - ✅ SO created + Inventory reduced + AR updated + GL posted

### 2️⃣ **Create Credit Note (Return)**
   - Open the SO
   - Click "Create Credit Note"
   - Select items to return
   - Click Save
   - ✅ CN created + Inventory restored + AR reduced + GL reversed

### 3️⃣ **Create Purchase Order**
   - Navigate: Sidebar → Inventory → Purchase Order
   - Fill Header (Vendor, Warehouse, Date)
   - Add Line Items (Products, Qty, Price)
   - Click Save
   - ✅ PO created + Inventory increased + AP created + GL posted

### 4️⃣ **Create Debit Note (Return to Vendor)**
   - Open the PO
   - Click "Create Debit Note"
   - Select items to return
   - Click Save
   - ✅ DN created + Inventory reduced + AP reduced + GL reversed

### 5️⃣ **View Financial Reports** ❌ NOT YET AVAILABLE
   - These API endpoints exist but no UI pages
   - Need to create React pages to display reports

---

## 🚀 Next Steps to Complete Finance Module

```
Phase: Build Financial Reports UI (HIGH PRIORITY)

1. Create TrialBalancePage.jsx
   └─ Call GET /api/financial-reports/trial-balance
      Display all GL accounts with Debit/Credit
      Show verification: Total DR = Total CR

2. Create BalanceSheetPage.jsx
   └─ Call GET /api/financial-reports/balance-sheet
      Show Assets / Liabilities / Equity sections
      Display totals and equation verification

3. Create ProfitLossPage.jsx
   └─ Call GET /api/financial-reports/profit-loss
      Show Revenue and Expense line items
      Display profit/loss and margins

4. Create ARAgingPage.jsx
   └─ Call GET /api/financial-reports/ar-aging
      Show customer aging buckets
      Display amounts due per customer

5. Create APAgingPage.jsx
   └─ Call GET /api/financial-reports/ap-aging
      Show vendor aging buckets
      Display amounts payable per vendor

6. Add to Sidebar.jsx
   └─ New menu item: "Finance" or "Reports"
      Link to all 5 new pages
```

---

## 📂 File References

**Current Working Pages:**
- [Sales Order Entry](src/pages/inventory/InventorySalesOrder.jsx)
- [Purchase Order Entry](src/pages/inventory/InventoryPurchaseOrder.jsx)

**Current Working Components:**
- [Sidebar Navigation](src/components/Sidebar.jsx)
- [Credit Note Modal](src/components/inventory/CreditNoteModal.jsx)
- [Debit Note Modal](src/components/inventory/DebitNoteModal.jsx)

**Backend Routes (Already Created):**
- `/api/financial-reports/*` endpoints operational
- `/api/chart-of-accounts/*` endpoints operational

**Need to Build UI Pages:**
- Pages for all financial reports (currently only backend API exists)

---

**Summary: The transaction entry UI is complete and working. Only the financial reporting UI pages are missing!**
