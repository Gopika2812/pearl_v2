# 📊 Financial Reports UI - Visual Reference Guide

## Sidebar Navigation Menu

```
┌─────────────────────────────────────────┐
│              PEARLS ERP                 │
│             [Logo Image]                │
├─────────────────────────────────────────┤
│                                         │
│ 🏠 Home                                 │
│ 🛒 Purchase Order                       │
│ 📄 Sales Order                          │
│ 📚 Pearls Book                          │
│ 👥 CRM                                  │
│ 🚚 Loading & Dispatch                   │
│ 👨 Employees Book                       │
│ 👥 Employee Dashboard                   │
│ 💰 Payroll & Attendance                 │
│                                         │
│ 📊 Summary ▼                             │
│    ├─ Product Summary                   │
│    ├─ Customer Summary                  │
│    ├─ Vendor Summary                    │
│    └─ Others                            │
│                                         │
│ 📈 Finance Reports ▼  ← NEW!            │
│    ├─ Trial Balance       ← NEW!        │
│    ├─ Balance Sheet       ← NEW!        │
│    ├─ Profit & Loss       ← NEW!        │
│    ├─ AR Aging            ← NEW!        │
│    └─ AP Aging            ← NEW!        │
│                                         │
│          [Logout Button]                │
└─────────────────────────────────────────┘
```

---

## Trial Balance Report - Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│                      TRIAL BALANCE                          │
│  Generated: February 27, 2026    [Print] [Export]          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✓ Trial Balance is Balanced                               │
│  (Green banner - Debit Total = Credit Total)               │
│                                                             │
├─────────────────┬──────────────┬─────────────────────────┤
│ Account Code    │ Account Name │ Type    │ Debit  │ Credit│
├─────────────────┼──────────────┼─────────┼────────┼───────┤
│ 1001            │ Cash         │ ASSET   │ 100000 │  -    │
│ 1101            │ AR           │ ASSET   │  50000 │  -    │
│ 1201            │ Inventory    │ ASSET   │  75000 │  -    │
│ 2001            │ AP           │ LIAB    │   -    │ 30000 │
│ 3001            │ Owner Cap    │ EQUITY  │   -    │100000 │
│ 4001            │ Sales Rev    │ INCOME  │   -    │ 80000 │
│ 5001            │ COGS         │ EXPENSE │ 15000  │  -    │
│ ...             │ ...          │ ...     │  ...   │  ...  │
├─────────────────┴──────────────┴─────────┼────────┼───────┤
│ TOTAL                                    │315000  │315000 │
└──────────────────────────────────────────┴────────┴───────┘
       Verification: 315000 = 315000 ✓ BALANCED
```

---

## Balance Sheet Report - Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│                      BALANCE SHEET                           │
│              As of February 27, 2026                         │
│              [Print] [Export]                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ✓ Balance Sheet Balanced: Assets = Liabilities + Equity    │
│                           (Green banner)                    │
│                                                              │
├────────────────┐  ┌─────────────────────────────┐           │
│    ASSETS      │  │ LIABILITIES & EQUITY        │           │
│ (Blue header)  │  │ (Orange header)             │           │
├────────────────┤  ├─────────────────────────────┤           │
│                │  │                             │           │
│ Current Assets │  │ Current Liabilities         │           │
│    ₹ 150,000   │  │       ₹ 30,000              │           │
│ Fixed Assets   │  │ Long-term Liabilities       │           │
│    ₹ 75,000    │  │       ₹ 15,000              │           │
│                │  │ Equity                      │           │
│ Total Assets   │  │       ₹ 180,000             │           │
│   ₹ 225,000    │  │ Total Liab & Equity         │           │
│ (Blue box)     │  │       ₹ 225,000             │           │
│                │  │ (Orange box)                │           │
└────────────────┘  └─────────────────────────────┘           │
│                                                              │
│  EQUATION VERIFICATION                                      │
│  ₹ 225,000 = ₹ 45,000 + ₹ 180,000 ✓ Verified              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Profit & Loss Report - Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│              PROFIT & LOSS STATEMENT                         │
│       For the period ending February 27, 2026               │
│              [Print] [Export]                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                  REVENUE (Green header)                      │
│  ├─ Sales Revenue                    ₹ 80,000              │
│  ├─ Service Revenue                  ₹ 20,000              │
│  └─ Total Revenue                    ₹ 100,000             │
│                                       (Green box)           │
│                                                              │
│                 EXPENSES (Red header)                        │
│  ├─ Cost of Goods Sold               ₹ 15,000              │
│  ├─ Salaries                         ₹ 10,000              │
│  ├─ Rent                             ₹  5,000              │
│  ├─ Utilities                        ₹  2,000              │
│  └─ Total Expenses                   ₹ 32,000              │
│                                       (Red box)             │
│                                                              │
│  ┌─────────────────────────────────────────────┐            │
│  │  NET PROFIT: ₹ 68,000                       │            │
│  │  Profit Margin: 68.00%                      │            │
│  │  (Green gradient banner)                    │            │
│  └─────────────────────────────────────────────┘            │
│                                                              │
│  Total Revenue: ₹ 100,000    Total Expenses: ₹ 32,000      │
│  (Summary row at bottom)                                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## AR Aging Report - Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│           ACCOUNTS RECEIVABLE (AR) AGING REPORT              │
│              As of February 27, 2026                         │
│              [Print] [Export]                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ 0-30 Days│ │31-60 Days│ │61-90 Days│ │ 90+ Days │         │
│ │ ₹50,000  │ │ ₹20,000  │ │ ₹10,000  │ │ ₹5,000   │         │
│ │ (Blue)   │ │(Yellow)  │ │(Orange)  │ │(Red)     │         │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                    Total Due: ₹85,000        │
│                                                              │
├───────────────────────────────────────────────────────────┬──┤
│ Customer Name    │ 0-30   │ 31-60  │ 61-90  │ 90+  │ Total │
├──────────────────┼────────┼────────┼────────┼──────┼───────┤
│ ABC Company      │ 30,000 │ 10,000 │  5,000 │  -   │ 45,000│
│ XYZ Industries   │ 15,000 │  7,000 │  3,000 │3,000 │ 28,000│
│ DEF Trading      │  5,000 │  3,000 │  2,000 │2,000 │ 12,000│
├──────────────────┼────────┼────────┼────────┼──────┼───────┤
│ TOTAL            │ 50,000 │ 20,000 │ 10,000 │5,000 │ 85,000│
│ (Cyan header)    │        │        │        │      │       │
└──────────────────┴────────┴────────┴────────┴──────┴───────┘

Color Coding:
   [Blue]   = Healthy (0-30 days)
   [Yellow] = Caution (31-60 days)
   [Orange] = Warning (61-90 days)
   [Red]    = Critical (90+ days)
```

---

## AP Aging Report - Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│          ACCOUNTS PAYABLE (AP) AGING REPORT                  │
│              As of February 27, 2026                         │
│              [Print] [Export]                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ 0-30 Days│ │31-60 Days│ │61-90 Days│ │ 90+ Days │         │
│ │ ₹25,000  │ │ ₹8,000   │ │ ₹4,000   │ │ ₹2,000   │         │
│ │ (Blue)   │ │(Yellow)  │ │(Orange)  │ │(Red)     │         │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                   Total Payable: ₹39,000     │
│                                                              │
├───────────────────────────────────────────────────────────┬──┤
│ Vendor Name      │ 0-30   │ 31-60  │ 61-90  │ 90+  │ Total │
├──────────────────┼────────┼────────┼────────┼──────┼───────┤
│ Supplier A       │ 12,000 │  5,000 │  2,000 │  -   │ 19,000│
│ Supplier B       │  8,000 │  2,000 │  1,500 │1,000 │ 12,500│
│ Supplier C       │  5,000 │  1,000 │    500 │1,000 │  7,500│
├──────────────────┼────────┼────────┼────────┼──────┼───────┤
│ TOTAL            │ 25,000 │  8,000 │  4,000 │2,000 │ 39,000│
│ (Amber header)   │        │        │        │      │       │
└──────────────────┴────────┴────────┴────────┴──────┴───────┘

Color Coding:
   [Blue]   = Healthy (0-30 days)
   [Yellow] = Upcoming Payment (31-60 days)
   [Orange] = Overdue (61-90 days)
   [Red]    = Seriously Overdue (90+ days)
```

---

## Real-Time Demo - User Flow

### Scenario: View Trial Balance after creating transactions

```
STEP 1: User at Home Page
┌─────────────────────────────────────────┐
│  Pearls ERP Dashboard                   │
│  [Recent Transactions]                  │
│  [Quick Links]                          │
└─────────────────────────────────────────┘
           │
           │ User clicks "Finance Reports" in sidebar
           ▼
STEP 2: Finance Reports Menu Opens
┌─────────────────────────────────────────┐
│ 📈 Finance Reports ▼                    │
│    ├─ Trial Balance       ← User clicks │
│    ├─ Balance Sheet                     │
│    ├─ Profit & Loss                     │
│    ├─ AR Aging                          │
│    └─ AP Aging                          │
└─────────────────────────────────────────┘
           │
           │ React Router navigates to /reports/trial-balance
           ▼
STEP 3: Loading State
┌─────────────────────────────────────────┐
│                                         │
│           ⏳ (Spinner)                  │
│    Loading Trial Balance...             │
│                                         │
└─────────────────────────────────────────┘
           │
           │ fetch() calls backend API
           │ Backend queries MongoDB GL
           │ Backend returns account data
           ▼
STEP 4: Data Displays
┌─────────────────────────────────────────┐
│        Trial Balance                    │
│ ✓ Balanced (Green badge)                │
│                                         │
│ Account | Type | Debit | Credit        │
│ ─────────────────────────────────       │
│ (Table with all GL accounts)            │
│                                         │
│ TOTAL  | 315000 | 315000                │
│ (Balanced ✓)                            │
│                                         │
│ [Print] [Export CSV]                   │
└─────────────────────────────────────────┘
```

---

## Print Preview - What Users See

When user clicks the **Print** button:

```
┌──────────────────────────────────────────────────────┐
│                    TRIAL BALANCE                     │
│ Pearls ERP - February 27, 2026                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Account Code │ Account Name     │ Debit   │ Credit  │
│─────────────────────────────────────────────────────│
│ 1001         │ Cash             │ 100,000 │     -   │
│ 1101         │ AR               │  50,000 │     -   │
│ ...          │ ...              │   ...   │   ...   │
│─────────────────────────────────────────────────────│
│ TOTAL        │                  │ 315,000 │ 315,000 │
│                                                      │
│ Verification: Debit = Credit  ✓                     │
│ Generated: 27-Feb-2026                              │
│ Page 1 of 1                                         │
└──────────────────────────────────────────────────────┘
```

---

## CSV Export - File Format

When user clicks **Export CSV**:

**File Name:** `trial-balance-2026-02-27.csv`

**Content:**
```csv
Account Code,Account Name,Account Type,Debit,Credit
1001,Cash,ASSET,100000,0
1101,AR,ASSET,50000,0
1201,Inventory,ASSET,75000,0
2001,AP,LIABILITY,0,30000
3001,Owner Capital,EQUITY,0,100000
4001,Sales Revenue,INCOME,0,80000
5001,COGS,EXPENSE,15000,0
5101,Salaries,EXPENSE,10000,0
5102,Rent,EXPENSE,5000,0

,,Total,315000,315000
```

User can open in:
- ✅ Excel
- ✅ Google Sheets
- ✅ Any spreadsheet application
- ✅ Text editor

---

## Error Handling - What Users See

If API fails or no data available:

```
┌──────────────────────────────────────────────────────┐
│                  Balance Sheet                       │
├──────────────────────────────────────────────────────┤
│                                                      │
│ ⚠️ Error fetching balance sheet:                    │
│    Cannot GET /api/financial-reports/balance-sheet  │
│                                                      │
│ Please make sure the backend server is running on   │
│ http://localhost:5000                               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Mobile View - Responsive Design

### AR Aging on Mobile (Small Screen):

```
┌──────────────────────────┐
│   AR AGING REPORT        │
│ [Print] [Export]         │
├──────────────────────────┤
│                          │
│ [0-30: ₹50K] [31-60: ..]│
│ [61-90: ₹10K] [90+: ..]  │
│                          │
│ Cust Name │ 0-30 │ 31-60│
├───────────┼──────┼──────┤
│ ABC       │ 30K  │  10K │
│ XYZ       │ 15K  │   7K │
├───────────┼──────┼──────┤
│ TOTAL     │ 45K  │  17K │
│           │      │      │
│ [Scroll right for more] │
└──────────────────────────┘
```

---

## Summary Table - All Report Comparison

| Feature | Trial Bal | Balance Sheet | P&L | AR Aging | AP Aging |
|---------|-----------|---------------|-----|----------|----------|
| Print | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export CSV | ✅ | ✅ | ✅ | ✅ | ✅ |
| Loading State | ✅ | ✅ | ✅ | ✅ | ✅ |
| Error Handling | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mobile Responsive | ✅ | ✅ | ✅ | ✅ | ✅ |
| Summary Cards | - | ✅ | ✅ | ✅ | ✅ |
| Verification Badge | ✅ | ✅ | - | - | - |
| Color Coding | - | - | G/R | B/Y/O/R | B/Y/O/R |
| Table Format | ✅ | Cards | Cards | Table | Table |
| Real-time Data | ✅ | ✅ | ✅ | ✅ | ✅ |

---

**All 5 Reports are Ready to Use!** 🎉
