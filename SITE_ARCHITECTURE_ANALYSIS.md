# Pearls ERP System - Complete Site Analysis & Flow

## 📋 Project Overview
**Pearls ERP** is a full-stack **Retailer Enterprise Resource Planning (ERP) system** built with:
- **Frontend**: React 19 + Vite + React Router + Tailwind CSS
- **Backend**: Node.js/Express + MongoDB + Mongoose
- **Additional Services**: Cloudinary (image storage), Twilio (SMS), PDF generation

---

## 🏗️ Architecture Overview

```
PEARLS ERP SYSTEM
├── Frontend (React/Vite)
│   ├── Context API (InventoryContext) - Global state management
│   ├── Pages (11+ main pages)
│   ├── Components (Reusable UI modules)
│   └── API Layer (Axios/Fetch to Express)
│
├── Backend (Express/MongoDB)
│   ├── 15+ REST API Routes
│   ├── 16 Mongoose Models
│   └── Business Logic
│
└── Data
    └── MongoDB Database (Cloud)
```

---

## 🔄 Complete Data Flow

### **1. APPLICATION INITIALIZATION**

#### Frontend Startup:
```
index.html
    ↓
main.jsx (ReactDOM.render)
    ↓
BrowserRouter (React Router setup)
    ↓
App.jsx (Main component + routing)
    ↓
InventoryProvider (Context wraps all routes)
    ↓
All child components receive global inventory state
```

#### Backend Startup:
```
server.js
    ↓
.env config loaded
    ↓
Express app initialized with CORS
    ↓
All 15 route modules mounted
    ↓
MongoDB connection established
    ↓
Server listens on port 5000
```

---

### **2. CONTEXT API & STATE MANAGEMENT**

**File**: `src/context/InventoryContext.jsx`

**Global State (Masters Data):**
```javascript
- voucherTypes      // Invoice types (zone1, zone2, etc.)
- productGroups     // Product categorization
- products          // All products master
- warehouses        // Storage locations
- customers         // Customer database
- vendors           // Supplier database
- salesOwners       // Sales ownership records
- salesMen          // Sales personnel
- deliveryMen       // Delivery personnel
- commissions       // Commission calculations
- drafts            // Saved draft orders
- finalOrders       // Completed orders
```

**Initialization Flow**:
```
InventoryProvider mounted
    ↓
useEffect triggers
    ↓
fetchVoucherTypes()
fetchVendors()
fetchProductGroups()
fetchProducts()
fetchWarehouses()
fetchCustomers()
fetchSalesOwners()
fetchSalesMen()
fetchDeliveryMen()
fetchCommissions()
    ↓
All data cached in Context
    ↓
Available to all child components via useContext()
```

---

### **3. ROUTING STRUCTURE**

**File**: `src/App.jsx`

**Main Routes**:
```
/ (Home)                          → Dashboard with stats & alerts
/login                            → HR Login page
/customer-login                   → Customer portal login
/pearls-shopping                  → Public shopping page
/purchase-order                   → Purchase Order form & list
/sales-order                      → Sales Order form & list
/pearls-book                      → Financial/Accounting book
/crm                              → Customer Relationship Mgmt
/dispatch                         → Loading & Dispatch sheet
/employees                        → Employees book
/employeepage                     → Employee dashboard
/hr-control                       → Payroll & Attendance
/summary/products                 → Product analytics
/summary/customers                → Customer analytics
/summary/vendors                  → Vendor analytics
/summary/others                   → Other summaries
```

**Layout Logic**:
- **Sidebar + Topbar**: Visible on all routes except `/login`, `/customer-login`, `/pearls-shopping`
- **Toggle**: Sidebar responsive on mobile devices

---

### **4. CORE BUSINESS ENTITIES & DATA MODELS**

#### **A. PRODUCT ECOSYSTEM**

**Product Model**:
```javascript
{
  _id: ObjectId,
  productGroup: ref→ProductGroup,
  name: String,
  perQty: Number,              // Qty per unit
  units: String,               // kg, liters, pieces, etc.
  totalQty: Number,            // Stock quantity
  purchasingPrice: Number,
  sellingPrice: Number,
  mrp: Number,                 // Maximum Retail Price
  margin: Number,              // Auto-calculated: selling - purchasing
  hsnCode: String,             // Tax classification
  hsn: String,                 // Alias for hsnCode
  gst: Number,                 // Goods & Service Tax %
  image: String,               // Cloudinary URL
  createdAt, updatedAt
}
```

**ProductGroup Model**:
- Hierarchical categorization of products
- Helps organize inventory
- Can be referenced by products

---

#### **B. ORDER PROCESSING SYSTEM**

**Purchase Order (PO) - Buying from Vendors**:
```javascript
{
  _id: ObjectId,
  invoiceId: String (unique),      // PO#1001, PO#1002, etc.
  voucherType: String,             // Purchase invoice type
  vendor: String,
  warehouse: String,               // Destination warehouse
  
  items: [
    {
      productId: ref→Product,
      name: String,
      qty: Number,
      purchasePrice: Number,
      sellingPrice: Number,
      hsn: String,
      gst, cgst, sgst, igst: Number,
      total: Number               // qty × purchasePrice
    }
  ],
  
  subtotal: Number,
  totalTax: Number,
  transportCharge: Number,
  grandTotal: Number,
  
  billingPerson: String,
  agent: String,
  status: "DRAFT" | "PLACED",
  date: Date
}
```

**Sales Order (SO) - Selling to Customers**:
```javascript
{
  _id: ObjectId,
  invoiceId: String (unique),      // INV#2001, INV#2002, etc.
  voucherType: String,             // Sales invoice type
  orderType: "SO" (Sales Order),
  
  customer: {
    customerId: ref→Customer,
    name: String,
    whatsapp: String,
    address: String,
    district, state, pincode: String
  },
  
  items: [
    {
      productId: ref→Product,
      qty: Number,
      sellingPrice: Number,
      discountType: "PERCENT" | "AMOUNT",
      discountPercent: Number,
      discountAmount: Number,
      gst, cgst, sgst, igst: Number,
      total: Number
    }
  ],
  
  sampleItems: [{...}],           // Free samples
  invoiceItems: [{...}],          // Edited items
  
  billingPerson: String,
  warehouse: String,
  agent: String,
  
  subtotal, totalTax, grandTotal: Number
}
```

---

#### **C. CUSTOMER & VENDOR MANAGEMENT**

**Customer Model**:
```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  phone: String,
  whatsapp: String,
  address: String,
  shopName: String,
  gstIN: String,            // GST identification
  district, state, pincode: String,
  creditLimit: Number,
  paymentTerms: String,
  referenceContact: String
}
```

**Vendor Model**:
```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  phone: String,
  address: String,
  gstIN: String,
  district, state, pincode: String,
  paymentTerms: String,
  bankDetails: Object,
  productCategories: [String]
}
```

---

#### **D. FINANCIAL TRACKING**

**Payment Model**:
```javascript
{
  _id: ObjectId,
  invoiceId: ref→SalesOrder/PurchaseOrder,
  paymentDate: Date,
  amount: Number,
  paymentMode: "CASH" | "CHEQUE" | "BANK_TRANSFER" | "DIGITAL",
  referenceNumber: String,
  remarks: String
}
```

**Credit Note & Debit Note** (Adjustments):
```javascript
CreditNote:  // Refund/Return from customers
- invoiceReference
- amount
- reason
- date

DebitNote:   // Additional charges from vendors
- invoiceReference
- amount
- reason
- date
```

---

#### **E. PERSONNEL & COMMISSION**

**SalesOwner**, **SalesMan**, **DeliveryMan** Models:
```javascript
{
  _id: ObjectId,
  name: String,
  employeeId: String,
  phone: String,
  email: String,
  address: String,
  zone: String,
  commissionRate: Number,
  joinDate: Date,
  status: "ACTIVE" | "INACTIVE"
}
```

**CommissionRule Model**:
```javascript
{
  _id: ObjectId,
  salesOwner: ref→SalesOwner,
  salesMan: ref→SalesMan,
  commissionRate: Number,     // % of sales
  fromDate, toDate: Date,
  productCategory: String,
  minimumTarget: Number
}
```

---

### **5. API ENDPOINTS**

**All endpoints follow RESTful convention:**

| Resource | Endpoints | Purpose |
|----------|-----------|---------|
| `/api/products` | GET, POST, PUT, DELETE | Product CRUD + bulk import |
| `/api/product-groups` | GET, POST, PUT, DELETE | Product categories |
| `/api/vendors` | GET, POST, PUT, DELETE | Supplier management |
| `/api/customers` | GET, POST, PUT, DELETE | Customer database |
| `/api/warehouses` | GET, POST, PUT, DELETE | Storage locations |
| `/api/purchase-orders` | GET, POST, PUT, DELETE | PO management |
| `/api/sales-orders` | GET, POST, PUT, DELETE | SO management |
| `/api/payments` | GET, POST, PUT, DELETE | Payment tracking |
| `/api/credit-notes` | GET, POST, PUT, DELETE | Customer refunds |
| `/api/debit-notes` | GET, POST, PUT, DELETE | Vendor additional charges |
| `/api/voucher-types` | GET, POST, PUT, DELETE | Invoice type definitions |
| `/api/sales-owners` | GET, POST, PUT, DELETE | Owner management |
| `/api/sales-men` | GET, POST, PUT, DELETE | Salesman management |
| `/api/delivery-men` | GET, POST, PUT, DELETE | Delivery staff |
| `/api/commission-rules` | GET, POST, PUT, DELETE | Commission setup |
| `/api/pearls-book` | GET | Financial reports |

---

### **6. FRONTEND COMPONENT HIERARCHY**

```
App.jsx (Main container)
├── Sidebar.jsx              (Navigation menu)
├── Topbar.jsx               (Header with profile)
└── Routes
    ├── Home.jsx             (Dashboard)
    │   ├── StatCard         (KPI display)
    │   └── QuickAction      (Quick links)
    │
    ├── InventoryPurchaseOrder.jsx
    │   ├── InventoryPurchaseOrderHeader.jsx
    │   ├── InventoryPurchaseOrderEntry.jsx
    │   ├── ProductCard.jsx
    │   └── Modals:
    │       ├── InventoryAddProductModal.jsx
    │       ├── InventoryAddVendorModal.jsx
    │       └── InventoryAddWarehouseModal.jsx
    │
    ├── InventorySalesOrder.jsx
    │   ├── InventorySalesOrderHeader.jsx
    │   ├── InventorySalesOrderEntry.jsx
    │   └── Modals:
    │       ├── InventoryAddCustomerModal.jsx
    │       ├── PaymentModal.jsx
    │       └── SalesReceiptModal.jsx
    │
    ├── PearlsBookPage.jsx   (Accounting)
    ├── CRMPage.jsx          (Customer mgmt)
    ├── DispatchSheetPage.jsx (Fulfillment)
    ├── EmployeesBookPage.jsx (HR records)
    ├── HRControlPanel.jsx   (Payroll/Attendance)
    └── Summary Pages
        ├── ProductSummary.jsx
        ├── CustomerSummary.jsx
        ├── VendorSummary.jsx
        └── OthersSummary.jsx
```

---

### **7. KEY USER WORKFLOWS**

#### **WORKFLOW 1: Creating a Purchase Order**
```
1. User navigates to /purchase-order
   ↓
2. Clicks "New Purchase Order"
   ↓
3. InventoryAddVendorModal opens
   - Selects/creates vendor
   ↓
4. InventoryAddWarehouseModal opens
   - Selects destination warehouse
   ↓
5. InventoryPurchaseOrderEntry form
   - Adds products (from Context cache)
   - Sets quantities, prices, taxes
   - System auto-calculates: total = qty × price
   ↓
6. User submits
   ↓
7. POST /api/purchase-orders (Backend)
   - Validates data
   - Generates unique invoiceId
   - Saves to MongoDB
   ↓
8. Response returned
   - Success: Order created, invoiceId displayed
   - Error: Validation error message shown
```

#### **WORKFLOW 2: Creating a Sales Order**
```
1. User navigates to /sales-order
   ↓
2. InventorySalesOrderHeader.jsx
   - Select voucher type
   - Select customer (InventoryAddCustomerModal)
   ↓
3. InventorySalesOrderEntry.jsx
   - Add products from inventory
   - Set quantity, selling price, discounts
   - Enter GST details (CGST, SGST, or IGST)
   - Add sample items (optional, free)
   ↓
4. System calculates:
   - Item total = qty × sellingPrice - discount
   - Tax = total × (gst/100)
   - Order total = subtotal + tax
   ↓
5. PaymentModal
   - Select payment method
   - Enter payment details
   ↓
6. POST /api/sales-orders
   - Creates order
   - Updates product inventory (reduces totalQty)
   ↓
7. SalesReceiptModal
   - Generates PDF invoice
   - Displays print/email options
```

#### **WORKFLOW 3: Viewing Pearls Book (Financial Report)**
```
1. User clicks "Pearls Book" → /pearls-book
   ↓
2. GET /api/pearls-book
   - Backend queries all SalesOrders
   - Aggregates by:
     * Invoice
     * Customer
     * Salesman
     * Amount
     * Date
   ↓
3. PearlsBookPage displays:
   - Table of all transactions
   - Filters by date range, customer, salesman
   - Export to Excel (XLSX)
```

---

### **8. DATA PERSISTENCE FLOW**

```
Frontend Form Submission
    ↓
Validate on client (React)
    ↓
POST request with JSON
    ↓
Express Route Handler
    ↓
Mongoose Model Validation
    (Schema checks, required fields, types)
    ↓
Pre-save Hooks (MongoDB middlewares)
    - Auto-calculate margin
    - Set timestamps
    - Generate IDs
    ↓
MongoDB Insert/Update
    ↓
Return response to frontend
    ↓
React Toast Notification (Success/Error)
    ↓
Update Context state
    ↓
Re-render components
```

---

### **9. EXTERNAL INTEGRATIONS**

| Service | Purpose | Configuration |
|---------|---------|----------------|
| **Cloudinary** | Image storage for products | `backend/config/cloudinary.js` |
| **MongoDB** | NoSQL database | Connection string in `.env` |
| **Twilio** | SMS notifications | `package.json` dependency |
| **Firebase** | Deployment & hosting | `firebase.json` config |
| **Puppeteer** | PDF generation | For invoice PDFs |
| **jsPDF** | Client-side PDF export | Invoice generation |
| **XLSX** | Excel import/export | Bulk product uploads |

---

### **10. TECH STACK SUMMARY**

**Frontend**:
- React 19 (UI framework)
- Vite (Build tool)
- React Router v7 (Navigation)
- Tailwind CSS (Styling)
- React Icons (Icon library)
- React Toastify (Notifications)
- Axios (HTTP client - configured in api.js)
- XLSX (Excel handling)

**Backend**:
- Express.js (Web server)
- MongoDB (Database)
- Mongoose (ODM)
- Multer (File uploads)
- CORS (Cross-origin)
- Cloudinary (Image CDN)
- Twilio (SMS)
- jsPDF + PDFKit (PDF generation)
- XLSX (Excel export)

---

### **11. ENVIRONMENT & CONFIGURATION**

**Frontend (.env.local)**:
```
VITE_API_BASE_URL=http://localhost:5000
```

**Backend (.env)**:
```
MONGO_URI=mongodb+srv://...
PORT=5000
CLOUDINARY_API_KEY=...
TWILIO_ACCOUNT_SID=...
```

---

### **12. SECURITY FEATURES**

- ✅ CORS enabled (whitelisted origins)
- ✅ Large payload limits (50MB) for bulk uploads
- ✅ Mongoose schema validation
- ✅ Unique invoice IDs prevent duplicates
- ✅ References between collections (FK integrity)
- ✅ Timestamps on all records (audit trail)

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│                REACT FRONTEND                       │
│  (React Router, Context API, Components)            │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP/JSON
                       ↓
┌─────────────────────────────────────────────────────┐
│              EXPRESS API SERVER                     │
│  (Routes, Middlewares, Controllers)                 │
└──────────────────────┬──────────────────────────────┘
                       │ Mongoose
                       ↓
┌─────────────────────────────────────────────────────┐
│             MONGODB DATABASE                        │
│  (Collections: Products, Orders, Customers, etc.)   │
└─────────────────────────────────────────────────────┘

                    ↔ External Services
                    • Cloudinary (Images)
                    • Twilio (SMS)
                    • Firebase (Deploy)
```

---

## 🎯 Key Features

1. **Inventory Management** - Track products, stock, pricing
2. **Order Processing** - Create & manage POs and SOs
3. **Customer Management** - Customer database with addresses/GST
4. **Vendor Management** - Supplier information & terms
5. **Financial Tracking** - Payments, credits, debits, commissions
6. **Reporting** - Pearls Book, Summaries, Export to Excel
7. **User Roles** - HR, Employees, Customers, Admins
8. **Dispatch** - Loading sheets and delivery tracking
9. **Commission System** - Auto-calculate commissions by rules
10. **Multi-warehouse** - Support for multiple storage locations

---

## 🚀 Deployment

- **Frontend**: Firebase hosting (`firebase.json`)
- **Backend**: Node.js server (port 5000)
- **Database**: MongoDB Cloud (Atlas)
- **Storage**: Cloudinary CDN

---

**This ERP system is designed for retail agencies to manage products, orders, customers, vendors, and financial operations in a unified platform.**