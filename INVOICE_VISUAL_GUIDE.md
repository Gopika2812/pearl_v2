# Visual Guide: Three Invoice Formats

Based on the uploaded images, here's exactly what each invoice format will display:

---

## INVOICE FORMAT 1️⃣: ORDER DETAILS

### Layout (as per your first image)

```
┌─────────────────────────────────────────────────────────┐
│                    PEARL AGENCY                         │
│              Invoice Management System                  │
└─────────────────────────────────────────────────────────┘

12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003, Tamil Nadu
Mobile: 9429692970 | GSTIN: 33DULPS2600Q1Z6
GPAY No: 8825847884 | State: Tamil Nadu (Code: 33)

┌──────────────────────────────────────────────────────────┐
│ Invoice No: INV-MAIN-0001-2026    | Billing Person: -    │
│ Date: 04/03/2026                  | Delivery Person: -   │
└──────────────────────────────────────────────────────────┘

┌─────────────────────┬──────────────────────────────────┐
│  SENDER (FROM)      │   BUYER (BILL TO)               │
├─────────────────────┼──────────────────────────────────┤
│ PEARL AGENCY        │ Swiss Bakers (K.P.Road) A/c     │
│ 12/13, South        │ 417-B,K.P.Road                  │
│ By-Pass Road        │ Ramavarmapuram, Nagercoil       │
│ Vanarpettai         │ Tamil Nadu                       │
│ GSTIN:              │ GSTIN: -                         │
│ 33DULPS2600Q1Z6     │ Mobile: +91-9489600352          │
│ Phone:              │                                  │
│ 9429692970          │                                  │
└─────────────────────┴──────────────────────────────────┘

                    PRODUCT DETAILS

┌──────────────────────┬─────┬──────┬──────┬────────────┐
│ Product Name         │ HSN │ Qty  │Price │   Total    │
├──────────────────────┼─────┼──────┼──────┼────────────┤
│ G.C Tutti Frutti     │2106 │  3   │ ₹84  │  ₹252.00   │
│ (Red) 1kg (1*15)     │1225 │      │      │            │
│                      │     │      │      │            │
│ G.C. Karonda 1kg     │2106 │  5   │ ₹175 │  ₹875.00   │
│ (1*13)               │0000 │      │      │            │
└──────────────────────┴─────┴──────┴──────┴────────────┘

SAMPLE PRODUCTS (NOT BILLED)
Red Cherry 850 Gm - Qty: 1

                        SUMMARY

Subtotal:              ₹1127.00
CGST (2.5%):           ₹28.18
SGST (2.5%):           ₹28.18
Transport:             ₹0.00
Extra Expenses:        ₹0.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GRAND TOTAL:           ₹1183.36

Opening Balance:       ₹0.00
Closing Balance:       ₹1183.36

Notes: [Any special instructions here]

Invoice generated on 04/03/2026, 14:30:45
```

**When this appears:**
- Complete order documentation ✅
- Customer gets full reference
- All product details visible ✅
- Tax breakdown clear ✅
- Balance tracking visible ✅

---

## INVOICE FORMAT 2️⃣: TAX INVOICE (HSN-WISE SUMMARY)

### Layout (as per your second image)

```
┌─────────────────────────────────────────────────────────┐
│                    PEARL AGENCY                         │
│         TAX INVOICE - HSN-WISE SUMMARY                  │
└─────────────────────────────────────────────────────────┘

Invoice No: INV-MAIN-0001-2026        Date: 04/03/2026

┌──────┬──────────────┬──────────────────────────────────┐
│ HSN  │ Taxable      │ CGST (Rate % | Amount)           │
│ Code │ Value        │ SGST (Rate % | Amount)           │
│      │              │ Total                            │
├──────┼──────────────┼──────────────────────────────────┤
│2106  │ ₹1127.00     │ CGST (2.5% | ₹28.18)             │
│1225  │              │ SGST (2.5% | ₹28.18)             │
│      │              │ Total: ₹1183.36                  │
├──────┼──────────────┼──────────────────────────────────┤
│2106  │              │                                  │
│0000  │              │                                  │
└──────┴──────────────┴──────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL TAXABLE VALUE:    ₹1127.00
TOTAL CGST:             ₹28.18
TOTAL SGST:             ₹28.18
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL AMOUNT:           ₹1183.36

Tax Invoice as per GST regulations
```

**When this appears:**
- GST compliance document ✅
- Accountant reference ✅
- Tax filing support ✅
- Summary format only (no product details) ✅

---

## INVOICE FORMAT 3️⃣: BACK ORDER INVOICE

### Layout (as per your fourth image)

```
┌─────────────────────────────────────────────────────────┐
│                    PEARL AGENCY                         │
│              BACK ORDER INVOICE                         │
│                 ⚠️ PENDING DELIVERY                     │
└─────────────────────────────────────────────────────────┘

                    ORDER DETAILS

Invoice No: ZONE1SO/001/2025-2026
Date: 01/03/2026

Customer: Swiss Bakers (K.P.Road) A/c
Address: 417-B,K.P.Road, Ramavarmapuram, Nagercoil

┌────┬──────────────────┬──────────┬──────────┬──────────┐
│ Sr.│ Product Name     │Requested │Confirmed │   Back   │
│ No.│                  │   Qty    │   Qty    │  Order   │
│    │                  │          │          │   Qty    │
├────┼──────────────────┼──────────┼──────────┼──────────┤
│ 1  │ G.C Tutti Frutti │   5 kg   │   3 kg   │   2 kg   │
│    │ (Red) 1kg (1*15) │          │          │  ⚠️RED   │
├────┼──────────────────┼──────────┼──────────┼──────────┤
│ 2  │ G.C. Karonda     │   5 kg   │   5 kg   │   0 kg   │
│    │ 1kg (1*13)       │          │          │          │
└────┴──────────────────┴──────────┴──────────┴──────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL BACK ORDER QUANTITY:   2 kg

ℹ️ Your pending product sent by 08/03/2026

[Customer gets back order invoice separately]
[Tracking number for follow-up]

Back Order Invoice - Please retain for reference
```

**When this appears:**
- Customer ordered 5kg, you have 3kg ✅
- 3kg is billed in main invoice ✅
- 2kg is back order (pending) ✅
- Customer knows what's coming ✅
- Separate invoice for accountability ✅

---

## How They Appear in Print Preview

### Print Dialog Shows All 3 Formats

When user clicks **"Print Invoice"**, they see:

```
┌─────────────────────────────────────────┐
│  Print Preview                          │
│                                         │
│  Destination: Microsoft Print to PDF    │
│  Pages: All (3 pages)                   │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ [PAGE 1 OF 3]                       ││
│  │ ORDER DETAILS                       ││
│  │ Full order with all product info    ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ [PAGE 2 OF 3]                       ││
│  │ TAX INVOICE - HSN-WISE              ││
│  │ Tax compliance summary              ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ [PAGE 3 OF 3]                       ││
│  │ BACK ORDER INVOICE (if applicable)  ││
│  │ Pending items tracking              ││
│  └─────────────────────────────────────┘│
│                                         │
│   [Print] [Cancel]                      │
└─────────────────────────────────────────┘
```

---

## Editable Quantities in Action

### Before Editing
```
Order Details
Product: G.C Tutti Frutti (Red) 1kg
Original Qty: 5 kg
Confirmed Qty: 5 kg (input field)
Back Order Qty: 0 kg
```

### User Edits Quantity to 3
```
Order Details
Product: G.C Tutti Frutti (Red) 1kg
Original Qty: 5 kg
Confirmed Qty: 3 kg ← [USER EDITED]
Back Order Qty: 2 kg ← [AUTO CALCULATED]

✅ Total updated
✅ Taxes recalculated
✅ Grand total changed
```

---

## WhatsApp Message Format

When user clicks **"Send via WhatsApp"**:

```
💬 MESSAGE SENT TO: +91-9489600352

---

Hey! Your invoice #INV-MAIN-0001-2026 is ready.

Total: ₹1183.36

Thank you for your business!

[WhatsApp opens with this pre-filled message]
```

---

## Screen Flow in the Modal

### Step 1: EDIT TAB ✏️
```
╔════════════════════════════════════════╗
║  EDIT    PREVIEW    SUCCESS            ║
╠════════════════════════════════════════╣
║                                        ║
║  Edit Order Items                      ║
║                                        ║
║  Invoice Type: ⭕ Order Details        ║
║                ⭕ Tax Invoice          ║
║                ⭕ Back Order           ║
║                                        ║
║  ┌────────────────────────────────────┐║
║  │ Product  │ Orig │ Confirm │ BackOrd││
║  ├──────────┼──────┼─────────┼────────┤║
║  │Product 1 │ 5kg  │ [3]  ← │ 2kg    ││
║  │Product 2 │ 5kg  │ [5]    │ 0kg    ││
║  └────────────────────────────────────┘║
║                                        ║
║  Notes:                                ║
║  ┌────────────────────────────────────┐║
║  │ Add any special instructions...    ││
║  └────────────────────────────────────┘║
║                                        ║
║  ☐ Auto Print    ☐ Send WhatsApp      ║
║                                        ║
║              [Generate Preview]        ║
╚════════════════════════════════════════╝
```

### Step 2: PREVIEW TAB 👁️
```
╔════════════════════════════════════════╗
║  EDIT    PREVIEW    SUCCESS            ║
╠════════════════════════════════════════╣
║                                        ║
║  Format:  [Order Details] [Tax Inv.] ║
║           [Back Order]                 ║
║                                        ║
║  ┌─────────────────────────────────┐  ║
║  │ Subtotal: ₹1127.00              │  ║
║  │ CGST: ₹28.18  SGST: ₹28.18      │  ║
║  │ Total: ₹1183.36                 │  ║
║  └─────────────────────────────────┘  ║
║                                        ║
║  ⚠️ Back Order Alert:                 ║
║  Product 1: 2kg | ...                 ║
║                                        ║
║              [Finalize & Generate]     ║
╚════════════════════════════════════════╝
```

### Step 3: SUCCESS TAB ✅
```
╔════════════════════════════════════════╗
║  EDIT    PREVIEW    SUCCESS            ║
╠════════════════════════════════════════╣
║                                        ║
║                    ✅                  ║
║                                        ║
║  Invoice Generated Successfully!       ║
║  Invoice #INV-MAIN-0001-2026          ║
║                                        ║
║  ┌─────────────────────────────────┐  ║
║  │ Total Amount: ₹1183.36          │  ║
║  │ Closing Balance: ₹1183.36       │  ║
║  └─────────────────────────────────┘  ║
║                                        ║
║  ⬇️ NEXT STEPS ⬇️                     ║
║  [🖨️ Print Invoice]  [💬 Send WhatsApp]║
║                                        ║
╚════════════════════════════════════════╝
```

---

## Real-Time Calculations Example

### Scenario: Partial Stock

**Customer Order:**
- Product: Chicken Chips 1.5kg × 3 units = **5 units**
- Unit Price: ₹77.15
- CGST: 5% | SGST: 5%
- You only have: **2 units** in stock

**User in Edit Tab:**
```
Original Qty: 5 units
Confirmed Qty: [2] ← User types 2
Back Order Qty: 3 units ← Auto-calculated

↓ Preview Tab Updates Instantly ↓

Original Total: ₹385.75 (5 units)
New Total: ₹154.30 (2 units)
CGST: ₹7.72 (5% of new total)
SGST: ₹7.72
Grand Total: ₹169.74 ← RECALCULATED

Back Order Items:
- Chicken Chips: 3 units (pending)
```

---

## Notes Feature Example

```
Invoice for: Swiss Bakers (K.P.Road)
Date: 04/03/2026

User adds note:
"Delivery on 05/03/2026 morning shift.
Please call 30 mins before arrival.
2 units back order, deliver next week."

↓ This note appears on the ORDER DETAILS format ↓

[In Invoice Preview]
─────────────────────────────────────────
Notes:
Delivery on 05/03/2026 morning shift.
Please call 30 mins before arrival.
2 units back order, deliver next week.
─────────────────────────────────────────
```

---

## Visual Comparison

### Old Process ❌
```
1. Generate Invoice
   ↓
2. Get some format (unclear)
   ↓
3. Try to print (might fail)
   ↓
4. Manual WhatsApp entry
   ↓
5. Hope it's correct
```

### New Process ✅
```
1. Click "Generate Invoice"
   ↓
2. EDIT: Adjust quantities, add notes
   ↓
3. PREVIEW: See exactly what will print (3 formats)
   ↓
4. SUCCESS: One-click print, one-click WhatsApp
   ↓
5. Done! Invoice saved & tracked
```

---

## Color Coding in the UI

```
🟦 Blue: Header, forms, main sections
🟩 Green: Success states, positive actions
🟥 Red: Back orders, warnings, negative values
🟨 Yellow: Options, secondary information
```

---

## Files Generated

```
Print Menu → 3 Pages
├─ Page 1: ORDER DETAILS (all product info)
├─ Page 2: TAX INVOICE (HSN summary)
└─ Page 3: BACK ORDER (if back orders exist)
```

---

## Summary

| Format | Purpose | When | Details |
|--------|---------|------|---------|
| **1️⃣ Order Details** | Complete documentation | Always | Full product table, customer, balance |
| **2️⃣ Tax Invoice** | GST compliance | Always | HSN-wise summary only |
| **3️⃣ Back Order** | Pending tracking | If back orders > 0 | What's pending and when it arrives |

**All three generate in one click, all three appear in print dialog, user can save all as PDF.**

---

This matches the exact formats shown in your uploaded images! 🎉
