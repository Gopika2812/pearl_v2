# Invoice Generation System Documentation

## Overview

A complete separate invoice generation system has been created with support for three distinct invoice formats without using the "Pearls Book" infrastructure. The system allows users to:

1. **Edit quantities** before generating invoices
2. **Add notes** to invoices
3. **Calculate back orders** automatically
4. **Generate 3 different invoice formats** for different purposes
5. **Print** or **send via WhatsApp** directly from the system

---

## Architecture

### Backend Structure

#### 1. **New Model: Invoice** (`backend/models/Invoice.js`)
Stores complete invoice records with:
- Invoice metadata (number, date, financial year)
- Reference to original sales order
- Processed items (with confirmed quantities)
- Back order items (quantities not billed)
- Customer & seller details
- Totals and tax calculations
- Status tracking (DRAFT, FINALIZED, PRINTED, SENT)

#### 2. **New Routes: Invoice API** (`backend/routes/invoiceRoutes.js`)

**Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/invoices/prepare/:salesOrderId` | Prepare sales order for invoicing |
| POST | `/invoices/preview/:salesOrderId` | Generate preview with edited quantities |
| POST | `/invoices/finalize/:salesOrderId` | Save invoice and mark order as invoiced |
| GET | `/invoices/:invoiceId` | Retrieve invoice details |
| PUT | `/invoices/:invoiceId/print` | Mark invoice as printed |
| PUT | `/invoices/:invoiceId/whatsapp` | Mark invoice as WhatsApp sent |
| GET | `/invoices` | Get all invoices (with filters) |

### Frontend Structure

#### 1. **New Component: InvoiceGeneratorModal** (`src/components/InvoiceGeneratorModal.jsx`)

A comprehensive modal component with 3 tabs:

**Tab 1: Edit** ✏️
- Shows all order items in a table
- Edit confirmed quantity for each item
- Back order quantity calculated automatically
- Add invoice notes
- Select invoice type (Order Details, Tax Invoice, Back Order)
- Checkbox to auto-print or send via WhatsApp

**Tab 2: Preview** 👁️
- Shows calculated totals with edited quantities
- Select format to preview (radio buttons)
- Summary cards showing subtotal, taxes, expenses, grand total
- Back order alert if applicable
- Generate and finalize button

**Tab 3: Success** ✅
- Confirmation with invoice number
- Display final amounts
- Print and WhatsApp buttons

#### 2. **Updated Component: BranchInvoicedOrders** 
Now uses the new `InvoiceGeneratorModal` instead of the old system

---

## Three Invoice Formats

### Format 1: ORDER DETAILS 📋
**Purpose:** Complete order documentation showing all details

**Includes:**
- Company header with logo, address, GSTIN, phone, GPAY number
- Invoice number and date
- Billing person info
- Sender (from) and Buyer (to) details
- Complete product table with:
  - Product name
  - HSN code
  - Edited quantity (confirmed only)
  - Unit price
  - Total amount
- Sample products section (if any, marked as NOT BILLED)
- Summary section:
  - Subtotal
  - CGST, SGST amounts
  - Transport charges
  - Extra expenses
  - **Grand Total**
- Closing balance calculation

### Format 2: TAX INVOICE 🧾
**Purpose:** GST compliance and tax reporting (HSN-wise summary)

**Includes:**
- Simple HSN-wise tax summary
- Columns: HSN Code | Taxable Value | CGST (Rate | Amount) | SGST (Rate | Amount) | Total
- Aggregate tax information
- Final totals for GST filing

### Format 3: BACK ORDER INVOICE 📦
**Purpose:** Document pending items for future delivery

**Shown only if there are back order items**

**Includes:**
- Invoice number and date
- Customer and billing details
- Back order summary table:
  - Product name
  - Requested quantity (original)
  - Confirmed quantity (what was billed)
  - Back order quantity ⚠️ (highlighted in red)
- Total back order quantity
- Expected delivery date (7 days from now)

---

## Workflow

### Step-by-Step Process

1. **Navigate to Sales Orders to Invoice** (`Branch Dashboard > Sales Orders to Invoice`)

2. **View Sales Orders List**
   - Click the expand arrow to see order items
   - Check customer details, items, and amounts

3. **Click "Generate Invoice"** Button
   - Opens `InvoiceGeneratorModal`

4. **In Edit Tab:**
   - Change quantities as needed (confirmed vs back order)
   - Add any notes about the order
   - Select invoice type to include
   - Check print/WhatsApp options if desired
   - Click "Generate Preview"

5. **In Preview Tab:**
   - View summary with new calculations
   - Select invoice format to preview (switch between three formats)
   - See back order warning if applicable
   - Click "Finalize & Generate" to save invoice

6. **In Success Tab:**
   - Invoice is now saved in database
   - Can print immediately
   - Can send via WhatsApp
   - Modal displays confirmation

---

## Database Integration

### Sales Order - Invoice Relationship

When an invoice is finalized:
1. A new `Invoice` document is created with full details
2. The `SalesOrder` is marked as `invoiceGenerated: true`
3. Invoice notes are saved to the sales order
4. Back order items are tracked in the invoice

### Data Flow

```
SalesOrder
    ↓
Edit Quantities & Notes
    ↓
Calculate Back Orders
    ↓
Generate Preview with New Totals
    ↓
Create Invoice Document
    ↓
Update SalesOrder.invoiceGenerated = true
    ↓
Print/Share Results
```

---

## Key Features

### 1. **Editable Quantities**
- Each item shows original quantity
- User can edit confirmed quantity (0 to original)
- Back order quantity = original - confirmed
- Totals are recalculated proportionally

### 2. **Smart Back Order Calculation**
- Half item ordered (5kg), only 3kg available?
- Confirm 3kg, back order 2kg automatically
- Both quantities tracked in the system

### 3. **Automatic Tax Recalculation**
- When quantity changes, taxes are recalculated
- CGST, SGST, or IGST handled correctly
- Transport and extra expenses preserved

### 4. **Balance Tracking**
- Opening balance (customer credit from previous orders)
- Closing balance = opening balance + grand total
- Shows customer's total liability

### 5. **Sample Items Handling**
- Sample items shown separately (not billed)
- Not included in grand total
- Clearly marked as "SAMPLE PRODUCTS (NOT BILLED)"

### 6. **Print & Share**
- **Print**: Opens browser print dialog with all three formats
- **WhatsApp**: Sends invoice number and amount to customer directly
- Auto-triggers based on checkboxes

---

## Technical Details

### API Endpoints Usage

```javascript
// Prepare invoice (get sales order data)
GET /api/invoices/prepare/[salesOrderId]

// Generate preview with edits
POST /api/invoices/preview/[salesOrderId]
Body: { items, notes, invoiceType }

// Save final invoice
POST /api/invoices/finalize/[salesOrderId]
Body: { items, notes, invoiceType }

// Mark as printed
PUT /api/invoices/[invoiceId]/print

// Mark as WhatsApp sent
PUT /api/invoices/[invoiceId]/whatsapp
```

### Quantity Calculation Logic

```javascript
// For each item:
const confirmedQty = item.confirmedQty || item.qty;
const qtyRatio = confirmedQty / originalQty;
const newTotal = originalTotal * qtyRatio;

// Tax calculation:
const taxAmount = originalTax * qtyRatio;
```

---

## File Structure

```
pearls-erp/
├── backend/
│   ├── models/
│   │   └── Invoice.js (NEW)
│   ├── routes/
│   │   └── invoiceRoutes.js (NEW)
│   └── server.js (UPDATED - added invoice routes)
│
└── src/
    ├── components/
    │   └── InvoiceGeneratorModal.jsx (NEW)
    └── pages/
        └── branch/
            └── BranchInvoicedOrders.jsx (UPDATED - uses new modal)
```

---

## Default Company Information

The system uses the following default company details:
```
Company Name: PEARL AGENCY
Address: 12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003
State: Tamil Nadu
GSTIN: 33DULPS2600Q1Z6
Phone: 9429692970
GPAY No: 8825847884
State Code: 33
```

*Note: These can be customized per branch by updating the `seller` object in the route or by fetching from branch settings.*

---

## Error Handling

The system includes error handling for:
- ❌ Sales order not found
- ❌ Missing required fields
- ❌ Database transaction failures
- ❌ Invalid quantity ranges
- ❌ Missing customer details

All errors are logged to console and shown as toast notifications to the user.

---

## Future Enhancements

Possible improvements:
1. **Email Support**: Send invoices via email
2. **PDF Generation**: Generate PDF files directly
3. **Invoice Customization**: Allow custom company details per branch
4. **Recurring Orders**: Auto-generate for repeat orders
5. **Invoice Templates**: Multiple design templates
6. **Audit Trail**: Track all changes to invoices
7. **Digital Signature**: Add company signature to invoices
8. **Multi-currency**: Support different currencies

---

## Testing the System

### To test the invoice generation:

1. Navigate to Branch Dashboard
2. Go to "Sales Orders to Invoice"
3. Select a sales order with active items
4. Click "Generate Invoice"
5. Edit quantities (e.g., reduce some quantities to create back orders)
6. Add a note
7. Click "Generate Preview"
8. Select different invoice formats to preview
9. Click "Finalize & Generate"
10. In success tab, click "Print Invoice"
11. Verify all three formats appear correctly

---

## Support

For issues or questions:
- Check browser console for error messages
- Verify sales order has items and customer details
- Ensure branch is properly selected
- Check MongoDB connection for database errors

---

**Created:** March 2026  
**System:** Pearl ERP - Separate Invoice Generation  
**Status:** Ready for Production
