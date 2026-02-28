# 🎨 Zoho ERP Finance Architecture Diagram

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (React Frontend)                     │
│  - Sales Order Form         - Credit Note Form                      │
│  - Purchase Order Form      - Debit Note Form                       │
│  - Financial Reports        - AR/AP Aging                           │
└────────────────────────┬────────────────────────────────────┬──────┘
                         │ HTTP Requests                      │
                         │ JSON Data                          │ HTTP Responses
                         ▼                                    ▲
┌─────────────────────────────────────────────────────────────────────┐
│                     EXPRESS API SERVER (Node.js)                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              ROUTES LAYER (Request Handlers)                │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │                                                              │   │
│  │  ┌──────────────────┐  ┌──────────────────┐                │   │
│  │  │ SO Route         │  │ CN Route         │                │   │
│  │  ├──────────────────┤  ├──────────────────┤                │   │
│  │  │ POST /sales-    │  │ POST /credit-    │                │   │
│  │  │ orders           │  │ notes            │                │   │
│  │  │                  │  │                  │                │   │
│  │  │ ✓ Create SO     │  │ ✓ Create CN     │                │   │
│  │  │ ✓ Reduce inv    │  │ ✓ Increase inv  │                │   │
│  │  │ ✓ Update AR     │  │ ✓ Reduce AR     │                │   │
│  │  │ ✓ Post GL JE    │  │ ✓ Post GL JE    │                │   │
│  │  └──────────────────┘  └──────────────────┘                │   │
│  │                                                              │   │
│  │  ┌──────────────────┐  ┌──────────────────┐                │   │
│  │  │ PO Route         │  │ DN Route         │                │   │
│  │  ├──────────────────┤  ├──────────────────┤                │   │
│  │  │ POST /purchase-  │  │ POST /debit-     │                │   │
│  │  │ orders           │  │ notes            │                │   │
│  │  │                  │  │                  │                │   │
│  │  │ ✓ Create PO     │  │ ✓ Create DN     │                │   │
│  │  │ ✓ Increase inv  │  │ ✓ Decrease inv  │                │   │
│  │  │ ✓ Update AP     │  │ ✓ Reduce AP     │                │   │
│  │  │ ✓ Post GL JE    │  │ ✓ Post GL JE    │                │   │
│  │  └──────────────────┘  └──────────────────┘                │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────┐               │   │
│  │  │ Financial Reports Routes                 │               │   │
│  │  ├──────────────────────────────────────────┤               │   │
│  │  │ GET /trial-balance                       │               │   │
│  │  │ GET /balance-sheet                       │               │   │
│  │  │ GET /profit-loss                         │               │   │
│  │  │ GET /ar-aging                            │               │   │
│  │  │ GET /ap-aging                            │               │   │
│  │  └──────────────────────────────────────────┘               │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────┐               │   │
│  │  │ Chart of Accounts Route                  │               │   │
│  │  ├──────────────────────────────────────────┤               │   │
│  │  │ POST /initialize (create 50+ accounts)   │               │   │
│  │  │ GET  /by-type/:type                      │               │   │
│  │  └──────────────────────────────────────────┘               │   │
│  │                                                              │   │
│  └──────────────────────┬───────────────────────────────────┬──┘   │
│                         │                                   │       │
│                         ▼                                   ▼       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │             SERVICE LAYER (Business Logic)                  │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │                                                              │   │
│  │  ┌────────────────────────────────────────┐                │   │
│  │  │     GLService (glService.js)           │                │   │
│  │  ├────────────────────────────────────────┤                │   │
│  │  │                                        │                │   │
│  │  │ ▪ postSalesOrderJE()                  │                │   │
│  │  │   └─ Debit AR / Credit Revenue        │                │   │
│  │  │                                        │                │   │
│  │  │ ▪ postCreditNoteJE()                  │                │   │
│  │  │   └─ Debit Revenue / Credit AR        │                │   │
│  │  │                                        │                │   │
│  │  │ ▪ postPurchaseOrderJE()               │                │   │
│  │  │   └─ Debit Inventory / Credit AP      │                │   │
│  │  │                                        │                │   │
│  │  │ ▪ postDebitNoteJE()                   │                │   │
│  │  │   └─ Debit AP / Credit Inventory      │                │   │
│  │  │                                        │                │   │
│  │  │ ▪ getTrialBalance()                   │                │   │
│  │  │ ▪ getBalanceSheet()                   │                │   │
│  │  │ ▪ getProfitLoss()                     │                │   │
│  │  │ ▪ updateGLAccounts()                  │                │   │
│  │  │                                        │                │   │
│  │  └────────────────────────────────────────┘                │   │
│  │                                                              │   │
│  └──────────────────────┬───────────────────────────────────┬──┘   │
│                         │                                   │       │
│                         ▼                                   ▼       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              DATA ACCESS LAYER (Models)                      │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │                                                              │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │   │
│  │  │ SalesOrder.js   │  │ CreditNote.js   │                 │   │
│  │  │ Product.js      │  │ Customer.js     │                 │   │
│  │  │ PurchaseOrder.js│  │ DebitNote.js    │                 │   │
│  │  │ Vendor.js       │  │                 │                 │   │
│  │  └─────────────────┘  └─────────────────┘                 │   │
│  │                                                              │   │
│  │  ┌────────────────────────────────────────────────────────┐ │   │
│  │  │         NEW GL Models                                  │ │   │
│  │  ├────────────────────────────────────────────────────────┤ │   │
│  │  │                                                        │ │   │
│  │  │ ▪ ChartOfAccounts.js                                 │ │   │
│  │  │   (50+ GL accounts master - Assets, Liabilities, etc) │ │   │
│  │  │                                                        │ │   │
│  │  │ ▪ JournalEntry.js                                    │ │   │
│  │  │   (Every debit/credit transaction - Audit trail)     │ │   │
│  │  │                                                        │ │   │
│  │  │ ▪ GeneralLedger.js                                   │ │   │
│  │  │   (Account balances - Real-time GL state)            │ │   │
│  │  │                                                        │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  │                                                              │   │
│  └──────────────────────┬───────────────────────────────────┬──┘   │
└─────────────────────────┼───────────────────────────────────┼──────┘
                          │                                   │
                          ▼                                   ▼
                    ┌──────────────────┐          ┌──────────────────┐
                    │   MONGODB        │          │   MongoDB        │
                    │  COLLECTIONS    │          │  Collections     │
                    ├──────────────────┤          ├──────────────────┤
                    │ SalesOrders      │          │ ChartOfAccounts  │
                    │ CreditNotes      │          │ JournalEntries   │
                    │ Products         │          │ GeneralLedger    │
                    │ Customers        │          │                  │
                    │ PurchaseOrders   │          │ (GL System DB)   │
                    │ Vendors          │          │                  │
                    │ DebitNotes       │          │                  │
                    └──────────────────┘          └──────────────────┘
```

---

## 🔄 Transaction Processing Flow

```
┌──────────────────────┐
│ 1. RECEIVED REQUEST  │
│ POST /sales-orders   │
│ { customer, items }  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 2. VALIDATE & PARSE                  │
│ ✓ Check customer exists              │
│ ✓ Validate items & quantities        │
│ ✓ Calculate totals (subtotal, tax)   │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 3. TRANSACTION PROCESSING            │
│ ┌─────────────────────────────────┐  │
│ │ A. Save SalesOrder to DB        │  │
│ │    invoiceId: SO-2026-0001      │  │
│ │    customer, items, amounts     │  │
│ └─────────────────────────────────┘  │
│          │                            │
│          ▼                            │
│ ┌─────────────────────────────────┐  │
│ │ B. REDUCE INVENTORY             │  │
│ │ for each item:                  │  │
│ │   Product.totalQty -= qty       │  │
│ │                                 │  │
│ │ Example: -100 units from stock  │  │
│ └─────────────────────────────────┘  │
│          │                            │
│          ▼                            │
│ ┌─────────────────────────────────┐  │
│ │ C. UPDATE CUSTOMER AR BALANCE   │  │
│ │ Customer.closingBalance +=      │  │
│ │ grandTotal                      │  │
│ │                                 │  │
│ │ Example: ₹1000 added to AR      │  │
│ └─────────────────────────────────┘  │
│          │                            │
│          ▼                            │
│ ┌─────────────────────────────────┐  │
│ │ D. POST TO GENERAL LEDGER       │  │
│ │ GLService.postSalesOrderJE()    │  │
│ │                                 │  │
│ │ Creates:                        │  │
│ │ DebitEntry:  AR (1101) = 1080   │  │
│ │ CreditEntry: Revenue (4001) =   │  │
│ │              1000               │  │
│ │ CreditEntry: GST (2101) = 80    │  │
│ │                                 │  │
│ │ Validates: Debit = Credit ✓     │  │
│ │ Stores: JournalEntry, updates   │  │
│ │ GeneralLedger balances          │  │
│ └─────────────────────────────────┘  │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 4. ERROR HANDLING                    │
│ if GLService fails:                  │
│   - Log the error                    │
│   - Continue (non-blocking)          │
│   - Return SO as created             │
│ else:                                │
│   - All systems consistent           │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 5. RESPONSE TO CLIENT                │
│ {                                    │
│   success: true,                     │
│   invoiceId: "SO-2026-0001",        │
│   data: {SalesOrder document}        │
│ }                                    │
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 6. QUERY FINANCIAL REPORTS           │
│ GET /trial-balance                   │
│                                      │
│ Returns:                             │
│ {                                    │
│   accounts: [                        │
│     {1001: Cash},                    │
│     {1101: AR = 1080},              │
│     {1201: Inventory = -100},       │
│     {2101: GST Payable = -80},      │
│     {4001: Revenue = -1000}         │
│   ],                                 │
│   totalDebits: 1180,                 │
│   totalCredits: 1180  ✓ BALANCED    │
│ }                                    │
└──────────────────────────────────────┘
```

---

## 📊 GL Entry Lifecycle

```
JOURNAL ENTRY CREATION → VALIDATION → POSTING → REPORTING

┌──────────────────────┐
│ Step 1: CREATE JE    │
├──────────────────────┤
│ When SO created:     │
│ - Generate JE ID     │
│ - Create line items  │
│   ├─ Debit AR 1080   │
│   ├─ Credit Rev 1000 │
│   └─ Credit GST 80   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Step 2: VALIDATE     │
├──────────────────────┤
│ Check:               │
│ ✓ Debit = Credit?    │
│ ✓ Accounts exist?    │
│ ✓ Amounts positive?  │
│ ✓ Balance equation?  │
│                      │
│ Result:              │
│ isBalanced = true    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Step 3: POST TO GL   │
├──────────────────────┤
│ For each line item:  │
│ - Find GL account    │
│ - Add debit to total │
│ - Add credit to total│
│ - Update balance     │
│                      │
│ Update GL:           │
│ AR account:          │
│  currentBalance +=   │
│  totalDebits -       │
│  totalCredits        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Step 4: REPORT       │
├──────────────────────┤
│ Trial Balance:       │
│ - Read all GL accts  │
│ - Sum debits/credits │
│ - Verify balance     │
│                      │
│ Balance Sheet:       │
│ - Group by type      │
│ - Calculate totals   │
│ - Verify equation    │
│                      │
│ P&L:                 │
│ - Sum revenue accounts│
│ - Sum expense accts  │
│ - Calculate profit   │
└──────────────────────┘
```

---

## 💰 Double-Entry Bookkeeping Illustration

```
SALES ORDER CREATED FOR ₹1000 + ₹80 GST = ₹1080

                        Balance Sheet Equation
                    ASSETS = LIABILITIES + EQUITY

                        Before SO:
                        0 = 0 + 0 (starting point)

                        SO Transaction:
                        Debit AR (Asset)      = +1080
                        Credit Revenue       = +1000
                        Credit GST Payable   = +80

                        After SO:
                        Assets:
                        ├─ AR = 1080
                        └─ Inventory = 0 (unchanged)
                        
                        Liabilities:
                        └─ GST Payable = 80
                        
                        Equity:
                        └─ Retained Earnings = 1000 (from revenue)
                        
                        Check: 1080 (Assets) = 80 (Liab) + 1000 (Equity) ✓


CREDIT NOTE FOR RETURN OF ₹500 + ₹40 GST = ₹540

                        Before CN:
                        Assets = 1080
                        Liabilities = 80
                        Equity = 1000

                        CN Transaction (Reversal):
                        Debit Revenue        = -500
                        Debit GST Payable    = -40
                        Credit AR            = -540

                        After CN:
                        Assets: 1080 - 540 = 540 (AR reduced)
                        Liabilities: 80 - 40 = 40 (GST reduced)
                        Equity: 1000 - 500 = 500 (Revenue reduced)
                        
                        Check: 540 = 40 + 500 ✓


PURCHASE ORDER FOR ₹2000 + ₹160 GST = ₹2160

                        PO Transaction:
                        Debit Inventory      = +2000
                        Debit GST Receivable = +160
                        Credit AP            = +2160

                        After PO:
                        Assets:
                        ├─ Inventory = +2000
                        ├─ GST Rec = +160
                        └─ AR = 540 (prev)
                        Total Assets = 2700
                        
                        Liabilities:
                        ├─ AP = 2160
                        └─ GST Pay = 40
                        Total Liab = 2200
                        
                        Equity: 500
                        
                        Check: 2700 = 2200 + 500 ✓
```

---

## 🎯 Account Interaction Map

```
                    ┌─────────────────────────────┐
                    │   SALES ORDER CREATED       │
                    │   ₹1000 + 80 GST = 1080     │
                    └────────────┬────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
            ┌─────────────────┐      ┌──────────────────┐
            │ PRODUCT MODEL   │      │ CUSTOMER MODEL   │
            ├─────────────────┤      ├──────────────────┤
            │ totalQty        │      │ closingBalance   │
            │   Before: 1000  │      │   Before: 0      │
            │   After: 900 ✓  │      │   After: 1080 ✓  │
            └─────────────────┘      └──────────────────┘
                    │                         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  GL POST REQUEST TO      │
                    │  GLService.              │
                    │  postSalesOrderJE()      │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │ CREATE JOURNAL ENTRY     │
                    │ JE-2026xxxx-0001         │
                    │                          │
                    │ LineItems:               │
                    │ ├─ Debit AR (1101) 1080  │
                    │ ├─ Credit Rev (4001) 1000│
                    │ └─ Credit GST (2101) 80  │
                    │                          │
                    │ Validate:                │
                    │ isBalanced = 1080 = 1080 │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  UPDATE GL ACCOUNTS      │
                    │                          │
                    │  AR (1101):              │
                    │  ├─ totalDebits += 1080  │
                    │  └─ balance = 1080       │
                    │                          │
                    │  Revenue (4001):         │
                    │  ├─ totalCredits += 1000 │
                    │  └─ balance = -1000      │
                    │                          │
                    │  GST Payable (2101):     │
                    │  ├─ totalCredits += 80   │
                    │  └─ balance = -80        │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │ QUERY TRIAL BALANCE      │
                    │ /financial-reports/TB    │
                    │                          │
                    │ Result:                  │
                    │ TotalDebits: 1080 ✓      │
                    │ TotalCredits: 1080 ✓     │
                    │ BALANCED!                │
                    └──────────────────────────┘
```

---

## 🔐 Data Integrity Flow

```
REQUEST VALIDATION → TRANSACTION → GL POSTING → VERIFICATION

┌──────────────────────┐
│ 1. INPUT VALIDATION  │
├──────────────────────┤
│ ✓ Customer ID valid? │
│ ✓ Items exist?       │
│ ✓ Amounts > 0?       │
│ ✓ Required fields?   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 2. BEGIN TRANSACTION                 │
│ Set TX savepoint (if needed)         │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 3. MODIFY MASTER DATA                │
│ ├─ Save SalesOrder                   │
│ ├─ Update Product (inventory)        │
│ ├─ Update Customer (balance)         │
│ └─ Increment VoucherType (counter)   │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 4. POST GL ENTRY                     │
│ ├─ Create JournalEntry doc           │
│ ├─ Validate (debit = credit)         │
│ └─ Update GeneralLedger accounts     │
│                                      │
│ If GL posting fails:                 │
│   └─ Log error but continue (OK)     │
│      (Non-blocking failure)          │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 5. COMMIT TRANSACTION                │
│ All changes permanent in MongoDB     │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 6. VERIFY DATA INTEGRITY             │
│ ├─ SO saved ✓                        │
│ ├─ Inventory reduced ✓               │
│ ├─ Customer balance updated ✓        │
│ ├─ JournalEntry created ✓            │
│ ├─ GL balances updated ✓             │
│ └─ All consistent ✓                  │
└──────────────────────────────────────┘
```

---

This architecture ensures:
- ✅ **Atomicity**: All-or-nothing transactions
- ✅ **Consistency**: Balance equation always holds
- ✅ **Double-Entry**: Every transaction has debit & credit
- ✅ **Auditability**: Complete journal entry history
- ✅ **Recoverability**: Non-blocking GL failures

**Production-Ready! 🚀**
