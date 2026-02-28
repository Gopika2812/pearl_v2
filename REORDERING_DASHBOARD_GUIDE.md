# Re-Ordering Dashboard - Complete Guide

## Overview

The **Re-Ordering Dashboard** is a real-time inventory management module that aggregates Purchase Order (PO) and Sales Order (SO) data to provide a clear view of:

- **Current Stock**: Actual inventory received from POs
- **Allocated Stock**: Stock reserved for pending (not yet invoiced) sales orders
- **Effective Available Stock**: Stock available for new sales (Current - Allocated)
- **Pending Orders**: Sales order quantities that haven't been invoiced yet
- **Alert Status**: Color-coded inventory levels (Critical, Low, Normal, Out of Stock)

---

## Business Flow Integration

### The Circular Purchase-Sales Cycle

```
1. PURCHASE ENTRY
   ↓
2. CREATE PURCHASE ORDER (PO)
   → Track PO until vendor delivers
   ↓
3. RECEIVE PO (Stock increases)
   → Stock viewed in Re-Ordering Dashboard
   ↓
4. SALES ORDER (SO created)
   → Customer ordered qty tracked
   ↓
5. DISPATCH & INVOICE
   → SO qty gets invoiced (allocated stock decreases)
   ↓
6. RE-ORDERING DECISION
   → If Effective Available < Alert Level
   → Create new PO (cycle repeats)
```

---

## How It Works

### Data Aggregation Logic

For each product, the dashboard calculates:

```
CURRENT STOCK
├─ Sum all PO items qty (where status: PLACED, RECEIVED, PARTIALLY_RETURNED)
└─ Example: PO-001 (20 units) + PO-002 (15 units) = 35 units

ORDERED VS INVOICED (from Sales Orders)
├─ Total SO Ordered: Sum of all SO items qty
├─ Total SO Invoiced: Sum of invoiced items from all SOs
└─ Pending SO: Total Ordered - Total Invoiced

ALLOCATED STOCK
├─ Stock reserved for pending (not invoiced) SOs
└─ Allocated Stock = Pending SO Qty

EFFECTIVE AVAILABLE
├─ Stock truly available for new sales
└─ = Current Stock - Allocated Stock

STATUS CALCULATION
├─ OUT_OF_STOCK: Effective Available = 0
├─ CRITICAL: Effective Available < Reorder Level AND > 0
├─ LOW: Effective Available <= Reorder Level
└─ NORMAL: Effective Available > Reorder Level
```

### Example Calculation

**Product: V Chick Burger Patty**

```
Purchase Orders Received:
  PO-2026-001: 50 units received
  PO-2026-002: 30 units received
  Current Stock = 80 units

Sales Orders Created:
  SO-2026-001: 57 units ordered
    └─ 50 units invoiced, 7 pending
  SO-2026-002: 38 units ordered
    └─ 30 units invoiced, 8 pending

Calculation:
  Total SO Ordered = 57 + 38 = 95 units
  Total SO Invoiced = 50 + 30 = 80 units
  Pending SO = 95 - 80 = 15 units
  
  Allocated Stock = 15 units (reserved for pending SOs)
  Effective Available = 80 - 15 = 65 units
  
  Status = NORMAL (if 65 > Alert Level)
```

---

## Features & Usage

### 1. Dashboard Overview

**Quick Stats Cards** (Top of page)
- OUT OF STOCK: Number of products with 0 inventory
- CRITICAL: Below alert level but available
- LOW STOCK: Near alert threshold
- NORMAL: Healthy inventory levels

**Filter Buttons**
- **All Products**: View complete inventory list
- **🔴 Critical**: Show items needing immediate attention
- **🟡 Low**: Show items approaching critical levels
- **🟢 Normal**: Show well-stocked items

### 2. Products Table

| Column | Description |
|--------|-------------|
| **Product Name** | Product name and HSN code |
| **Available** | Effective Available qty (Current - Allocated) |
| **Pending SO** | Qty not yet invoiced awaiting dispatch |
| **Status** | Color badge: RED/ORANGE/YELLOW/GREEN |
| **Action** | Click arrow to view detailed breakdown |

### 3. Product Details Panel

When you click on a product, the right panel shows:

#### Stock Information
```
Current Stock: 80 units (actual inventory)
├─ Allocated for SO: 15 units (reserved for pending orders)
└─ Effective Available: 65 units (available for sale)
```

#### Sales Order Info
- **Total Ordered**: Complete SO qty ordered
- **Total Invoiced**: Total qty already delivered & invoiced
- **Pending (Not Invoiced)**: Awaiting invoice processing
- **Recent Orders List**: Click through recent SOs with their breakdown

#### Re-order Settings
- **Alert Threshold**: Level at which alert triggers (e.g., 10 units)
- **Reorder Quantity**: Qty to order when alert triggers (e.g., 50 units)
- **Lead Time**: Days to receive new PO (e.g., 5 days)
- **Check Period**: How often to check inventory (Daily/Weekly/Monthly)

### 4. Edit Alert Settings

**To Update Reorder Parameters:**

1. Click product row → Details panel opens
2. Click **"Edit Settings"** button
3. Modify:
   - **Alert Threshold**: When to reorder (units)
   - **Reorder Quantity**: How much to order
   - **Lead Time**: Expected delivery days
   - **Check Period**: Review frequency
4. Click **Save** to update

---

## Integration with Business Process

### Phase 1: Purchase Order Management

```
Backend: /api/reordering/dashboard
├─ Fetches all Purchase Orders
├─ Sums qty received by product
└─ Shows "Current Stock"

Flow:
  Create PO → Receive Stock → Stock appears in Dashboard
```

### Phase 2: Sales Order Tracking

```
Backend: /api/reordering/product/:productId
├─ Fetches all Sales Orders for product
├─ Tracks ordered vs invoiced quantities
├─ Calculates pending qty
└─ Shows in "Pending SO" column

Flow:
  Create SO → Dispatch → Invoice → Reduces "Allocated Stock"
```

### Phase 3: Re-Ordering Alert

```
Status Calculation:
  IF (Effective Available < Reorder Level)
    → Status = CRITICAL (shown in red)
    → Action: Create new PO
  
  Automatic Trigger (next phase):
    → When CRITICAL → Auto-generate PO
    → Send to vendor
    → Cycle repeats
```

---

## Technical Implementation

### Backend API Endpoints

#### 1. GET /api/reordering/dashboard
**Purpose**: Fetch all products with aggregated stock data

**Response Structure**:
```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "productId": "6991a0e7f08415df696403ae",
      "productName": "V Chick Burger Patty",
      "category": "Food",
      "hsn": "1906.90",
      "currentStock": 80,
      "allocatedStock": 15,
      "effectiveAvailable": 65,
      "totalSOOrdered": 95,
      "totalSOInvoiced": 80,
      "pendingSO": 15,
      "reorderLevel": 10,
      "reorderQty": 50,
      "status": "NORMAL"
    }
  ]
}
```

#### 2. GET /api/reordering/product/:productId
**Purpose**: Get detailed breakdown for single product

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "productId": "6991a0e7f08415df696403ae",
    "productName": "V Chick Burger Patty",
    "stock": {
      "currentStock": 80,
      "allocatedStock": 15,
      "effectiveAvailable": 65
    },
    "salesOrder": {
      "totalOrdered": 95,
      "totalInvoiced": 80,
      "pendingSO": 15,
      "details": [
        {
          "soId": "SO-2026-001",
          "date": "2025-02-10",
          "customer": "Restaurant A",
          "orderedQty": 57,
          "invoicedQty": 50,
          "pendingQty": 7
        }
      ]
    },
    "reordering": {
      "reorderLevel": 10,
      "reorderQty": 50,
      "leadTime": 5,
      "checkPeriod": "WEEKLY"
    },
    "status": "NORMAL"
  }
}
```

#### 3. PUT /api/reordering/product/:productId/settings
**Purpose**: Update reorder configuration

**Request Body**:
```json
{
  "reorderLevel": 15,
  "reorderQty": 75,
  "leadTime": 3,
  "checkPeriod": "DAILY"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Reorder settings updated successfully",
  "product": {
    "_id": "6991a0e7f08415df696403ae",
    "productName": "V Chick Burger Patty",
    "reorderLevel": 15,
    "reorderQty": 75,
    "leadTime": 3,
    "checkPeriod": "DAILY"
  }
}
```

### Frontend Component Structure

**File**: `src/pages/ReorderingDashboard.jsx`

**Key Functions**:
- `fetchDashboard()`: Loads all products
- `handleProductClick()`: Fetches detailed product data
- `handleSaveSettings()`: Updates reorder configuration
- `getStatusBadge()`: Returns color styling for status
- `filteredProducts`: Filters by status (all/critical/low/normal)

**UI Components**:
1. **Header**: Title and description
2. **Stats Cards**: Quick overview (4 cards)
3. **Filter Buttons**: Status-based filtering
4. **Products Table**: Main inventory list
5. **Details Panel**: Product-specific information and settings editor

---

## Data Model Changes

### Product Schema (Updated)

```javascript
{
  _id: ObjectId,
  productName: String,
  category: String,
  hsn: String,
  
  // Reordering Fields (NEW)
  reorderLevel: { type: Number, default: 10 },
  reorderQty: { type: Number, default: 20 },
  leadTime: { type: Number, default: 5 },
  checkPeriod: { type: String, enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'] }
}
```

---

## Key Business Rules

1. **Stock Visibility**
   - Only includes POs with status: PLACED, RECEIVED, PARTIALLY_RETURNED
   - Cancelled POs not counted

2. **Pending Calculation**
   - Pending SO = Total SO Qty ordered - Total SO Qty invoiced
   - Only invoiced items reduce allocated stock

3. **Status Logic**
   ```
   IF effective_available == 0
     → OUT_OF_STOCK (Red)
   ELSE IF effective_available < reorderLevel
     → CRITICAL (Red/Orange)
   ELSE IF effective_available <= reorderLevel + 5
     → LOW (Yellow)
   ELSE
     → NORMAL (Green)
   ```

4. **Reorder Timing**
   - Check Period: When inventory should be reviewed
   - Lead Time: Days to receive new stock
   - Uses both to plan ordering in advance

---

## Next Implementation Phases

### Phase 2: Auto PO Creation
```
Trigger: When any product reaches CRITICAL status
Action:
  1. Check Effective Available < Reorder Level
  2. Auto-create PO with reorderQty
  3. Vendor: Use default vendor for product
  4. Status: PENDING_APPROVAL
  5. Notify: Email/SMS to procurement team
```

### Phase 3: Dashboard Actions
```
Quick Actions in Dashboard:
  1. "Create PO Now" button for critical items
  2. "Adjust Settings" modal for bulk updates
  3. "View PO History" for product
  4. "Set Vendor" for reordering
  5. "Archive" toggle for inactive items
```

### Phase 4: Analytics & Reporting
```
Reports to Build:
  1. Stock Turnover Rate (qty sold / avg stock)
  2. Reorder Frequency (how often ordered)
  3. Stockout Incidents (historical)
  4. Lead Time Performance (PO delivery time)
  5. Carrying Cost Analysis (holding costs)
```

---

## Troubleshooting

### Issue: Products not showing in dashboard?
**Solution**: Check that products have:
- Created Purchase Orders (with qty received)
- Or Sales Orders (with items)

### Issue: Pending SO qty seems wrong?
**Solution**: Verify that:
- SO has items with quantities
- SO has invoiceItems array populated
- Invoice qty < Ordered qty

### Issue: Status always showing "NORMAL"?
**Solution**: Lower the reorderLevel for that product
- Edit settings → reduce Alert Threshold

### Issue: Effective Available shows negative?
**Solution**: Ensure PO quantities are larger than pending SO
- May indicate overbooking (SO > PO received)
- Requires manual stock adjustment

---

## FAQ

**Q: How often is stock updated?**
A: Real-time. Dashboard fetches latest data when page loads or status changed.

**Q: What if I have negative effective available stock?**
A: Indicates more SO orders than received stock. Prioritize PO fulfillment or reduce open SO.

**Q: Can I set different alert levels per product?**
A: Yes! Each product has its own reorderLevel and reorderQty in settings.

**Q: How does pending SO affect my available stock?**
A: Directly! Pending qty is reserved (allocated). New customers can only order effective available stock.

**Q: When should I create a new PO?**
A: When effective available falls below reorderLevel. Dashboard will show CRITICAL status.

---

## Performance Tips

1. **For Large Inventories** (1000+ products)
   - Use filters (critical/low items first)
   - Archive slow-moving products
   - Set daily check periods for high-turnover items

2. **For Daily Use**
   - Check dashboard each morning
   - Focus on CRITICAL items immediately
   - Update settings quarterly based on demand trends

3. **For Accuracy**
   - Ensure POs have correct received qty
   - Verify SO invoicing is immediate
   - Regular inventory audits (monthly)

---

## Related Modules

- **Purchase Order Entry**: Create and track POs
- **Sales Order Entry**: Create and track SOs
- **Payment Module**: Process vendor payments
- **General Ledger**: Financial impact of stock movements
- **Financial Reports**: Inventory valuation in Balance Sheet

