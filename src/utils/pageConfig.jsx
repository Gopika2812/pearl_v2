import React from "react";
import { 
  FaHome, FaShoppingCart, FaBox, FaFileAlt, FaDollarSign, 
  FaTruck, FaHandshake, FaUsers, FaChartLine, FaLink, 
  FaBook, FaHistory, FaCheckCircle, FaMoneyBillWave, 
  FaDownload, FaLock, FaBookOpen, FaShieldAlt, FaPlusCircle,
  FaFileInvoice, FaList, FaUndo, FaMoneyCheckAlt, FaReceipt,
  FaBoxes, FaHandHoldingUsd, FaPlus, FaSync
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
  sync: <FaSync />
};

export const PAGE_CONFIG = [
  {
    category: "General",
    items: [
      { id: "home", name: "Home Dashboard", path: "/branch-home", icon: "home" },
    ]
  },
  {
    category: "Purchase",
    items: [
      { id: "purchase-dropdown", name: "Purchase Order", icon: "purchase", isDropdown: true, subItems: [
        { id: "create-po", name: "Create PO", path: "/branch/po", icon: "add" },
        { id: "purchase-list", name: "Purchase Order List", path: "/branch/purchase-orders", icon: "list", permissionFields: ["grandTotal", "totalPaid", "status"] },
        { id: "purchase-invoice-list", name: "Purchase Invoice List", path: "/branch/purchase-invoices", icon: "invoice" },
      ]},
      { id: "restocking", name: "Restocking (Recycling)", path: "/branch/recycling", icon: "sync" },
      { id: "suppliers", name: "Suppliers (Creditors)", path: "/branch/suppliers", icon: "handshake", permissionFields: ["credit", "debit", "gstin"] },
    ]
  },
  {
    category: "Sales",
    items: [
      { id: "sales-dropdown", name: "Sales Order", icon: "sales", isDropdown: true, subItems: [
        { id: "create-so", name: "Create SO", path: "/branch/sales-order", icon: "add" },
        { id: "sales-order-list", name: "Sales Order List", path: "/branch/sales-orders", icon: "list" },
        { id: "sales-invoice-list", name: "Sales Invoice List", path: "/branch/sales-invoices", icon: "invoice" },
        { id: "claims", name: "Claims", path: "/branch/claims", icon: "claims" },
      ]},
      { id: "customers", name: "Customers (Debtors)", path: "/branch/customers", icon: "users", permissionFields: ["margin", "debit", "credit", "gstin"] },
    ]
  },
  {
    category: "Other Transactions",
    items: [
      { id: "others-dropdown", name: "Other Transactions", icon: "plus", isDropdown: true, subItems: [
        { id: "other-payment", name: "Other Payment", path: "/branch/other-payment", icon: "money" },
        { id: "other-receipt", name: "Other Receipt", path: "/branch/other-receipt", icon: "download" },
      ]}
    ]
  },
  {
    category: "Directory",
    items: [
      { id: "product-records", name: "Product Records", path: "/branch/product-records", icon: "box", permissionFields: ["purchasingPrice", "sellingPrice", "grossProfit"] },
    ]
  },
  {
    category: "Accounts",
    items: [
      { id: "locked-prices", name: "Locked Prices", path: "/branch/locked-prices", icon: "lock" },
      { id: "ledgers", name: "Ledger", path: "/branch/ledger", icon: "book" },

      { id: "journals", name: "Journal Master", path: "/branch/journals", icon: "book" },
      { id: "stock-journal", name: "Stock Journal", path: "/branch/stock-journal", icon: "history" },
      { id: "day-book", name: "Day Book", path: "/branch/day-book", icon: "bookOpen" },
      { id: "extra-expense-ledger", name: "Extra Expense Ledger", path: "/branch/extra-expense-ledger", icon: "list" },
    ]
  },
  {
    category: "Reports",
    items: [
      { id: "insights", name: "Insights & Analysis", path: "/branch/insights", icon: "chart" },
      { id: "stock-summary", name: "Stock Summary (Tally)", path: "/branch/stock-summary", icon: "bookOpen" },
    ]
  },
  {
    category: "Admin",
    items: [
      { id: "quick-links", name: "Quick Links Hub", path: "/branch/quick-links", icon: "link" },
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
