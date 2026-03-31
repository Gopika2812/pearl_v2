/**
 * QUICK_LINKS_CONFIG: Central Registry for Master Data & Modules
 * 
 * To add a NEW PAGE to the Super Admin Control System:
 * 1. Add a new key here (e.g., 'new_module')
 * 2. Define its label, endpoint, and fields.
 * 3. Use 'permissionFields' to specify which columns can be hidden for specific roles.
 * 4. Add the key to a category in QUICK_LINKS_CATEGORIES below.
 */
export const QUICK_LINKS_CONFIG = {
  voucher_type: {
    label: "Voucher Type",
    desc: "Define entry formats for PO, SO, and Invoices",
    endpoint: "/voucher-types",
    displayFields: ["name", "orderType", "prefix", "counter"],
    editableFields: ["name", "orderType", "prefix", "counter"],
    permissionFields: ["counter", "prefix"]
  },
  warehouse: {
    label: "Warehouse",
    desc: "Manage physical locations for stock storage",
    endpoint: "/warehouses",
    displayFields: ["name"],
    editableFields: ["name"],
    permissionFields: []
  },
  product_group: {
    label: "Product Group",
    desc: "Group products by department or type",
    endpoint: "/product-groups",
    displayFields: ["name", "description"],
    editableFields: ["name", "description"],
    permissionFields: []
  },
  product_category: {
    label: "Product Category",
    desc: "Categorize items for better stock tracking",
    endpoint: "/product-categories",
    displayFields: ["name", "description"],
    editableFields: ["name", "description"],
    permissionFields: []
  },
  product: {
    label: "Product",
    desc: "Master record of all sellable and stock items",
    endpoint: "/products",
    displayFields: ["name", "totalQty", "purchasingPrice", "sellingPrice", "marginPercentage", "adminMargin", "productGroup", "productCategories", "warehouse"],
    editableFields: ["name", "purchasingPrice", "sellingPrice", "adminMargin", "productGroup", "productCategories", "warehouse"],
    detailedFields: ["name", "totalQty", "totalQtyUnit", "perQty", "units", "purchasingPrice", "sellingPrice", "marginPercentage", "adminMargin", "hsnCode", "gst"],
    permissionFields: ["purchasingPrice", "adminMargin", "sellingPrice", "marginPercentage", "gst", "totalQty"]
  },
  customer_category: {
    label: "Customer Category",
    desc: "Segment clients by business type",
    endpoint: "/customer-categories",
    displayFields: ["name", "description"],
    editableFields: ["name", "description"],
    permissionFields: []
  },
  customer_group: {
    label: "Customer Group",
    desc: "Organize customers for regional tracking",
    endpoint: "/customer-groups",
    displayFields: ["name", "description"],
    editableFields: ["name", "description"],
    permissionFields: []
  },
  customer: {
    label: "Customer",
    desc: "Detailed records of clients and credit limits",
    endpoint: "/customers",
    displayFields: ["name", "whatsapp", "email", "margin", "debit", "credit", "salesOwner", "customerCategory"],
    editableFields: ["name", "whatsapp", "email", "margin", "debit", "credit"],
    detailedFields: ["name", "whatsapp", "email", "address", "district", "state", "pincode", "registrationType", "gstin", "salesOwner", "margin", "credit", "debit"],
    permissionFields: ["margin", "debit", "credit", "gstin"]
  },
  vendor: {
    label: "Vendor",
    desc: "Sources and suppliers for procurement",
    endpoint: "/vendors",
    displayFields: ["name", "gstin", "email", "phone"],
    editableFields: ["name", "gstin", "email"],
    permissionFields: []
  },
  sales_owner: {
    label: "Sales Owner",
    desc: "Primary account managers and partners",
    endpoint: "/sales-owners",
    displayFields: ["name", "phone", "email"],
    editableFields: ["name", "phone", "email"],
    permissionFields: []
  },
  sales_man: {
    label: "Sales Man",
    desc: "Staff responsible for direct bookings",
    endpoint: "/sales-men",
    displayFields: ["name", "phone", "email", "commissionPercentage"],
    editableFields: ["name", "phone", "email"],
    permissionFields: ["commissionPercentage", "phone"]
  },
  delivery_man: {
    label: "Delivery Man",
    desc: "Logistics staff and vehicle tracking",
    endpoint: "/delivery-men",
    displayFields: ["name", "phone", "email", "vehicleNumber"],
    editableFields: ["name", "phone", "email"],
    permissionFields: ["phone", "vehicleNumber"]
  }
};

export const QUICK_LINKS_CATEGORIES = [
  {
    title: "System & Billing",
    icon: "⚙️",
    color: "from-slate-700 to-slate-900",
    items: ["voucher_type", "warehouse"]
  },
  {
    title: "Inventory Master",
    icon: "📦",
    color: "from-blue-600 to-indigo-700",
    items: ["product_group", "product_category", "product"]
  },
  {
    title: "Customer Management",
    icon: "👥",
    color: "from-emerald-500 to-teal-700",
    items: ["customer_category", "customer_group", "customer"]
  },
  {
    title: "People & Logistics",
    icon: "🚛",
    color: "from-orange-500 to-red-600",
    items: ["vendor", "sales_owner", "sales_man", "delivery_man"]
  }
];
