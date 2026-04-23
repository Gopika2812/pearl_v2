import { useEffect, useState } from "react";
import { FaBuilding, FaCheck, FaShieldAlt, FaUser, FaUsers, FaUsersCog, FaLock, FaGlobe, FaShoppingCart, FaBox, FaFileAlt, FaDollarSign, FaTruck, FaHandshake, FaChartLine, FaLink, FaBook, FaChartBar, FaChevronRight, FaEdit, FaTrash, FaCheckCircle, FaPlus } from "react-icons/fa";
import { QUICK_LINKS_CONFIG, QUICK_LINKS_CATEGORIES } from "../utils/quickLinksConfig";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

import { PAGE_CONFIG, ICON_MAP, getFlattenedPages } from "../utils/pageConfig";

/**
 * Dynamically merge all configured pages from PAGE_CONFIG
 * into a unified list for permission management.
 */
const getUnifiedPageDefinitions = () => {
  return getFlattenedPages();
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
      ["edit", "delete", "restock", "create_shortcuts"].forEach(a => newActionPerms[a] = false);
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
    selectedUser && 
    userPermissions.length === allPages.length && 
    allowedQuickLinks.length === Object.keys(QUICK_LINKS_CONFIG).length && 
    (voucherTypes.length === 0 || allowedVoucherTypes.length === voucherTypes.length);

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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Step 1: Select Branch */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50/50 p-4 border-b border-gray-100">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <FaBuilding className="text-gray-400" />
                  01. Origin Node
                </h3>
              </div>
              <div className="p-3 space-y-1.5 max-h-[400px] overflow-y-auto no-scrollbar">
                {branches.map(branch => (
                  <button
                    key={branch._id}
                    onClick={() => setSelectedBranch(branch)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-300 flex items-center justify-between group ${
                      selectedBranch?._id === branch._id
                        ? "bg-primary/5 text-primary shadow-sm"
                        : "hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className={`font-bold text-xs truncate max-w-[150px] ${selectedBranch?._id === branch._id ? "text-primary" : "text-gray-700"}`}>{branch.name}</span>
                      <span className={`text-[8px] uppercase tracking-widest font-black ${selectedBranch?._id === branch._id ? "text-primary/60" : "text-gray-400"}`}>
                        {branch.code}
                      </span>
                    </div>
                    <FaChevronRight className={`text-[10px] transition-transform duration-300 ${selectedBranch?._id === branch._id ? "translate-x-1" : "text-gray-300 opacity-0 group-hover:opacity-100"}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Select User */}
            {selectedBranch && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in slide-in-from-left duration-500">
                <div className="bg-primary/5 p-4 border-b border-primary/10 flex items-center gap-3">
                  <FaUsers className="text-primary text-sm" />
                  <h3 className="text-[10px] font-black text-primary uppercase tracking-widest">02. Personnel</h3>
                </div>
                <div className="p-3 space-y-1.5 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {loading ? (
                    <div className="py-8 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">Accessing...</div>
                  ) : branchUsers.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest">No nodes found</div>
                  ) : (
                    branchUsers.map(user => (
                      <button
                        key={user._id}
                        onClick={() => setSelectedUser(user)}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-300 flex items-center justify-between group ${
                          selectedUser?._id === user._id
                            ? "bg-primary text-white shadow-md shadow-primary/20"
                            : "hover:bg-gray-50 text-gray-600"
                        }`}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className={`font-bold text-xs truncate ${selectedUser?._id === user._id ? "text-white" : "text-gray-700"}`}>{user.username}</span>
                          <span className={`text-[9px] font-black uppercase tracking-widest ${selectedUser?._id === user._id ? "text-white/60" : "text-primary/60"}`}>
                            {user.role}
                          </span>
                        </div>
                        <FaChevronRight className={`text-[10px] transition-transform duration-300 ${selectedUser?._id === user._id ? "translate-x-1" : "text-gray-300 opacity-0 group-hover:opacity-100"}`} />
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
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500">
                <div className="bg-gray-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shadow-inner">
                      <FaLock size={16} />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-sm uppercase tracking-widest">3. Access Configuration</h3>
                      <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">
                        Authorizing user: <span className="text-primary italic">{selectedUser.username}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-white/70 font-black tracking-widest text-[10px] cursor-pointer hover:text-white transition group">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        isAllSelected ? "bg-primary border-primary text-white" : "border-gray-500 bg-gray-700 group-hover:border-gray-400"
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
                                  onClick={() => togglePermission(item.id)}
                                  className={`flex items-center gap-4 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                                    userPermissions.includes(item.id)
                                      ? "border-primary/20 bg-primary/5 shadow-sm"
                                      : "border-gray-50 bg-white hover:border-gray-200"
                                  }`}
                                >
                                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                                    userPermissions.includes(item.id) ? "bg-primary text-white" : "bg-gray-100 text-gray-400"
                                  }`}>
                                    {ICON_MAP[item.icon]}
                                  </div>
                                  <div className="flex-1">
                                    <p className={`text-[11px] font-bold ${userPermissions.includes(item.id) ? "text-gray-900" : "text-gray-500"}`}>
                                      {item.name}
                                      {item.isDropdown && <span className="ml-2 text-[8px] opacity-40">(Dropdown)</span>}
                                    </p>
                                  </div>
                                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                    userPermissions.includes(item.id) ? "bg-primary border-primary text-white" : "border-gray-200"
                                  }`}>
                                    {userPermissions.includes(item.id) && <FaCheck size={8} />}
                                  </div>
                                </div>

                                {/* Sub Items if Dropdown */}
                                {item.isDropdown && (
                                  <div className="ml-8 pl-4 border-l-2 border-gray-100 space-y-2">
                                    {item.subItems.map(sub => (
                                      <div
                                        key={sub.id}
                                        onClick={() => togglePermission(sub.id)}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-300 ${
                                          userPermissions.includes(sub.id)
                                            ? "border-primary/10 bg-white shadow-sm"
                                            : "border-transparent bg-gray-50/50 hover:bg-gray-100/50"
                                        }`}
                                      >
                                        <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                                          userPermissions.includes(sub.id) ? "bg-primary/10 text-primary" : "bg-gray-200 text-gray-400"
                                        }`}>
                                          <span className="text-[10px]">{ICON_MAP[sub.icon]}</span>
                                        </div>
                                        <div className="flex-1">
                                          <p className={`text-[10px] font-bold ${userPermissions.includes(sub.id) ? "text-gray-800" : "text-gray-400"}`}>{sub.name}</p>
                                        </div>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                          userPermissions.includes(sub.id) ? "bg-primary border-primary text-white" : "border-gray-200 bg-white"
                                        }`}>
                                          {userPermissions.includes(sub.id) && <FaCheck size={6} />}
                                        </div>
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


                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 border-dashed p-12 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-200 mb-6">
                  <FaShieldAlt size={32} />
                </div>
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Protocol Configuration</h3>
                <p className="text-gray-400 text-[10px] font-bold uppercase mt-2 max-w-xs leading-relaxed">
                  Select an origin node and a personnel profile to initiate access configuration
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
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
      `}</style>
    </div>
  );
}

