# 🎨 Visual Page Layout & Flow

## Page Structure

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                 RECYCLING & RESTOCKING ENTRY                              ║
║                           GOLDEN FOODS                      [🔄 Refresh]  ║
╚═══════════════════════════════════════════════════════════════════════════╝

┌───────────────────────────────────────────────────────────────────────────┐
│ 🔴 LOW STOCK PRODUCTS - Require Restocking                                │
│ 3 product(s) need immediate attention                                     │
├───────────────────────────────────────────────────────────────────────────┤
│ Product │ Qty │ Min │ Max │ Order │ Vendor │ Status │ Actions            │
├───────────────────────────────────────────────────────────────────────────┤
│ Ketchup │  0  │ 10  │ 50  │  50   │ ----   │ Ready  │ [🔧] [🟠]          │
│ Coffee  │  5  │ 10  │ 50  │  45   │ ---    │ Ready  │ [🔧] [🟠]          │
│ Sugar   │  2  │ 10  │ 50  │  48   │ ---    │ Ready  │ [🔧] [🟠]          │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│ 📋 RESTOCKING PIPELINE                                                    │
│ 2 active restocking request(s)                                            │
├───────────────────────────────────────────────────────────────────────────┤
│ Product │ Curr │ Order │ Vendor │ PO#        │ Status     │ Action       │
├───────────────────────────────────────────────────────────────────────────┤
│ Coffee  │  5   │ +45   │ ABC    │ PO-2025-01 │ PO_CREATED │ [✓ Received] │
│ Rice    │  8   │ +42   │ DEF    │ PO-2025-02 │ INITIATED  │ ------       │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│ ✓ WELL STOCKED PRODUCTS                                                   │
│ 15 product(s) at good stock level                                         │
├───────────────────────────────────────────────────────────────────────────┤
│ Product │ Current │ Min/Max │ Vendor │ Health                            │
├───────────────────────────────────────────────────────────────────────────┤
│ Salt    │   45    │ 10/50   │ ABC    │ ████████░░ (90%)                 │
│ Flour   │   48    │ 10/50   │ DEF    │ █████████░ (96%)                 │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Inline Configuration Popup

```
When you click 🔧 Config on Ketchup:

┌─────────────────────────────────────────────────────────────┐
│ CONFIGURE: V Professional Tomato Ketchup 1.2kg              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Min Stock Qty:                                              │
│  ┌────────────────────────────────────────┐                │
│  │ 10                                      │ ← Editable     │
│  └────────────────────────────────────────┘                │
│  Default: 10 (below this = alert)                           │
│                                                               │
│  Max Stock Qty:                                              │
│  ┌────────────────────────────────────────┐                │
│  │ 50                                      │ ← Editable     │
│  └────────────────────────────────────────┘                │
│  Default: 50 (restock target)                               │
│                                                               │
│  Preferred Vendor:                                           │
│  ┌────────────────────────────────────────┐                │
│  │  Type vendor name here...              │ ← REQUIRED!    │
│  │  Example: "ABC Fresh Foods"            │                │
│  └────────────────────────────────────────┘                │
│                                                               │
│                      [Save]  [Cancel]                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## User Interactions Flow

### Flow 1: First Time Setup

```
Product found with qty=0
        ↓
    [🔧 Config]
        ↓
    Edit Dialog Opens
    ├─ Min: 10
    ├─ Max: 50
    └─ Vendor: "ABC Supplies"
        ↓
    [Save]
        ↓
    Toast: "✓ Saved"
        ↓
    [🟠 Restock] ← Now enabled!
        ↓
    Button: "Creating..."
        ↓
    Toast: "✓ PO: PO-2025-001"
        ↓
    Product moves to Section 2 (Pipeline)
        ↓
    Status Badge: 🟡 PO_CREATED
        ↓
    Button changes: [✓ Received] ← Wait for stock
```

### Flow 2: Subsequent Restocks

```
Product qty drops below min
        ↓
    Shows in 🔴 Low Stock (vendor already set)
        ↓
    [🟠 Restock] ← Can click immediately!
        ↓
    Button: "Creating..."
        ↓
    Toast: "✓ PO: PO-2025-002"
        ↓
    Section 2 (Pipeline) updates
        ↓
    Status: 🟡 PO_CREATED
        ↓
    Wait for stock delivery
        ↓
    [✓ Received]
        ↓
    Toast: "✓ Stock received & inventory updated"
        ↓
    Product moves to Section 3 (Well Stocked)
        ↓
    Ready to sell!
```

### Flow 3: Status Progression

```
Section 1: Low Stock
(Product: Ketchup | Qty: 0 | Vendor: unset)
        ↓
    Click [🔧 Config] → Set vendor
        ↓
    Click [🟠 Restock]
        ↓
Section 2: Pipeline
(Status: INITIATED - creating PO)
        ↓
Auto-transition (instant)
        ↓
Section 2: Pipeline
(Status: 🟡 PO_CREATED)
(Button: [✓ Received])
        ↓
Days pass... Stock arrives
        ↓
Click [✓ Received]
        ↓
Section 2 → Section 3
Status: 🟢 RECEIVED
        ↓
Section 3: Well Stocked
(Product: Ketchup | Qty: 50 | Health: 100%)
        ↓
COMPLETE ✓
```

---

## Status Indicators

### Section 1: 🔴 Low Stock Products

```
Ketchup
│
├─ Qty: 0 (RED background - CRITICAL!)
├─ Min: 10 (yellow)
├─ Max: 50 (blue)
├─ Need: 50 (blue, bold)
├─ Vendor: "Not set" (orange warning)
├─ Status: Ready (gray)
└─ Actions:
   ├─ [🔧 Config] (blue button)
   └─ [🟠 Restock] (orange button - maybe disabled)

Color Meaning:
🔴 Red = Critical state (qty=0 or very low)
🟠 Orange = Action available  
🟡 Yellow = Warning threshold
🟢 Green = Healthy stock
🔵 Blue = Information/data
```

### Section 2: 📋 Pipeline

```
Coffee
│
├─ Current: 5
├─ Order: +45 (blue, bold)
├─ Vendor: "ABC Fresh Foods"
├─ PO#: PO-2025-001 (blue, clickable)
├─ Status Badge:
│  ├─ 🔵 INITIATED (blue) = Just created
│  ├─ 🟡 PO_CREATED (yellow) = Awaiting delivery ← Most common
│  ├─ 🟢 RECEIVED (green) = Delivery confirmed
│  └─ 🔴 CANCELLED (red) = Request cancelled
└─ Action:
   └─ [✓ Received] (green - appears when status=PO_CREATED)
```

### Section 3: ✓ Well Stocked

```
Salt
│
├─ Current: 45 (green text)
├─ Min/Max: 10/50
├─ Vendor: "ABC Supplies"
└─ Health Bar:
   ████████░░  (90% of max)
   
   Green bar = Good
   Length = (CurrentQty / MaxQty) * 100%
```

---

## Button States

### Config Button (🔧)

```
Normal State:
[🔧 Config]
Action: Opens inline editor

While Saving:
[⏳ Saving...] ← Disabled

After Save:
[🔧 Config] ← Returns to normal
Toast: "✓ Product configuration saved"
```

### Restock Button (🟠)

```
Normal State (if vendor set):
[🟠 Restock]
Action: Creates RestockingEntry + PO

Disabled State (if vendor NOT set):
[🟠 Restock] ← Grayed out
Tooltip: "Configure vendor first"

While Creating:
[⏳ Creating...] ← Disabled
Tooltip: "Do not click again"

After Success:
[🟠 Restock] ← Returns to normal
Toast: "✓ Restocking initiated! PO: PO-..."
Product moves to Pipeline
```

### Received Button (✓)

```
Visible When: Status = PO_CREATED

Normal State:
[✓ Received] (green)
Action: Mark as received + update qty

While Saving:
[⏳ Updating...] ← Disabled

After Success:
Button disappears
Status changes to: 🟢 RECEIVED
Product moves to Section 3
Toast: "✓ Stock received & inventory updated"
```

---

## Data Updates

### When You Click [🔧 Config] + [Save]

```
Database BEFORE:
{
  name: "Ketchup",
  totalQty: 0,
  minStockQty: undefined,
  maxStockQty: undefined,
  preferredVendor: undefined
}

You Enter:
├─ Min: 10
├─ Max: 50
└─ Vendor: "ABC Fresh Foods"

Database AFTER:
{
  name: "Ketchup",
  totalQty: 0,
  minStockQty: 10,
  maxStockQty: 50,
  preferredVendor: "ABC Fresh Foods"
}
```

### When You Click [🟠 Restock]

```
Creates TWO records:

RestockingEntry:
{
  productName: "Ketchup",
  currentQty: 0,
  restockingQty: 50,
  vendor: "ABC Fresh Foods",
  purchaseOrderNumber: "PO-2025-0001",
  status: "PO_CREATED"
}

PurchaseOrder:
{
  invoiceId: "PO-2025-0001",
  vendor: "ABC Fresh Foods",
  items: [
    {
      productId: "...",
      name: "Ketchup",
      qty: 50
    }
  ],
  status: "PLACED"
}
```

### When You Click [✓ Received]

```
RestockingEntry Updates:
{
  status: "PO_CREATED" → "RECEIVED",
  processedAt: "2026-03-07T14:30:00Z"
}

Product Updates:
{
  totalQty: 0 → 50
}

PurchaseOrder Updates:
{
  status: "PLACED" → "RECEIVED"
}
```

---

## Color Scheme Reference

```
CRITICAL (Action needed now):
🔴 Red       #DC2626   Low stock items, critical alerts
🟠 Orange    #F97316   Action buttons, primary CTA

PROGRESS (In process):
🟡 Yellow    #FBBF24   PO created, awaiting delivery
🔵 Blue      #3B82F6   Information, data fields

SUCCESS (Complete):
🟢 Green     #10B981   Received, healthy stock

NEUTRAL:
⚪ Gray      #6B7280   Inactive, disabled, secondary info
```

---

## Mobile Layout

```
On iPhone/Mobile:

┌─────────────────────────┐
│    RESTOCKING ENTRY     │
│      GOLDEN FOODS       │
│    [🔄 Refresh]         │
└─────────────────────────┘

┌─────────────────────────┐
│ 🔴 LOW STOCK PRODUCTS   │
│ 3 need attention        │
├─────────────────────────┤
│ Product scrolls ↔       │
│ Ketchup │ 0 │ 10 │ 50   │
│ [🔧] [🟠]               │
│                         │
│ Coffee │ 5 │ 10 │ 50    │
│ [🔧] [🟠]               │
│                         │
│ Sugar │ 2 │ 10 │ 50     │
│ [🔧] [🟠]               │
└─────────────────────────┘

┌─────────────────────────┐
│ 📋 PIPELINE             │
│ 2 restocking            │
├─────────────────────────┤
│ Coffee │ 5 │ +45 │ PO-1 │
│ Status: PO_CREATED      │
│ [✓ Received]            │
│                         │
│ Rice │ 8 │ +42 │ PO-2   │
│ Status: INITIATED       │
└─────────────────────────┘

┌─────────────────────────┐
│ ✓ WELL STOCKED          │
│ 15 products             │
├─────────────────────────┤
│ Salt │ 45 │ Health: 90% │
│ Flour │ 48 │ Health: 96%│
│ +13 more...             │
└─────────────────────────┘
```

---

## Responsive Design Breakpoints

```
Desktop (>1024px):
├─ Full table view
├─ All columns visible
├─ Side-by-side sections
└─ Maximum information density

Tablet (768px-1024px):
├─ Tables scroll horizontally
├─ Stacked sections
├─ Optimized column widths
└─ Touch-friendly buttons

Mobile (<768px):
├─ Vertical scrolling
├─ Single-column layout
├─ Compact padding
├─ Large touch targets (44px minimum)
└─ Card-based presentation
```

---

## Notification Toast Positions

```
Top-Right Corner:

┌──────────────────────────────────────────┐
│ ✓ Restocking initiated! PO: PO-2025-001 │ ← Green (success)
└──────────────────────────────────────────┘ Auto-dismiss in 2.5s

┌──────────────────────────────────────────┐
│ ⚠️ Configure thresholds & vendor first   │ ← Red (error)
└──────────────────────────────────────────┘ Auto-dismiss in 2.5s

Timing: All toasts auto-dismiss after 2.5 seconds
Overlap: Multiple toasts stack vertically
```

---

## Keyboard Navigation (Desktop)

```
Tab through interactive elements:
1. [🔄 Refresh] button
2. [🔧 Config] button (first product)
3. [🟠 Restock] button (first product)
4. [🔧 Config] button (next product)
5. ... and so on

Enter/Space: Activate button
Escape: Close modal (if open)
Page Down: Scroll to next section
```

---

## Accessibility Features

```
✓ Color not only indicator
  (text labels + icons + shapes)

✓ Sufficient color contrast
  (WCAG AA compliant)

✓ Large touch targets
  (44px minimum height)

✓ Clear focus indicators
  (blue outline on tabbed elements)

✓ ARIA labels
  (screen readers understand buttons)

✓ Semantic HTML
  (<button>, <table>, <form>)
```

---

## Screen Dimensions

```
Typical Section Heights:

Low Stock Products:
├─ Header: 60px
├─ Table rows: 60px × N products
└─ Total: 60 + (60 × N)

Restocking Pipeline:
├─ Header: 60px
├─ Table rows: 60px × M entries
└─ Total: 60 + (60 × M)

Well Stocked Products:
├─ Header: 60px
├─ Table rows: 60px × K products (showing 10)
├─ "View more" text: 40px
└─ Total: 60 + (60 × 10) + 40

Full Page: 1000px+ recommended
Minimum Width: 320px (mobile)
```

---

## Visual Hierarchy

```
Level 1 (Highest - Immediate attention):
🔴 Critical products with qty=0 in RED

Level 2 (Action needed):
🟠 Restock buttons
📋 Pipeline section with pending orders

Level 3 (Good state):
✓ Well stocked products
🟢 Green badges

Level 4 (Supplementary):
📊 Health bars
📅 Dates
ℹ️ Additional info

Level 5 (Background):
Gray text, disabled elements
```

---

This visual layout helps users understand exactly what they'll see and how to interact with the system!
