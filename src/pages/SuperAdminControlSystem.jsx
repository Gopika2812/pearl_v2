import { useEffect, useState } from "react";
import {
  FaBox,
  FaBuilding,
  FaCalendar,
  FaCheck,
  FaChevronRight,
  FaDollarSign,
  FaEdit,
  FaFileInvoice, FaFilePdf,
  FaLink,
  FaLock,
  FaShieldAlt,
  FaSearch,
  FaTrash,
  FaTruck,
  FaUndo,
  FaUsers, FaUsersCog
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../api";
import { QUICK_LINKS_CONFIG } from "../utils/quickLinksConfig";

import { ICON_MAP, PAGE_CONFIG, getFlattenedPages } from "../utils/pageConfig";


const getUnifiedPageDefinitions = () => {
  return getFlattenedPages();
};

export default function SuperAdminControlSystem() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchUsers, setBranchUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [personnelSearchQuery, setPersonnelSearchQuery] = useState("");
  const [expandedFieldsPageId, setExpandedFieldsPageId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userPermissions, setUserPermissions] = useState([]);
  const [fieldPermissions, setFieldPermissions] = useState({});
  const [actionPermissions, setActionPermissions] = useState({});
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [allowedVoucherTypes, setAllowedVoucherTypes] = useState([]);
  const [allowedQuickLinks, setAllowedQuickLinks] = useState([]);
  const [allowedBranchesState, setAllowedBranchesState] = useState([]);

  // Check Super Admin auth
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      navigate("/super-admin-login");
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== "SUPER_ADMIN") {
      toast.error("Access denied");
      navigate("/branch-login");
    }
  }, [navigate]);

  // Initial branches fetch
  useEffect(() => {
    fetchBranches();
  }, []);

  // Fetch users when branch selected
  useEffect(() => {
    if (selectedBranch) {
      fetchBranchUsers(selectedBranch._id);
      fetchVoucherTypes(selectedBranch._id);
      setSelectedUserIds([]);
      setPersonnelSearchQuery("");
      setUserPermissions([]);
      setFieldPermissions({});
      setActionPermissions({});
      setAllowedVoucherTypes([]);
      setAllowedQuickLinks([]);
      setAllowedBranchesState([selectedBranch._id]);
    }
  }, [selectedBranch]);

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_BASE}/branches`);
      const data = await res.json();
      if (data.success) setBranches(data.data);
    } catch (err) {
      toast.error("Failed to fetch branches");
    }
  };

  const fetchVoucherTypes = async (branchId) => {
    try {
      const res = await fetch(`${API_BASE}/voucher-types/branch/${branchId}`);
      const data = await res.json();
      if (data.success) setVoucherTypes(data.data);
    } catch (err) {
      console.error("Failed to fetch voucher types", err);
    }
  };

  const fetchBranchUsers = async (branchId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/branch-users/branch/${branchId}`);
      const data = await res.json();
      if (data.success) setBranchUsers(data.data);
    } catch (err) {
      toast.error("Failed to fetch branch users");
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (pageId) => {
    if (userPermissions.includes(pageId)) {
      setUserPermissions(userPermissions.filter(id => id !== pageId));
    } else {
      setUserPermissions([...userPermissions, pageId]);
    }
  };

  const toggleFieldPermission = (field) => {
    setFieldPermissions(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const toggleActionPermission = (action) => {
    setActionPermissions(prev => {
      const newVal = !prev[action];

      // Automatically sync Sales Order menu and sub-menu checkboxes when toggling Bypass SO Lock
      if (action === "bypassSalesOrderLock") {
        const salesOrderPageIds = [
          "sales-dropdown",
          "create-so",
          "sales-order-list",
          "sales-invoice-list",
          "claims",
          "credit-note",
          "receipt",
          "receipt-records"
        ];

        setUserPermissions(currentPerms => {
          if (newVal) {
            // Add all Sales Order menus
            const uniquePerms = new Set([...currentPerms, ...salesOrderPageIds]);
            return Array.from(uniquePerms);
          } else {
            // Remove all Sales Order menus
            return currentPerms.filter(id => !salesOrderPageIds.includes(id));
          }
        });
      }

      return {
        ...prev,
        [action]: newVal
      };
    });
  };

  const toggleVoucherType = (vtId) => {
    setAllowedVoucherTypes(prev =>
      prev.includes(vtId) ? prev.filter(id => id !== vtId) : [...prev, vtId]
    );
  };

  const toggleQuickLink = (linkId) => {
    setAllowedQuickLinks(prev =>
      prev.includes(linkId) ? prev.filter(id => id !== linkId) : [...prev, linkId]
    );
  };

  const toggleAllowedBranchState = (branchId) => {
    setAllowedBranchesState(prev =>
      prev.includes(branchId)
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  };

  const toggleSelectUser = (userId) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAllUsers = (checked) => {
    if (checked) {
      // Select only currently filtered users
      const filteredIds = filteredUsers.map(u => u._id);
      setSelectedUserIds(prev => {
        const unique = new Set([...prev, ...filteredIds]);
        return Array.from(unique);
      });
    } else {
      // Deselect only currently filtered users
      const filteredIds = filteredUsers.map(u => u._id);
      setSelectedUserIds(prev => prev.filter(id => !filteredIds.includes(id)));
    }
  };

  const handleUserClick = (user) => {
    // Select this user if not selected
    if (!selectedUserIds.includes(user._id)) {
      setSelectedUserIds([...selectedUserIds, user._id]);
    }

    // Load their permissions into the active configuration
    setUserPermissions(user.allowedPages || []);
    setFieldPermissions(user.fieldPermissions || {});
    setActionPermissions(user.actionPermissions || {});
    setAllowedVoucherTypes(user.allowedVoucherTypes || []);
    setAllowedQuickLinks(user.allowedQuickLinks || []);
    const branchIds = (user.allowedBranches || []).map(b => b._id || b);
    setAllowedBranchesState(branchIds);

    toast.info(`Loaded permissions from ${user.username}`);
  };

  // Compute filtered users list
  const filteredUsers = branchUsers.filter(user =>
    user.username.toLowerCase().includes(personnelSearchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(personnelSearchQuery.toLowerCase())
  );

  const isAllFilteredUsersSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every(u => selectedUserIds.includes(u._id));

  const handleSavePermissions = async () => {
    if (selectedUserIds.length === 0) {
      toast.error("Please select at least one personnel profile on the right");
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      
      // Parallel commits to all selected users
      const promises = selectedUserIds.map(async (userId) => {
        const res = await fetch(`${API_BASE}/branch-users/${userId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            allowedPages: userPermissions,
            fieldPermissions: fieldPermissions,
            actionPermissions: actionPermissions,
            allowedVoucherTypes: allowedVoucherTypes,
            allowedQuickLinks: allowedQuickLinks,
            allowedBranches: allowedBranchesState,
            branch: allowedBranchesState.includes(selectedBranch._id)
              ? selectedBranch._id
              : (allowedBranchesState[0] || selectedBranch._id)
          })
        });
        return res.json();
      });

      const results = await Promise.all(promises);
      const failures = results.filter(r => !r.success);

      if (failures.length === 0) {
        toast.success(`✅ Access committed for ${selectedUserIds.length} user(s) successfully!`);
        // Refresh users list to reflect saved states in background
        await fetchBranchUsers(selectedBranch._id);
      } else {
        toast.error(`Failed to commit for some users: ${failures.map(f => f.message).join(", ")}`);
      }
    } catch (err) {
      toast.error("Error committing access");
    } finally {
      setSaving(false);
    }
  };

  const allPages = getUnifiedPageDefinitions();
  const categories = [...new Set(allPages.map(p => p.category))];

  // Helper for Global Select All
  const handleSelectAll = (isSelecting) => {
    if (isSelecting) {
      // 1. Pages
      setUserPermissions(allPages.map(p => p.id));

      // 2. Actions
      const newActionPerms = {};
      ["edit", "delete", "restock", "editPreviousDay", "action_pdf", "action_ewb", "action_cancel", "action_return", "create_shortcuts", "export", "editInvoiceItems", "editSellingPrice", "allowDummyBills"].forEach(a => newActionPerms[a] = true);
      setActionPermissions(newActionPerms);

      // 3. Field Visibility
      const newFieldPerms = {};
      getFlattenedPages().forEach(page => {
        if (page.permissionFields) {
          page.permissionFields.forEach(f => {
            newFieldPerms[`${page.id}_${f}`] = true;
          });
        }
      });
      setFieldPermissions(newFieldPerms);

      // 4. Hubs & Vouchers
      setAllowedQuickLinks(Object.keys(QUICK_LINKS_CONFIG));
      setAllowedVoucherTypes(voucherTypes.map(vt => vt._id));
    } else {
      setUserPermissions([]);

      const newActionPerms = {};
      ["edit", "delete", "restock", "editPreviousDay", "action_pdf", "action_ewb", "action_cancel", "action_return", "create_shortcuts", "export", "editInvoiceItems", "editSellingPrice", "allowDummyBills"].forEach(a => newActionPerms[a] = false);
      setActionPermissions(newActionPerms);

      const newFieldPerms = {};
      getFlattenedPages().forEach(page => {
        if (page.permissionFields) {
          page.permissionFields.forEach(f => {
            newFieldPerms[`${page.id}_${f}`] = false;
          });
        }
      });
      setFieldPermissions(newFieldPerms);

      setAllowedQuickLinks([]);
      setAllowedVoucherTypes([]);
    }
  };

  const isAllSelected =
    selectedBranch &&
    userPermissions.length === allPages.length &&
    allowedQuickLinks.length === Object.keys(QUICK_LINKS_CONFIG).length &&
    (voucherTypes.length === 0 || allowedVoucherTypes.length === voucherTypes.length);

  const fieldLabels = {
    orderBillId: "Order / Bill ID",
    invoiceId: "Invoice ID",
    orderRef: "Order Reference",
    vendor: "Vendor",
    vendorBillNo: "Vendor Bill#",
    billDate: "Bill Date",
    grandTotal: "Grand Total",
    entryDate: "Entry Date",
    dnId: "DN ID",
    invoiceRef: "Invoice Ref",
    details: "Details",
    totalAmount: "Total Amount",
    paidAmount: "Paid Amount",
    poDate: "PO Date",
    paymentId: "Payment ID",
    recipient: "Recipient / Description",
    mode: "Mode",
    type: "Type",
    productName: "Product Name",
    units: "Units",
    currentStock: "Current Stock",
    pendingSales: "Pending Sales",
    available: "Available",
    threshold: "Threshold",
    restockQty: "Restock Qty",
    preferredVendor: "Preferred Vendor",
    supplierName: "Supplier Name",
    gstin: "GSTIN",
    pos: "POs",
    credit: "Credit",
    debit: "Debit",
    status: "Status",
    date: "Date",
    action: "Action",
    action_edit: "Action: Edit",
    action_delete: "Action: Delete",
    action_invoice: "Action: Invoice",
    action_slip: "Action: Slip",
    action_ledger: "Action: Ledger",
    action_cancel: "Action: Cancel",
    action_si_bill: "Action: SI Bill",
    action_gen_invoice: "Action: Generate Invoice",
    action_pay: "Action: Pay",
    action_return: "Action: Return",
    action_config: "Action: Config",
    action_restock: "Action: Restock",
    action_return: "Action: Return",
    action_ewb: "Action: E-Way Bill",
    action_pdf: "Action: PDF",
    action_receipt: "Action: Receipt",
    action_return: "Action: Return",
    action_followup: "Action: Follow Up",
    action_log: "Action: Log",
    zone: "Zone",
    days: "Days",
    token: "Token",
    soId: "Order (SO)",
    siId: "Invoice (SI)",
    soRef: "Order Ref (SO)",
    dateTime: "Date & Time",
    createdBy: "Created By",
    einvoiceStatus: "E-Invoice Status",
    paymentId: "Payment ID",
    claimId: "Claim ID",
    cnId: "CN ID",
    receiptId: "Receipt ID",
    invoiceRef: "Invoice Ref",
    dateLogged: "Date Logged",
    followUpBy: "Follow-up By",
    nextFollowUp: "Next Follow-up",
    remarks: "Remarks",
    ledgerGroup: "Ledger Group",
    ledgerName: "Ledger Name",
    gst: "GST %",
    action_delete: "Action: Delete",
    action_edit: "Action: Edit",
    voucher: "Voucher / Time",
    purchasePrice: "Purchase ₹",
    sellingPrice: "Selling ₹",
    margin: "Margin (%)",
    profit: "Profit (%)",
    bar: "Bar",
    details: "Ledger Details",
    unit: "Unit Conversion",
    prices: "Prices",
    productInfo: "Product Info",
    cost: "Cost",
    stdPrice: "Std. Price",
    lockedPrice: "Locked ₹",
    hierarchy: "Group Hierarchy",
    nature: "Nature",
    tax: "Tax Details",
    net: "Net Financial Position",
    gstin: "GSTIN",
    type: "Type",
    invoiceId: "Invoice ID",
    accountName: "Account Name",
    partyName: "Party Name",
    expenseName: "Expense Name",
    baseAmount: "Base Amount",
    gstPercent: "GST %",
    gstAmount: "GST Amount",
    groupName: "Stock Group Name",
    opening: "Opening",
    inwards: "Inwards",
    outwards: "Outwards",
    closingQty: "Closing Qty",
    closingValue: "Closing Value",
    recipient: "Recipient / Description",
    mode: "Mode",
    voucherType: "Voucher Type",
    customer: "Customer",
    items: "Items",
    itemsCount: "Items Count",
    warehouse: "Warehouse",
    vendorBill: "Vendor Bill#",
    entryDate: "Entry Date",
    purchasingPrice: "Purchase Cost",
    adminMargin: "Admin Net",
    sellingPrice: "Selling Price",
    marginPercentage: "Margin %",
    margin: "Margin Box",
    grossProfit: "Profit",
    gst: "GST Logic",
    gstin: "GSTIN Num",
    totalQty: "Inventory",
    debit: "Debit Val",
    credit: "Credit/Lim",
    totalPaid: "Paid Amt",
    invoiceGenerated: "Inv Status",
    amount: "Amount",
    paymentMethod: "Pay Type",
    orderType: "Order Type",
    prefix: "Prefix",
    counter: "Counter",
    description: "Description",
    hsnCode: "HSN Code",
    totalQty: "Total Quantity",
    purchasingPrice: "Purchase Cost",
    sellingPrice: "Selling Price",
    marginPercentage: "Margin %",
    adminMargin: "Admin Net",
    productGroup: "Product Group",
    productCategories: "Product Categories",
    warehouse: "Warehouse",
    action_edit: "Edit Permission",
    action_delete: "Delete Permission",
    groupName: "Group Name",
    opening: "Opening Stock",
    inwards: "Total Inwards",
    outwards: "Total Outwards",
    closingQty: "Closing Qty",
    closingValue: "Closing Value",
    whatsapp: "WhatsApp",
    salesOwner: "Sales Owner",
    customerCategory: "Customer Category",
    commissionPercentage: "Commission %",
    vehicleNumber: "Vehicle Number",
    tokenId: "Token ID",
    assignedTo: "Assigned To",
    action_wb_add: "WB: Add Item",
    action_wb_price: "WB: Edit Price",
    action_wb_qty: "WB: Edit Qty",
    action_wb_discount: "WB: Edit Disc",
    action_wb_delete: "WB: Delete Item",
    physicalQty: "Physical Qty",
    inward: "Inward Adjust",
    outward: "Outward Adjust",
    expiryDate: "Expiry Date",
    checkedBy: "Staff Member",
    action_save: "Action: Save",
    action_approve: "Action: Approve",
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-6 pb-10 w-full font-poppins text-secondary">
      <div className="w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <FaUsersCog className="text-primary text-sm" />
              </span>
              Control System
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Granular access control and security protocols
              <span className="ml-2 bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                Security Node Active
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Step 1: Select Branch */}
          <div className="lg:col-span-2 space-y-6 sticky top-[100px] self-start">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50/50 p-4 border-b border-gray-100">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <FaBuilding className="text-gray-400" />
                  01. Origin Node
                </h3>
              </div>
              <div className="p-3 space-y-1.5 max-h-[600px] overflow-y-auto no-scrollbar">
                {branches.map(branch => (
                  <button
                    key={branch._id}
                    onClick={() => setSelectedBranch(branch)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-300 flex items-center justify-between group ${selectedBranch?._id === branch._id
                        ? "bg-primary/5 text-primary shadow-sm"
                        : "hover:bg-gray-50 text-gray-600"
                      }`}
                  >
                    <div className="flex flex-col">
                      <span className={`font-bold text-xs truncate max-w-[120px] ${selectedBranch?._id === branch._id ? "text-primary" : "text-gray-700"}`}>{branch.name}</span>
                      <span className={`text-[8px] uppercase tracking-widest font-black ${selectedBranch?._id === branch._id ? "text-primary/60" : "text-gray-400"}`}>
                        {branch.code}
                      </span>
                    </div>
                    <FaChevronRight className={`text-[10px] transition-transform duration-300 ${selectedBranch?._id === branch._id ? "translate-x-1" : "text-gray-300 opacity-0 group-hover:opacity-100"}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 2: Access Configuration */}
          <div className="lg:col-span-7">
            {selectedBranch ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 animate-in fade-in duration-500 overflow-visible">
                <div className="bg-gray-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-[100px] z-30 shadow-lg rounded-t-2xl border-b border-gray-700">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shadow-inner">
                      <FaLock size={16} />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-sm uppercase tracking-widest">3. Access Configuration</h3>
                      <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">
                        Configuring access for <span className="text-sky-400 font-extrabold">{selectedUserIds.length}</span> user(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-white/70 font-black tracking-widest text-[10px] cursor-pointer hover:text-white transition group">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isAllSelected ? "bg-primary border-primary text-white" : "border-gray-500 bg-gray-700 group-hover:border-gray-400"
                        }`}>
                        {isAllSelected && <FaCheck size={8} />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={isAllSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                      SELECT ALL
                    </label>
                    <button
                      onClick={handleSavePermissions}
                      disabled={saving}
                      className="bg-primary hover:bg-primary/90 disabled:bg-gray-700 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                    >
                      {saving ? (
                        <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <FaCheck size={10} />
                          Commit Access
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-8">
                  {/* Branch Node Access Control */}
                  <div className="bg-sky-50/30 p-6 rounded-2xl border border-sky-100 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-600 mb-6 flex items-center gap-2">
                      <FaBuilding className="text-xs" />
                      AUTHORIZED WORKSPACES (BRANCHES)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {branches.map(br => {
                        const isChecked = allowedBranchesState.includes(br._id);
                        return (
                          <div
                            key={br._id}
                            onClick={() => toggleAllowedBranchState(br._id)}
                            className={`flex items-center gap-4 px-5 py-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${isChecked
                                ? "border-sky-500/20 bg-white shadow-md shadow-sky-500/5"
                                : "border-gray-50 bg-gray-100/50 opacity-60 hover:opacity-100"
                              }`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isChecked ? "bg-sky-500 text-white" : "bg-gray-200 text-gray-400"
                              }`}>
                              <FaBuilding size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[10px] font-black uppercase tracking-wide truncate ${isChecked ? "text-gray-900" : "text-gray-400"}`}>
                                {br.name}
                              </p>
                              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                                {br.code} • {br.location || "Origin"}
                              </p>
                            </div>
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${isChecked ? "bg-sky-500 border-sky-500 text-white" : "border-gray-200 bg-white"
                              }`}>
                              {isChecked && <FaCheck size={6} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Global Action Permissions */}
                  <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      GLOBAL ACTION PERMISSIONS
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {[
                        { id: "edit", name: "Allow Edit", icon: <FaEdit /> },
                        { id: "delete", name: "Allow Delete", icon: <FaTrash /> },
                        { id: "restock", name: "Allow Restock", icon: <FaBox /> },
                        { id: "editPreviousDay", name: "Edit Previous Day", icon: <FaCalendar /> },
                        { id: "action_pdf", name: "Print/PDF (SI)", icon: <FaFilePdf /> },
                        { id: "action_ewb", name: "E-Way Bill (SI)", icon: <FaTruck /> },
                        { id: "action_cancel", name: "Cancel (SI)", icon: <FaTrash /> },
                        { id: "action_return", name: "Sales Return", icon: <FaUndo /> },
                        { id: "editInvoiceItems", name: "Edit Workbench Items", icon: <FaEdit /> },
                        { id: "create_shortcuts", name: "Shortcuts", icon: <FaLink /> },
                        { id: "editSellingPrice", name: "Edit Selling Price", icon: <FaDollarSign /> },
                        { id: "bypassSalesOrderLock", name: "Bypass SO Lock", icon: <FaLock /> },
                        { id: "allowDummyBills", name: "Allow Dummy Bills", icon: <FaFileInvoice /> }
                      ].map(action => {
                        const isEnabled = (action.id === "bypassSalesOrderLock" || action.id === "allowDummyBills")
                          ? actionPermissions[action.id] === true
                          : actionPermissions[action.id] !== false;
                        return (
                          <div
                            key={action.id}
                            onClick={() => toggleActionPermission(action.id)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-300 ${isEnabled
                                ? "border-primary/20 bg-white shadow-sm"
                                : "border-gray-50 bg-gray-100/50 opacity-60"
                              }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isEnabled ? "bg-primary text-white" : "bg-gray-200 text-gray-400"
                              }`}>
                              <span className="text-xs">{action.icon}</span>
                            </div>
                            <span className={`text-[10px] font-bold ${isEnabled ? "text-gray-900" : "text-gray-400"}`}>
                              {action.name}
                            </span>
                            <div className={`ml-auto w-4 h-4 rounded-md border flex items-center justify-center transition-all ${isEnabled ? "bg-primary border-primary text-white" : "border-gray-200 bg-white"
                              }`}>
                              {isEnabled && <FaCheck size={6} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Data Export Control */}
                  <div className="bg-emerald-50/30 p-6 rounded-2xl border border-emerald-100 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-6 flex items-center gap-2">
                      <FaFilePdf className="text-xs" />
                      DATA EXPORT CONTROL (PDF/EXCEL/REPORTS)
                    </h4>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="max-w-md">
                        <p className="text-xs text-gray-600 font-medium">
                          Manage user ability to export data from the system. When disabled, the user will not see any "Export" or "Download" buttons across all modules including Sales, Inventory, and Financial reports.
                        </p>
                      </div>
                      <div
                        onClick={() => toggleActionPermission("export")}
                        className={`flex items-center gap-4 px-8 py-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 min-w-[240px] ${actionPermissions.export !== false
                            ? "border-emerald-500/20 bg-white shadow-md shadow-emerald-500/5 scale-105"
                            : "border-gray-100 bg-gray-50 opacity-60"
                          }`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-lg ${actionPermissions.export !== false ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-gray-300 text-white"
                          }`}>
                          <FaFilePdf size={20} />
                        </div>
                        <div>
                          <p className={`text-[11px] font-black uppercase tracking-widest ${actionPermissions.export !== false ? "text-gray-900" : "text-gray-400"}`}>
                            {actionPermissions.export !== false ? "Exporting Allowed" : "Exporting Restricted"}
                          </p>
                          <p className="text-[9px] text-gray-400 font-bold mt-1">Global Data Access Security</p>
                        </div>
                        <div className={`ml-auto w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${actionPermissions.export !== false ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-200 bg-white"
                          }`}>
                          {actionPermissions.export !== false && <FaCheck size={10} />}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      PAGE WISE ACCESS (SIDE BAR)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {PAGE_CONFIG.map(category => (
                        <div key={category.category} className="space-y-4">
                          <h5 className="text-[9px] font-black uppercase tracking-widest text-primary/60 border-b border-gray-100 pb-2">
                            {category.category.toUpperCase()} MODULES
                          </h5>
                          <div className="space-y-3">
                            {category.items.map(item => (
                              <div key={item.id} className="space-y-2">
                                {/* Parent Item */}
                                <div
                                  onClick={() => {
                                    if (item.permissionFields) setExpandedFieldsPageId(expandedFieldsPageId === item.id ? null : item.id);
                                  }}
                                  className={`flex items-center gap-4 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-300 ${userPermissions.includes(item.id)
                                      ? "border-primary/20 bg-primary/5 shadow-sm"
                                      : "border-gray-50 bg-white hover:border-gray-200"
                                    } ${expandedFieldsPageId === item.id ? "ring-2 ring-primary/20" : ""}`}
                                >
                                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${userPermissions.includes(item.id) ? "bg-primary text-white" : "bg-gray-100 text-gray-400"
                                    }`}>
                                    {ICON_MAP[item.icon]}
                                  </div>
                                  <div className="flex-1">
                                    <p className={`text-[11px] font-bold ${userPermissions.includes(item.id) ? "text-gray-900" : "text-gray-500"}`}>
                                      {item.name}
                                      {item.isDropdown && <span className="ml-2 text-[8px] opacity-40">(Dropdown)</span>}
                                    </p>
                                    {item.permissionFields && (
                                      <p className="text-[8px] font-black text-primary/40 uppercase mt-0.5">Click to configure columns</p>
                                    )}
                                  </div>
                                  <div
                                    onClick={(e) => { e.stopPropagation(); togglePermission(item.id); }}
                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${userPermissions.includes(item.id) ? "bg-primary border-primary text-white" : "border-gray-200"
                                      }`}>
                                    {userPermissions.includes(item.id) && <FaCheck size={8} />}
                                  </div>
                                </div>

                                {/* Field Permissions for Parent Item */}
                                {expandedFieldsPageId === item.id && item.permissionFields && (
                                  <div className="ml-13 p-4 bg-gray-50/50 rounded-xl border border-gray-100 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                      <FaLock size={8} /> Column Visibility
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {item.permissionFields.map(fieldId => {
                                        const key = `${item.id}_${fieldId}`;
                                        const isAllowed = fieldPermissions[key] !== false;
                                        return (
                                          <div
                                            key={key}
                                            onClick={(e) => { e.stopPropagation(); toggleFieldPermission(key); }}
                                            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border transition-all duration-300 cursor-pointer ${isAllowed ? "bg-white border-primary/20 shadow-sm" : "bg-gray-100/50 border-transparent opacity-50"
                                              }`}
                                          >
                                            <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center transition-all ${isAllowed ? "bg-primary border-primary text-white" : "border-gray-300 bg-white"
                                              }`}>
                                              {isAllowed && <FaCheck size={6} />}
                                            </div>
                                            <span className={`text-[9px] font-bold ${isAllowed ? "text-gray-700" : "text-gray-400"}`}>
                                              {fieldLabels[fieldId] || fieldId}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Sub Items if Dropdown */}
                                {item.isDropdown && (
                                  <div className="ml-8 pl-4 border-l-2 border-gray-100 space-y-3">
                                    {item.subItems.map(sub => (
                                      <div key={sub.id} className="space-y-2">
                                        <div
                                          onClick={() => {
                                            if (sub.permissionFields) setExpandedFieldsPageId(expandedFieldsPageId === sub.id ? null : sub.id);
                                          }}
                                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-300 ${userPermissions.includes(sub.id)
                                              ? "border-primary/10 bg-white shadow-sm"
                                              : "border-transparent bg-gray-50/50 hover:bg-gray-100/50"
                                            } ${expandedFieldsPageId === sub.id ? "ring-2 ring-primary/10" : ""}`}
                                        >
                                          <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${userPermissions.includes(sub.id) ? "bg-primary/10 text-primary" : "bg-gray-200 text-gray-400"
                                            }`}>
                                            <span className="text-[10px]">{ICON_MAP[sub.icon]}</span>
                                          </div>
                                          <div className="flex-1">
                                            <p className={`text-[10px] font-bold ${userPermissions.includes(sub.id) ? "text-gray-800" : "text-gray-400"}`}>
                                              {sub.name}
                                            </p>
                                            {sub.permissionFields && (
                                              <p className="text-[8px] font-black text-primary/40 uppercase">Click to configure columns</p>
                                            )}
                                          </div>
                                          <div
                                            onClick={(e) => { e.stopPropagation(); togglePermission(sub.id); }}
                                            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${userPermissions.includes(sub.id) ? "bg-primary border-primary text-white" : "border-gray-200 bg-white"
                                              }`}>
                                            {userPermissions.includes(sub.id) && <FaCheck size={6} />}
                                          </div>
                                        </div>

                                        {/* Field Permissions for Sub Item */}
                                        {expandedFieldsPageId === sub.id && sub.permissionFields && (
                                          <div className="p-3 bg-gray-50/50 rounded-xl border border-gray-100 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                              <FaLock size={8} /> Column Visibility
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                              {sub.permissionFields.map(fieldId => {
                                                const key = `${sub.id}_${fieldId}`;
                                                const isAllowed = fieldPermissions[key] !== false;
                                                return (
                                                  <div
                                                    key={key}
                                                    onClick={(e) => { e.stopPropagation(); toggleFieldPermission(key); }}
                                                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border transition-all duration-300 cursor-pointer ${isAllowed ? "bg-white border-primary/20 shadow-sm" : "bg-gray-100/50 border-transparent opacity-50"
                                                      }`}
                                                  >
                                                    <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center transition-all ${isAllowed ? "bg-primary border-primary text-white" : "border-gray-300 bg-white"
                                                      }`}>
                                                      {isAllowed && <FaCheck size={6} />}
                                                    </div>
                                                    <span className={`text-[9px] font-bold ${isAllowed ? "text-gray-700" : "text-gray-400"}`}>
                                                      {fieldLabels[fieldId] || fieldId}
                                                    </span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4. Voucher Type Controls */}
                  <div className="mt-12 pt-8 border-t border-gray-100">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Voucher Type Control (Sales/Purchase)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {voucherTypes.length === 0 ? (
                        <p className="text-[10px] text-gray-400 font-bold uppercase italic">No voucher types configured for this branch</p>
                      ) : (
                        voucherTypes.map(vt => (
                          <div
                            key={vt._id}
                            onClick={() => toggleVoucherType(vt._id)}
                            className={`flex items-center gap-4 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-300 ${allowedVoucherTypes.includes(vt._id)
                                ? "border-primary/20 bg-primary/5 shadow-sm"
                                : "border-gray-50 bg-white hover:border-gray-200"
                              }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${allowedVoucherTypes.includes(vt._id) ? "bg-primary text-white" : "bg-gray-100 text-gray-400"
                              }`}>
                              <FaFileInvoice className="text-xs" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[10px] font-bold truncate ${allowedVoucherTypes.includes(vt._id) ? "text-gray-900" : "text-gray-500"}`}>
                                {vt.name}
                              </p>
                              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                                {vt.orderType} • {vt.prefix}
                              </p>
                            </div>
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${allowedVoucherTypes.includes(vt._id) ? "bg-primary border-primary text-white" : "border-gray-200 bg-white"
                              }`}>
                              {allowedVoucherTypes.includes(vt._id) && <FaCheck size={6} />}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 border-dashed p-12 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-200 mb-6">
                  <FaShieldAlt size={32} />
                </div>
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Protocol Configuration</h3>
                <p className="text-gray-400 text-[10px] font-bold uppercase mt-2 max-w-xs leading-relaxed">
                  Select an origin node branch to initiate access configuration
                </p>
              </div>
            )}
          </div>

          {/* Step 3: Personnel Target Selection */}
          <div className="lg:col-span-3 sticky top-[100px] self-start">
            {selectedBranch && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in slide-in-from-right duration-500">
                <div className="bg-primary/5 p-4 border-b border-primary/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <FaUsers className="text-primary text-sm" />
                    <h3 className="text-[10px] font-black text-primary uppercase tracking-widest">02. Personnel</h3>
                  </div>
                  {branchUsers.length > 0 && (
                    <label className="flex items-center gap-1.5 text-primary/60 hover:text-primary transition font-black tracking-widest text-[9px] cursor-pointer select-none">
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                        isAllFilteredUsersSelected
                          ? "bg-primary border-primary text-white"
                          : "border-primary/20 bg-white"
                      }`}>
                        {isAllFilteredUsersSelected && <FaCheck size={6} />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={isAllFilteredUsersSelected}
                        onChange={(e) => toggleSelectAllUsers(e.target.checked)}
                      />
                      ALL
                    </label>
                  )}
                </div>

                {/* Interactive Search Console */}
                {branchUsers.length > 0 && (
                  <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                    <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors pointer-events-none">
                        <FaSearch size={10} />
                      </div>
                      <input
                        type="text"
                        value={personnelSearchQuery}
                        onChange={(e) => setPersonnelSearchQuery(e.target.value)}
                        placeholder="Search personnel..."
                        className="w-full pl-9 pr-3 py-2 bg-white border-2 border-gray-100 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl transition-all outline-none font-bold text-[10px] text-secondary shadow-inner"
                      />
                    </div>
                  </div>
                )}

                <div className="p-3 space-y-1.5 max-h-[550px] overflow-y-auto custom-scrollbar">
                  {loading ? (
                    <div className="py-8 text-center text-gray-400 text-xs font-bold uppercase tracking-widest animate-pulse">Accessing...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                      {personnelSearchQuery ? "No matches found" : "No nodes found"}
                    </div>
                  ) : (
                    filteredUsers.map(user => {
                      const isChecked = selectedUserIds.includes(user._id);
                      return (
                        <div
                          key={user._id}
                          className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-300 flex items-center gap-3 border ${
                            isChecked
                              ? "bg-primary/5 border-primary/20 shadow-sm"
                              : "hover:bg-gray-50 border-transparent text-gray-600"
                          }`}
                        >
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectUser(user._id);
                            }}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
                              isChecked
                                ? "bg-primary border-primary text-white shadow-inner"
                                : "border-gray-300 bg-white hover:border-primary/40"
                            }`}
                          >
                            {isChecked && <FaCheck size={8} />}
                          </div>
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => handleUserClick(user)}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-xs truncate text-gray-700 hover:text-primary transition-colors">{user.username}</span>
                              <span className={`text-[8px] font-black uppercase tracking-widest text-primary/60 mt-0.5`}>
                                {user.role}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Viewport Commit Access Button (Always visible from top to bottom) */}
      {selectedBranch && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in zoom-in duration-300">
          <button
            onClick={handleSavePermissions}
            disabled={saving || selectedUserIds.length === 0}
            className={`bg-primary text-white font-black px-6 py-4 rounded-2xl shadow-2xl shadow-primary/30 flex items-center gap-3 text-xs uppercase tracking-widest transition-all duration-300 border border-primary/20 backdrop-blur-md ${
              selectedUserIds.length === 0
                ? "opacity-50 cursor-not-allowed scale-95 hover:bg-primary"
                : "hover:bg-primary/95 hover:scale-105 active:scale-95"
            }`}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <FaCheck size={12} />
                Commit Access ({selectedUserIds.length})
              </>
            )}
          </button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      ` }} />
    </div>
  );
}

