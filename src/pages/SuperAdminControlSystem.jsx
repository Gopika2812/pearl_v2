import { useEffect, useState } from "react";
import { FaBuilding, FaCheck, FaShieldAlt, FaUser, FaUsers, FaUsersCog, FaLock, FaGlobe, FaShoppingCart, FaBox, FaFileAlt, FaDollarSign, FaTruck, FaHandshake, FaChartLine, FaLink, FaBook, FaChartBar, FaChevronRight, FaEdit, FaTrash, FaCheckCircle, FaPlus } from "react-icons/fa";
import { QUICK_LINKS_CONFIG, QUICK_LINKS_CATEGORIES } from "../utils/quickLinksConfig";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

const PAGE_DEFINITIONS = [
  { id: "home", name: "Home Dashboard", icon: <FaGlobe />, category: "General" },
  { id: "create-po", name: "Create Purchase Order", icon: <FaShoppingCart />, category: "Purchase" },
  { id: "purchase-list", name: "Purchase Order List", icon: <FaBox />, category: "Purchase" },
  { id: "restocking", name: "Restocking / Recycling", icon: <FaBox />, category: "Purchase" },
  { id: "debit-note", name: "Debit Note", icon: <FaFileAlt />, category: "Purchase" },
  { id: "payment-po", name: "Purchase Payment", icon: <FaDollarSign />, category: "Purchase" },
  { id: "create-so", name: "Create Sales Order", icon: <FaShoppingCart />, category: "Sales" },
  { id: "invoiced-order", name: "Invoiced Order List", icon: <FaFileAlt />, category: "Sales" },
  { id: "credit-note", name: "Credit Note", icon: <FaFileAlt />, category: "Sales" },
  { id: "claims", name: "Claims Orders", icon: <FaFileAlt />, category: "Sales" },
  { id: "receipt", name: "Sales Receipt", icon: <FaDollarSign />, category: "Sales" },
  { id: "dispatch", name: "Loading & Dispatch", icon: <FaTruck />, category: "Logistics" },
  { id: "suppliers", name: "Suppliers (Creditors)", icon: <FaHandshake />, category: "Directory" },
  { id: "customers", name: "Customers (Debtors)", icon: <FaUsers />, category: "Directory" },
  { id: "journals", name: "Journal Master", icon: <FaBook />, category: "Accounts" },
  { id: "other-payment", name: "Other Payment", icon: <FaDollarSign />, category: "Accounts" },
  { id: "other-receipt", name: "Other Receipt", icon: <FaDollarSign />, category: "Accounts" },
  { id: "insights", name: "Insights & Analysis", icon: <FaChartLine />, category: "Reports" },
  { id: "quick-links", name: "Quick Links", icon: <FaLink />, category: "General" },
];

/**
 * Dynamically merge Quick Link resources into PAGE_DEFINITIONS 
 * to ensure they show up in "Module Access" automatically.
 */
const getUnifiedPageDefinitions = () => {
  const definitions = [...PAGE_DEFINITIONS];
  const existingIds = new Set(definitions.map(p => p.id));

  Object.keys(QUICK_LINKS_CONFIG).forEach(key => {
    if (!existingIds.has(key)) {
      definitions.push({
        id: key,
        name: QUICK_LINKS_CONFIG[key].label,
        icon: <FaLink />, // Default icon
        category: "Master Data"
      });
    }
  });

  return definitions;
};

export default function SuperAdminControlSystem() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchUsers, setBranchUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userPermissions, setUserPermissions] = useState([]);
  const [fieldPermissions, setFieldPermissions] = useState({});
  const [actionPermissions, setActionPermissions] = useState({});
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [allowedVoucherTypes, setAllowedVoucherTypes] = useState([]);
  const [allowedQuickLinks, setAllowedQuickLinks] = useState([]);

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
      setSelectedUser(null);
      setUserPermissions([]);
    }
  }, [selectedBranch]);

  // Set permissions when user selected
  useEffect(() => {
    if (selectedUser) {
      setUserPermissions(selectedUser.allowedPages || []);
      setFieldPermissions(selectedUser.fieldPermissions || {});
      setActionPermissions(selectedUser.actionPermissions || {});
      setAllowedVoucherTypes(selectedUser.allowedVoucherTypes || []);
      setAllowedQuickLinks(selectedUser.allowedQuickLinks || []);
    }
  }, [selectedUser]);

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
    setActionPermissions(prev => ({
      ...prev,
      [action]: !prev[action]
    }));
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

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/branch-users/${selectedUser._id}`, {
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
          allowedQuickLinks: allowedQuickLinks
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Permissions updated for ${selectedUser.username}`);
        // Update local state
        const updatedUser = { 
          ...selectedUser, 
          allowedPages: userPermissions,
          fieldPermissions: fieldPermissions,
          actionPermissions: actionPermissions,
          allowedVoucherTypes: allowedVoucherTypes,
          allowedQuickLinks: allowedQuickLinks
        };
        setBranchUsers(branchUsers.map(u => u._id === selectedUser._id ? updatedUser : u));
        setSelectedUser(updatedUser);
      } else {
        toast.error(data.message || "Failed to update permissions");
      }
    } catch (err) {
      toast.error("Error saving permissions");
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
      ["edit", "delete", "restock", "create_shortcuts"].forEach(a => newActionPerms[a] = true);
      setActionPermissions(newActionPerms);
      
      // 3. Field Visibility
      const newFieldPerms = {};
      Object.keys(QUICK_LINKS_CONFIG).forEach(type => {
        const config = QUICK_LINKS_CONFIG[type];
        if (config.permissionFields) {
          config.permissionFields.forEach(f => {
            newFieldPerms[`${type}_${f}`] = true;
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
      ["edit", "delete", "restock", "create_shortcuts"].forEach(a => newActionPerms[a] = false);
      setActionPermissions(newActionPerms);
      
      const newFieldPerms = {};
      Object.keys(QUICK_LINKS_CONFIG).forEach(type => {
        const config = QUICK_LINKS_CONFIG[type];
        if (config.permissionFields) {
          config.permissionFields.forEach(f => {
            newFieldPerms[`${type}_${f}`] = false;
          });
        }
      });
      setFieldPermissions(newFieldPerms);
      
      setAllowedQuickLinks([]);
      setAllowedVoucherTypes([]);
    }
  };

  const isAllSelected = 
    selectedUser && 
    userPermissions.length === allPages.length && 
    allowedQuickLinks.length === Object.keys(QUICK_LINKS_CONFIG).length && 
    (voucherTypes.length === 0 || allowedVoucherTypes.length === voucherTypes.length);

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20 px-4 md:px-6 pb-12">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-gray-900 flex items-center gap-4">
                <div className="p-3 bg-secondary/10 rounded-2xl text-secondary">
                  <FaUsersCog />
                </div>
                Control System
              </h1>
              <p className="text-gray-500 mt-2 font-medium tracking-tight">Configure page-level access permissions for branch personnel</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Step 1: Select Branch */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-secondary p-5 flex items-center gap-3">
                <FaBuilding className="text-white lg" />
                <h3 className="font-bold text-white">1. Select Branch</h3>
              </div>
              <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                {branches.map(branch => (
                  <button
                    key={branch._id}
                    onClick={() => setSelectedBranch(branch)}
                    className={`w-full text-left px-5 py-4 rounded-2xl transition-all duration-300 flex items-center justify-between group ${
                      selectedBranch?._id === branch._id
                        ? "bg-secondary text-white shadow-lg shadow-secondary/20"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-sm truncate max-w-[120px]">{branch.name}</span>
                      <span className={`text-[10px] uppercase tracking-widest font-bold ${selectedBranch?._id === branch._id ? "text-white/60" : "text-gray-400"}`}>
                        {branch.code}
                      </span>
                    </div>
                    <FaChevronRight className={`text-xs transition-transform duration-300 ${selectedBranch?._id === branch._id ? "translate-x-1" : "text-gray-300 opacity-0 group-hover:opacity-100"}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Select User */}
            {selectedBranch && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-in slide-in-from-left duration-500">
                <div className="bg-primary p-5 flex items-center gap-3">
                  <FaUsers className="text-white lg" />
                  <h3 className="font-bold text-white">2. Select User</h3>
                </div>
                <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {loading ? (
                    <div className="py-8 text-center text-gray-400 font-medium">Loading users...</div>
                  ) : branchUsers.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-sm">No users found</div>
                  ) : (
                    branchUsers.map(user => (
                      <button
                        key={user._id}
                        onClick={() => setSelectedUser(user)}
                        className={`w-full text-left px-5 py-4 rounded-2xl transition-all duration-300 flex items-center justify-between group ${
                          selectedUser?._id === user._id
                            ? "bg-primary text-white shadow-lg shadow-primary/20"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm truncate">{user.username}</span>
                          <span className={`text-[10px] font-bold ${selectedUser?._id === user._id ? "text-white/60" : "text-primary"}`}>
                            {user.role}
                          </span>
                        </div>
                        <FaChevronRight className={`text-xs transition-transform duration-300 ${selectedUser?._id === user._id ? "translate-x-1" : "text-gray-300 opacity-0 group-hover:opacity-100"}`} />
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Permissions Grid */}
          <div className="lg:col-span-3">
            {selectedUser ? (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500">
                <div className="bg-gray-900 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white">
                      <FaLock size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-xl">3. Set Permissions</h3>
                      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
                        Configure {selectedUser.username}'s access
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-white/90 font-bold tracking-wide text-sm cursor-pointer hover:text-white transition group">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        isAllSelected ? "bg-green-500 border-green-500 text-white" : "border-gray-500 bg-gray-800 group-hover:border-gray-400"
                      }`}>
                        {isAllSelected && <FaCheck size={10} />}
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
                      className="bg-green-500 hover:bg-green-600 disabled:bg-gray-700 text-white px-8 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-green-500/20 flex items-center gap-2"
                    >
                      {saving ? "Saving..." : (
                        <>
                          <FaCheck />
                          Save Access
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {categories.map(category => (
                    <div key={category} className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                        <span className="w-2 h-2 bg-secondary rounded-full"></span>
                        {category} Pages
                      </h4>
                      <div className="space-y-2">
                        {allPages.filter(p => p.category === category).map(page => {
                          const isAllowed = userPermissions.includes(page.id);
                          return (
                            <div
                              key={page.id}
                              onClick={() => togglePermission(page.id)}
                              className={`flex items-center gap-4 px-5 py-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                                isAllowed
                                  ? "border-secondary bg-secondary/5"
                                  : "border-gray-50 bg-white hover:border-gray-200"
                              }`}
                            >
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                                isAllowed ? "bg-secondary text-white" : "bg-gray-100 text-gray-400"
                              }`}>
                                {page.icon}
                              </div>
                              <div className="flex-1">
                                <p className={`text-sm font-bold ${isAllowed ? "text-gray-900" : "text-gray-500"}`}>{page.name}</p>
                              </div>
                              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                isAllowed ? "bg-secondary border-secondary text-white" : "border-gray-200"
                              }`}>
                                {isAllowed && <FaCheck size={10} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* New Granular Permissions Section */}
                  <div className="md:col-span-2 mt-8 pt-8 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Action Permissions */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500 flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        Quick Links: Action Control (Edit/Delete)
                      </h4>
                      <div className="space-y-3">
                        {[
                          { id: "edit", name: "Allow Edit Records", icon: <FaEdit /> },
                          { id: "delete", name: "Allow Delete Records", icon: <FaTrash /> },
                          { id: "restock", name: "Allow Restocking Logic", icon: <FaBox /> },
                          { id: "create_shortcuts", name: "Allow Form Shortcuts (+)", icon: <FaPlus /> }
                        ].map(action => {
                          const isAllowed = actionPermissions[action.id] !== false; // Default to true if not set
                          return (
                            <div
                              key={action.id}
                              onClick={() => toggleActionPermission(action.id)}
                              className={`flex items-center gap-4 px-5 py-3 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                                isAllowed
                                  ? "border-red-200 bg-red-50/30"
                                  : "border-gray-100 bg-gray-50 opacity-60"
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                isAllowed ? "bg-red-500 text-white" : "bg-gray-200 text-gray-400"
                              }`}>
                                {action.icon}
                              </div>
                              <div className="flex-1">
                                <p className={`text-xs font-bold ${isAllowed ? "text-gray-900" : "text-gray-500"}`}>{action.name}</p>
                              </div>
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                isAllowed ? "bg-red-500 border-red-500 text-white" : "border-gray-200"
                              }`}>
                                {isAllowed && <FaCheck size={8} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Field Visibility Permissions - NOW GRANULAR PER PAGE */}
                    <div className="md:col-span-2 mt-8 pt-8 border-t border-gray-100 space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 flex items-center gap-2">
                        <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                        Quick Links: Column Visibility (Per Page)
                      </h4>
                      <p className="text-gray-400 text-[10px] font-bold uppercase mb-4 italic">
                        Select which columns are visible on each specific page. Settings are saved per-user.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {Object.keys(QUICK_LINKS_CONFIG).map(type => {
                          const config = QUICK_LINKS_CONFIG[type];
                          if (!config.permissionFields || config.permissionFields.length === 0) return null;
                          
                          return (
                            <div key={type} className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100">
                              <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <FaLink size={8} /> {config.label} Columns
                              </h5>
                              <div className="space-y-2">
                                {config.permissionFields.map(fieldId => {
                                  // Find a nice name for the field
                                  const key = `${type}_${fieldId}`;
                                  const isAllowed = fieldPermissions[key] !== false;
                                  
                                  // Simple titleize if name not found in config labels? 
                                  // Actually let's just use the fieldId with some formatting or a small map
                                  const fieldLabels = {
                                    purchasingPrice: "Purchasing Price",
                                    adminMargin: "Admin Margin",
                                    sellingPrice: "Selling Price",
                                    marginPercentage: "Normal Margin (%)",
                                    margin: "Customer Margin",
                                    gst: "GST / HSN Info",
                                    totalQty: "Stock Levels",
                                    debit: "Debit Balance",
                                    credit: "Credit/Limit",
                                    gstin: "GSTIN",
                                    commissionPercentage: "Commission %",
                                    phone: "Phone Number",
                                    vehicleNumber: "Vehicle Number",
                                    counter: "Current Counter",
                                    prefix: "Prefix"
                                  };

                                  return (
                                    <div
                                      key={key}
                                      onClick={() => toggleFieldPermission(key)}
                                      className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all duration-300 cursor-pointer ${
                                        isAllowed
                                          ? "bg-white border-purple-100 shadow-sm"
                                          : "bg-gray-100/50 border-transparent opacity-60"
                                      }`}
                                    >
                                      <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${
                                        isAllowed ? "bg-purple-500 border-purple-500 text-white" : "border-gray-300 bg-white"
                                      }`}>
                                        {isAllowed && <FaCheck size={8} />}
                                      </div>
                                      <span className={`text-[10px] font-bold ${isAllowed ? "text-gray-700" : "text-gray-400"}`}>
                                        {fieldLabels[fieldId] || fieldId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section Access - NOW DYNAMIC */}
                    <div className="md:col-span-2 mt-8 pt-8 border-t border-gray-100 space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-600 rounded-full"></span>
                        Quick Links Hub: Section Access (Manage Sub-Pages)
                      </h4>
                      <p className="text-gray-400 text-[10px] font-bold uppercase mb-4 italic">
                        Select which master data sections are visible in the Hub. Changes reflect immediately for the user.
                      </p>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {Object.keys(QUICK_LINKS_CONFIG).map((linkId) => {
                          const config = QUICK_LINKS_CONFIG[linkId];
                          const isAllowed = allowedQuickLinks.includes(linkId);
                          return (
                            <div
                              key={linkId}
                              onClick={() => toggleQuickLink(linkId)}
                              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                                isAllowed
                                  ? "border-emerald-200 bg-emerald-50/10 shadow-sm"
                                  : "border-gray-50 bg-white opacity-60"
                              }`}
                            >
                              <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                                isAllowed ? "bg-emerald-500 border-emerald-500" : "border-gray-200"
                              }`}>
                                {isAllowed && <div className="w-1 h-1 bg-white rounded-full"></div>}
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-tight ${isAllowed ? "text-emerald-900" : "text-gray-500"}`}>
                                {config.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Voucher Type Access Section */}
                    <div className="md:col-span-2 mt-8 pt-8 border-t border-gray-100 space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        Voucher Type Authorization
                      </h4>
                      <p className="text-gray-400 text-[10px] font-bold uppercase mb-4 italic">
                        If none selected, all types are allowed by default. Once one is selected, only those will be visible to the user.
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {voucherTypes.length === 0 ? (
                          <div className="col-span-full py-4 text-center text-gray-400 text-xs font-bold border-2 border-dashed border-gray-100 rounded-2xl">
                            No custom voucher types found for this branch
                          </div>
                        ) : (
                          voucherTypes.map(vt => {
                            const isSelected = allowedVoucherTypes.includes(vt._id);
                            return (
                              <div
                                key={vt._id}
                                onClick={() => toggleVoucherType(vt._id)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                                  isSelected
                                    ? "border-blue-200 bg-blue-50/30 font-bold"
                                    : "border-gray-50 bg-white hover:border-gray-200 opacity-70"
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                  isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"
                                }`}>
                                  <FaFileAlt size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs truncate ${isSelected ? "text-gray-900" : "text-gray-500"}`}>
                                    {vt.name.toUpperCase()}
                                  </p>
                                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                                    {vt.orderType} • {vt.prefix}
                                  </p>
                                </div>
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                  isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200"
                                }`}>
                                  {isSelected && <FaCheck size={8} />}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-3xl border border-gray-100 border-dashed p-12 text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-6">
                  <FaShieldAlt size={40} />
                </div>
                <h3 className="text-xl font-bold text-gray-400">Permissions Configuration</h3>
                <p className="text-gray-400 text-sm mt-2 max-w-xs">Select a branch and a user from the left to start configuring their access rights.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
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
      `}</style>
    </div>
  );
}
