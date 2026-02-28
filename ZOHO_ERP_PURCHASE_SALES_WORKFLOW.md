# 📋 Zoho ERP - Purchase & Sales Workflow Design

**Document Purpose**: Clear process flow and data structure (NO IMPLEMENTATION - REFERENCE ONLY)

---

## 🛒 SECTION 1: PURCHASE PROCESS (CORRECTED FLOW)

### 1.1 Correct Purchase Workflow (Circular Process)

```
┌─────────────────────────────────────────────────────────────────┐
│                  PURCHASE CYCLE (Continuous Loop)               │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │  PURCHASE ENTRY      │
                    │  (Create PO Form)    │
                    │ Fill vendor, items,  │
                    │ qty, price → Save    │
                    └──────────┬───────────┘
                               │ Creates
                               ↓
                    ┌──────────────────────┐
                    │  PURCHASE ORDER      │
                    │  (Stored in DB)      │
                    │ Track status until   │
                    │ goods received       │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              Once Received        Once Received
                    ↓                    ↓
         ┌──────────────────┐  ┌──────────────────┐
         │    PAYMENT       │  │  RE-ORDERING     │
         │  (Pay vendor)    │  │  (Monitor Stock) │
         │                  │  │ - See available  │
         │                  │  │ - See pending SO │
         │                  │  │ - Set alert qty  │
         │                  │  │ - Period check   │
         └────────┬─────────┘  └────────┬─────────┘
                  │                     │
                  │         If Stock < Threshold
                  │         During Period Check
                  │                     │
                  │                     │ Trigger Alert
                  │                     ↓
                  │            Create New Purchase Entry
                  │            (Cycles back to Step 1)
                  │                     ↑
                  └─────────────────────┘
                       Complete Payment
                       Done with this cycle
```

### 1.2 Four-Step Flow (Detailed)

#### **STEP 1: PURCHASE ENTRY - Create PO**

**What it is:**
- The ENTRY POINT for creating a new purchase order
- You fill in vendor, items, quantities, prices
- Save as a purchase order in the system

**Data to capture:**
```
Purchase Entry Form {
  // This is where you CREATE the PO
  
  vendor: {
    vendorId: ObjectId
    vendorName: "VRB CONSUMER PRODUCTS"
    paymentTerms: "30 days"
    address: {...}
  }
  
  items: [
    {
      productId: ObjectId
      productName: "Symega Pineapple 5ltr"
      quantity: 20
      purchasePrice: 2001.95
      hsn: "21051187"
      gst: 18%
    }
  ]
  
  subtotal: 100,097.50
  taxAmount: 18,017.55
  grandTotal: 118,115.05
  
  status: "CREATED"  // Ready to track as PO
}

// Once saved, this becomes a "Purchase Order" in system
```

**Action**: Click "Save" → PO is created and stored

---

#### **STEP 2: PURCHASE ORDER - Track & Wait for Receipt**

**What it is:**
- Now it's stored in database as Purchase Order
- You track it until goods are received
- Status: CREATED → SENT → ACKNOWLEDGED → RECEIVED

**Data tracked:**
```
Purchase Order {
  poId: "PO-2026-001"
  vendor: {...}
  items: [...]
  
  status: "RECEIVED"  // Once goods arrive
  dateCreated: 28-Feb-2026
  dateReceived: 28-Feb-2026
  
  // Now it branches into 2 paths:
}
```

**Two Paths After Receipt:**

**Path A: Payment → Complete**
```
   PO Received
       ↓
   Create Payment Record
   (Pay vendor)
       ↓
   Payment Done
   (This cycle complete)
```

**Path B: Stock Falls Below Threshold → Re-Order**
```
   PO Received
   Stock Updated: 20 units received
       ↓
   Monitor Stock via Re-ordering
   Check: Is current stock < alert level?
       ↓
   If YES → Create NEW PO
   (Cycle back to Step 1)
```

---

#### **STEP 3: PAYMENT - Pay Vendor for Received Goods**

**What it is:**
- Once you received the goods and verified
- Create a payment record to pay the vendor
- Mark the PO as "PAID"

**Data to capture:**
```
Payment Record {
  paymentId: "PAY-2026-001"
  linkedPO: "PO-2026-001"
  
  vendor: "VRB CONSUMER PRODUCTS"
  amountDue: 118,115.05
  amountPaid: 118,115.05
  
  paymentDate: 28-Mar-2026
  paymentMethod: "BANK_TRANSFER"
  status: "FULLY_PAID"
}

// GL posting:
Debit AP (2001)          ₹118,115.05
   Credit Bank (1001)                ₹118,115.05
```

**Result**: PO marked as PAID, AP reduces to 0

---

#### **STEP 4: RE-ORDERING PHASE - Monitor & Alert**

**What it is:**
- CONTINUOUS monitoring of stock levels
- Shows what's available, what's on pending orders
- Sets alert thresholds for automatic re-ordering
- Triggers new PO when stock falls below level

**Data to monitor:**
```
Re-ordering Dashboard {
  
  Product: "Symega Pineapple 5ltr"
  
  // 1. AVAILABLE QUANTITY
  availableStock: 20 units
  └─ What's physically in warehouse & ready to sell
  
  // 2. SALE ORDER QUANTITY (Not yet invoiced)
  pendingSaleOrderQty: 5 units
  └─ Customer ordered but invoice not created yet
  └─ This qty will be deducted when SO converts to SI
  
  // 3. RE-STOCKING QUANTITY
  restockingQty: 15 units
  └─ When we need to re-order, order THIS much
  
  // 4. CERTAIN PERIOD THRESHOLD
  checkPeriod: "MONTHLY"
  └─ Check stock levels monthly
  └─ Options: DAILY, WEEKLY, MONTHLY, QUARTERLY
  
  // 5. ALERT QUANTITY (Threshold Level)
  alertQty: 10 units
  └─ 🔴 When available stock < 10 → ALERT!
  └─ When stock reaches below this → Create new PO
  
  
  ┌─ MONITORING LOGIC:
  │
  ├─ Current Available = 20 units
  ├─ Alert Threshold = 10 units
  │
  ├─ Today check: 20 > 10 → NO ALERT ✓ GREEN
  │
  ├─ Week 2: Available = 12 units (sold 8)
  │  12 > 10 → Still OK 🟡 ORANGE (Getting Close)
  │
  ├─ Week 3: Available = 8 units (sold 4 more)
  │  8 < 10 → 🔴 ALERT! THRESHOLD CROSSED
  │  └─ Automatically create NEW Purchase Entry
  │  └─ Create new PO: "Order 15 units from same vendor"
  │  └─ Goes back to STEP 1
  │
  └─ New PO Created!
     Cycle continues...
```

**Monitoring Page Shows:**
```
┌────────────────────────────────────────────────────────┐
│  RE-ORDERING DASHBOARD                                │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Product: Symega Pineapple 5ltr                        │
│                                                        │
│ ├─ CURRENT STOCK: 20 units               [GREEN ✓]   │
│ │                                                      │
│ ├─ Less: Pending SO qty: 5 units         [RESERVED]  │
│ │  (SO created but not invoiced)                      │
│ │                                                      │
│ ├─ Effective Available: 15 units                      │
│ │  (What you can actually sell now)                   │
│ │                                                      │
│ ├─ Alert Threshold: 10 units             [MONITOR]   │
│ │  (When stock falls below this → ALERT)             │
│ │                                                      │
│ ├─ Reorder Quantity: 15 units            [ORDER AMT] │
│ │  (Order this much when alert triggered)            │
│ │                                                      │
│ ├─ Check Period: MONTHLY                 [INTERVAL]  │
│ │  (Check every month)                               │
│ │                                                      │
│ └─ Last Check: 28-Feb-2026               [STATUS]    │
│    Status: ✓ OK (15 > 10)                            │
│    Next Check: 28-Mar-2026                           │
│                                                        │
│ [ACTION BUTTONS]:                                     │
│ ┌─────────────────┐  ┌──────────────────┐           │
│ │ Manual Re-Order │  │ Edit Settings    │           │
│ │ (Create PO now) │  │ (Change alert    │           │
│ │                 │  │  qty, period)    │           │
│ └─────────────────┘  └──────────────────┘           │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Stock Status Example:**
```
Stock Level: 20 units
Alert Level: 10 units
Reorder Qty: 15 units

Week 1: 20 units  [✓ GREEN]    (20 > 10)
Week 2: 15 units  [🟡 YELLOW]  (15 > 10, but close)
Week 3: 8 units   [🔴 RED]     (8 < 10) → AUTO CREATE NEW PO!
Week 4: 8 + 15 = 23 units [✓ GREEN] (New PO arrived)
```

---

### 1.3 The Complete Circular Cycle

```
                    ┌─────────────────┐
                    │ PURCHASE ENTRY  │
                    │  CREATE PO      │
                    └────────┬────────┘
                             │ Save
                    ┌────────▼────────┐
                    │ PURCHASE ORDER  │
                    │  TRACK & WAIT   │
                    │  FOR RECEIPT    │
                    └────────┬────────┘
                             │ Goods Received
                    ┌────────▼────────────┐
                    │    PAYMENT         │
                    │  PAY VENDOR        │
                    │  Mark PO as PAID   │
                    └────────┬───────────┘
                             │ Payment Complete
                    ┌────────▼──────────────┐
                    │  RE-ORDERING PHASE   │
                    │  MONITOR STOCK       │
                    │  Check Period: MONTH │
                    └────────┬──────────────┘
                             │
                    ┌────────▼──────────────┐
                    │ Is stock < alert?    │
                    └┬───────────────────┬─┘
                     │                   │
       NO (Still OK) │                   │ YES (Below Alert)
                     │                   │
                     ↓                   ↓
              Continue Monitor    Create NEW Purchase Entry
              Check next month    (Go back to Step 1)
              ...                 Loop continues!
```

**Key Point**: This is a CONTINUOUS CYCLE, not a one-time process!

---

## 📊 SECTION 2: RE-ORDERING PHASE - DETAILED BREAKDOWN

### 2.1 What Data to Track in Re-ordering

```
Re-ordering Configuration {
  productId: ObjectId
  productName: "Symega Pineapple 5ltr"
  
  // 1. AVAILABLE QUANTITY
  currentStock: 20              // Physical units in warehouse
  allocatedStock: 0             // Reserved for pending SO
  availableQty: 20              // currentStock - allocatedStock
  
  // 2. SALE ORDER QUANTITY (Not Yet Invoiced)
  pendingSaleOrders: [
    {
      soId: "SO-001",
      qty: 3 units
    },
    {
      soId: "SO-002",
      qty: 2 units
    }
  ]
  totalPendingSO: 5 units       // Orders placed but not invoiced
  
  // 3. RE-STOCKING QUANTITY
  restockingQty: 15 units       // How much to order when alert
  
  // 4. PERIOD THRESHOLD / CHECK INTERVAL
  checkPeriod: "MONTHLY"        // DAILY, WEEKLY, MONTHLY, QUARTERLY
  lastCheckDate: 28-Feb-2026
  nextCheckDate: 28-Mar-2026
  
  // 5. ALERT QUANTITY (Threshold)
  alertQty: 10 units            // When to alert
  alertStatus: "GREEN"          // GREEN, YELLOW, RED
  
  // LOGIC:
  if (availableQty < alertQty) {
    alertStatus = "RED"
    autoCreatePO = true
  } else if (availableQty < alertQty + 5) {
    alertStatus = "YELLOW"
  } else {
    alertStatus = "GREEN"
  }
}
```

### 2.2 Re-ordering Page UI

```
┌──────────────────────────────────────────────────────────────┐
│  INVENTORY MANAGEMENT - RE-ORDERING DASHBOARD                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  FILTER: [All Products] [Low Stock] [Critical] [Search...] │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Product Name       │ Avail │ Pending │ Alert │ Status  │ │
│  │                    │ Qty   │ SO Qty  │ Level │         │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ Symega Pineapple   │  20   │   5     │  10   │ GREEN ✓ │ │
│  │ (15 effective)     │       │ (SO-001 │       │         │ │
│  │                    │       │+ SO-002)│       │ Actions │ │
│  │                    │       │         │       │ ┌──────┐│ │
│  │                    │       │         │       │ │Option││ │
│  │                    │       │         │       │ │Menu  ││ │
│  │                    │       │         │       │ └──────┘│ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ MC Veg Burger      │  12   │   3     │  10   │YELLOW⚠ │ │
│  │ (9 effective)      │       │ (SO-003)│       │ Getting │ │
│  │                    │       │         │       │ Low!    │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ DM Tomato Ketchup  │   8   │   2     │  10   │ RED 🔴  │ │
│  │ (6 effective)      │       │ (SO-004)│       │ ALERT!  │ │
│  │                    │       │         │       │[Re-Order]│ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  CLICKING ON A PRODUCT shows:                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │ Product: DM Tomato Ketchup                           │ │
│  │                                                        │ │
│  │ Current Stock:              8 units                  │ │
│  │ Pending SO (not invoiced):  2 units                 │ │
│  │ Effective Available:        6 units                 │ │
│  │                                                        │ │
│  │ Alert Threshold:           10 units                 │ │
│  │ Status:                    🔴 CRITICAL              │ │
│  │                            (6 < 10)                 │ │
│  │                                                        │ │
│  │ Reorder Qty:               20 units                 │ │
│  │ Check Period:              MONTHLY                  │ │
│  │ Last Checked:              28-Feb-2026              │ │
│  │                                                        │ │
│  │ ┌──────────────────┐  ┌──────────────────┐         │ │
│  │ │ Create PO Now    │  │ Edit Settings    │         │ │
│  │ │ Order 20 units   │  │ (Change alert    │         │ │
│  │ │ from vendor      │  │  qty, period)    │         │ │
│  │ └──────────────────┘  └──────────────────┘         │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 SECTION 3: COMPLETE PURCHASE CYCLE - TIMELINE EXAMPLE

```
Day 1 (28-Feb):
  ├─ PURCHASE ENTRY: Create PO
  │  └─ Fill form: Vendor=VRB, Item=Pineapple, Qty=20, Price=2001.95
  │  └─ Save → Creates Purchase Order
  │
  ├─ PURCHASE ORDER status: CREATED
  │  └─ Waiting for goods to arrive
  │
  └─ Stock Situation:
     ├─ Available: 0 units
     └─ (No stock yet)

Day 8 (7-Mar):
  ├─ Goods arrived from vendor!
  │  └─ Physical goods received, counted: 20 units ✓
  │
  ├─ PURCHASE ORDER status: RECEIVED
  │  └─ Update stock in system
  │
  ├─ RE-ORDERING starts monitoring:
  │  ├─ Current Stock: 20 units
  │  ├─ Alert Threshold: 10 units
  │  ├─ Status: 🟢 GREEN (20 > 10)
  │  └─ Next check in 1 month
  │
  └─ Stock Situation:
     ├─ Available: 20 units
     └─ Pending SO: 0 units

Day 28 (21-Mar):
  ├─ Sales happened!
  │  └─ Customers ordered: 8 units sold
  │
  ├─ RE-ORDERING monitors:
  │  ├─ Current Stock: 12 units
  │  ├─ Alert Threshold: 10 units
  │  ├─ Status: 🟡 YELLOW (12 ≈ 10, getting close)
  │  └─ Continue monitoring
  │
  └─ Stock Situation:
     ├─ Available: 12 units
     └─ Pending SO: 2 units (ordered but not invoiced)

Day 35 (28-Mar - MONTHLY CHECK):
  ├─ Monthly stock check triggered!
  │  ├─ More sales: 5 units sold in last week
  │  ├─ Current Stock NOW: 7 units
  │  │
  │  ├─ Alert Check:
  │  │  └─ 7 < 10 (alert threshold)
  │  │  └─ 🔴 ALERT TRIGGERED!
  │  │
  │  ├─ Auto-create NEW Purchase Entry:
  │  │  └─ "Order 20 units from VRB"
  │  │  └─ Status: CREATED (new PO)
  │  │
  │  └─ Cycle RESTART:
  │     └─ NEW PO waiting for goods (Day 1 again)
  │
  └─ Stock Situation:
     ├─ Available: 5 units (Critical!)
     ├─ Pending SO: 2 units
     └─ NEW PO ordered: 20 units (arriving in ~7 days)

Day 42 (4-Apr - NEW PO ARRIVES):
  ├─ Second batch of goods arrived!
  │  └─ 20 more units received
  │
  ├─ Stock now:
  │  ├─ Total: 25 units
  │  ├─ Status: 🟢 GREEN again (25 > 10)
  │  └─ Next monthly check: 4-May
  │
  └─ PAYMENT for first PO:
     ├─ PAY vendor for first batch (20 units received 28-Feb)
     ├─ Amount: ₹118,115.05
     ├─ Method: Bank Transfer
     └─ Status: PAID ✓
```

---



#### **STEP 1: PURCHASE ORDER (Vendor Quotation)**

**What it is:**
- Quotation/Request for Quote from vendor
- No GL posting yet (only commitment)
- Status: DRAFT → SENT → ACKNOWLEDGED

**Data to capture:**
```
Purchase Order {
  poId: "PO-2026-001"
  date: 28-Feb-2026
  vendor: {
    vendorName: "VRB CONSUMER PRODUCTS"
    vendorId: ObjectId
    paymentTerms: "30 days Net"
    address: {...}
  }
  items: [
    {
      productId: ObjectId
      productName: "Symega Pineapple 5ltr"
      quantity: 20
      purchasePrice: 2001.95
      hsn: "21051187"
      gst: 18%
      total: 100,097.50
    }
  ]
  subtotal: 100,097.50
  taxAmount: 18,017.55
  grandTotal: 118,115.05
  warehouse: "Tirunelveli"
  notes: "Payment terms 30 days"
  status: "ACKNOWLEDGED"  // Now ready to receive
}
```

**GL Impact:** NONE YET (only when goods received)

---

#### **STEP 2: PURCHASE ENTRY (Goods Receipt / Bill In)**

**What it is:**
- Process when you PHYSICALLY RECEIVE goods
- Goods counted, inspected, put in warehouse
- THIS is when GL posting happens
- Status: RECEIVED → VERIFIED → BILLED

**Data to capture:**
```
Purchase Entry / Bill In {
  purchaseEntryId: "PE-2026-001"
  linkedPO: "PO-2026-001"  // Reference to original PO
  
  receiptDate: 28-Feb-2026
  vendor: {vendorId, vendorName}
  warehouse: "Tirunelveli"
  
  items: [
    {
      productId: ObjectId
      productName: "Symega Pineapple 5ltr"
      orderedQty: 20
      receivedQty: 20         // What we actually got
      damagedQty: 0
      netQty: 20              // receivedQty - damagedQty
      purchasePrice: 2001.95
      total: 100,097.50
      hsn: "21051187"
      gst: 18%
      lineTotal: 118,115.05
    }
  ]
  
  subtotal: 100,097.50
  totalTax: 18,017.55
  grandTotal: 118,115.05
  
  status: "VERIFIED"  // Ready for payment
  receiptNotes: "All items received in good condition"
  
  // Additional tracking
  estimatedInvoiceDate: 28-Feb-2026
  expectedPaymentDate: 28-Mar-2026 (based on vendor terms)
}
```

**GL Impact:** ✅ POST JOURNAL ENTRY
```
Debit  Inventory Account (1201)    ₹100,097.50
Debit  GST Receivable (1301)       ₹18,017.55
       Credit AP Account (2001)                ₹118,115.05
```

**Stock Updates:** ✅ INVENTORY INCREASES
```
Before Receipt: Product A Stock = 0
After Receipt:  Product A Stock = 20 units
```

---

#### **STEP 3: PAYMENT RECORD (Vendor Payment)**

**What it is:**
- When you PAY vendor for received goods
- Can be partial or full payment
- Can be done via cheque, bank transfer, cash
- Status: PENDING → PARTIALLY PAID → FULLY PAID

**Data to capture:**
```
Payment Record {
  paymentId: "PAY-2026-001"
  linkedPurchaseEntry: "PE-2026-001"
  linkedPO: "PO-2026-001"
  
  paymentDate: 28-Mar-2026
  vendor: {vendorId, vendorName}
  
  amountDue: 118,115.05          // From Purchase Entry
  amountPaid: 118,115.05          // What we pay now
  
  paymentMethod: "BANK_TRANSFER"  // Options: CASH, CHEQUE, NEFT, RTGS
  bankAccount: "HDFC - 1234567"
  referenceNumber: "TXN-2026-5467"
  
  status: "FULLY_PAID"  // Can be PENDING, PARTIAL, FULL
  
  // For partial payments
  previouslyPaid: 0
  remainingBalance: 0
}
```

**GL Impact:** ✅ POST ANOTHER JOURNAL ENTRY
```
Debit  AP Account (2001)          ₹118,115.05
       Credit Bank/Cash (1001)                 ₹118,115.05
```

**AP Gets Reduced:** 
```
Before Payment: AP = ₹118,115.05
After Payment:  AP = ₹0 (fully paid)
```

---

#### **STEP 4: RE-ORDERING PROCESS**

**What it is:**
- Automatic or manual process to maintain stock levels
- Triggered when stock falls below reorder point
- Creates new PO automatically

**Data to track:**
```
Product Stock Management {
  productId: ObjectId
  productName: "Symega Pineapple 5ltr"
  
  currentStock: 20
  reorderLevel: 5      // Alert when stock < 5
  reorderQuantity: 20  // Order this much
  leadTimeDays: 7      // Takes 7 days to receive
  
  // Reorder Logic:
  if (currentStock < reorderLevel) {
    createNewPO({
      vendor: lastVendor,
      quantity: reorderQuantity,
      estimatedDelivery: today + leadTimeDays
    })
  }
  
  // Alert Status:
  stockStatus: "NORMAL"    // GREEN
  // OR when stock < reorderLevel:
  stockStatus: "ALERT"     // RED - Create new PO
}
```

---

### 1.3 Purchase Dropdown Menu Structure

```
PURCHASE DROPDOWN in UI:
┌─ Purchase Entry (Main - Shows list of all)
│  ├─ All Purchase Entries
│  ├─ Recent
│  ├─ By Status (Pending, Delivered, Paid)
│  └─ [+ New Purchase Entry] Button
│
├─ Purchase Order (Archive - History)
│  ├─ All POs
│  ├─ By Status (Draft, Sent, Acknowledged)
│  └─ [+ New PO] Button
│
├─ Payment
│  ├─ All Vendor Payments
│  ├─ Pending Payments
│  ├─ By Status (Pending, Partial, Paid)
│  └─ [+ New Payment] Button
│
└─ Stock Management
   ├─ Stock Summary (Current levels)
   ├─ Reorder Alerts (Items below threshold)
   ├─ Movement History
   └─ [+ Adjust Stock] Button
```

---

## 💰 SECTION 2: SALES PROCESS (FROM SO TO PAYMENT)

### 2.1 Current State vs Desired State

```
CURRENT (Partial):
┌──────────────────┐
│  Sales Order     │
│  - Create        │
│  - Store in DB   │
│  - Done ✓        │
└──────────────────┘

DESIRED (Zoho-like):
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Sales       │→ │  Sales       │→ │  Goods       │→ │   Payment    │
│  Order       │  │  Invoice     │  │  Dispatched  │  │   Record     │
│ (Quotation)  │  │ (Bill Out)   │  │ (Outward)    │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
     Step 1          Step 2            Step 3            Step 4
```

### 2.2 Workflow Breakdown

#### **STEP 1: SALES ORDER (Customer Quotation)**

**What it is:**
- Quotation to customer
- NO GL posting in this stage
- Status: DRAFT → CONFIRMED → READY_TO_DISPATCH

**Data to capture:**
```
Sales Order {
  soId: "SO-2026-001"
  invoiceId: "LOCALLINESO/006/2025-2026"  // From your data
  date: 26-Feb-2026
  
  customer: {
    customerId: ObjectId
    customerName: "Aryaas Sweets & Bakery"
    address: "PALAYAMKOTTAI, TIRUNELVELI"
    creditLimit: 50000
    creditUsed: 0
  }
  
  warehouse: "Tirunelveli"
  deliveryMan: {deliveryManId, name}
  
  items: [
    {
      productId: ObjectId
      productName: "MC Popular Veg Burger Patty"
      quantity: 30
      sellingPrice: 204.90
      discountPercent: 0
      gst: 5%
      lineTotal: 6,454.35
      
      // Key addition: Track what's allocated
      allocatedQty: 30  // Reserved from warehouse stock
      dispatchedQty: 0  // Not yet shipped
      invoicedQty: 0    // Not yet billed
    },
    {
      productId: ObjectId
      productName: "DM TOMATO KETCHUP 8GM"
      quantity: 14
      sellingPrice: 63.44
      discountPercent: 0
      gst: 5%
      lineTotal: 932.57
      allocatedQty: 14
      dispatchedQty: 0
      invoicedQty: 0
    },
    {
      productId: ObjectId
      productName: "Amul Unsalted Cooking Butter"
      quantity: 30
      sellingPrice: 256.96
      discountPercent: 0
      gst: 5%
      lineTotal: 8,094.24
      allocatedQty: 30
      dispatchedQty: 0
      invoicedQty: 0
    }
  ]
  
  subtotal: 14,743.96
  totalTax: 737.20
  grandTotal: 15,481.16
  
  status: "CONFIRMED"  // Ready to make SI
  notes: "Deliver to godown only"
}
```

**GL Impact:** NONE YET (only when invoice created)

**Stock Impact:** RESERVED/ALLOCATED
```
Before SO: Burger Patty Stock = 100
After SO:  
  - Available Stock = 70 (what customer can buy)
  - Reserved/Allocated = 30 (reserved for this SO)
```

---

#### **STEP 2: SALES INVOICE (Goods Dispatch / Bill Out)**

**What it is:**
- When you create formal invoice & dispatch goods
- THIS is when GL posting happens
- AR (Accounts Receivable) is created
- Status: CREATED → DISPATCHED → PAID

**Data to capture:**
```
Sales Invoice {
  invoiceId: "INV-2026-001"
  linkedSO: "SO-2026-001"  // Reference to original SO
  
  invoiceDate: 28-Feb-2026
  dueDate: 28-Mar-2026  // Based on credit terms
  
  customer: {customerId, name}
  warehouse: "Tirunelveli"
  deliveryMan: {...}
  
  items: [
    {
      productId: ObjectId
      productName: "MC Popular Veg Burger Patty"
      quantityOrdered: 30      // From SO
      quantityDispatched: 30   // What we actually sent
      shortageQty: 0           // If we couldn't send full qty
      
      sellingPrice: 204.90
      discountPercent: 0
      gst: 5%
      lineTotal: 6,454.35
    }
    // ... other items
  ]
  
  subtotal: 14,743.96
  totalTax: 737.20
  transportCharge: 0
  grandTotal: 15,481.16
  
  status: "DISPATCHED"  // Goods sent, waiting payment
  
  // Payment tracking
  amountDue: 15,481.16
  amountPaid: 0
  remainingBalance: 15,481.16
}
```

**GL Impact:** ✅ POST JOURNAL ENTRY
```
Debit  AR Account (1101)          ₹15,481.16
       Credit Sales Revenue (3001)            ₹14,743.96
       Credit GST Payable (2101)              ₹737.20
```

**Warehouse Stock Decreases:**
```
Before Invoice: Burger Patty Stock = 70 (30 allocated)
After Invoice:  
  - Available Stock = 40 (actual inventory gone)
  - Allocated = 0
  - Stocked = 0
```

---

#### **STEP 3: GOODS DISPATCH - STOCKING MODULE**

**What it is:**
- Tracks what's physically held in warehouse
- Shows real-time stock levels
- Triggers reorder alerts
- Shows waiting inventory

**Data to capture:**
```
Stock/Stocking Record {
  stockId: "STK-2026-001"
  productId: ObjectId
  productName: "MC Popular Veg Burger Patty"
  warehouse: "Tirunelveli"
  
  // Stock Levels
  totalStock: 40              // Physical units in warehouse
  allocatedStock: 0           // Reserved for pending SOs
  availableStock: 40          // What can be sold
  
  // Reorder Configuration
  reorderLevel: 10            // Alert when < 10
  reorderQuantity: 30         // Order this much
  leadTime: 7                 // Days to receive
  
  // Alert Status
  stockAlert: {
    status: "NORMAL"          // GREEN - Stock healthy
    // OR when totalStock < reorderLevel:
    status: "LOW"             // ORANGE - Getting low
    // OR when totalStock = 0:
    status: "OUT_OF_STOCK"    // RED - No stock
    
    alertLevel: "ALERT_LEVEL"
    period: "MONTHLY"         // How often to check
  }
  
  // Last Activity
  lastReceiptDate: 28-Feb-2026
  lastDispatchDate: 26-Feb-2026
  lastMovementQty: 30
  lastMovementType: "DISPATCH"
}
```

**Stocking Page Should Show:**
```
┌─────────────────────────────────────────────────────────┐
│  STOCKING DASHBOARD                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Item: MC Popular Veg Burger Patty                      │
│  ├─ Available Qty: 40 units          [GREEN]            │
│  ├─ Allocated Qty: 0 units           [Reserved for SO] │
│  ├─ Total Stock: 40 units                              │
│  │                                                      │
│  ├─ Reorder Level: 10 units [ALERT LEVEL]              │
│  ├─ Current Status: ✓ NORMAL (Stock above alert)       │
│  │                                                      │
│  ├─ Reorder Configuration:                             │
│  │  └─ Order Qty: 30 units                             │
│  │  └─ Lead Time: 7 days                               │
│  │  └─ Check Period: MONTHLY                           │
│  │                                                      │
│  └─ Stock Movement History:                             │
│     ├─ 28-Feb: SO Dispatch (-30) → Stock now 40        │
│     ├─ 1-Mar: PO Receipt (+30) → Stock will be 70      │
│     └─ View Full History...                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

#### **STEP 4: SALES ORDER - WAITING QTY / PENDING ORDERS**

**What it is:**
- Shows SOs not yet converted to invoice
- Shows partially dispatched orders
- Shows customers waiting for goods

**Data to capture:**
```
Sales Order Waiting / Pending Status {
  soId: "SO-2026-001"
  customer: "Aryaas Sweets & Bakery"
  soDate: 26-Feb-2026
  
  Items Status:
  [
    {
      productId: ObjectId
      productName: "MC Popular Veg Burger Patty"
      orderedQty: 30
      dispatchedQty: 0        // 🔴 NOT YET SHIPPED
      waitingQty: 30          // 🔴 WAITING TO DISPATCH
      invoicedQty: 0          // 🔴 NOT YET INVOICED
      
      daysWaiting: 2 days     // SO created 2 days ago
      status: "PENDING_DISPATCH"
    }
  ]
  
  overallStatus: "PARTIALLY_PENDING"
  // OR:
  overallStatus: "FULLY_PENDING"      // All items waiting
  overallStatus: "FULLY_DISPATCHED"   // All items shipped
}
```

**Waiting Orders Page Should Show:**
```
┌──────────────────────────────────────────────────────────────────┐
│  SALES ORDER - WAITING QTY / PENDING ORDERS                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  SO-2026-001 | Aryaas Sweets | Created: 26-Feb | Status: PENDING │
│                                                                   │
│  Product                      │ Ordered │ Dispatched │ Waiting   │
│  ─────────────────────────────┼─────────┼────────────┼─────────  │
│  MC Veg Burger                │   30    │     0      │  30 🔴    │
│  DM Tomato Ketchup            │   14    │     0      │  14 🔴    │
│  Amul Unsalted Butter         │   30    │     0      │  30 🔴    │
│                                                                   │
│  [Action Buttons]:                                               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐    │
│  │ Create Invoice  │  │ Partial Dispatch │  │ Mark Ready  │    │
│  │ (All items)     │  │ (Some items)     │  │ for OD      │    │
│  └─────────────────┘  └──────────────────┘  └─────────────┘    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

#### **STEP 5: PAYMENT RECORD (Customer Payment)**

**What it is:**
- When customer pays for the invoice
- Can be partial or full
- Can be cheque, bank transfer, cash

**Data to capture:**
```
Payment Record {
  paymentId: "CUST-PAY-2026-001"
  linkedInvoice: "INV-2026-001"
  linkedSO: "SO-2026-001"
  
  paymentDate: 28-Mar-2026
  customer: {customerId, name: "Aryaas Sweets"}
  
  originalAmount: 15,481.16        // From Invoice
  amountPaid: 15,481.16
  
  paymentMethod: "CHEQUE"
  chequeNumber: "BANK123456"
  bankName: "HDFC"
  
  status: "FULLY_PAID"  // Or PENDING, PARTIAL
  
  // For partial
  previouslyPaid: 8000
  currentPayment: 7481.16
  remainingBalance: 0
}
```

**GL Impact:** ✅ POST JOURNAL ENTRY (for payment)
```
Debit  Bank Account (1001)        ₹15,481.16
       Credit AR Account (1101)                ₹15,481.16
```

**AR Gets Reduced:**
```
Before Payment: AR = ₹15,481.16
After Payment:  AR = ₹0 (paid in full)
```

---

### 2.3 Sales Page UI Layout

**SALES ENTRY PAGE** should show:
```
┌────────────────────────────────────────────────────────────────────┐
│  SALES ORDER RECORDS - LIST VIEW                                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Date  │Invoice│ Customer │ Warehouse│ Subtotal│  Tax  │ Total │  │
│        │  No   │          │          │         │       │       │ S│
│========╪═══════╪══════════╪══════════╪═════════╪═══════╪═══════╪══│
│26-Feb  │SO-001 │Aryaas... │Tirunelveli│14,743  │  737  │15,481 │ │
│27-Feb  │SO-002 │Another.. │Tirunelveli│25,000  │1,250  │26,250 │ │
│28-Feb  │SO-003 │Third...  │Tirunelveli│ 8,500  │  425  │ 8,925 │ │
│                                                                    │
│  [Each Row has]:                                                   │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ View / Edit      │  │ [Payment] 💳 │  │[Stocking] 📦 │        │
│  │ Details          │  │              │  │              │        │
│  └──────────────────┘  └──────────────┘  └──────────────┘        │
│                                                                    │
│  [Filters on left]:                                                │
│  ├─ All (5 records)                                               │
│  ├─ Pending Payment (2)    🔴                                     │
│  ├─ Pending Dispatch (2)   🟠                                     │
│  ├─ Fully Paid (1)         🟢                                     │
│  └─ Search by Customer...                                         │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 📊 SECTION 3: DATABASE STRUCTURE REQUIRED

### 3.1 New Collections Needed

```javascript
// 1. PURCHASE COLLECTION
db.PurchaseOrders {
  _id, poId, date, vendor, items[], 
  status, notes, createdAt, updatedAt
}

// 2. PURCHASE ENTRY COLLECTION (New - Bill In)
db.PurchaseEntries {
  _id, peId, linkedPO, receiptDate, vendor,
  items[{receivedQty, damagedQty, netQty}],
  status, totalTax, grandTotal, createdAt
}

// 3. VENDOR PAYMENT COLLECTION (New)
db.VendorPayments {
  _id, paymentId, linkedPE, vendor,
  paymentDate, amountDue, amountPaid,
  paymentMethod, status, createdAt
}

// 4. STOCK/INVENTORY COLLECTION (New)
db.Stock {
  _id, productId, warehouse,
  currentStock, allocatedStock, availableStock,
  reorderLevel, reorderQuantity, leadTime,
  lastMovement, createdAt, updatedAt
}

// 5. STOCK ALERT/REORDER COLLECTION (New)
db.StockAlerts {
  _id, productId, warehouse,
  alertStatus, alertLevel, period,
  isActive, createdAt
}

// 6. SALES INVOICE COLLECTION (New - Bill Out)
db.SalesInvoices {
  _id, invoiceId, linkedSO, date, customer,
  items[{dispatchedQty, invoicedQty}],
  status, amountDue, amountPaid, createdAt
}

// 7. CUSTOMER PAYMENT COLLECTION (New)
db.CustomerPayments {
  _id, paymentId, linkedInvoice, customer,
  paymentDate, amountDue, amountPaid,
  paymentMethod, status, createdAt
}

// 8. SALES ORDER WAITING/PENDING COLLECTION (New)
db.SalesOrderPending {
  _id, soId, customer, items[{waitingQty}],
  overallStatus, daysWaiting, createdAt
}
```

---

## 🔄 SECTION 4: STATUS & WORKFLOW FLOW

### 4.1 Purchase Flow Status

```
┌─────────────────────────────────────────────────────────┐
│         PURCHASE ORDER LIFECYCLE                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  DRAFT → SENT → ACKNOWLEDGED → (PE Receipt) → BILLED   │
│           ↓         ↓              ↓            ↓       │
│        rejected  waiting       received      verified   │
│                                                         │
│  Then:  VERIFIED → PENDING_PAYMENT → PAID              │
│                                                         │
└─────────────────────────────────────────────────────────┘

PURCHASE ENTRY STATUS:
CREATED → VERIFIED → APPROVED → BILLED → PAYMENT_DONE

PAYMENT STATUS:
PENDING → PARTIAL_PAID → FULLY_PAID
```

### 4.2 Sales Flow Status

```
┌──────────────────────────────────────────────────────────┐
│           SALES ORDER LIFECYCLE                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  DRAFT → CONFIRMED → (Ready) → DISPATCHED → INVOICED   │
│           ↓          ↓           ↓             ↓        │
│        pending    allocated   shipped      billed      │
│                                                          │
│  Then:  BILLED → PENDING_PAYMENT → PAID                 │
│                                                          │
└──────────────────────────────────────────────────────────┘

PENDING ORDERS STATUS:
PENDING_DISPATCH → PARTIAL_DISPATCH → FULLY_DISPATCHED

PAYMENT STATUS:
PENDING → PARTIAL_PAID → FULLY_PAID
```

---

## 📲 SECTION 5: UI WIREFRAMES & PAGES NEEDED

### 5.1 New UI Pages Required

```
PURCHASE SECTION:
1. Purchase Entry List Page
   ├─ All entries with filters
   ├─ Quick actions (Edit, Delete, View)
   ├─ Linked to PO

2. Purchase Entry Form Page
   ├─ Auto-populate from linked PO
   ├─ Edit received quantities
   ├─ Add inspection notes
   ├─ Save as "RECEIVED"

3. Vendor Payment Page
   ├─ Show pending amounts
   ├─ Create payment record
   ├─ Payment history

4. Stock Dashboard Page
   ├─ All products with current stock
   ├─ Alert status (Red/Orange/Green)
   ├─ Reorder info
   ├─ Last movement


SALES SECTION:
1. Sales Invoice List Page
   ├─ All invoices with filters
   ├─ Quick actions
   ├─ Linked to SO

2. Sales Invoice Form Page
   ├─ Auto-populate from SO
   ├─ Edit dispatch quantities
   ├─ Create invoice
   ├─ Mark as "DISPATCHED"

3. Customer Payment Page
   ├─ Show AR data
   ├─ Create payment record
   ├─ Payment history

4. Stocking Page
   ├─ Product-wise stock view
   ├─ Reorder alerts
   ├─ Movement history
   ├─ Alert configuration

5. Sales Order Waiting Page
   ├─ List of pending SOs
   ├─ Waiting quantities
   ├─ Days waiting
   ├─ Create invoice or dispatch
```

---

## 🔗 SECTION 6: DATA RELATIONSHIPS

```
PURCHASE FLOW RELATIONSHIP:
┌────────────┐
│     PO     │
│ (Step 1)   │
└──────┬─────┘
       │ links to
       ↓
┌────────────────┐
│ Purchase Entry │
│    (Step 2)    │
└──────┬─────────┘
       │ links to
       ↓
┌──────────────────┐
│ Vendor Payment   │
│   (Step 4)       │
└──────────────────┘


SALES FLOW RELATIONSHIP:
┌────────────┐
│     SO     │
│ (Step 1)   │
└──────┬─────┘
       │ links to
       ↓
┌────────────────┐
│ Sales Invoice  │
│    (Step 2)    │
└──────┬─────────┘
       │ links to
       ↓
┌──────────────────┐
│ Customer Payment │
│   (Step 4)       │
└──────────────────┘


STOCK MANAGEMENT RELATIONSHIP:
┌──────────────┐         ┌───────────────┐
│   Purchase   │────────→│  Stock Level  │
│   Entry      │ updates │  (Increase)   │
└──────────────┘         └───────────────┘
                              ↑      ↓
                         increases decreases
                              ↑      ↓
                         ┌──────────────────┐
                         │ Stock Alerts     │
                         │ (Reorder Config) │
                         └──────────────────┘
                         
┌──────────────┐         
│  Sales       │────────→│  Stock Level   │
│  Invoice     │ updates │  (Decrease)    │
└──────────────┘         └───────────────┘
```

---

## ✅ SECTION 7: IMPLEMENTATION CHECKLIST

### Phase 1: Purchase Module
```
☐ Create PurchaseEntry model
☐ Create VendorPayment model
☐ Create Stock model
☐ Create StockAlert model
☐ Build Purchase Entry routes (Create, Read, Update)
☐ Build Vendor Payment routes
☐ Build Stock Dashboard API
☐ GL posting for Purchase Entry
☐ GL posting for Vendor Payment
☐ Stock update logic
☐ Build UI pages for Purchase Entry
☐ Build UI for Vendor Payments
☐ Build Stock Dashboard page
```

### Phase 2: Sales Module
```
☐ Create SalesInvoice model
☐ Create CustomerPayment model
☐ Create SalesOrderPending model
☐ Build Sales Invoice routes
☐ Build Customer Payment routes
☐ Build Pending Orders API
☐ GL posting for Sales Invoice
☐ GL posting for Customer Payment
☐ Build Stocking page
☐ Build Sales Invoice form
☐ Build Customer Payment page
☐ Build Pending Orders list
```

### Phase 3: Integration
```
☐ Link POs to Purchase Entries
☐ Link SOs to Sales Invoices
☐ Auto-generate Pending orders list
☐ Reorder alert triggers
☐ Payment reminders
☐ Stock reconciliation
```

---

## 💡 KEY CONCEPTS TO UNDERSTAND

### Concept 1: Allocated vs Available Stock
```
Total Stock = 100 units

Scenario 1: No SO
  Available = 100 (can sell all)
  Allocated = 0

Scenario 2: One SO with 30 units
  Available = 70 (only this much can be sold now)
  Allocated = 30 (reserved for this SO)
  
Scenario 3: SO dispatched & invoiced
  Available = 70 (was already reduced)
  Allocated = 0 (no longer reserved - already gone)
```

### Concept 2: Waiting Quantity
```
SO Created on 26-Feb: 30 units of Burger Patty
  ├─ orderedQty = 30
  ├─ dispatchedQty = 0
  └─ waitingQty = 30 (NOT YET SHIPPED)

Invoice Created on 27-Feb: Dispatch 30 units
  ├─ dispatchedQty = 30 (finally shipped)
  ├─ waitingQty = 0 (no longer waiting)
  └─ invoicedQty = 30 (now billed)

Key Insight: If customer orders 30 but you can only ship 20
  - dispatchedQty = 20
  - waitingQty = 10 (STILL WAITING FOR PAYMENT)
```

### Concept 3: GL Posting Trigger Points

```
PURCHASE:
  PO Created           → NO GL posting
  Purchase Entry       → GL posting (inventory increases, AP created)
  Vendor Payment       → GL posting (AP decreases, bank decreases)

SALES:
  SO Created           → NO GL posting
  Sales Invoice        → GL posting (AR created, revenue recognized)
  Customer Payment     → GL posting (AR decreases, bank increases)
```

---

## 🎯 SUMMARY TABLE

| Module | Current Status | What's Missing | Urgency |
|--------|---|---|---|
| **Purchase Order** | ✓ Created | Receiving/Entry process | High |
| **Purchase Entry** | ✗ Missing | Full workflow | High |
| **Vendor Payment** | ✗ Missing | Payment tracking | High |
| **Stock Management** | ✗ Missing | Levels, alerts, reorder | High |
| **Sales Order** | ✓ Created | Invoice creation | High |
| **Sales Invoice** | ✗ Missing | Bill out process | High |
| **Customer Payment** | ✗ Missing | Payment tracking | High |
| **Stocking** | ✗ Missing | Real-time stock view | High |
| **Pending Orders** | ✗ Missing | Waiting qty tracking | Medium |
| **GL Integration** | ✓ Partial | Complete all posting | High |

---

## 🚀 NEXT STEPS (In Order)

1. **Design Database** - Create all new collections with proper fields
2. **Create Models** - Write Mongoose schemas for PE, VP, SI, CP, Stock
3. **Build APIs** - Create routes and controllers for CRUD operations
4. **GL Integration** - Add GL posting to each transaction
5. **Build UI** - Create React pages for each workflow
6. **Testing** - Test complete flow: PO → PE → Payment
7. **Testing** - Test complete flow: SO → SI → Payment
8. **Reporting** - Verify GL, AR, AP, Stock reports

---

This document serves as your **complete roadmap** for building a Zoho-like ERP system. 

**No coding yet** - Just understanding the flow! 🎯
