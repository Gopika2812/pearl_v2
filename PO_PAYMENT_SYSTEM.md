# PO Payment & Creditor Management System

## Overview
Complete purchase order payment tracking system with vendor credit management and debit note functionality.

---

## **Key Features Implemented**

### **1. Payment Modal (POPaymentModal.jsx)**
- **Record Payments**: Record vendor payments against purchase orders
- **Payment Summary Card**: Shows Total Amount → Paid Amount → Pending Balance
- **Payment Form**:
  - Payment amount (with max validation to prevent overpayment)
  - Payment method (Bank Transfer, Check, Cash, Credit, Other)
  - Reference number (Check number, Transaction ID, etc.)
  - Description/Notes
- **Payment History**: View all payments made for the PO in a table
- **Status Control**: 
  - Button disabled when PO is fully paid (shows ✅ "Fully Paid")
  - Shows pending balance in red when balance remains
  - Green "Pay ₹X" button when payment can be made
- **Auto-Calculation**: Calculates paid + pending balance in real-time

### **2. Purchase Order Records Enhancement**
- **Pay Creditors Button**: Green credit card button in PO actions
- **Payment Modal Integration**: Opens payment modal for selected PO
- **Auto-Refresh**: Records list refreshes after successful payment
- **Full Payment Tracking**: Shows payment history below PO details

### **3. Backend Payment Endpoint** (`POST /payments`)
**Records payment and updates vendor credit:**
```javascript
{
  branchId: "...",
  paymentType: "vendor_payment",
  vendor: {
    vendorId: "...",
    name: "Field Fresh Foods"
  },
  purchaseOrder: {
    poId: "...",
    invoiceId: "ZONE1PO/001/2025-2026"
  },
  amount: 1000,
  paymentMethod: "bank_transfer",
  referenceNo: "TXN123456",
  description: "Payment for PO...",
  paymentDate: new Date(),
  status: "completed"
}
```

**Vendor Credit Update**:
- When payment is recorded, vendor's `credit` field is automatically incremented
- Example: Payment of ₹1000 → Vendor credit increases by ₹1000
- This tracks how much the vendor has been paid

### **4. New Backend Endpoint** (`GET /payments/po/:poId`)
Fetches all payments for a specific purchase order:
```javascript
GET /api/payments/po/{PO_ID}
Response: {
  success: true,
  data: [
    {
      _id: "...",
      paymentDate: "2026-03-03T...",
      amount: 1000,
      paymentMethod: "bank_transfer",
      referenceNo: "TXN123456",
      ...
    }
  ]
}
```

---

## **How The Workflow Works**

### **Step 1: Create Purchase Order**
```
User selects voucher type → Vendor → Warehouse → Adds items
Grand Total: ₹1,460
```

### **Step 2: View PO in Records**
```
Records table shows:
- Invoice ID: ZONE1PO/001/2025-2026
- Vendor: Field Fresh Foods
- Grand Total: ₹1,460
- Actions: [👁️ View] [💳 Pay] [🗑️ Delete]
```

### **Step 3: Click "Pay Creditors" (💳 Button)**
```
Modal Opens:
┌─────────────────────────────────┐
│ Payment for ZONE1PO/001/2025-26 │
├─────────────────────────────────┤
│ Total: ₹1,460                   │
│ Paid: ₹0                        │
│ Pending: ₹1,460 (Red)           │
├─────────────────────────────────┤
│ Record New Payment              │
│ Amount: [_______] Max ₹1,460    │
│ Method: [Bank Transfer ▼]       │
│ Ref No: [TXN123456___]          │
│ Description: [____________]     │
│                                 │
│ [Cancel] [Pay ₹1000] ✓          │
└─────────────────────────────────┘
```

### **Step 4: Make Payment**
- User enters amount: ₹500
- Selects payment method: "Bank Transfer"
- Enters reference: "TXN123456"
- Clicks "Pay ₹500"

### **Step 5: Backend Processes Payment**
```
1. Creates Payment record with status "completed"
2. Updates Vendor credit: credit += ₹500
3. Returns success response
```

### **Step 6: UI Updates**
```
Modal Refreshes:
- Payment History shows:
  │ 2026-03-03 │ Bank Transfer │ ₹500 │ TXN123456 │
  
- Balances Update:
  │ Total: ₹1,460 │ Paid: ₹500 │ Pending: ₹960 │
  
- Button enabled for next payment: "Pay ₹960" (Green)
```

### **Step 7: Full Payment**
```
User pays remaining ₹960:
- Modal shows: ✅ "Payment Fully Completed"
- Payment History:
  │ 2026-03-03 │ Bank Transfer │ ₹500  │ TXN123456 │
  │ 2026-03-05 │ Bank Transfer │ ₹960  │ TXN234567 │
  
- Balances:
  │ Total: ₹1,460 │ Paid: ₹1,460 │ Pending: ₹0 │
  
- Button DISABLED (no pending balance)
- Vendor credit updated to ₹1,460 in database
```

---

## **Vendor Credit Tracking**

### **What is Credit?**
- **Credit** = Total amount vendor has been paid
- Stored in `Vendor.credit` field
- Auto-incremented when payment is recorded

### **Example Flow**:
```
Initial State:
Vendor: Field Fresh Foods
- Debit: ₹0 (Amount we owe)
- Credit: ₹0 (Amount we paid)

After PO Created:
- Debit: ₹1,460 (We owe vendor)
- Credit: ₹0

After Payment 1 (₹500):
- Debit: ₹1,460
- Credit: ₹500 (↑ incremented)

After Payment 2 (₹960):
- Debit: ₹1,460
- Credit: ₹1,460 (✅ Balanced)
```

---

## **Debit Note Functionality**

### **Debit Note Context**
- **Debit Note** = Reduction in amount owed to vendor
- Created when: Invoice returned, quality issues, adjustments, etc.

### **Integration with Credit System**
```
When Debit Note is created:
1. Vendor.debit is reduced
2. This reduces "amount owed" for payment tracking
3. Pending balance = Vendor.debit - Vendor.credit
```

### **In Payment Modal**:
```
Pending Balance Calculation:
Pending = PO.grandTotal - Total Paid Payments

Example with Debit Note:
Original PO: ₹1,460
Debit Note: -₹200 (Return/Adjustment)
New Balance: ₹1,260
Paid Amount: ₹500
Pending: ₹760 ← Uses fresh calculation
```

---

## **UI Components Structure**

```
InventoryPurchaseOrder.jsx
├─ InventoryPurchaseOrderEntry (Create PO)
└─ InventoryPurchaseOrderRecords
   ├─ [Table of POs]
   ├─ View Details Modal
   └─ POPaymentModal ← NEW
      ├─ Payment Summary Card
      ├─ Payment Form
      ├─ Payment History Table
      └─ Status Messages
```

---

## **API Endpoints Summary**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/payments` | Record vendor payment |
| GET | `/payments/po/:poId` | Get payments for specific PO |
| GET | `/payments` | Get all payments |
| PUT | `/payments/:id` | Update payment |
| DELETE | `/payments/:id` | Delete payment |

---

## **Key Data Flows**

### **Payment Creation**
```
Frontend → POST /payments
  ↓
- Create Payment record
- Increment Counter (PAY/001/2025-26)
- Update Vendor.credit += amount
- Return success → Modal refreshes
```

### **Pending Balance Calculation**
```
PO.grandTotal (₹1,460)
  - Sum(All Payments for this PO)
  = Pending Balance
  
Updated every time:
- New payment recorded
- Modal re-opens
- Records list refreshes
```

---

## **Features & Capabilities**

✅ Record multiple partial payments for single PO
✅ Prevent overpayment (max = pending balance)
✅ Track payment method (Bank, Check, Cash, Credit, Other)
✅ Auto-update vendor credit in database
✅ Payment history for each PO
✅ Full payment status indication
✅ Pending balance display
✅ Reference number tracking
✅ Payment date tracking
✅ Description/notes for each payment
✅ Real-time balance calculations

---

## **Payment Status Flow**

```
PO Created (Pending)
    ↓
User clicks "Pay Creditors"
    ↓
Opens Payment Modal
    ↓
Enter Amount → Select Method → Add Reference
    ↓
Click "Pay ₹X"
    ↓
Payment Created → Vendor Credit Updated
    ↓
Modal refreshes:
  - Payment History updated
  - Pending Balance recalculated
  - Vendor.credit incremented in database
    ↓
If Fully Paid: Show ✅ "Fully Completed"
If Partial: Show remaining pending & enable next payment
```

---

## **Files Modified/Created**

### **New Files**
- `src/components/inventory/POPaymentModal.jsx` - Payment recording component

### **Modified Files**
- `src/components/inventory/InventoryPurchaseOrderRecords.jsx` - Added payment button & modal integration
- `backend/routes/paymentRoutes.js` - Added vendor credit update + new endpoint for PO payments
- `backend/models/Vendor.js` - Uses existing credit field

---

## **Next Steps (Optional Enhancements)**

1. **Debit Note Creation**: Form to create debit notes linked to POs
2. **Payment Reversals**: Ability to reverse/refund payments
3. **Vendor Dashboard**: Summary of vendor debit/credit balance
4. **Payment Reports**: Vendor payment history exports
5. **Auto-GL Posting**: Post payment entries to General Ledger
6. **Reconciliation**: Match payments to receipts/invoices
