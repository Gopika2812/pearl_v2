import { useEffect, useState } from "react";
import { FaEdit, FaTrash, FaUserShield, FaSearch, FaFilter, FaTimes, FaSave, FaLock, FaChevronRight, FaChevronLeft, FaShieldAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

const ROLES = [
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "STAFF", label: "Staff" },
  { value: "SALES_OWNER", label: "Sales Owner" },
  { value: "SALESMAN", label: "Salesman" },
  { value: "DELIVERY_MAN", label: "Delivery Man" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

export default function SuperAdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [branches, setBranches] = useState([]);
  
  // Inline Edit State
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_BASE}/branches`);
      const data = await res.json();
      if (data.success) setBranches(data.data || []);
    } catch (err) {
      console.error("Fetch Branches Error:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/branch-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      } else {
        toast.error(data.message || "Failed to fetch users");
      }
    } catch (error) {
      console.error("Fetch Users Error:", error);
      toast.error("Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Are you absolutely sure you want to PERMANENTLY delete user "${user.username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setActionLoading(user._id);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/branch-users/${user._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`🗑️ User ${user.username} deleted successfully`);
        setUsers(users.filter(u => u._id !== user._id));
      } else {
        toast.error(data.message || "Failed to delete user");
      }
    } catch (error) {
      console.error("Delete User Error:", error);
      toast.error("Error deleting user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartEdit = (user) => {
    setEditingId(user._id);
    setEditingData({
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      role: user.role || "STAFF",
      status: user.status || "ACTIVE",
      password: ""
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingData({});
  };

  const handleSaveEdit = async (userId) => {
    try {
      setActionLoading(userId);
      const token = localStorage.getItem("token");
      
      const payload = { ...editingData };
      if (!payload.password) delete payload.password;

      const res = await fetch(`${API_BASE}/super-admin/update-user/${userId}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`✅ User updated successfully!`);
        setUsers(users.map(u => u._id === userId ? { ...u, ...data.data } : u));
        handleCancelEdit();
      } else {
        toast.error(data.message || "Update failed");
      }
    } catch (error) {
      console.error("Update Error:", error);
      toast.error("Connection error during update");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.branch?.name && u.branch.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchesBranch = branchFilter === "ALL" || u.branch?._id === branchFilter;
    
    return matchesSearch && matchesRole && matchesBranch;
  });

  return (
    <div className="min-h-screen bg-white p-4 md:p-6 pb-10 w-full font-poppins text-secondary">
      <div className="w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <FaShieldAlt className="text-primary text-sm" />
              </span>
              User Management
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              System-wide personnel database and access control
              <span className="ml-2 bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                {filteredUsers.length} active records
              </span>
            </p>
          </div>
        </div>

      {/* Toolbar - Highly Responsive */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <div className="relative w-full lg:max-w-[400px]">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
          <input 
            type="text"
            placeholder="Search personnel database..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-12 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all text-secondary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">
            <FaFilter className="text-primary/60" /> Filters
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select 
              className="bg-gray-50 border border-gray-200 rounded-lg py-2 px-4 text-xs font-bold text-secondary outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all cursor-pointer min-w-[150px]"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">ALL ROLES</option>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label.toUpperCase()}</option>)}
            </select>
            <select 
              className="bg-gray-50 border border-gray-200 rounded-lg py-2 px-4 text-xs font-bold text-secondary outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all cursor-pointer min-w-[150px]"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="ALL">ALL BRANCHES</option>
              {branches.map(b => <option key={b._id} value={b._id}>{b.name.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Main Container - Responsive Layout */}
      <div className="relative">
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-32 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-gray-100 border-t-primary rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Accessing records...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-32 text-center text-gray-400">
            <FaShieldAlt className="mx-auto text-4xl mb-4 opacity-10" />
            <p className="text-[10px] font-black uppercase tracking-widest">No matching personnel found</p>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE VIEW */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Personnel Identity</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Deployment Origin</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Access Protocol</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredUsers.map((user) => {
                      const isEditing = editingId === user._id;
                      return (
                        <tr key={user._id} className={`transition-colors ${isEditing ? "bg-primary/5" : "hover:bg-gray-50/70"}`}>
                          {/* User Info */}
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <div className="space-y-2 max-w-[280px]">
                                <input 
                                  type="text"
                                  value={editingData.name}
                                  onChange={(e) => setEditingData({...editingData, name: e.target.value})}
                                  placeholder="Full Name"
                                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-primary"
                                />
                                <div className="flex gap-2">
                                  <input 
                                    type="text"
                                    value={editingData.username}
                                    onChange={(e) => setEditingData({...editingData, username: e.target.value})}
                                    placeholder="Username"
                                    className="w-1/2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:border-primary"
                                  />
                                  <input 
                                    type="password"
                                    value={editingData.password}
                                    onChange={(e) => setEditingData({...editingData, password: e.target.value})}
                                    placeholder="New Password (optional)"
                                    className="w-1/2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:border-primary"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                                  {user.name?.charAt(0) || user.username?.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-gray-800 truncate">{user.name || "Untitled User"}</p>
                                  <p className="text-[10px] font-medium text-gray-400 truncate">
                                    <span className="text-primary/60 font-black">@{user.username}</span> • {user.email}
                                  </p>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Branch Info */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-gray-700">{user.branch?.name || "Independent"}</span>
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{user.branch?.code || "SYSTEM"}</span>
                            </div>
                          </td>

                          {/* Role Info */}
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <select 
                                className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-[10px] font-black outline-none focus:border-primary"
                                value={editingData.role}
                                onChange={(e) => setEditingData({...editingData, role: e.target.value})}
                              >
                                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label.toUpperCase()}</option>)}
                              </select>
                            ) : (
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                                user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' 
                                ? "bg-rose-50 text-rose-600 border-rose-100" 
                                : "bg-primary/5 text-primary border-primary/10"
                              }`}>
                                {user.role}
                              </span>
                            )}
                          </td>

                          {/* Status Info */}
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <select 
                                className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-[10px] font-black outline-none focus:border-primary"
                                value={editingData.status}
                                onChange={(e) => setEditingData({...editingData, status: e.target.value})}
                              >
                                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label.toUpperCase()}</option>)}
                              </select>
                            ) : (
                              <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${user.status === 'ACTIVE' ? 'text-primary' : 'text-gray-400'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'ACTIVE' ? 'bg-primary' : 'bg-gray-300'}`}></div>
                                {user.status}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button 
                                    onClick={() => handleSaveEdit(user._id)}
                                    disabled={actionLoading === user._id}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
                                  >
                                    {actionLoading === user._id ? (
                                      <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                      <FaSave size={12} />
                                    )}
                                  </button>
                                  <button 
                                    onClick={handleCancelEdit}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:bg-gray-200 transition-all"
                                  >
                                    <FaTimes size={12} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => handleStartEdit(user)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all"
                                  >
                                    <FaEdit size={12} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteUser(user)}
                                    disabled={actionLoading === user._id}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all"
                                  >
                                    <FaTrash size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MOBILE CARD VIEW */}
            <div className="lg:hidden space-y-3">
              {filteredUsers.map((user) => {
                const isEditing = editingId === user._id;
                return (
                  <div key={user._id} className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 transition-all ${isEditing ? "border-primary bg-primary/5" : ""}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-secondary text-white flex items-center justify-center font-black text-sm">
                          {user.name?.charAt(0) || user.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          {isEditing ? (
                            <input 
                              type="text"
                              value={editingData.name}
                              onChange={(e) => setEditingData({...editingData, name: e.target.value})}
                              className="bg-white border border-gray-200 rounded px-2 py-1 text-xs font-bold w-full"
                            />
                          ) : (
                            <p className="text-sm font-black text-gray-800">{user.name || "Untitled"}</p>
                          )}
                          <p className="text-[10px] font-bold text-primary/60">@{user.username}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {isEditing ? (
                          <select 
                            className="bg-white border border-gray-200 rounded px-1 py-0.5 text-[9px] font-black outline-none"
                            value={editingData.status}
                            onChange={(e) => setEditingData({...editingData, status: e.target.value})}
                          >
                            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        ) : (
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${user.status === 'ACTIVE' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                            {user.status}
                          </span>
                        )}
                        <p className="text-[9px] font-black text-gray-400 mt-1 uppercase">{user.branch?.code || "SYSTEM"}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-4 border-t border-gray-50">
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Role Protocol</p>
                        {isEditing ? (
                          <select 
                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-[10px] font-bold outline-none"
                            value={editingData.role}
                            onChange={(e) => setEditingData({...editingData, role: e.target.value})}
                          >
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        ) : (
                          <p className="text-[11px] font-black text-gray-700">{user.role}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Branch Origin</p>
                        <p className="text-[11px] font-black text-gray-700 truncate">{user.branch?.name || "Independent"}</p>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="py-4 space-y-2 border-t border-gray-50">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Credentials</p>
                          <div className="grid grid-cols-2 gap-2">
                            <input 
                              type="text"
                              value={editingData.username}
                              onChange={(e) => setEditingData({...editingData, username: e.target.value})}
                              placeholder="Username"
                              className="bg-white border border-gray-200 rounded px-2 py-1.5 text-[10px] font-bold"
                            />
                            <input 
                              type="password"
                              value={editingData.password}
                              onChange={(e) => setEditingData({...editingData, password: e.target.value})}
                              placeholder="New Password"
                              className="bg-white border border-gray-200 rounded px-2 py-1.5 text-[10px] font-bold"
                            />
                          </div>
                      </div>
                    )}

                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                      {isEditing ? (
                        <>
                          <button 
                            onClick={() => handleSaveEdit(user._id)}
                            disabled={actionLoading === user._id}
                            className="flex-1 bg-primary text-white py-2 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                          >
                            {actionLoading === user._id ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <FaSave />} Save
                          </button>
                          <button 
                            onClick={handleCancelEdit}
                            className="flex-1 bg-gray-100 text-gray-400 py-2 rounded-xl font-black text-[10px] uppercase"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleStartEdit(user)}
                            className="flex-1 bg-primary/10 text-primary py-2 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2"
                          >
                            <FaEdit /> Edit Profile
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user)}
                            className="flex-1 bg-rose-50 text-rose-600 py-2 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2"
                          >
                            <FaTrash /> Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  </div>
  );
}




