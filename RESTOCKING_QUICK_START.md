# Quick Start Guide - Restocking & Inventory Management

## 🚀 How to Use the Restocking System

### Access the Page
1. Navigate to the Pearls ERP application
2. Select your Branch from the dropdown
3. Click **"Restocking & Inventory"** in the left sidebar
   - Desktop: Full menu
   - Mobile: Hamburger menu → Select "Restocking & Inventory"

### Step 1️⃣ View Products Below Minimum Stock

The page loads automatically with:
- **Products Below Threshold** section showing all products where `currentQty < minStockQty`
- Each product shows:
  - 📦 **Product Name**
  - 🔴 **Current Stock** (in red if low)
  - 📊 **Min/Max Thresholds** (what you configured)
  - 🔵 **Recommended Restock Qty** (auto-calculated: max - current)
  - 🏢 **Preferred Vendor** (where to buy from)

### Step 2️⃣ One-Click Restocking

When a product needs restocking:

1. **Click the "Restock" button** next to the product
   - Button shows loading state while processing
   - Toast notification appears with generated PO number
   - ✅ Example: `"✓ Restocking initiated! PO created: PO-2025-001"`

2. **Behind the scenes:**
   - A RestockingEntry record is created (INITIATED status)
   - A Purchase Order is automatically generated with:
     - Same vendor as Product.preferredVendor
     - Line item qty = maxStockQty - currentQty
     - Purchasing price from Product.purchasingPrice
     - Auto-generated invoice number
   - Status changes to PO_CREATED

3. **In PurchaseOrders list:**
   - The new PO appears immediately
   - You can print, send, or edit it
   - It tracks the restocking request

### Step 3️⃣ View Restocking History

The **Restocking Entries History** section shows:
- All restocking requests for this branch
- Status progression:
  - 🔵 **INITIATED** - Just created, before PO
  - 🟡 **PO_CREATED** - Purchase order generated, waiting for delivery
  - 🟢 **RECEIVED** - Stock received and inventory updated
  - ❌ **CANCELLED** - Request cancelled

For each entry, see:
- Product name
- Current & Restock quantities
- Vendor name
- PO number (link to PurchaseOrders)
- Status badge
- Date created
- Action buttons

### Step 4️⃣ Mark Stock as Received

When the restocked items arrive:

1. **Find the entry with "PO_CREATED" status**
2. **Click "Received" button**
   - Toast: `"✓ Restocking marked as received & stock updated"`
3. **What happens:**
   - Status changes to RECEIVED
   - Product.totalQty increases by restockingQty
   - Example: If maxStockQty=50 and currentQty=5, totalQty increases by 45
   - processedAt timestamp is recorded
   - Product is now at full stock

💡 **Product quantities are updated ONLY when marked as received** - not when PO is created!

---

## 📋 System Flow Diagram

```
Product Stock Falls Below Min Threshold
            ↓
    [Products Below Threshold Table]
    Current Stock: 5 | Min: 10 | Max: 50
    Recommended Restock: 45 units
            ↓
    User Clicks "Restock" Button
            ↓
    Three Things Happen (Auto):
    ✅ RestockingEntry created (INITIATED)
    ✅ PurchaseOrder auto-generated (with line items)
    ✅ Status changed to PO_CREATED
    ✅ Toast shows PO number
            ↓
    [Restocking History Table]
    Status: PO_CREATED | PO#: PO-2025-001
            ↓
    Supplier sends stock
    (You can track in PurchaseOrders page)
            ↓
    Stock Arrives
    User Clicks "Received" Button
            ↓
    Product.totalQty increased by 45
    Status: RECEIVED
    RestockingEntry complete ✓
            ↓
    Product Back at Full Stock
    (Stock: 5 + 45 = 50 = max)
```

---

## 🔧 Configuration (Admin Setup)

### Per-Product Settings
To customize restocking for each product:

**Location:** Products page (Admin) or Product edit modal

**Fields to Set:**
```javascript
Product {
  minStockQty: 10,              // Alert when stock falls below this
  maxStockQty: 50,              // Target stock level to restock to
  preferredVendor: "Vendor ABC", // Who to buy from
  restockingDays: ["MONDAY", "WEDNESDAY", "FRIDAY"] // Optional: days to auto-trigger
}
```

**What Each Means:**
- 🟢 **minStockQty**: "Alert - products below this amount should be restocked"
  - Example: minStockQty = 10
  - Product shows in "Below Threshold" when totalQty < 10

- 🔵 **maxStockQty**: "Target stock level we want to keep"
  - Example: maxStockQty = 50
  - If current = 5, restock by 45 (to reach 50)

- 🏢 **preferredVendor**: "Default vendor for auto PO generation"
  - Example: "Supplier ABC Co"
  - Used when you click "Restock"

- 📅 **restockingDays** (future feature): Days to auto-trigger restocking
  - Example: ["MONDAY", "WEDNESDAY"]
  - Not yet implemented in UI

---

## 📊 Dashboard Information

### What's Shown on Products Below Threshold

| Column | Description |
|--------|-------------|
| Product Name | Name of the product |
| Current | How many units in stock RIGHT NOW (red if low) |
| Min | Your minimum threshold setting |
| Max | Your maximum stock target |
| Restock Qty | How many units will be ordered (max - current) |
| Vendor | Preferred vendor to buy from |
| Action | "Restock" button |

### What's Shown in Restocking History

| Column | Description |
|--------|-------------|
| Product | Name of product being restocked |
| Current Qty | Stock level when restocking was triggered |
| Restock Qty | How many units were ordered |
| Vendor | Who supplies this product |
| PO Number | Purchase Order number (clickable link to PO page) |
| Status | 🔴 INITIATED / 🟡 PO_CREATED / 🟢 RECEIVED / ❌ CANCELLED |
| Date | When the restocking was initiated |
| Action | "Received" button (only for PO_CREATED status) |

---

## 🎯 Common Use Cases

### Scenario 1: Coffee Stock Running Low

```
1. Restocking page loads
2. You see: Coffee | Current: 8 | Min: 10 | Max: 50 | Restock: 42 units
3. Click "Restock"
4. PO-2025-042 created automatically with 42 units of coffee
5. PO appears in PurchaseOrders list
6. When coffee arrives, click "Received"
7. Stock updated: 8 + 42 = 50 units
```

### Scenario 2: Multiple Products Need Restocking

```
Products Below Threshold Shows:
- Product A: Current 3 → Click Restock → PO-2025-001
- Product B: Current 7 → Click Restock → PO-2025-002
- Product C: Current 2 → Click Restock → PO-2025-003

Each gets its own PO immediately
Check history: 3 entries with PO_CREATED status
```

### Scenario 3: Track Restocking Status

```
History Table Shows:
- Product A | PO-2025-001 | Status: PO_CREATED | Date: Jan 15
  Action: "Received" button (awaiting delivery)
  
- Product B | PO-2025-002 | Status: RECEIVED | Date: Jan 14
  Action: None (✓ Done)
  
- Product C | PO-2025-003 | Status: PO_CREATED | Date: Jan 15
  Action: "Received" button (still in transit)
```

---

## ⚡ Quick Tips

1. **Refresh Data**: Click the "Refresh" button (top-right) to force reload
   - Products below threshold
   - Restocking entries
   - Useful after marking stock received

2. **Branch Selection**: Data automatically updates when you switch branches
   - Sidebar shows current branch name
   - Only shows data for selected branch

3. **Mobile Friendly**: Works on phones and tablets
   - Hamburger menu to access sidebar
   - Scrollable tables if too wide

4. **Toast Notifications**: Watch for success/error messages
   - ✅ Green = Success (restocking created, mark received)
   - 🔴 Red = Error (missing product, API failure)
   - Auto-dismisses after 2.5 seconds

5. **PO Numbers**: Click PO number to view full purchase order details
   - See line items, vendor details, pricing
   - Track delivery status
   - Print or send to supplier

---

## 🐛 Troubleshooting

### Issue: "No products below threshold" showing
**Possible Causes:**
- All products are well-stocked (minStockQty not configured)
- minStockQty is too low (set to 0 or 1)
- Branch has no products

**Solution:**
- Set minStockQty for your products in admin settings
- Example: coffee minStockQty = 10 (will alert when < 10)
- Check you're on correct branch in sidebar

### Issue: "Restock button not working"
**Possible Causes:**
- Product missing preferredVendor setting
- Network error
- Server error

**Solution:**
- Check browser console (F12) for error messages
- Set preferredVendor in product settings
- Click Refresh and try again
- Check that product has a vendor assigned

### Issue: "PO not showing in list"
**Possible Causes:**
- Page not refreshed after creating PO
- Purchase order created for different branch

**Solution:**
- Click Refresh button on restocking page
- Go to "Purchase Orders List" page
- Verify you're on correct branch

### Issue: "Stock qty didn't update"
**Possible Causes:**
- "Mark Received" button wasn't clicked
- You only created the PO (doesn't increase stock)
- Stock only increases when entry status = RECEIVED

**Solution:**
- Go to Restocking History
- Find entry with "PO_CREATED" status
- Click "Received" button
- Wait for success toast
- Stock will now be updated

---

## 📱 Mobile View

On mobile phones:
1. Click hamburger menu (☰) top-left
2. Scroll down and tap "Restocking & Inventory"
3. Tables scroll horizontally if needed
4. All buttons and functions work same as desktop

---

## 🔐 Permissions

- **View Restocking**: All branch staff can view
- **Create Restocking Request**: Requires product access
- **Mark as Received**: Usually warehouse/stock manager
- **Configure Product Settings**: Admin only

(Actual permissions configured by admin in User Management)

---

## 🔄 Data Sync

Data updates automatically when:
- ✅ Page loads
- ✅ Branch changes
- ✅ "Refresh" button clicked
- ✅ After restocking action
- ✅ After marking received

**No auto-polling** (page doesn't check every few seconds) - click Refresh to get latest data

---

## 📞 Support

If something isn't working:

1. **Check Console**: Open browser dev tools (F12)
   - Look for red error messages
   - Note any error codes

2. **Verify Setup**:
   - Branch selected ✓
   - Products have minStockQty configured ✓
   - Preferred vendor set ✓

3. **Try Refresh**: Click Refresh button, force page reload (Ctrl+F5)

4. **Contact Admin**: If errors persist
   - Share error message from console
   - Mention which product/branch affected

---

## 🎓 Related Pages

- **Purchase Orders**: `/branch/purchase-orders`
  - View, edit, manage POs created by restocking system
  - Track delivery status

- **Products**: (Admin page)
  - Configure minStockQty, maxStockQty, preferredVendor

- **Recycling Entry**: `/branch/recycling`
  - Different system (for damaged/returned goods)

---

**✅ System Ready for Use!**

Last Updated: January 2025
Version: 1.0 (Initial Release)
