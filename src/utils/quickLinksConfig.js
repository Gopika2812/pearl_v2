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
    endpoint: "/voucher-types",
    displayFields: ["name", "orderType", "prefix", "counter"],
    editableFields: ["name", "orderType", "prefix", "counter"],
    permissionFields: ["counter", "prefix"]
  },
  warehouse: {
    label: "Warehouse",
    endpoint: "/warehouses",
    displayFields: ["name"],
    editableFields: ["name"],
    permissionFields: []
  },
  product_group: {
    label: "Product Group",
    endpoint: "/product-groups",
    displayFields: ["name", "description"],
    editableFields: ["name", "description"],
    permissionFields: []
  },
  product_category: {
    label: "Product Category",
    endpoint: "/product-categories",
    displayFields: ["name", "description"],
    editableFields: ["name", "description"],
    permissionFields: []
  },
  product: {
    label: "Product",
    endpoint: "/products",
    displayFields: ["name", "purchasingPrice", "sellingPrice", "marginPercentage", "adminMargin", "productGroup", "productCategories", "warehouse"],
    editableFields: ["name", "purchasingPrice", "sellingPrice", "adminMargin", "productGroup", "productCategories", "warehouse"],
    detailedFields: ["name", "perQty", "units", "purchasingPrice", "sellingPrice", "marginPercentage", "adminMargin", "hsnCode", "gst"],
    permissionFields: ["purchasingPrice", "adminMargin", "sellingPrice", "marginPercentage", "gst", "totalQty"]
  },
  customer_category: {
    label: "Customer Category",
    endpoint: "/customer-categories",
    displayFields: ["name", "description"],
    editableFields: ["name", "description"],
    permissionFields: []
  },
  customer_group: {
    label: "Customer Group",
    endpoint: "/customer-groups",
    displayFields: ["name", "description"],
    editableFields: ["name", "description"],
    permissionFields: []
  },
  customer: {
    label: "Customer",
    endpoint: "/customers",
    displayFields: ["name", "whatsapp", "email", "margin", "debit", "credit", "salesOwner", "customerCategory"],
    editableFields: ["name", "whatsapp", "email", "margin", "debit", "credit"],
    detailedFields: ["name", "whatsapp", "email", "address", "district", "state", "pincode", "registrationType", "gstin", "salesOwner", "margin", "credit", "debit"],
    permissionFields: ["margin", "debit", "credit", "gstin"]
  },
  vendor: {
    label: "Vendor",
    endpoint: "/vendors",
    displayFields: ["name", "gstin", "email", "phone"],
    editableFields: ["name", "gstin", "email"],
    permissionFields: []
  },
  sales_owner: {
    label: "Sales Owner",
    endpoint: "/sales-owners",
    displayFields: ["name", "phone", "email"],
    editableFields: ["name", "phone", "email"],
    permissionFields: []
  },
  sales_man: {
    label: "Sales Man",
    endpoint: "/sales-men",
    displayFields: ["name", "phone", "email", "commissionPercentage"],
    editableFields: ["name", "phone", "email"],
    permissionFields: ["commissionPercentage", "phone"]
  },
  delivery_man: {
    label: "Delivery Man",
    endpoint: "/delivery-men",
    displayFields: ["name", "phone", "email", "vehicleNumber"],
    editableFields: ["name", "phone", "email"],
    permissionFields: ["phone", "vehicleNumber"]
  },
  claims: {
    label: "Claims Orders",
    endpoint: "/sales-orders?isClaim=true",
    displayFields: ["invoiceId", "customer", "createdAt", "grandTotal", "invoiceGenerated"],
    editableFields: ["invoiceId"],
    permissionFields: ["grandTotal", "invoiceGenerated", "createdAt"]
  },
};

export const QUICK_LINKS_CATEGORIES = [
  {
    title: "System & Billing",
    items: ["voucher_type", "warehouse"]
  },
  {
    title: "Inventory Master",
    items: ["product_group", "product_category", "product"]
  },
  {
    title: "Customer Management",
    items: ["customer_category", "customer_group", "customer"]
  },
  {
    title: "People & Logistics",
    items: ["vendor", "sales_owner", "sales_man", "delivery_man"]
  },
  {
    title: "Modules & Transactions",
    items: ["claims"]
  }
];
