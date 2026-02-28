# Comprehensive ERP Transformation Guide
## From Retail Management System → Enterprise Resource Planning (Zoho-like ERP)

---

## 📚 Table of Contents
1. [What is an ERP System?](#what-is-erp)
2. [Gap Analysis: Current vs Required](#gap-analysis)
3. [Zoho ERP Features Overview](#zoho-features)
4. [Implementation Roadmap](#roadmap)
5. [Module-by-Module Implementation Guide](#modules)
6. [Database Schema Enhancements](#database)
7. [Step-by-Step Implementation Procedure](#step-by-step)
8. [Feature Implementation Checklist](#checklist)

---

## <a name="what-is-erp"></a>1. What is an ERP System?

### Definition
An **ERP (Enterprise Resource Planning)** system is an integrated software platform that consolidates all business operations into a single unified system. It breaks organizational silos by connecting different departments through shared data and processes.

### Core Principle
**"Single source of truth"** - All departments (Accounting, Sales, Purchase, Inventory, HR) work with the same data, eliminating duplicates and inconsistencies.

### Key Characteristics
```
Traditional System (Silos)          →    ERP System (Integrated)
┌──────────────┐                        ┌─────────────────────┐
│ Accounting   │──[EMAIL]──            │                     │
├──────────────┤        ISOLATED       │   UNIFIED ERP       │
│   Sales      │──[EMAIL]──            │   DATABASE          │
├──────────────┤                        ├─────────────────────┤
│ Inventory    │──[EMAIL]──            │ • Real-time data    │
├──────────────┤                        │ • Shared GL         │
│   HR         │──[EMAIL]──            │ • Auto sync         │
└──────────────┘                        │ • No duplicates     │
                                        └─────────────────────┘
```

### What Makes Zoho ERP Great
- ✅ End-to-end inventory tracking
- ✅ Automated General Ledger (GL) entries
- ✅ Real-time financial reports (P&L, Balance Sheet)
- ✅ Multi-currency & GST-compliant
- ✅ Smart recurring orders
- ✅ Approval workflows
- ✅ Complete audit trail
- ✅ Mobile-first design
- ✅ API-first architecture

---

## <a name="gap-analysis"></a>2. Gap Analysis: Current vs Required

### Current Pearls ERP Status

| Feature | Current | Required |
|---------|---------|----------|
| **Basic Inventory** | ✅ YES | ✅ YES (Enhanced) |
| **PO Management** | ✅ Basic | ❌ → Needs enhancement |
| **SO Management** | ✅ Basic | ❌ → Needs enhancement |
| **Opening/Closing Balance** | ❌ NO | ✅ REQUIRED |
| **Opening/Closing Stock** | ❌ NO | ✅ REQUIRED |
| **General Ledger** | ❌ NO | ✅ REQUIRED |
| **Trial Balance Report** | ❌ NO | ✅ REQUIRED |
| **Profit & Loss Statement** | ❌ NO | ✅ REQUIRED |
| **Balance Sheet** | ❌ NO | ✅ REQUIRED |
| **Credit Notes** | ✅ Partial | ❌ → Full GL integration needed |
| **Debit Notes** | ✅ Partial | ❌ → Full GL integration needed |
| **GST Compliance** | ✅ Basic | ❌ → Full GST, IGST, SGST, CGST |
| **Role-Based Access** | ❌ NO | ✅ REQUIRED |
| **Approval Workflows** | ❌ NO | ✅ REQUIRED |
| **Payment Methods** | ✅ Basic | ❌ → Full reconciliation |
| **Bank Reconciliation** | ❌ NO | ✅ REQUIRED |
| **CRM** | ❌ Partial | ❌ → Full CRM suite |
| **Recurring Orders** | ❌ NO | ✅ REQUIRED |
| **Multi-company Support** | ❌ NO | ✅ REQUIRED |
| **Audit Trail** | ❌ NO | ✅ REQUIRED |
| **Financial Year Management** | ❌ NO | ✅ REQUIRED |
| **Stock Valuation Methods** | ❌ NO | ✅ FIFO/LIFO/WAC |
| **API Integration** | ⚠️ Limited | ✅ REQUIRED |

---

## <a name="zoho-features"></a>3. Zoho ERP Features Overview

### 3.1 Core Modules

```
ZOHO ERP
│
├── 📦 INVENTORY MANAGEMENT
│   ├── Product Master (with variants)
│   ├── Warehouse Management (multi-location)
│   ├── Opening Stock & Closing Stock
│   ├── Stock Adjustments
│   ├── Stock Movements Report
│   ├── Stock Aging Report
│   ├── Stock Valuation (FIFO/LIFO/WAC)
│   └── Low Stock Alerts
│
├── 🛒 SALES MANAGEMENT
│   ├── Quotations
│   ├── Sales Orders (recurring)
│   ├── Invoices
│   ├── Delivery Challan
│   ├── Sales Return (with Credit Note)
│   ├── Customer Statements
│   ├── Sales Analytics
│   └── Order Tracking
│
├── 🏢 PURCHASE MANAGEMENT
│   ├── Purchase Requests
│   ├── Quotations from Vendors
│   ├── Purchase Orders (with auto-generation)
│   ├── Goods Receipt Note (GRN)
│   ├── Purchase Return (with Debit Note)
│   ├── Vendor Statements
│   ├── Purchase Analytics
│   └── Supplier Management
│
├── 💰 ACCOUNTING & FINANCE
│   ├── Chart of Accounts
│   ├── General Ledger
│   ├── Trial Balance
│   ├── Balance Sheet
│   ├── Profit & Loss Statement
│   ├── Cash Flow Statement
│   ├── Journal Entries
│   ├── Bank Reconciliation
│   ├── Payment Reconciliation
│   ├── Opening & Closing Balances
│   ├── Cost Centers
│   ├── Tax Compliance
│   └── Financial Reports
│
├── 💳 PAYMENT & COLLECTIONS
│   ├── Invoice Payments
│   ├── Overpayments
│   ├── Payment Methods (Cash, Check, Bank, etc.)
│   ├── Payment Plans
│   ├── Payment Reminders
│   ├── Collections Management
│   └── Payment Gateway Integration
│
├── 🎫 GST COMPLIANCE
│   ├── GST Registration
│   ├── IGST, SGST, CGST Handling
│   ├── HSN Code Management
│   ├── GST Invoicing
│   ├── GSTR-1 (Sales) Report
│   ├── GSTR-2 (Purchases) Report
│   ├── GSTR-3B (Outward Supplies) Report
│   ├── ITC Tracking (Input Tax Credit)
│   └── GST Audit Trail
│
├── 👥 CRM
│   ├── Customer Master
│   ├── Vendor Master
│   ├── Leads Management
│   ├── Opportunities
│   ├── Activities & Tasks
│   ├── Communication History
│   ├── Customer Segmentation
│   ├── Sales Pipeline
│   └── CRM Analytics
│
├── 🔐 ACCESS CONTROL
│   ├── User Roles (Admin, Manager, User)
│   ├── Permissions Matrix
│   ├── Field-level Security
│   ├── Document-level Security
│   ├── Approval Workflows
│   ├── Audit Logs
│   └── User Activity Tracking
│
└── 📊 REPORTING & ANALYTICS
    ├── 100+ Standard Reports
    ├── Custom Report Builder
    ├── Dashboards
    ├── Real-time KPI Tracking
    ├── Export (PDF, Excel, CSV)
    ├── Scheduled Reports
    └── Data Visualization
```

---

## <a name="roadmap"></a>4. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
```
├── Database Schema Redesign
├── Chart of Accounts Setup
├── Opening Balance Configuration
├── Opening Stock Management
├── Financial Year Configuration
└── Role-Based Access Control System
```

### Phase 2: Core Transactions (Weeks 5-12)
```
├── Enhanced PO Module
├── Enhanced SO Module
├── GRN (Goods Receipt Note)
├── Delivery Challan
├── Credit Notes with GL auto-entries
├── Debit Notes with GL auto-entries
└── Payment Reconciliation
```

### Phase 3: Financial Management (Weeks 13-20)
```
├── General Ledger System
├── Journal Entry Management
├── Trial Balance Report
├── Balance Sheet Report
├── Profit & Loss Statement
├── Bank Reconciliation
├── Cost Allocation
└── Financial Close Process
```

### Phase 4: Compliance & Analytics (Weeks 21-28)
```
├── GST Module (Full compliance)
├── GST Reports (GSTR-1, GSTR-2, GSTR-3B)
├── CRM Enhancement
├── Recurring Orders
├── Advanced Reporting
├── Dashboard & KPI
└── API Integration
```

### Phase 5: Testing & Deployment (Weeks 29-32)
```
├── UAT (User Acceptance Testing)
├── Data Migration from Tally
├── Performance Testing
├── Security Audit
├── Production Deployment
└── Training & Documentation
```

---

## <a name="modules"></a>5. Module-by-Module Implementation Guide

### MODULE 1: FOUNDATIONAL SETUP
---

#### 1.1 Chart of Accounts (COA)

**What it is**: A hierarchical list of all accounts a company uses to record transactions.

**Tally users know**: This is like their "Group Master" and "Ledger Master"

**Structure**:
```
COA (Chart of Accounts)
├── ASSETS (Debit balance)
│   ├── Fixed Assets
│   │   ├── Property, Plant & Equipment
│   │   ├── Land
│   │   ├── Building
│   │   ├── Machinery
│   │   └── Furniture & Fixtures
│   │
│   └── Current Assets
│       ├── Cash & Cash Equivalents
│       │   ├── Cash Account
│       │   └── Bank Accounts
│       ├── Accounts Receivable (Debtors)
│       ├── Inventory
│       ├── Prepaid Expenses
│       └── Other Current Assets
│
├── LIABILITIES (Credit balance)
│   ├── Long-term Liabilities
│   │   ├── Long-term Loans
│   │   └── Deferred Tax
│   │
│   └── Current Liabilities
│       ├── Accounts Payable (Creditors)
│       ├── Short-term Loans
│       ├── GST Payable
│       ├── TDS Payable
│       └── Other Short-term Liabilities
│
├── EQUITY (Credit balance)
│   ├── Share Capital
│   ├── Retained Earnings
│   └── Reserves
│
├── INCOME (Credit - normally)
│   ├── Sales Revenue
│   │   ├── Product Sales
│   │   ├── Service Revenue
│   │   └── By-Products
│   │
│   ├── Other Income
│   │   ├── Interest Income
│   │   ├── Rental Income
│   │   └── Miscellaneous Income
│   │
│   └── GST Credit (IGST, SGST, CGST)
│
└── EXPENSES (Debit - normally)
    ├── Cost of Goods Sold
    │   ├── Purchase Accounts
    │   ├── Freight & Forwarding
    │   └── Stock Adjustments
    │
    ├── Operating Expenses
    │   ├── Salaries & Wages
    │   ├── Rent
    │   ├── Utilities
    │   ├── Office Expenses
    │   ├── Maintenance
    │   └── Marketing
    │
    └── GST Payable (IGST, SGST, CGST)
```

**Database Model for COA**:
```javascript
{
  _id: ObjectId,
  code: String,              // AL001, AL002 (unique identifier)
  name: String,              // "Fixed Assets"
  accountType: String,       // ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
  parent: ref→Account,       // For hierarchy
  isHeader: Boolean,         // Is it a group or individual account?
  openingBalance: Number,    // Opening balance for financial year
  allowJournalEntry: Boolean,// Can user post JE directly?
  description: String,
  createdAt, updatedAt
}
```

**Implementation Steps**:
```
1. Create CoA table in MongoDB
2. Insert standard accounts for retail business
3. Create CoA Master page (read-only for now)
4. Create account hierarchy visualization
5. Add opening balance input form
```

---

#### 1.2 Opening & Closing Balances

**What it is**: Starting position of accounts at the beginning of a financial year.

**Example**:
```
Financial Year: 2025-2026 (April 2025 to March 2026)

Opening Balances (as on 31st March 2025):
┌─────────────────────────────────────────┐
│ Cash Account          ₹50,000 (Asset)   │
│ Bank Account          ₹2,00,000 (Asset) │
│ Stock (Inventory)     ₹5,00,000 (Asset) │
│ Creditors Account     -₹1,00,000 (Liab) │
│ Capital               -₹6,50,000 (Equity)│
└─────────────────────────────────────────┘
```

**Database Model**:
```javascript
// Opening Balance Entry
{
  _id: ObjectId,
  financialYear: String,     // "FY2025-26"
  account: ref→CoA,          // Which account
  openingBalance: Number,    // Opening amount
  description: String,       // Notes
  enteredBy: ref→User,
  createdAt
}

// Closing Balance (auto-calculated)
{
  _id: ObjectId,
  financialYear: String,
  account: ref→CoA,
  closingBalance: Number,    // = Opening + Debits - Credits
  generatedDate: Date
}
```

**Implementation Steps**:
```
1. Create Opening Balance Setup form
   - Display all accounts from CoA
   - Input boxes for opening balance
   - Validation: balanced COA required

2. Create Opening Balance Verification Report
   - Show all accounts with balances
   - Verify: Sum of Assets = Liabilities + Equity

3. Closing Balance Auto-Generation Logic
   - OnMonth-End:
     a. Query all JournalEntries for the month
     b. Calculate: Closing = Opening + Debit - Credit
     c. Store in ClosingBalance collection

4. Create Balance Report (Trial Balance)
   - Display opening balance of all accounts
```

---

#### 1.3 Opening Stock Management

**What it is**: Initial inventory at the start of a financial year.

**Different from Opening Balance**: While opening balance is for financial accounts, opening stock is for physical inventory.

**Example**:
```
Opening Stock (1st April 2025):
┌──────────────────────────────────────┐
│ Product: Pearl Necklace               │
│ Quantity: 50 units                   │
│ Cost per unit: ₹500                  │
│ Total Value: ₹25,000                 │
│                                       │
│ Product: Diamond Ring                │
│ Quantity: 20 units                   │
│ Cost per unit: ₹2,000                │
│ Total Value: ₹40,000                 │
│                                       │
│ TOTAL OPENING STOCK: ₹65,000         │
└──────────────────────────────────────┘
```

**Database Model**:
```javascript
// Opening Stock Record
{
  _id: ObjectId,
  financialYear: String,     // "FY2025-26"
  warehouse: ref→Warehouse,
  product: ref→Product,
  openingQty: Number,        // Physical quantity
  costPerUnit: Number,       // Purchase cost
  totalValue: Number,        // qty × costPerUnit
  notes: String,
  createdBy: ref→User,
  createdAt
}
```

**Implementation Steps**:
```
1. Create Opening Stock Sheet
   - Multi-product entry table
   - Auto-calculate total value
   - Warehouse-wise grouping

2. Link to Inventory Module
   - totalQty field in Product updates from Opening Stock

3. Create Opening Stock Valuation Report
   - Show product-wise quantities & values
   - Warehouse summary
   - Match with actual stock

4. Stock Adjustment Journal Entry (Auto)
   - When OpeningStock is finalized:
     Debit: Inventory Account ₹65,000
     Credit: Opening Stock Account ₹65,000
```

---

### MODULE 2: ENHANCED PURCHASE ORDER (PO)
---

#### 2.1 Complete PO Workflow

**Tally Users Know**: This is like "Purchase Voucher" in Tally, but with approval flow.

**PO States/Status**:
```
┌─────────────────────────────────────────────────────┐
│                                                       │
│  DRAFT → PENDING APPROVAL → APPROVED → RECEIVED    │
│    ↑                          ↓                     │
│    └──────← REJECTED ──────────┘                   │
│                                                      │
│  RECEIVED → BILLED → PARTIALLY BILLED → CLOSED    │
│    ↑                                                │
│    └─────── RETURN ─────────┐                      │
└─────────────────────────────────────────────────────┘
```

**Enhanced PO Database Model**:
```javascript
{
  _id: ObjectId,
  
  // Identification
  poNumber: String,          // PO001, PO002 (unique)
  poDate: Date,
  deliveryDate: Date,        // Expected delivery
  financialYear: String,     // FY2025-26
  
  // Vendor Details
  vendor: {
    vendorId: ref→Vendor,
    name: String,
    address: String,
    gst: String,
    paymentTerms: String     // Net 30, Net 60, etc.
  },
  
  // Warehouse
  warehouse: ref→Warehouse,  // Where goods will arrive
  
  // Items
  items: [
    {
      productId: ref→Product,
      hsnCode: String,
      description: String,
      qty: Number,
      unit: String,          // kg, pieces, etc.
      rate: Number,          // Purchase price
      discount: Number,      // % or amount
      discountType: "PERCENT" | "AMOUNT",
      taxable: Boolean,
      gst: Number,          // GST %
      igst: Number,         // If applicable
      sgst: Number,
      cgst: Number,
      lineTotal: Number,    // qty × rate - discount + tax
      deliveredQty: Number, // Updated on GRN
      billedQty: Number,    // Updated on invoice
      lineStatus: "PENDING" | "PARTIALLY_DELIVERED" | "DELIVERED" | "PARTIALLY_BILLED" | "BILLED"
    }
  ],
  
  // Amounts
  subtotal: Number,
  discountAmount: Number,
  taxAmount: Number,
  transportCharge: Number,
  otherCharges: Number,
  grandTotal: Number,
  
  // Workflow
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "RECEIVED" | "BILLED" | "CLOSED" | "CANCELLED",
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED",
  approvedBy: ref→User,
  approvalDate: Date,
  
  // For Returns/Adjustments
  returnLinked: Boolean,     // Is there a debit note?
  debitNoteRef: ref→DebitNote,
  
  // Tracking
  createdBy: ref→User,
  lastModifiedBy: ref→User,
  createdAt,
  updatedAt
}
```

**New Features to Add**:

1. **Approval Workflow**:
```
RBAC Level needed:
- Purchaser: Can create PO
- Manager: Can approve PO > ₹50,000
- Director: Can approve PO > ₹5,00,000
```

2. **Goods Receipt Note (GRN)**:
```
When goods arrive from vendor:
{
  _id: ObjectId,
  grnNumber: String,         // GRN001
  poReference: ref→PurchaseOrder,
  receiptDate: Date,
  items: [
    {
      itemRef: ref→POItem,
      receivedQty: Number,    // Physical quantity received
      acceptedQty: Number,    // After QC inspection
      rejectedQty: Number,
      rejectionReason: String,
      batchNo: String,
      expiryDate: Date
    }
  ],
  notes: String,
  createdBy: ref→User,
  createdAt
}
```

3. **Purchase Invoice Matching**:
```
Scenario:
PO: 100 units @ ₹100 = ₹10,000
GRN: 100 units received
Invoice from Vendor: 120 units @ ₹100 = ₹12,000 (MISMATCH!)

System should:
- Flag the discrepancy
- Require manager approval
- Auto-adjust if within tolerance (e.g., 2%)
```

---

#### 2.2 PO to GL Mapping

**Every PO line item creates GL entries**:

```
When PO is RECEIVED:
────────────────────
Debit:   Inventory Account (Product)    ₹10,000
Credit:  Accounts Payable (Vendor)                ₹10,000

When Vendor Invoice is RECEIVED:
───────────────────────────────
Debit:   Accounts Payable             ₹10,000
Credit:  Cash/Bank                              ₹10,000

When Payment is MADE:
────────────────────
(No new entry - already recorded above)
```

**Database: PurchaseGLEntry**:
```javascript
{
  _id: ObjectId,
  poRef: ref→PurchaseOrder,
  grnRef: ref→GoodsReceiptNote,
  invoiceRef: ref→PurchaseInvoice,
  
  journalEntries: [
    {
      debitAccount: ref→CoA,      // e.g., Inventory
      debitAmount: Number,
      creditAccount: ref→CoA,     // e.g., Accounts Payable
      creditAmount: Number,
      description: String,
      glDate: Date,
      status: "DRAFT" | "POSTED"
    }
  ],
  
  createdAt
}
```

---

### MODULE 3: ENHANCED SALES ORDER (SO)
---

#### 3.1 Complete SO Workflow

**SO States**:
```
QUOTATION → SALES ORDER → DELIVERY CHALLAN → INVOICE → RECEIVED/CLOSED
                ↓
         PENDING APPROVAL
```

**Enhanced SO Model**:
```javascript
{
  _id: ObjectId,
  
  // Identification
  soNumber: String,          // SO001 (unique)
  quoteNumber: String,       // If converted from quote
  soDate: Date,
  deliveryDate: Date,
  financialYear: String,
  invoiceNumber: String,     // Generated after billing
  
  // Customer Details
  customer: {
    customerId: ref→Customer,
    name: String,
    billingAddress: String,
    shippingAddress: String,
    gst: String,
    paymentTerms: String     // Net 30, Credit 15, etc.
  },
  
  // Order Details
  warehouse: ref→Warehouse,  // From which warehouse to ship
  items: [
    {
      productId: ref→Product,
      hsnCode: String,
      description: String,
      qty: Number,
      unit: String,
      rate: Number,          // Selling price
      discount: Number,      // % or amount
      discountType: "PERCENT" | "AMOUNT",
      gst: Number,
      sgst: Number,
      cgst: Number,
      igst: Number,
      lineTotal: Number,
      
      // Fulfillment tracking
      deliveredQty: Number,
      invoicedQty: Number,
      lineStatus: "PENDING" | "PARTIALLY_DELIVERED" | "DELIVERED" | "INVOICED"
    }
  ],
  
  // Amounts
  subtotal: Number,
  discountAmount: Number,
  taxAmount: Number,
  shippingCharge: Number,
  otherCharges: Number,
  grandTotal: Number,
  
  // Payment
  amountReceived: Number,
  amountDue: Number,
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID",
  
  // Recurring (if applicable)
  isRecurring: Boolean,
  recurringFrequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY",
  nextOccurrenceDate: Date,
  recurringEndDate: Date,
  
  // Workflow
  status: "DRAFT" | "CONFIRMED" | "PARTIAL_DELIVERY" | "DELIVERED" | "INVOICED" | "COMPLETED" | "CANCELLED",
  approvalRequired: Boolean,
  approvedBy: ref→User,
  approvalDate: Date,
  
  // Linked Documents
  deliveryChallanRef: ref→DeliveryChallan,
  invoiceRef: ref→Invoice,
  creditNoteRefs: [ref→CreditNote],
  
  createdBy: ref→User,
  updatedAt
}
```

**New Features**:

1. **Delivery Challan**:
```javascript
{
  _id: ObjectId,
  dcNumber: String,          // DC001
  soRef: ref→SalesOrder,
  dcDate: Date,
  items: [
    {
      itemRef: ref→SOItem,
      deliveredQty: Number,
      status: "PENDING" | "DELIVERED"
    }
  ],
  shippedBy: String,         // Delivery person
  notes: String,
  createdAt
}
```

2. **Recurring Sales Orders**:
```
Example: Customer reorders same products every month

When creating SO:
- Mark: isRecurring = true
- Set: recurringFrequency = "MONTHLY"
- Set: nextOccurrenceDate = "2025-04-01"

Auto-Action on Schedule:
- System creates new SO automatically
- Same items, customer, terms
- May need approval based on RBAC
```

3. **Order to Invoice Conversion**:
```
When SO is delivered and ready to invoice:
- Create Invoice document (linked to SO)
- Mark items as "INVOICED"
- Update customer receivables
- Create GL entry
- Generate PDF invoice
```

---

#### 3.2 Sales Order GL Mapping

```
When SO is INVOICED:
────────────────────
Debit:   Accounts Receivable (Customer)  ₹11,000 (incl. tax)
Credit:  Sales Revenue                             ₹10,000
Credit:  GST Payable                                ₹1,000
```

---

### MODULE 4: CREDIT NOTES & DEBIT NOTES WITH GL
---

#### 4.1 Credit Notes (Sales Return)

**What it is**: Document issued to customer for returned goods or adjustments.

**Scenario**:
```
Customer bought: Pearl Necklace
Price: ₹1,000
Customer complains: Broken/Defective
Solution: Issue credit note for ₹1,000
```

**Credit Note Model**:
```javascript
{
  _id: ObjectId,
  
  cnNumber: String,          // CN001 (unique)
  cnDate: Date,
  financialYear: String,
  
  salesOrderRef: ref→SalesOrder,
  invoiceRef: ref→Invoice,
  
  customer: {
    customerId: ref→Customer,
    name: String,
    address: String,
    gst: String
  },
  
  reason: "DAMAGED" | "DEFECTIVE" | "RETURN" | "PRICE_ADJUSTMENT" | "OTHER",
  
  items: [
    {
      productId: ref→Product,
      originalSoItemRef: ref→SOItem,
      hsnCode: String,
      qty: Number,           // Returned quantity
      rate: Number,          // Unit price
      gst: Number,
      lineTotal: Number,
      
      // Stock update
      stockAdjustment: "INCREASE"  // Add back to inventory
    }
  ],
  
  subtotal: Number,
  taxAmount: Number,
  cn_amount: Number,         // Credit amount (that adjusts invoice)
  
  approvalRequired: Boolean,
  status: "DRAFT" | "APPROVED" | "POSTED",
  approvedBy: ref→User,
  
  // GL Entries (Auto-generated)
  glEntries: [
    {
      debitAccount: ref→CoA,      // Sales Revenue
      creditAccount: ref→CoA,     // Accounts Receivable
      amount: Number
    }
  ],
  
  createdBy: ref→User,
  createdAt
}
```

**GL Entry When CN is POSTED**:
```
Debit:  Sales Revenue (Reversal)  ₹1,000  → reduces income
Credit: Accounts Receivable                → reduces amount owed by customer

Effect on Reports:
- Income decreases (refund to customer)
- Customer balance reduces (they owe less)
```

---

#### 4.2 Debit Notes (Purchase Return)

**What it is**: Document issued TO vendor (not BY vendor) for returned goods.

**Scenario**:
```
Company bought from Vendor: 100 units @ ₹100 = ₹10,000
Vendor sends: Only 95 good units, 5 defective
Action: Issue Debit Note for ₹500 (5 units × ₹100)
Effect: Company owes ₹9,500 instead of ₹10,000
```

**Debit Note Model**:
```javascript
{
  _id: ObjectId,
  
  dnNumber: String,          // DN001
  dnDate: Date,
  financialYear: String,
  
  purchaseOrderRef: ref→PurchaseOrder,
  vendorInvoiceRef: ref→VendorInvoice,
  
  vendor: {
    vendorId: ref→Vendor,
    name: String,
    address: String,
    gst: String
  },
  
  reason: "DAMAGED" | "DEFECTIVE" | "SHORT_DELIVERY" | "PRICE_ADJUSTMENT" | "OTHER",
  
  items: [
    {
      productId: ref→Product,
      originalPoItemRef: ref→POItem,
      hsnCode: String,
      qty: Number,           // Rejected quantity
      rate: Number,
      gst: Number,
      lineTotal: Number,
      
      stockAdjustment: "DECREASE"  // Remove from inventory
    }
  ],
  
  subtotal: Number,
  taxAmount: Number,
  dn_amount: Number,         // Debit amount (reduces payable)
  
  approvalRequired: Boolean,
  status: "DRAFT" | "APPROVED" | "POSTED",
  approvedBy: ref→User,
  
  // GL Entries (Auto-generated)
  glEntries: [
    {
      debitAccount: ref→CoA,      // Accounts Payable (vendor liability)
      creditAccount: ref→CoA,     // Purchase Revenue/Expense
      amount: Number
    }
  ],
  
  createdBy: ref→User,
  createdAt
}
```

**GL Entry When DN is POSTED**:
```
Debit:  Accounts Payable (Vendor)  ₹500  → company owes less
Credit: Purchase Expense Reversal          → reduces purchase cost

Effect on Reports:
- Purchase cost decreases
- Vendor balance decreases (company owes less)
```

---

### MODULE 5: GENERAL LEDGER & JOURNAL ENTRIES
---

#### 5.1 Journal Entry

**What it is**: The fundamental accounting record. Every transaction (PO, SO, CN, DN, Payments, etc.) is recorded as JE.

**Manual Journal Entry**:
```
When you need to record something not auto-captured:
- Bank loan receipt
- Owner capital injection
- Depreciation
- Manual adjustments
```

**Journal Entry Model**:
```javascript
{
  _id: ObjectId,
  
  jeNumber: String,          // JE001 (unique)
  jeDate: Date,
  financialYear: String,
  
  narration: String,         // Description of transaction
  
  lines: [
    {
      _id: ObjectId,
      account: ref→CoA,
      debitAmount: Number,
      creditAmount: Number,
      description: String      // Line-level narration
    }
  ],
  
  // Validation
  totalDebits: Number,       // Sum of all debits (auto-calculated)
  totalCredits: Number,      // Sum of all credits (auto-calculated)
  isBalanced: Boolean,       // totalDebits == totalCredits?
  
  // Workflow
  status: "DRAFT" | "POSTED" | "REVERSED",
  postedBy: ref→User,
  postedDate: Date,
  
  // Reversal (if applicable)
  reversedJeRef: ref→JournalEntry,
  reversedReason: String,
  
  attachments: [String],     // File URLs for supporting docs
  
  createdBy: ref→User,
  createdAt
}
```

**GL Account Balance Calculation**:
```javascript
// Real-time GL balance for any account:

closingBalance = 
  openingBalance 
  + Sum(all JE debits for this account) 
  - Sum(all JE credits for this account)

Example:
Opening Balance: ₹50,000
+ JE Debit: ₹10,000
+ JE Debit: ₹5,000
- JE Credit: ₹20,000
= Closing Balance: ₹45,000
```

---

### MODULE 6: FINANCIAL REPORTS
---

#### 6.1 Trial Balance

**What it is**: List of all accounts with their balances. Must balance! (Total Debits = Total Credits)

**Query Logic**:
```javascript
db.CoA.aggregate([
  {
    $lookup: {
      from: "JournalEntries",
      localField: "_id",
      foreignField: "lines.account",
      as: "transactions"
    }
  },
  {
    $project: {
      code: 1,
      name: 1,
      openingBalance: 1,
      totalDebits: { $sum: "$transactions.lines.debitAmount" },
      totalCredits: { $sum: "$transactions.lines.creditAmount" },
      closingBalance: {
        $add: [
          "$openingBalance",
          { $subtract: [
            { $sum: "$transactions.lines.debitAmount" },
            { $sum: "$transactions.lines.creditAmount" }
          ]}
        ]
      }
    }
  }
])
```

**Report Output**:
```
TRIAL BALANCE AS ON 31-03-2026
─────────────────────────────────────────────
Account Name          Code    Debit    Credit
─────────────────────────────────────────────
Cash                  1010    50,000    -
Bank                  1020    2,00,000  -
Inventory             1030    5,00,000  -
Debtors               1040    1,50,000  -
Fixed Assets          1050    10,00,000 -
                                      
Creditors             2010    -         2,00,000
GST Payable           2020    -         50,000
Long-term Loan        2030    -         5,00,000
                              
Capital               3010    -         10,00,000
Retained Earnings     3020    -         1,00,000
                              
Sales                 4010    -         20,00,000
Purchase              5010    10,00,000 -
Salary Expense        5020    2,00,000  -
Other Expenses        5030    1,50,000  -
─────────────────────────────────────────────
TOTAL                        30,50,000  30,50,000
─────────────────────────────────────────────
```

**Implementation**:
```javascript
// Route: GET /api/reports/trial-balance?financialYear=FY2025-26

function generateTrialBalance(fyear) {
  1. Get all CoA accounts with opening balances
  2. For each account, sum debits & credits from JEs
  3. Calculate closing balance
  4. Verify: Total Debits = Total Credits
  5. Return formatted report
}
```

---

#### 6.2 Balance Sheet

**What it is**: Shows company's financial position (Assets, Liabilities, Equity) on a specific date.

**Structure**:
```
BALANCE SHEET AS ON 31-03-2026
═════════════════════════════════════════

ASSETS
─────────────────────────────────────────
Fixed Assets:
  Land & Building              5,00,000
  Machinery                     2,00,000
  Furniture & Fixtures           50,000
  Accumulated Depreciation      (50,000)
  ────────────────────────────
  Total Fixed Assets                    7,00,000

Current Assets:
  Cash                           50,000
  Bank                         2,00,000
  Inventory                    5,00,000
  Debtors                      1,50,000
  ────────────────────────────
  Total Current Assets                  9,00,000

TOTAL ASSETS                          16,00,000

LIABILITIES & EQUITY
─────────────────────────────────────────
Current Liabilities:
  Creditors                    2,00,000
  GST Payable                     50,000
  ────────────────────────────
  Total Current Liabilities             2,50,000

Long-term Liabilities:
  Long-term Loan               5,00,000

Total Liabilities                      7,50,000

Equity:
  Capital                     10,00,000
  Retained Earnings           -1,50,000
  ────────────────────────────
  Total Equity                         8,50,000

TOTAL LIABILITIES & EQUITY           16,00,000

Verification: Assets (16L) = Liabilities (7.5L) + Equity (8.5L) ✓
```

---

#### 6.3 Profit & Loss Statement (Income Statement)

**What it is**: Shows company's profitability over a period.

**Structure**:
```
PROFIT & LOSS STATEMENT
For the period: 01-04-2025 to 31-03-2026
═════════════════════════════════════════

REVENUE
─────────────────────────────────────────
Sales                           20,00,000
Less: Sales Return               (1,00,000)
─────────────────────────────
Net Sales                       19,00,000

Other Income                       50,000
─────────────────────────────
TOTAL REVENUE                   19,50,000

COST OF GOODS SOLD
─────────────────────────────────────────
Opening Stock (1-Apr-2025)        5,00,000
Less: Closing Stock             (4,50,000)
─────────────────────────────
Cost of Goods Sold              4,50,000

GROSS PROFIT                    15,00,000
(19,50,000 - 4,50,000)

OPERATING EXPENSES
─────────────────────────────────────────
Salaries                        2,00,000
Rent                              50,000
Utilities                         20,000
Office Expenses                   15,000
Marketing                         10,000
─────────────────────────────
Total Operating Expenses        2,95,000

PROFIT BEFORE TAX (PBT)         12,05,000

Tax (Assume 30%)                3,61,500

NET PROFIT AFTER TAX (PAT)       8,43,500
```

**Query Logic**:
```javascript
function generateP&L(fromDate, toDate) {
  1. REVENUE section:
     - Sum all INCOME account JEs in period
     - Add opening stock
     - Subtract closing stock
  
  2. EXPENSES section:
     - Sum all EXPENSE account JEs in period
  
  3. Calculate:
     - Gross Profit = Revenue - COGS
     - Operating Income = Gross Profit - OpEx
     - Net Profit = Operating Income - Tax
  
  4. Return formatted report
}
```

---

### MODULE 7: GST COMPLIANCE
---

#### 7.1 GST Master Setup

**What if is**: Goods & Service Tax (18% on most items in India)

**Types**:
```
IGST (Integrated GST):       For inter-state transactions (9% on sales + 9% on purchases)
SGST (State GST):           For intra-state sales (9% on sales)
CGST (Central GST):         For intra-state sales (9% on sales)

ITC (Input Tax Credit):     Tax paid on purchases can be offset against tax on sales
```

**HSN Code Management**:
```javascript
{
  _id: ObjectId,
  hsnCode: String,           // "7113" for jewelry
  description: String,       // "Articles of jewelry..."
  gstRate: Number,          // 5, 12, 18, 28
  applicableTo: String      // "Jewelry"
}
```

**GST Configuration in Product**:
```javascript
// Existing Product model needs:

{
  _id: ObjectId,
  ...existing fields...
  
  // NEW GST Fields
  hsnCode: String,
  gstRate: Number,           // 5, 12, 18, or 28
  
  // For SO (Intra-state to customer in same state):
  sgst: Number,             // 9% if gstRate is 18%
  cgst: Number,             // 9% if gstRate is 18%
  
  // For SO (Inter-state to customer in different state):
  igst: Number              // 18% if gstRate is 18%
}
```

---

#### 7.2 GST Invoicing

**Implementation in SO**:
```javascript
// When creating SO invoice:

items: [
  {
    productId: ref,
    qty: 10,
    rate: 1000,              // Rate excludes tax
    
    // Auto-calculate based on customer location
    if (customerState === companyState) {
      sgst = (qty × rate × gstRate) / 100 / 2  // 9% part
      cgst = (qty × rate × gstRate) / 100 / 2  // 9% part
      igst = 0
    } else {
      igst = (qty × rate × gstRate) / 100      // Full 18%
      sgst = 0
      cgst = 0
    }
  }
]
```

**Invoice Display**:
```
LINE ITEM LEVEL:
Product: Pearl Necklace
HSN: 7113
Qty: 10 units
Rate: ₹1,000 per unit = ₹10,000
Discount: 5% = ₹500
Taxable Value: ₹9,500

Tax Calculation (Intra-state):
SGST (9%): ₹855
CGST (9%): ₹855
Total Tax: ₹1,710

Line Total: ₹9,500 + ₹1,710 = ₹11,210
```

---

#### 7.3 GST Reports

**GSTR-1 (Sales)**:
```javascript
// Summary of all sales (invoices) in a month

{
  _id: ObjectId,
  reportMonth: "March 2026",
  
  // B2B Sales (Business to Business)
  b2bSales: [
    {
      customerGST: "18AABCD1234H1Z0",
      invoiceNo: "INV001",
      invoiceDate: Date,
      invoiceValue: 11210,
      taxableValue: 9500,
      sgst: 855,
      cgst: 855,
      igst: 0
    }
  ],
  
  // B2C Sales (Business to Consumer)
  b2cSales: [
    {
      invoiceValue: 1000,
      taxableValue: 1000,
      sgst: 45,
      cgst: 45
    }
  ],
  
  // Exports
  exports: [],
  
  // Totals
  totalSalesValue: 12210,
  totalTaxableValue: 10500,
  totalSGST: 900,
  totalCGST: 900,
  totalIGST: 0,
  totalTax: 1800,
  
  generatedDate: Date
}
```

**GSTR-2 (Purchases)**:
```javascript
// Summary of all purchases (POs, Invoices) in a month
// Structure similar to GSTR-1 but for purchases
```

**GSTR-3B (Payment)**:
```javascript
// Shows:
// - Outward supplies (sales)
// - Inward supplies (purchases)
// - ITC (Input Tax Credit) claimed
// - Net GST to pay or refund
```

---

### MODULE 8: ROLE-BASED ACCESS CONTROL (RBAC)
---

#### 8.1 User Roles

**Roles to Define**:
```
┌──────────────────────────────────────────────────────┐
│ 1. SUPER ADMIN                                       │
│    - Full system access                              │
│    - Can create other users & roles                  │
│    - Can access all reports & configurations         │
│                                                       │
│ 2. ADMIN                                             │
│    - Manage all modules                              │
│    - Cannot delete financial records                 │
│    - Cannot modify approved documents                │
│                                                       │
│ 3. MANAGER                                           │
│    - Approve POs > ₹50,000                          │
│    - Approve SOs > ₹1,00,000                        │
│    - View all reports                                │
│    - Cannot create accounts in COA                   │
│                                                       │
│ 4. PURCHASE EXECUTIVE                               │
│    - Create & manage POs                             │
│    - Cannot approve                                  │
│    - Cannot access Sales orders or Accounting       │
│                                                       │
│ 5. SALES EXECUTIVE                                  │
│    - Create & manage SOs                             │
│    - Create & approve Credit Notes (own company)     │
│    - Cannot see Purchase orders or GL                │
│                                                       │
│ 6. ACCOUNTANT                                        │
│    - Can view GL, Trial Balance, P&L                │
│    - Can create Journal Entries                      │
│    - Can post Credit/Debit Notes                     │
│    - Cannot modify PO/SO amounts                     │
│                                                       │
│ 7. WAREHOUSE MANAGER                                │
│    - Can receive goods (GRN)                         │
│    - Can issue goods (Delivery Challan)              │
│    - Can report stock adjustments                    │
│    - Cannot modify rates or prices                   │
│                                                       │
│ 8. VIEW-ONLY USER                                   │
│    - Read-only access to assigned modules            │
│    - Can export reports                              │
│    - Cannot create or modify anything               │
└──────────────────────────────────────────────────────┘
```

#### 8.2 Permissions Matrix

**Database Model**:
```javascript
{
  _id: ObjectId,
  
  role: String,              // "PURCHASE_EXECUTIVE"
  
  // Module-level permissions
  modules: {
    purchaseOrder: {
      create: true,
      read: true,
      update: true,
      delete: false,
      approve: false,
      applovalLimit: null    // Only show docs under limit
    },
    
    salesOrder: {
      create: false,
      read: false,
      update: false,
      delete: false,
      approve: false
    },
    
    accountingGL: {
      create: false,
      read: false,
      update: false,
      delete: false
    },
    
    reports: {
      trialBalance: true,
      profitLoss: true,
      balanceSheet: true,
      gstReports: false,
      export: true
    }
  },
  
  // Field-level security (hide sensitive fields)
  hiddenFields: {
    purchaseOrder: ["vendorBankDetails", "creditLimit"],
    salesOrder: ["marginPercentage", "profitAmount"]
  },
  
  // Document-level security
  dataScope: {
    warehouse: ["WH001", "WH002"],  // Only see these warehouses
    vendor: ["All"],                 // Or specific vendors
    customer: ["All"],               // Or specific customers
    salesman: ["Self"]               // Can see only own records
  }
}
```

#### 8.3 Implementation

**Frontend Guard**:
```javascript
// ProtectedRoute.jsx
function ProtectedRoute({ element, requiredPermissions }) {
  const user = useContext(AuthContext);
  
  const hasPermission = requiredPermissions.every(perm => 
    user.permissions.includes(perm)
  );
  
  if (!hasPermission) {
    return <AccessDenied />;
  }
  
  return element;
}

// Usage:
<Route 
  path="/purchase-order" 
  element={
    <ProtectedRoute 
      element={<InventoryPurchaseOrder />}
      requiredPermissions={["purchaseOrder:create", "purchaseOrder:read"]}
    />
  }
/>
```

**Backend Guard**:
```express.js
// Middleware: checkPermission
function checkPermission(permission) {
  return (req, res, next) => {
    const user = req.user;  // From JWT token
    
    if (!user.permissions.includes(permission)) {
      return res.status(403).json({ 
        error: "Insufficient permissions" 
      });
    }
    
    next();
  };
}

// Usage:
router.post('/purchase-orders', 
  checkPermission('purchaseOrder:create'),
  createPO
);

router.put('/purchase-orders/:id/approve',
  checkPermission('purchaseOrder:approve'),
  approvePO
);
```

---

### MODULE 9: PAYMENT METHODOLOGIES
---

#### 9.1 Payment Methods

**During SO Creation**:
```javascript
{
  _id: ObjectId,
  
  soRef: ref→SalesOrder,
  
  payments: [
    {
      paymentMode: "CASH" | "CHEQUE" | "BANK_TRANSFER" | "UPI" | "CREDIT_CARD",
      amount: Number,
      paymentDate: Date,
      
      // Mode-specific details
      bankDetails: {                          // For BANK_TRANSFER
        bankName: String,
        accountNo: String,
        ifscCode: String,
        transactionId: String,
        referenceNo: String
      },
      
      chequeDetails: {                        // For CHEQUE
        chequeNo: String,
        chequeDate: Date,
        bankName: String,
        branch: String
      },
      
      upiDetails: {                           // For UPI
        upiId: String,
        transactionId: String
      },
      
      status: "PENDING" | "CLEARED" | "BOUNCED" | "CANCELLED",
      
      reconciled: Boolean,                    // Bank reconciled?
      reconciliationDate: Date
    }
  ],
  
  totalAmount: Number,
  amountReceived: Number,
  amountDue: Number,
  
  createdAt
}
```

#### 9.2 Payment Reconciliation

**Monthly Bank Reconciliation**:
```javascript
{
  _id: ObjectId,
  
  month: "March 2026",
  bankAccount: ref→BankAccount,
  
  // Bank statement data
  statementOpeningBalance: Number,
  statementClosingBalance: Number,
  
  // Our GL data
  glOpeningBalance: Number,
  glClosingBalance: Number,
  
  // Reconciliation items
  deposits: [
    {
      paymentRef: ref→Payment,
      amount: Number,
      status: "MATCHED" | "NOT_MATCHED"
    }
  ],
  
  withdrawals: [
    {                                         // Eg: cheque payments
      paymentRef: ref→Payment,
      amount: Number,
      status: "CLEARED" | "OUTSTANDING"  
    }
  ],
  
  // Differences
  unmatchedAmount: Number,
  outstandingItems: [{...}],
  
  status: "BALANCED" | "UNBALANCED",
  reconciledBy: ref→User,
  reconciledDate: Date
}
```

**Database Model for Bank Account**:
```javascript
{
  _id: ObjectId,
  
  accountNo: String,
  bankName: String,
  branch: String,
  accountHolder: String,
  ifscCode: String,
  
  // Opening balance (as on FY start date)
  openingBalance: Number,
  
  // Current balance (auto-calculated)
  currentBalance: Number,    // = Opening + Deposits - Withdrawals
  
  // Reconciliation tracking
  lastReconciledDate: Date,
  lastReconciledBalance: Number,
  
  isActive: Boolean,
  createdAt
}
```

---

### MODULE 10: CRM ENHANCEMENTS
---

#### 10.1 Complete Customer Master

**Enhanced Customer Model**:
```javascript
{
  _id: ObjectId,
  
  // Basic Info
  customerCode: String,      // C001 (unique)
  name: String,
  email: String,
  phone: String,
  whatsapp: String,
  
  // Business Details
  shopName: String,
  businessType: "RETAILER" | "WHOLESALER" | "DISTRIBUTOR",
  industryType: String,
  
  // GST & Tax
  gstIN: String,             // GSTIN
  panNo: String,
  
  // Addresses
  billingAddress: {
    street: String,
    city: String,
    district: String,
    state: String,
    pincode: String,
    country: String
  },
  
  shippingAddresses: [
    {
      label: String,         // "Main Shop", "Branch", etc.
      ...address fields...
    }
  ],
  
  // Credit Management
  creditLimit: Number,       // Max credit allowed
  creditUsed: Number,        // Current outstanding
  creditAvailable: Number,   // creditLimit - creditUsed
  
  paymentTerms: String,      // "Net 30", "2/10 Net 30", etc.
  
  // Contact Persons
  contactPersons: [
    {
      name: String,
      designation: String,
      phone: String,
      email: String,
      isPrimary: Boolean
    }
  ],
  
  // Bank Details
  bankDetails: {
    accountNo: String,
    bankName: String,
    ifscCode: String,
    accountHolder: String
  },
  
  // Relationship Management
  assignedSalesman: ref→SalesMan,
  preferredWarehouse: ref→Warehouse,
  
  // Classification
  customerClass: "A" | "B" | "C",  // Based on sales
  isActive: Boolean,
  
  // CRM Fields
  remarks: String,
  lastOrderDate: Date,
  lastOrderAmount: Number,
  totalLifetimeValue: Number,  // Sum of all sales
  
  // Activity Tracking
  activities: [
    {
      type: "CALL" | "MEETING" | "EMAIL" | "ORDER",
      date: Date,
      details: String,
      createdBy: ref→User
    }
  ],
  
  // Loyalty
  loyaltyPoints: Number,
  preferredCustomer: Boolean,
  
  createdAt,
  updatedAt
}
```

#### 10.2 CRM Features

1. **Customer Segmentation**:
```javascript
// Dashboard should show:
- High-value customers (Top 10% by sales)
- New customers (Joined in last 3 months)
- Inactive customers (No order in 6 months)
- At-risk customers (Credit limit exceeded)
- Loyal customers (Repeat orders)
```

2. **Sales Pipeline**:
```javascript
// Track customer journey:
LEAD → PROSPECT → QUOTATION → SALES ORDER → CUSTOMER
```

3. **Activity Tracking**:
```javascript
// Log every interaction:
- Call logs with notes
- Meeting minutes
- Email threads
- Order history
```

---

### MODULE 11: RECURRING ORDERS & AUTOMATION
---

#### 11.1 Recurring Sales Orders

**Use Case**: Large customers who reorder the same products monthly/quarterly.

**Model**:
```javascript
{
  _id: ObjectId,
  
  recurringOrderNo: String,  // RO001
  
  customer: ref→Customer,
  
  // Template items
  items: [
    {
      productId: ref→Product,
      qty: Number,
      rate: Number,
      // Discount, tax settings...
    }
  ],
  
  // Recurrence settings
  frequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY",
  
  // Dates
  firstOrderDate: Date,
  nextOrderDate: Date,
  lastOrderDate: Date,
  endDate: Date,             // Optional, recurring ends on this date
  
  // Auto-generation settings
  autoGenerate: Boolean,
  requiresApprovalEachTime: Boolean,
  
  // Workflow
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED",
  
  // History
  generatedOrders: [ref→SalesOrder],
  
  createdAt
}
```

**Auto-Generation Logic**:
```javascript
// Scheduled job (runs daily at 2 AM)
async function generateRecurringOrders() {
  const today = new Date();
  
  // Find all active recurring orders with nextOrderDate = today
  const orders = await RecurringOrder.find({
    status: "ACTIVE",
    nextOrderDate: { $lte: today }
  });
  
  for (const ro of orders) {
    // Create new SO from template
    const newSO = {
      soNumber: generateSONumber(),
      customer: ro.customer,
      items: ro.items,
      soDate: today,
      status: "DRAFT",  // Or "PENDING_APPROVAL" based on settings
      recurringOrderRef: ro._id
    };
    
    const savedSO = await SalesOrder.create(newSO);
    
    // Update recurring order
    ro.lastOrderDate = today;
    ro.generatedOrders.push(savedSO._id);
    
    // Calculate next order date
    switch(ro.frequency) {
      case "MONTHLY":
        ro.nextOrderDate = addMonths(today, 1);
        break;
      case "QUARTERLY":
        ro.nextOrderDate = addMonths(today, 3);
        break;
      // ... other frequencies
    }
    
    // Check if recurring should end
    if (ro.endDate && ro.nextOrderDate > ro.endDate) {
      ro.status = "COMPLETED";
    }
    
    await ro.save();
    
    // Send notification
    notifyUser(`Recurring order RO${ro.recurringOrderNo} generated as SO${newSO.soNumber}`);
  }
}
```

---

## <a name="database"></a>6. Database Schema Enhancements

### New Collections to Add

```javascript
// 1. ChartOfAccounts
db.createCollection("chartofaccounts", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["code", "name", "accountType"],
      properties: {
        code: { bsonType: "string" },
        name: { bsonType: "string" },
        accountType: { enum: ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] },
        parent: { bsonType: "objectId" }
      }
    }
  }
})

// 2. JournalEntries
db.createCollection("journalentries", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["jeNumber", "jeDate", "lines"],
      properties: {
        jeNumber: { bsonType: "string" },
        jeDate: { bsonType: "date" },
        lines: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              account: { bsonType: "objectId" },
              debitAmount: { bsonType: "double" },
              creditAmount: { bsonType: "double" }
            }
          }
        }
      }
    }
  }
})

// 3. OpeningBalances
db.createCollection("openingbalances")

// 4. GoodsReceiptNotes
db.createCollection("goodsreceiptnotes")

// 5. DeliveryChallan
db.createCollection("deliverychallan")

// 6. RecurringOrders
db.createCollection("recurringorders")

// 7. Payments
db.createCollection("payments")

// 8. BankReconciliation
db.createCollection("bankreconciliation")

// 9. UserRoles & Permissions
db.createCollection("userroles")
db.createCollection("permissions")

// 10. AuditLog
db.createCollection("auditlog")
```

### Indices for Performance

```javascript
// Frequently queried indices
db.purchaseorder.createIndex({ "invoiceId": 1 })
db.purchaseorder.createIndex({ "vendor": 1, "poDate": -1 })
db.purchaseorder.createIndex({ "status": 1 })
db.purchaseorder.createIndex({ "financialYear": 1 })

db.salesorder.createIndex({ "soNumber": 1 })
db.salesorder.createIndex({ "customer": 1, "soDate": -1 })
db.salesorder.createIndex({ "status": 1 })
db.salesorder.createIndex({ "financialYear": 1 })

db.journalentries.createIndex({ "jeDate": -1 })
db.journalentries.createIndex({ "lines.account": 1 })
db.journalentries.createIndex({ "status": 1 })

db.customer.createIndex({ "gstIN": 1 })
db.customer.createIndex({ "email": 1 })
db.customer.createIndex({ "phone": 1 })

db.vendor.createIndex({ "gstIN": 1 })
db.vendor.createIndex({ "vendorCode": 1 })

// Compound indices for complex queries
db.salesorder.createIndex({ "financialYear": 1, "status": 1, "soDate": -1 })
```

---

## <a name="step-by-step"></a>7. Step-by-Step Implementation Procedure

### PHASE 1: FOUNDATION (Weeks 1-4)

#### Week 1: Database & COA Setup

**Task 1.1: Create Chart of Accounts**

```bash
# Backend - Create new controller
File: backend/controllers/chartOfAccountsController.js

// Functions to implement:
1. createCoA()           - Create new account
2. getCoAHierarchy()     - Get full hierarchy
3. updateCoA()           - Modify account
4. getCoAByType()        - Filter by ASSET, LIABILITY, etc.
5. validateBalance()     - Check if balanced

# Backend - Create routes
File: backend/routes/coaRoutes.js

router.post('/', createCoA);
router.get('/', getCoAHierarchy);
router.get('/by-type/:type', getCoAByType);
router.put('/:id', updateCoA);
router.delete('/:id', deleteCoA);

# Backend - Update Mongoose model
File: backend/models/ChartOfAccounts.js

const coaSchema = new Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  accountType: { type: String, enum: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] },
  parent: { type: Schema.Types.ObjectId, ref: 'ChartOfAccounts' },
  openingBalance: { type: Number, default: 0 },
  isHeader: Boolean,
  allowJournalEntry: Boolean,
  timestamps: true
})
```

**Task 1.2: Frontend - COA Master Page**

```jsx
// File: src/pages/ChartOfAccountsPage.jsx

import { useState, useEffect } from 'react';

function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [expandedParents, setExpandedParents] = useState([]);
  
  useEffect(() => {
    fetch(`${API_BASE}/chart-of-accounts`)
      .then(r => r.json())
      .then(data => setAccounts(data))
  }, []);
  
  const renderTree = (accounts, parentId = null) => {
    return (
      <ul>
        {accounts
          .filter(a => a.parent === parentId)
          .map(account => (
            <li key={account._id}>
              <strong>{account.code}</strong> - {account.name}
              ({account.accountType})
              
              {hasChildren(account._id) && (
                <button onClick={() => toggleExpand(account._id)}>
                  {expandedParents.includes(account._id) ? '▼' : '▶'}
                </button>
              )}
              
              {expandedParents.includes(account._id) && 
                renderTree(accounts, account._id)
              }
            </li>
          ))
        }
      </ul>
    );
  };
  
  return (
    <div>
      <h1>Chart of Accounts</h1>
      {renderTree(accounts)}
    </div>
  );
}
```

---

**Task 1.3: Opening Balance Setup**

```jsx
// File: src/pages/OpeningBalanceSetupPage.jsx

function OpeningBalanceSetup() {
  const [accounts, setAccounts] = useState([]);
  const [balances, setBalances] = useState({});
  
  const handleOpeningBalanceInput = (accountId, value) => {
    setBalances(prev => ({
      ...prev,
      [accountId]: value
    }));
  };
  
  const submitOpeningBalances = async () => {
    const payload = Object.entries(balances).map(([accountId, balance]) => ({
      account: accountId,
      openingBalance: balance,
      financialYear: "FY2025-26"
    }));
    
    const response = await fetch(`${API_BASE}/opening-balances`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      alert('Opening balances saved!');
      // Verify balance
      verifyBalance();
    }
  };
  
  const verifyBalance = async () => {
    const response = await fetch(`${API_BASE}/opening-balances/verify`);
    const verification = await response.json();
    
    console.log(`Assets: ${verification.totalAssets}`);
    console.log(`Liabilities: ${verification.totalLiabilities}`);
    console.log(`Equity: ${verification.totalEquity}`);
    
    if (Math.abs(verification.totalAssets - 
                 (verification.totalLiabilities + verification.totalEquity)) < 0.01) {
      alert('✓ Balances verified! (Assets = Liabilities + Equity)');
    } else {
      alert('✗ Imbalance detected!');
    }
  };
  
  return (
    <form>
      <h1>Opening Balance Setup - FY 2025-26</h1>
      {accounts.map(account => (
        <div key={account._id}>
          <label>{account.name}</label>
          <input 
            type="number"
            onChange={(e) => handleOpeningBalanceInput(account._id, e.target.value)}
          />
        </div>
      ))}
      
      <button onClick={submitOpeningBalances}>Save & Verify</button>
    </form>
  );
}
```

---

**Task 1.4: Opening Stock Setup**

```jsx
// File: src/pages/OpeningStockSetupPage.jsx

function OpeningStockSetup() {
  const [products, setProducts] = useState([]);
  const [stocks, setStocks] = useState([]);
  
  const addStockEntry = () => {
    setStocks(prev => [...prev, { productId: '', qty: 0, costPerUnit: 0 }]);
  };
  
  const submitOpeningStock = async () => {
    const payload = stocks.map(s => ({
      product: s.productId,
      openingQty: s.qty,
      costPerUnit: s.costPerUnit,
      totalValue: s.qty * s.costPerUnit,
      financialYear: "FY2025-26"
    }));
    
    await fetch(`${API_BASE}/opening-stock`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    // Auto-create GL entry
    await fetch(`${API_BASE}/journal-entries/auto-opening-stock`, { method: 'POST' });
    
    alert('Opening stock saved and GL entries created!');
  };
  
  return (
    <form>
      <h1>Opening Stock - FY 2025-26</h1>
      
      <table>
        <tr>
          <th>Product</th>
          <th>Qty</th>
          <th>Cost/Unit</th>
          <th>Total Value</th>
        </tr>
        {stocks.map((stock, i) => (
          <tr key={i}>
            <td>
              <select value={stock.productId} 
                onChange={(e) => updateStock(i, 'productId', e.target.value)}>
                {products.map(p => <option value={p._id}>{p.name}</option>)}
              </select>
            </td>
            <td>
              <input type="number" 
                value={stock.qty}
                onChange={(e) => updateStock(i, 'qty', e.target.value)} />
            </td>
            <td>
              <input type="number" 
                value={stock.costPerUnit}
                onChange={(e) => updateStock(i, 'costPerUnit', e.target.value)} />
            </td>
            <td>{stock.qty * stock.costPerUnit}</td>
          </tr>
        ))}
      </table>
      
      <button onClick={addStockEntry}>Add Row</button>
      <button onClick={submitOpeningStock}>Save Opening Stock</button>
    </form>
  );
}
```

---

**Task 1.5: Financial Year Configuration**

```javascript
// Backend Model: FinancialYear.js

const financialYearSchema = new Schema({
  fiscalYear: String,        // "FY2025-26"
  startDate: Date,           // 2025-04-01
  endDate: Date,             // 2026-03-31
  status: "ACTIVE" | "CLOSED",
  lockDate: Date,            // After this date, no modifications allowed
  createdBy: ref→User,
  createdAt
});

// Setup page for FY configuration
function FinancialYearSetupPage() {
  const [currentFY, setCurrentFY] = useState(null);
  const [nextFY, setNextFY] = useState(null);
  
  const createNewFY = async () => {
    await fetch(`${API_BASE}/financial-years`, {
      method: 'POST',
      body: JSON.stringify({
        fiscalYear: "FY2026-27",
        startDate: "2026-04-01",
        endDate: "2027-03-31"
      })
    });
    alert('New financial year created!');
  };
  
  const generateClosingBalances = async () => {
    // Calculate closing balances for current FY
    // They become opening balances for next FY
    await fetch(`${API_BASE}/opening-balances/generate-from-closing`, {
      method: 'POST',
      body: JSON.stringify({ fromFY: "FY2025-26", toFY: "FY2026-27" })
    });
    alert('Closing balances generated for next FY!');
  };
  
  return (
    <div>
      <h1>Financial Year Configuration</h1>
      <button onClick={createNewFY}>Create New FY</button>
      <button onClick={generateClosingBalances}>Auto-generate Closing Balances</button>
    </div>
  );
}
```

---

#### Week 2-3: Role-Based Access Control

**Task 2.1: User Roles & Permissions**

```javascript
// Backend Model: UserRole.js

const userRoleSchema = new Schema({
  roleId: String,            // "PURCHASE_EXECUTIVE"
  roleName: String,          // "Purchase Executive"
  description: String,
  
  modules: {
    purchaseOrder: {
      permissions: ["create", "read", "update", "delete"],
      canApprove: Boolean,
      approvalMatrixLimit: Number  // Approve POs up to ₹X
    },
    salesOrder: {
      permissions: ["create", "read", "update"],
      canApprove: Boolean,
      approvalMatrixLimit: Number
    },
    accounting: {
      permissions: [],
      canViewGLOnly: Boolean
    },
    reports: {
      canAccess: Boolean,
      allowedReports: [String]  // ["TrialBalance", "P&L", ...]
    }
  },
  
  createdAt
});

// Backend: AuthMiddleware.js

function checkPermission(requiredPermissions) {
  return (req, res, next) => {
    const userRole = req.user.role;
    
    const hasPermission = requiredPermissions.every(perm => 
      userRole.modules[perm.module].permissions.includes(perm.action)
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    next();
  };
}

// Example usage:
router.post('/purchase-orders',
  checkPermission([{ module: 'purchaseOrder', action: 'create' }]),
  createPurchaseOrder
);

router.put('/purchase-orders/:id/approve',
  checkPermission([{ module: 'purchaseOrder', action: 'approve' }]),
  approvePurchaseOrder
);
```

---

#### Week 4: Audit Trail & Financial Year Close

**Task 4.1: Audit Log**

```javascript
// Backend Model: AuditLog.js

const auditLogSchema = new Schema({
  user: ref→User,
  action: String,           // "CREATE", "UPDATE", "DELETE", "APPROVE", "POST"
  documentType: String,     // "PurchaseOrder", "SalesOrder", "JournalEntry"
  documentId: ObjectId,
  documentNo: String,       // "PO001", "INV001", etc.
  
  oldValue: Object,         // Before update
  newValue: Object,         // After update
  
  ipAddress: String,
  userAgent: String,        // Browser info
  
  timestamp: Date,
  status: "SUCCESS" | "FAILED"
});

// Middleware to auto-log
function auditLog(req, res, next) {
  const originalSend = res.send;
  
  res.send = function(data) {
    AuditLog.create({
      user: req.user._id,
      action: req.method,
      documentType: req.route.path.split('/')[2],
      documentId: req.params.id,
      ipAddress: req.ip,
      timestamp: new Date(),
      status: res.statusCode < 400 ? 'SUCCESS' : 'FAILED'
    });
    
    originalSend.call(this, data);
  };
  
  next();
}
```

---

### PHASE 2: CORE TRANSACTIONS (Weeks 5-12)

#### Week 5-6: Enhanced PO Module

**Task: Complete PO Workflow with Approval**

```javascript
// Backend Controller: purchaseOrderController.js

// 1. Create PO (DRAFT status)
export const createPO = async (req, res) => {
  const { vendor, warehouse, items, ...rest } = req.body;
  
  // Generate unique PO number
  const poNumber = `PO${Date.now()}`;
  
  // Calculate totals
  let subtotal = 0;
  let totalTax = 0;
  items.forEach(item => {
    item.lineTotal = item.qty * item.rate - item.discount;
    item.lineTotal += item.lineTotal * (item.gst / 100);
    totalTax += item.lineTotal * (item.gst / 100);
    subtotal += item.qty * item.rate;
  });
  
  const po = new PurchaseOrder({
    poNumber,
    vendor,
    warehouse,
    items,
    subtotal,
    totalTax,
    grandTotal: subtotal + totalTax,
    status: 'DRAFT',
    approvalRequired: subtotal > 50000,  // Approval needed if > 50K
    createdBy: req.user._id,
    ...rest
  });
  
  await po.save();
  res.json({ success: true, po });
};

// 2. Submit for Approval
export const submitForApproval = async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  `po.status = 'PENDING_APPROVAL';
  po.approvalRequired = true;
  
  // Find approver based on amount
  const approvalLimit = po.grandTotal;
  const approver = await User.findOne({
    $or: [
      { role: 'DIRECTOR', approvalLimit: { $gte: approvalLimit } },
      { role: 'MANAGER', approvalLimit: { $gte: approvalLimit } }
    ]
  });
  
  if (approver) {
    // Send notification (Twilio/Email)
    notifyUser(approver, `PO ${po.poNumber} pending approval`);
  }
  
  await po.save();
  res.json({ success: true, message: 'PO submitted for approval' });
};

// 3. Approve PO
export const approvePO = async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  
  // Verify approver has authority
  const userApprovalLimit = req.user.approvalLimit;
  if (po.grandTotal > userApprovalLimit) {
    return res.status(403).json({ error: 'Insufficient approval authority' });
  }
  
  po.status = 'APPROVED';
  po.approvalStatus = 'APPROVED';
  po.approvedBy = req.user._id;
  po.approvalDate = new Date();
  
  await po.save();
  
  res.json({ success: true, message: 'PO approved' });
};

// 4. Create GRN (Goods Receipt Note)
export const createGRN = async (req, res) => {
  const { poId, items } = req.body;
  const po = await PurchaseOrder.findById(poId);
  
  if (!po || po.status !== 'APPROVED') {
    return res.status(400).json({ error: 'PO must be approved first' });
  }
  
  // Verify received quantity matches PO
  let discrepancy = false;
  items.forEach(item => {
    const poItem = po.items.find(i => i._id.toString() === item.itemId);
    if (item.receivedQty > poItem.qty * 1.02) {  // Allow 2% excess
      discrepancy = true;
      item.requiresApproval = true;
    }
  });
  
  const grn = new GoodsReceiptNote({
    grnNumber: `GRN${Date.now()}`,
    poReference: poId,
    items,
    createdBy: req.user._id
  });
  
  await grn.save();
  
  // Update PO status
  po.status = 'RECEIVED';
  po.deliveryNumber = grn.grnNumber;
  await po.save();
  
  // Update product stock
  for (const item of items) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { totalQty: item.acceptedQty }
    });
  }
  
  res.json({ success: true, grn });
};

// 5. Auto-create GL Entry when PO is Received
async function createPOGLEntry(poId) {
  const po = await PurchaseOrder.findById(poId);
  
  // Debit: Inventory Account
  // Credit: Accounts Payable (Vendor)
  
  const glEntry = new JournalEntry({
    jeDate: new Date(),
    narration: `Purchase: ${po.vendor}`,
    lines: [
      {
        account: INVENTORY_ACCOUNT_ID,  // Chart of Accounts: Inventory
        debitAmount: po.grandTotal,
        creditAmount: 0
      },
      {
        account: ACCOUNTS_PAYABLE_ID,   // Chart of Accounts: AP
        debitAmount: 0,
        creditAmount: po.grandTotal
      }
    ],
    status: 'POSTED',
    poRef: poId
  });
  
  await glEntry.save();
}
```

---

**Week 7-8: Enhanced SO Module**

```javascript
// Similar flow to PO but for Sales Orders
// Implement: SO creation → Approval → Delivery Challan → Invoice → Payment
```

---

**Week 9-10: Credit Notes & Debit Notes**

```javascript
// Backend Controller: creditNoteController.js

export const createCreditNote = async (req, res) => {
  const { invoiceId, items, reason } = req.body;
  
  const invoice = await SalesOrder.findById(invoiceId);
  
  const cn = new CreditNote({
    cnNumber: `CN${Date.now()}`,
    invoiceRef: invoiceId,
    customer: invoice.customer,
    reason,
    items: items.map(item => ({
      productId: item.productId,
      qty: item.returnedQty,
      rate: item.rate,
      lineTotal: item.returnedQty * item.rate,
      stockAdjustment: 'INCREASE'  // Add back to inventory
    })),
    cn_amount: items.reduce((sum, item) => sum + (item.returnedQty * item.rate), 0),
    status: 'DRAFT',
    createdBy: req.user._id
  });
  
  await cn.save();
  
  // Add back to inventory
  for (const item of items) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { totalQty: item.returnedQty }
    });
  }
  
  res.json({ success: true, cn });
};

export const postCreditNote = async (req, res) => {
  const cn = await CreditNote.findById(req.params.id);
  
  // Auto-create GL entry
  const glEntry = new JournalEntry({
    jeDate: new Date(),
    narration: `Sales Return: ${cn.cnNumber}`,
    lines: [
      {
        account: SALES_REVENUE_ID,
        debitAmount: cn.cn_amount,  // Debit: Reverse sales income
        creditAmount: 0
      },
      {
        account: ACCOUNTS_RECEIVABLE_ID,
        debitAmount: 0,
        creditAmount: cn.cn_amount  // Credit: Customer owes less
      }
    ],
    status: 'POSTED',
    cnRef: cn._id
  });
  
  await glEntry.save();
  
  cn.status = 'POSTED';
  cn.glEntryRef = glEntry._id;
  await cn.save();
  
  res.json({ success: true, cn });
};
```

---

#### Week 11-12: Payment Reconciliation

```javascript
// Backend Controller: paymentController.js

export const recordPayment = async (req, res) => {
  const { soId, amount, paymentMode, bankDetails } = req.body;
  
  const payment = new Payment({
    soRef: soId,
    amount,
    paymentMode,
    bankDetails,
    status: 'PENDING',  // Wait for bank clearing
    createdAt: new Date()
  });
  
  await payment.save();
  
  res.json({ success: true, payment });
};

export const reconcilePayment = async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  
  // Mark as cleared after bank statement reconciliation
  payment.status = 'CLEARED';
  payment.reconciled = true;
  payment.reconciliationDate = new Date();
  
  // Auto-create GL entry
  const glEntry = new JournalEntry({
    jeDate: payment.reconciliationDate,
    narration: `Payment received`,
    lines: [
      {
        account: BANK_ACCOUNT_ID,
        debitAmount: payment.amount,
        creditAmount: 0
      },
      {
        account: ACCOUNTS_RECEIVABLE_ID,
        debitAmount: 0,
        creditAmount: payment.amount
      }
    ],
    status: 'POSTED'
  });
  
  await glEntry.save();
  await payment.save();
  
  res.json({ success: true, payment });
};
```

---

### PHASE 3: FINANCIAL MANAGEMENT (Weeks 13-20)

#### Week 13-14: General Ledger & Trial Balance

```javascript
// Backend Route: reports/generalLedger.js

export const getGeneralLedger = async (req, res) => {
  const { account, fromDate, toDate } = req.query;
  
  const glEntries = await JournalEntry.find({
    'lines.account': account,
    jeDate: { $gte: new Date(fromDate), $lte: new Date(toDate) },
    status: 'POSTED'
  });
  
  let balance = 0;
  const acc = await ChartOfAccounts.findById(account);
  if (acc) balance = acc.openingBalance;
  
  const ledger = glEntries.map(je => {
    const line = je.lines.find(l => l.account.toString() === account);
    balance += (line.debitAmount - line.creditAmount);
    
    return {
      jeDate: je.jeDate,
      narration: je.narration,
      debit: line.debitAmount,
      credit: line.creditAmount,
      balance
    };
  });
  
  res.json(ledger);
};

export const getTrialBalance = async (req, res) => {
  const { financialYear, asOnDate } = req.query;
  
  const accounts = await ChartOfAccounts.find({});
  
  const trialBalance = [];
  let totalDebits = 0;
  let totalCredits = 0;
  
  for (const account of accounts) {
    const glEntries = await JournalEntry.find({
      'lines.account': account._id,
      jeDate: { $lte: new Date(asOnDate) },
      status: 'POSTED'
    });
    
    let balance = account.openingBalance;
    let debits = 0, credits = 0;
    
    glEntries.forEach(je => {
      const line = je.lines.find(l => l.account.toString() === account._id);
      debits += line.debitAmount;
      credits += line.creditAmount;
      balance += (debits - credits);
    });
    
    if (balance !== 0) {
      trialBalance.push({
        accountCode: account.code,
        accountName: account.name,
        accountType: account.accountType,
        debit: balance > 0 ? balance : 0,
        credit: balance < 0 ? Math.abs(balance) : 0
      });
      
      totalDebits += (balance > 0 ? balance : 0);
      totalCredits += (balance < 0 ? Math.abs(balance) : 0);
    }
  }
  
  // Add verification
  const balanced = Math.abs(totalDebits - totalCredits) < 0.01;
  
  res.json({
    trialBalance,
    totalDebits,
    totalCredits,
    balanced,
    message: balanced ? 'TB Balanced' : 'TB Unbalanced'
  });
};

// Frontend: TrialBalanceReport.jsx
function TrialBalanceReport() {
  const [tbData, setTBData] = useState(null);
  
  useEffect(() => {
    fetch(`${API_BASE}/reports/trial-balance?asOnDate=2026-03-31`)
      .then(r => r.json())
      .then(data => setTBData(data));
  }, []);
  
  if (!tbData) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>Trial Balance</h1>
      <table>
        <thead>
          <tr>
            <th>Account Code</th>
            <th>Account Name</th>
            <th>Debit</th>
            <th>Credit</th>
          </tr>
        </thead>
        <tbody>
          {tbData.trialBalance.map(row => (
            <tr key={row.accountCode}>
              <td>{row.accountCode}</td>
              <td>{row.accountName}</td>
              <td>₹{row.debit.toFixed(2)}</td>
              <td>₹{row.credit.toFixed(2)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 'bold'}}>
            <td colSpan="2">TOTAL</td>
            <td>₹{tbData.totalDebits.toFixed(2)}</td>
            <td>₹{tbData.totalCredits.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      
      <p style={{ color: tbData.balanced ? 'green' : 'red' }}>
        {tbData.message}
      </p>
    </div>
  );
}
```

---

#### Week 15-16: Balance Sheet

```javascript
// Backend: reports/balanceSheet.js

export const getBalanceSheet = async (req, res) => {
  const { asOnDate } = req.query;
  
  // Get all account balances as on that date
  const accounts = await ChartOfAccounts.find({});
  
  let assets = 0, liabilities = 0, equity = 0;
  const balanceSheetItems = {};
  
  for (const account of accounts) {
    const glEntries = await JournalEntry.find({
      'lines.account': account._id,
      jeDate: { $lte: new Date(asOnDate) },
      status: 'POSTED'
    });
    
    let balance = account.openingBalance;
    glEntries.forEach(je => {
      const line = je.lines.find(l => l.account.toString() === account._id);
      balance += (line.debitAmount - line.creditAmount);
    });
    
    if (balance !== 0) {
      if (!balanceSheetItems[account.accountType]) {
        balanceSheetItems[account.accountType] = [];
      }
      
      balanceSheetItems[account.accountType].push({
        accountName: account.name,
        balance: Math.abs(balance)
      });
      
      if (account.accountType === 'ASSET') assets += balance;
      else if (account.accountType === 'LIABILITY') liabilities += balance;
      else if (account.accountType === 'EQUITY') equity += balance;
    }
  }
  
  res.json({
    assets: {
      total: assets,
      items: balanceSheetItems['ASSET'] || []
    },
    liabilities: {
      total: liabilities,
      items: balanceSheetItems['LIABILITY'] || []
    },
    equity: {
      total: equity,
      items: balanceSheetItems['EQUITY'] || []
    },
    balanced: Math.abs(assets - (liabilities + equity)) < 0.01
  });
};
```

**Frontend Balance Sheet**:
```jsx
function BalanceSheetReport() {
  const [bs, setBS] = useState(null);
  
  return (
    <div>
      <h1>Balance Sheet as on {new Date().toLocaleDateString()}</h1>
      
      <div style={{ display: 'flex', gap: '50px' }}>
        {/* ASSETS */}
        <div>
          <h3>ASSETS</h3>
          <ul>
            {bs?.assets.items.map(item => (
              <li key={item.accountName}>
                {item.accountName}: ₹{item.balance}
              </li>
            ))}
          </ul>
          <strong>Total Assets: ₹{bs?.assets.total}</strong>
        </div>
        
        {/* LIABILITIES & EQUITY */}
        <div>
          <div>
            <h3>LIABILITIES</h3>
            <ul>
              {bs?.liabilities.items.map(item => (
                <li key={item.accountName}>
                  {item.accountName}: ₹{item.balance}
                </li>
              ))}
            </ul>
            <strong>Total Liabilities: ₹{bs?.liabilities.total}</strong>
          </div>
          
          <div style={{ marginTop: '30px' }}>
            <h3>EQUITY</h3>
            <ul>
              {bs?.equity.items.map(item => (
                <li key={item.accountName}>
                  {item.accountName}: ₹{item.balance}
                </li>
              ))}
            </ul>
            <strong>Total Equity: ₹{bs?.equity.total}</strong>
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: '30px', color: bs?.balanced ? 'green' : 'red' }}>
        <strong>
          {bs?.balanced ? '✓ BALANCED' : '✗ UNBALANCED'}
        </strong>
      </div>
    </div>
  );
}
```

---

#### Week 17-18: Profit & Loss Statement

```javascript
// Backend: reports/profitLoss.js

export const getProfitLoss = async (req, res) => {
  const { fromDate, toDate } = req.query;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  
  // Opening Stock
  const openingStockRecords = await OpeningStock.find({
    createdAt: { $lt: from }
  });
  
  const openingStockValue = openingStockRecords.reduce(
    (sum, record) => sum + record.totalValue,
    0
  );
  
  // Get all GL entries in the period
  const glEntries = await JournalEntry.find({
    jeDate: { $gte: from, $lte: to },
    status: 'POSTED'
  }).populate('lines.account');
  
  // Categorize by account type
  let salesRevenue = 0,
    otherIncome = 0,
    purchaseCost = 0,
    operatingExpenses = 0;
  
  glEntries.forEach(je => {
    je.lines.forEach(line => {
      const amount = line.creditAmount - line.debitAmount;  // For income/expense
      
      switch(line.account.accountType) {
        case 'INCOME':
          salesRevenue += amount;
          break;
        case 'EXPENSE':
          if (line.account.name.includes('Purchase')) {
            purchaseCost += amount;
          } else {
            operatingExpenses += amount;
          }
          break;
      }
    });
  });
  
  // Get Closing Stock
  const closingStockRecords = await OpeningStock.find({
    createdAt: { $lte: to }
  });
  
  const closingStockValue = closingStockRecords.reduce(
    (sum, record) => sum + record.totalValue,
    0
  );
  
  // Calculate P&L
  const cogs = openingStockValue + purchaseCost - closingStockValue;
  const grossProfit = salesRevenue - cogs;
  const operatingIncome = grossProfit - operatingExpenses;
  const tax = operatingIncome * 0.30;
  const netProfit = operatingIncome - tax;
  
  res.json({
    period: `${fromDate} to ${toDate}`,
    revenue: salesRevenue,
    otherIncome,
    cogs,
    grossProfit,
    operatingExpenses,
    operatingIncome,
    tax,
    netProfit
  });
};
```

---

### PHASE 4: GST & CRM (Weeks 21-28)

#### Week 21-22: GST Compliance

```javascript
// Backend: GST Report Generation

export const generateGSTR1 = async (req, res) => {
  const { month, year } = req.query;
  
  // Get all invoices for the month
  const invoices = await SalesOrder.find({
    status: 'INVOICED',
    invoiceDate: {
      $gte: new Date(`${year}-${month}-01`),
      $lt: new Date(`${year}-${Number(month) + 1}-01`)
    }
  }).populate('customer');
  
  const b2bSales = [];
  const b2cSales = [];
  
  invoices.forEach(inv => {
    const invoiceData = {
      invoiceNo: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      invoiceValue: inv.grandTotal,
      taxableValue: inv.subtotal
    };
    
    if (inv.customer.gstIN) {
      // B2B
      b2bSales.push({
        ...invoiceData,
        customerGST: inv.customer.gstIN,
        sgst: inv.items.reduce((sum, item) => sum + (item.sgst || 0), 0),
        cgst: inv.items.reduce((sum, item) => sum + (item.cgst || 0), 0),
        igst: inv.items.reduce((sum, item) => sum + (item.igst || 0), 0)
      });
    } else {
      // B2C
      b2cSales.push(invoiceData);
    }
  });
  
  const report = {
    month: `${month}/${year}`,
    b2bSales,
    b2cSales,
    totalSalesValue: b2bSales.reduce((sum, s) => sum + s.invoiceValue, 0) +
                     b2cSales.reduce((sum, s) => sum + s.invoiceValue, 0)
  };
  
  res.json(report);
};

export const generateGSTR3B = async (req, res) => {
  const { month, year } = req.query;
  
  const from = new Date(`${year}-${month}-01`);
  const to = new Date(`${year}-${Number(month) + 1}-01`);
  
  // Sales with tax
  const sales = await SalesOrder.find({
    status: 'INVOICED',
    invoiceDate: { $gte: from, $lt: to }
  });
  
  const outwardTaxableSupply = sales.reduce((sum, s) => sum + s.subtotal, 0);
  const outwardTax = sales.reduce((sum, s) => {
    return sum + (s.items.reduce((t, item) => t + (item.sgst || 0) + (item.cgst || 0) + (item.igst || 0), 0));
  }, 0);
  
  // Purchases with tax
  const purchases = await PurchaseOrder.find({
    status: 'RECEIVED',
    poDate: { $gte: from, $lt: to }
  });
  
  const inwardTaxableSupply = purchases.reduce((sum, p) => sum + p.subtotal, 0);
  const inwardTax = purchases.reduce((sum, p) => {
    return sum + (p.items.reduce((t, item) => t + (item.sgst || 0) + (item.cgst || 0) + (item.igst || 0), 0));
  }, 0);
  
  // ITC Credit
  const itcEligible = inwardTax;
  
  // GST to Pay
  const gstPayable = outwardTax - itcEligible;
  
  res.json({
    month: `${month}/${year}`,
    outwardSupply: {
      taxableValue: outwardTaxableSupply,
      taxAmount: outwardTax
    },
    inwardSupply: {
      taxableValue: inwardTaxableSupply,
      taxAmount: inwardTax
    },
    itcClaimed: itcEligible,
    gstPayable: gstPayable > 0 ? gstPayable : 0,
    refundDue: gstPayable < 0 ? Math.abs(gstPayable) : 0
  });
};
```

---

#### Week 23-24: CRM Enhancements

```javascript
// Backend: CRM features

// 1. Customer Segmentation
export const getCustomerSegments = async (req, res) => {
  const allCustomers = await Customer.find({}).populate('lastOrder');
  
  const segments = {
    highValue: allCustomers.filter(c => c.totalLifetimeValue > 1000000),
    new: allCustomers.filter(c => {
      const daysSince = (Date.now() - c.createdAt) / (1000 * 60 * 60 * 24);
      return daysSince < 90;
    }),
    inactive: allCustomers.filter(c => {
      const daysSince = (Date.now() - c.lastOrderDate) / (1000 * 60 * 60 * 24);
      return daysSince > 180;
    }),
    atRisk: allCustomers.filter(c => c.creditUsed > c.creditLimit)
  };
  
  res.json(segments);
};

// 2. Activity Logging
export const logActivity = async (req, res) => {
  const { customerId, type, details } = req.body;
  
  await Customer.findByIdAndUpdate(
    customerId,
    {
      $push: {
        activities: { type, details, date: new Date(), createdBy: req.user._id }
      }
    }
  );
  
  res.json({ success: true });
};

// 3. Sales Pipeline
export const getSalesPipeline = async (req, res) => {
  const pipeline = {};
  const customers = await Customer.find({});
  
  customers.forEach(c => {
    if (c.lastOrderDate === null) {
      pipeline['LEAD'] = (pipeline['LEAD'] || 0) + 1;
    } else if (c.creditUsed === 0) {
      pipeline['PROSPECT'] = (pipeline['PROSPECT'] || 0) + 1;
    } else if (c.totalLifetimeValue < 100000) {
      pipeline['CUSTOMER_LOW'] = (pipeline['CUSTOMER_LOW'] || 0) + 1;
    } else {
      pipeline['CUSTOMER_HIGH'] = (pipeline['CUSTOMER_HIGH'] || 0) + 1;
    }
  });
  
  res.json(pipeline);
};
```

**Frontend CRM Dashboard**:
```jsx
function CRMDashboard() {
  const [segments, setSegments] = useState({});
  const [pipeline, setPipeline] = useState({});
  
  return (
    <div>
      <h1>CRM Dashboard</h1>
      
      <div className="cards">
        <Card title="High-Value Customers" value={segments.highValue?.length} />
        <Card title="New Customers (90 days)" value={segments.new?.length} />
        <Card title="Inactive Customers (180+ days)" value={segments.inactive?.length} />
        <Card title="At-Risk Customers" value={segments.atRisk?.length} />
      </div>
      
      <div style={{ marginTop: '30px' }}>
        <h2>Sales Pipeline</h2>
        <BarChart data={pipeline} />
      </div>
    </div>
  );
}
```

---

#### Week 25-26: Recurring Orders

```javascript
// Backend: Recurring Order automation

// Scheduled job
import cron from 'node-cron';

// Run at 2 AM daily
cron.schedule('0 2 * * *', generateRecurringOrders);

async function generateRecurringOrders() {
  const today = new Date();
  const recurringOrders = await RecurringOrder.find({
    status:'ACTIVE',
    nextOrderDate: { $lte: today }
  });
  
  for (const ro of recurringOrders) {
    // Create new SO
    const newSO = new SalesOrder({
      soNumber: generateSONumber(),
      customer: ro.customer,
      items: ro.items,
      soDate: today,
      status: ro.requiresApprovalEachTime ? 'PENDING_APPROVAL' : 'CONFIRMED',
      recurringOrderRef: ro._id
    });
    
    await newSO.save();
    
    // Update next date
    let nextDate = new Date(today);
    switch(ro.frequency) {
      case 'DAILY':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'WEEKLY':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'MONTHLY':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'QUARTERLY':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'YEARLY':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
    
    ro.lastOrderDate = today;
    ro.nextOrderDate = nextDate;
    ro.generatedOrders.push(newSO._id);
    
    // Check if should end
    if (ro.endDate && ro.nextOrderDate > ro.endDate) {
      ro.status = 'COMPLETED';
    }
    
    await ro.save();
    
    // Notify system
    console.log(`Generated SO ${newSO.soNumber} from RO ${ro.recurringOrderNo}`);
  }
}
```

---

### PHASE 5: TESTING & DEPLOYMENT (Weeks 29-32)

#### Week 29: UAT Preparation

```javascript
// Create test data script

async function seedTestData() {
  // 1. Create Chart of Accounts
  const coa = [
    { code: 'AS001', name: 'Cash', accountType: 'ASSET', openingBalance: 50000 },
    { code: 'AS002', name: 'Bank', accountType: 'ASSET', openingBalance: 200000 },
    { code: 'AS003', name: 'Inventory', accountType: 'ASSET', openingBalance: 500000 },
    // ... more accounts
  ];
  await ChartOfAccounts.insertMany(coa);
  
  // 2. Create test customers
  const customers = [
    { name: 'ABC Retail', gstIN: '18AABCD1234H1Z0', city: 'Mumbai' },
    // ... more
  ];
  await Customer.insertMany(customers);
  
  // 3. Create test products
  const products = [
    { name: 'Pearl Necklace', hsnCode: '7113', gstRate: 5, rate: 1000 },
    // ... more
  ];
  await Product.insertMany(products);
  
  console.log('Test data seeded successfully');
}
```

---

## <a name="checklist"></a>8. Feature Implementation Checklist

### Phase 1: Foundation
- [ ] Chart of Accounts setup
- [ ] Opening Balance configuration
- [ ] Opening Stock management
- [ ] Financial Year setup
- [ ] Role-Based Access Control
- [ ] User Management

### Phase 2: Core Transactions
- [ ] Enhanced PO with approval flow
- [ ] Goods Receipt Note (GRN)
- [ ] PO to GL integration
- [ ] Enhanced SO with delivery tracking
- [ ] Delivery Challan
- [ ] SO to GL integration
- [ ] Credit Notes with GL entries
- [ ] Debit Notes with GL entries

### Phase 3: Financial
- [ ] Journal Entry creation
- [ ] GL posting & reversals
- [ ] Trial Balance report
- [ ] Balance Sheet report
- [ ] Profit & Loss statement
- [ ] Bank Reconciliation

### Phase 4: Compliance & CRM
- [ ] GST Master setup
- [ ] GST Invoicing
- [ ] GSTR-1 generation
- [ ] GSTR-2 generation
- [ ] GSTR-3B generation
- [ ] CRM module (customer segmentation, pipeline, activities)
- [ ] Recurring Orders
- [ ] Advanced reporting

### Phase 5: Deployment
- [ ] UAT in staging environment
- [ ] Data migration from Tally
- [ ] Performance testing & optimization
- [ ] Security audit & hardening
- [ ] Production deployment
- [ ] User training & documentation

---

## 🎯 Key Takeaways

### What makes this a real ERP:

1. **Single Source of Truth**: All transactions (PO, SO, CN, DN) automatically post to GL
2. **Real-time Reporting**: TB, BS, P&L update as transactions occur
3. **Integrated Workflows**: PO → GRN → Invoice → Payment all connected
4. **Financial Integrity**: Every document creates GL entries for audit trail
5. **Compliance**: GST, TDS, ITC tracking built-in
6. **Role Security**: RBAC ensures data integrity & segregation of duties
7. **Scalability**: Multi-company, multi-warehouse, multi-currency ready

### Technology Stack for Full ERP:

**Backend Enhancements**:
- Add queue system (Bull) for background jobs (GRN processing, recurring orders)
- Add cache layer (Redis) for real-time GL balance lookups
- Add full-text search (Elasticsearch) for document search
- Add webhooks for third-party integrations

**Frontend Enhancements**:
- Add data visualization (Chart.js, D3.js) for reports
- Add PDF generation (ReportLab server-side) for invoices
- Add real-time collaboration (WebSocket) for approval routing
- Add offline support (PWA) for field users

---

**This roadmap transforms Pearls ERP from a basic retail management system into an enterprise-grade ERP comparable to Zoho. The 32-week timeline is achievable with a dedicated 2-3 person team.**