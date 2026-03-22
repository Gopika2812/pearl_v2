import { useEffect, useState } from "react";
import { FaBuilding, FaCheck, FaShieldAlt, FaUser, FaUsers, FaUsersCog, FaLock, FaGlobe, FaShoppingCart, FaBox, FaFileAlt, FaDollarSign, FaTruck, FaHandshake, FaChartLine, FaLink, FaBook, FaChartBar, FaChevronRight } from "react-icons/fa";
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
  { id: "receipt", name: "Sales Receipt", icon: <FaDollarSign />, category: "Sales" },
  { id: "dispatch", name: "Loading & Dispatch", icon: <FaTruck />, category: "Logistics" },
  { id: "suppliers", name: "Suppliers (Creditors)", icon: <FaHandshake />, category: "Directory" },
  { id: "customers", name: "Customers (Debtors)", icon: <FaUsers />, category: "Directory" },
  { id: "journals", name: "Journal Master", icon: <FaBook />, category: "Accounts" },
  { id: "insights", name: "Insights & Analysis", icon: <FaChartLine />, category: "Reports" },
  { id: "summary", name: "General Summary", icon: <FaChartBar />, category: "Reports" },
  { id: "quick-links", name: "Quick Links", icon: <FaLink />, category: "General" },
  { id: "admin-branches", name: "Branch Management (Local)", icon: <FaBuilding />, category: "Admin" },
];

export default function SuperAdminControlSystem() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchUsers, setBranchUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userPermissions, setUserPermissions] = useState([]);

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
      setSelectedUser(null);
      setUserPermissions([]);
    }
  }, [selectedBranch]);

  // Set permissions when user selected
  useEffect(() => {
    if (selectedUser) {
      setUserPermissions(selectedUser.allowedPages || []);
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
        body: JSON.stringify({ allowedPages: userPermissions })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Permissions updated for ${selectedUser.username}`);
        // Update local state
        setBranchUsers(branchUsers.map(u => u._id === selectedUser._id ? { ...u, allowedPages: userPermissions } : u));
        setSelectedUser({ ...selectedUser, allowedPages: userPermissions });
      } else {
        toast.error(data.message || "Failed to update permissions");
      }
    } catch (err) {
      toast.error("Error saving permissions");
    } finally {
      setSaving(false);
    }
  };

  const categories = [...new Set(PAGE_DEFINITIONS.map(p => p.category))];

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
                <div className="bg-gray-900 p-6 flex items-center justify-between">
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

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {categories.map(category => (
                    <div key={category} className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                        <span className="w-2 h-2 bg-secondary rounded-full"></span>
                        {category} Pages
                      </h4>
                      <div className="space-y-2">
                        {PAGE_DEFINITIONS.filter(p => p.category === category).map(page => {
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
