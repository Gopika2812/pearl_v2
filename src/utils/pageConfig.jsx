import React from "react";
import {
  FaHome, FaShoppingCart, FaBox, FaFileAlt, FaDollarSign,
  FaTruck, FaHandshake, FaUsers, FaChartLine, FaLink,
  FaBook, FaHistory, FaCheckCircle, FaMoneyBillWave,
  FaDownload, FaLock, FaBookOpen, FaShieldAlt, FaPlusCircle,
  FaFileInvoice, FaList, FaUndo, FaMoneyCheckAlt, FaReceipt,
  FaBoxes, FaHandHoldingUsd, FaPlus, FaSync, FaTicketAlt, FaPhone,
  FaCalendarCheck, FaMoneyCheck, FaFileContract, FaCheckSquare
} from "react-icons/fa";

export const ICON_MAP = {
  home: <FaHome />,
  purchase: <FaShoppingCart />,
  sales: <FaShoppingCart />,
  box: <FaBox />,
  file: <FaFileAlt />,
  dollar: <FaDollarSign />,
  truck: <FaTruck />,
  handshake: <FaHandshake />,
  users: <FaUsers />,
  chart: <FaChartLine />,
  link: <FaLink />,
  book: <FaBook />,
  history: <FaHistory />,
  money: <FaMoneyBillWave />,
  download: <FaDownload />,
  lock: <FaLock />,
  bookOpen: <FaBookOpen />,
  shield: <FaShieldAlt />,
  plus: <FaPlusCircle />,
  add: <FaPlus />,
  list: <FaList />,
  invoice: <FaFileInvoice />,
  return: <FaUndo />,
  payment: <FaMoneyCheckAlt />,
  receipt: <FaReceipt />,
  inventory: <FaBoxes />,
  claims: <FaHandHoldingUsd />,
  sync: <FaSync />,
  token: <FaTicketAlt />,
  phone: <FaPhone />,
  calendar: <FaCalendarCheck />,
  payroll: <FaMoneyCheck />,
  structure: <FaFileContract />,
  check: <FaCheckSquare />
};

export const PAGE_CONFIG = [
  {
    category: "General",
    items: [
      { id: "home", name: "Home Dashboard", path: "/branch-home", icon: "home" },
      { id: "tokenization", name: "Tokenization", path: "/branch/tokenization", icon: "token" },
    ]
  },
  {
    category: "Purchase",
    items: [
      {
        id: "purchase-dropdown", name: "Purchase Order", icon: "purchase", isDropdown: true, subItems: [
          { id: "create-po", name: "Create PO", path: "/branch/po", icon: "add" },
          { id: "purchase-list", name: "Purchase Order List", path: "/branch/purchase-orders", icon: "list", permissionFields: ["soId", "vendor", "warehouse", "itemsCount", "totalAmount", "status", "date", "action_edit", "action_delete", "action_invoice", "action_slip"] },
          { id: "purchase-invoice-list", name: "Purchase Invoice List", path: "/branch/purchase-invoices", icon: "invoice", permissionFields: ["invoiceId", "orderRef", "vendor", "vendorBill", "billDate", "grandTotal", "entryDate", "action_edit", "action_delete"] },
          { id: "debit-note", name: "Debit Note", path: "/branch/debit-note", icon: "return", permissionFields: ["dnId", "date", "vendor", "items", "amount", "invoiceRef", "details", "action_edit", "action_delete"] },
          { id: "payment-po", name: "PO Payment / Records", path: "/branch/po-payment", icon: "payment", permissionFields: ["invoiceId", "vendor", "warehouse", "items", "totalAmount", "paidAmount", "status", "poDate", "action", "paymentId", "paymentDate", "paymentType", "recipient", "mode", "amount"] },
          { id: "payment-records", name: "Payment Records", path: "/branch/payment-records", icon: "payment", permissionFields: ["paymentId", "date", "type", "recipient", "mode", "amount", "action"] },
          { id: "restocking", name: "Restocking", path: "/branch/recycling", icon: "sync", permissionFields: ["productName", "units", "currentStock", "pendingSales", "available", "threshold", "restockQty", "preferredVendor", "status", "action_config", "action_restock"] },
          { id: "suppliers", name: "Suppliers", path: "/branch/suppliers", icon: "handshake", permissionFields: ["supplierName", "gstin", "pos", "credit", "debit", "action_pay", "action_return", "action_ledger"] },
        ]
      },
    ]
  },
  {
    category: "Sales",
    items: [
      {
        id: "sales-dropdown", name: "Sales Order", icon: "sales", isDropdown: true, subItems: [
          { id: "create-so", name: "Create SO", path: "/branch/sales-order", icon: "add" },
          { id: "sales-order-list", name: "Sales Order List", path: "/branch/sales-orders", icon: "list", permissionFields: ["soId", "siId", "voucherType", "customer", "items", "grandTotal", "status", "date", "action_si_bill", "action_gen_invoice", "action_cancel", "action_wb_add", "action_wb_price", "action_wb_qty", "action_wb_discount", "action_wb_delete"] },
          { id: "sales-invoice-list", name: "Sales Invoice List", path: "/branch/sales-invoices", icon: "invoice", permissionFields: ["dateTime", "siId", "soRef", "customer", "createdBy", "grandTotal", "einvoiceStatus", "status", "action_return", "action_ewb", "action_cancel", "action_pdf"] },
          { id: "claims", name: "Claims", path: "/branch/claims", icon: "claims", permissionFields: ["claimId", "date", "customer", "items", "amount", "status", "action"] },
          { id: "credit-note", name: "Credit Note", path: "/branch/credit-note", icon: "return", permissionFields: ["cnId", "date", "customer", "items", "amount", "invoiceRef", "action"] },
          { id: "receipt", name: "Receipt Management", path: "/branch/receipt", icon: "receipt", permissionFields: ["receiptId", "date", "customer", "amount", "mode", "action"] },
          { id: "receipt-records", name: "Receipt Records", path: "/branch/receipt-records", icon: "history", permissionFields: ["receiptId", "date", "customer", "amount", "mode", "action"] },
        ]
      },
      { id: "customers", name: "Customers (Debtors)", path: "/branch/customers", icon: "users", permissionFields: ["name", "gstin", "margin", "debit", "credit", "action_receipt", "action_return", "action_ledger"] },
      {
        id: "follow-up-dropdown", name: "Customer Follow-Up", icon: "phone", isDropdown: true, subItems: [
          { id: "follow-up-form", name: "Log Follow-Up", path: "/branch/follow-up", icon: "add", permissionFields: ["name", "group", "category", "zone", "balance", "limit", "days", "token", "action_followup", "action_log", "action_ledger", "action_edit"] },
          { id: "follow-up-records", name: "Follow-Up Records", path: "/branch/follow-up-records", icon: "history", permissionFields: ["dateLogged", "customer", "followUpBy", "result", "balance", "nextFollowUp", "remarks"] },
        ]
      },
    ]
  },
  {
    category: "Other Transactions",
    items: [
      {
        id: "others-dropdown", name: "Other Transactions", icon: "plus", isDropdown: true, subItems: [
          { id: "other-payment", name: "Other Payment", path: "/branch/other-payment", icon: "money", permissionFields: ["id", "date", "ledgerGroup", "ledgerName", "note", "mode", "gst", "amount", "action_delete"] },
          { id: "other-receipt", name: "Other Receipt", path: "/branch/other-receipt", icon: "download", permissionFields: ["id", "date", "ledgerGroup", "ledgerName", "note", "mode", "gst", "amount", "action_delete"] },
        ]
      }
    ]
  },
  {
    category: "Delivery",
    items: [
      {
        id: "delivery-dropdown", name: "Delivery", icon: "truck", isDropdown: true, subItems: [
          { id: "delivery-flow", name: "Delivery Flow", path: "/branch/delivery-flow", icon: "list" },
          { id: "delivery-records", name: "Delivery Records", path: "/branch/delivery-records", icon: "history" },
          { id: "delivery-receipt", name: "Delivery Receipt", path: "/branch/delivery-receipt", icon: "receipt" },
          { id: "transferred-receipts", name: "Receipts Transferred", path: "/branch/transferred-receipts", icon: "history" },
        ]
      }
    ]
  },
  {
    category: "Directory",
    items: [
      { id: "product-records", name: "Product Records", path: "/branch/product-records", icon: "box", permissionFields: ["voucher", "customer", "purchasePrice", "sellingPrice", "margin", "qty", "gst", "discount", "profit"] },
      { id: "product-config", name: "Product Configuration", path: "/branch/product-config", icon: "sync", permissionFields: ["bar", "details", "qty", "unit", "prices", "action_edit", "action_delete"] },
    ]
  },
  {
    category: "Accounts",
    items: [
      { id: "locked-prices", name: "Locked Prices", path: "/branch/locked-prices", icon: "lock", permissionFields: ["productInfo", "customer", "cost", "stdPrice", "lockedPrice", "margin", "action_edit", "action_delete"] },
      { id: "ledgers", name: "Ledger", path: "/branch/ledger", icon: "book", permissionFields: ["details", "hierarchy", "nature", "tax", "debit", "credit", "net"] },

      { id: "journals", name: "Journal Master", path: "/branch/journals", icon: "book", permissionFields: ["name", "group", "gstin", "type", "debit", "credit"] },

      { id: "day-book", name: "Day Book", path: "/branch/day-book", icon: "bookOpen", permissionFields: ["date", "voucherType", "invoiceId", "accountName", "debit", "credit"] },
      { id: "extra-expense-ledger", name: "Extra Expense Ledger", path: "/branch/extra-expense-ledger", icon: "list", permissionFields: ["date", "type", "invoiceId", "partyName", "expenseName", "baseAmount", "gstPercent", "gstAmount", "total"] },
    ]
  },
  {
    category: "Reports",
    items: [
      { id: "insights", name: "Insights & Analysis", path: "/branch/insights", icon: "chart" },
      { id: "stock-summary", name: "Stock Summary (Tally)", path: "/branch/stock-summary", icon: "bookOpen", permissionFields: ["groupName", "opening", "inwards", "outwards", "closingQty", "closingValue"] },
    ]
  },
  {
    category: "Inventory Audit",
    items: [
      {
        id: "physical-stock-dropdown", name: "Stock Verification", icon: "inventory", isDropdown: true, subItems: [
          { id: "physical-stock-entry", name: "Stock Journal Entry", path: "/branch/physical-stock", icon: "add", permissionFields: ["productName", "productGroupName", "systemQty", "physicalQty", "inward", "outward", "mrp", "batch", "expiryDate", "checkedBy", "status", "action_save", "action_approve"] },
          { id: "physical-stock-records", name: "Stock Journal Records", path: "/branch/physical-stock-records", icon: "history" },
        ]
      },
    ]
  },
  {
    category: "HR Payroll",
    items: [
      {
        id: "hr-payroll-dropdown", name: "HR Management", icon: "users", isDropdown: true, subItems: [
          { id: "attendance", name: "Attendance", path: "/branch/hr/attendance", icon: "calendar" },
          { id: "attendance-records", name: "Attendance Records", path: "/branch/hr/attendance-logs", icon: "history" },
          { id: "payroll-processing", name: "Process Payroll", path: "/branch/hr/payroll", icon: "payroll" },
          { id: "salary-structure", name: "Salary Structure", path: "/branch/hr/salary-structure", icon: "structure" },
          { id: "hr-reports", name: "HR Reports", path: "/branch/hr/reports", icon: "chart" },
        ]
      }
    ]
  },
  {
    category: "Admin",
    items: [
      { id: "quick-links", name: "Quick Links Hub", path: "/branch/quick-links", icon: "link", isDropdown: true, subItems: [
        { id: "voucher_type", name: "Voucher Type", path: "/branch/quick-links?type=voucher_type", icon: "file", permissionFields: ["name", "orderType", "prefix", "counter", "action_edit", "action_delete"] },
        { id: "warehouse", name: "Warehouse", path: "/branch/quick-links?type=warehouse", icon: "inventory", permissionFields: ["name", "action_edit", "action_delete"] },
        { id: "product_group", name: "Product Group", path: "/branch/quick-links?type=product_group", icon: "box", permissionFields: ["name", "description", "action_edit", "action_delete"] },
        { id: "product_category", name: "Product Category", path: "/branch/quick-links?type=product_category", icon: "box", permissionFields: ["name", "description", "action_edit", "action_delete"] },
        { id: "product", name: "Product Records (Master)", path: "/branch/quick-links?type=product", icon: "box", permissionFields: ["name", "hsnCode", "totalQty", "purchasingPrice", "sellingPrice", "marginPercentage", "adminMargin", "productGroup", "productCategories", "warehouse", "action_edit", "action_delete"] },
        { id: "customer_category", name: "Customer Category", path: "/branch/quick-links?type=customer_category", icon: "users", permissionFields: ["name", "description", "action_edit", "action_delete"] },
        { id: "customer_group", name: "Customer Group", path: "/branch/quick-links?type=customer_group", icon: "users", permissionFields: ["name", "description", "action_edit", "action_delete"] },
        { id: "customer", name: "Customer Details", path: "/branch/quick-links?type=customer", icon: "users", permissionFields: ["name", "whatsapp", "email", "margin", "debit", "credit", "salesOwner", "customerCategory", "gstin", "action_edit", "action_delete"] },
        { id: "vendor", name: "Vendor Details", path: "/branch/quick-links?type=vendor", icon: "handshake", permissionFields: ["name", "gstin", "email", "phone", "action_edit", "action_delete"] },
        { id: "sales_owner", name: "Sales Owner", path: "/branch/quick-links?type=sales_owner", icon: "lock", permissionFields: ["name", "phone", "email", "action_edit", "action_delete"] },
        { id: "sales_man", name: "Sales Man", path: "/branch/quick-links?type=sales_man", icon: "users", permissionFields: ["name", "phone", "email", "commissionPercentage", "action_edit", "action_delete"] },
        { id: "delivery_man", name: "Delivery Man", path: "/branch/quick-links?type=delivery_man", icon: "truck", permissionFields: ["name", "phone", "email", "vehicleNumber", "action_edit", "action_delete"] },
        { id: "token", name: "Order Token", path: "/branch/quick-links?type=token", icon: "token", permissionFields: ["tokenId", "status", "customer", "assignedTo", "createdAt"] },
      ]},
      { id: "admin-requests", name: "Admin Requests", path: "/branch/admin-requests", icon: "shield" },
    ]
  }
];

export const getFlattenedPages = () => {
  const flattened = [];
  PAGE_CONFIG.forEach(cat => {
    cat.items.forEach(item => {
      if (item.isDropdown) {
        item.subItems.forEach(sub => {
          flattened.push({ ...sub, category: cat.category });
        });
      } else {
        flattened.push({ ...item, category: cat.category });
      }
    });
  });
  return flattened;
};
