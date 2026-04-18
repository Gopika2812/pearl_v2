import { useEffect, useState } from "react";
import { FaEdit, FaTrash, FaUserShield, FaSearch, FaFilter, FaTimes, FaSave, FaLock, FaChevronRight, FaChevronLeft } from "react-icons/fa";
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

export default function SuperAdminUserApproval() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setEditingData({
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      role: user.role || "STAFF",
      status: user.status || "ACTIVE",
      password: ""
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      setActionLoading(editingUser._id);
      const token = localStorage.getItem("token");
      
      const payload = { ...editingData };
      if (!payload.password) delete payload.password;

      const res = await fetch(`${API_BASE}/super-admin/update-user/${editingUser._id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`✅ User ${editingUser.username} updated!`);
        setUsers(users.map(u => u._id === editingUser._id ? { ...u, ...data.data } : u));
        setIsEditModalOpen(false);
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
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.branch?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 font-outfit">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          <FaUserShield className="text-indigo-600" />
          Full User Management
        </h1>
        <p className="text-slate-500 font-bold mt-1 uppercase tracking-widest text-[10px]">Manage all registered system users in one place</p>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Search by username, name, branch or email..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <FaFilter className="text-slate-400" />
          <select 
            className="flex-1 md:w-48 bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="ALL">ALL ROLES</option>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Loading User Records...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-32 text-center text-slate-400">
            <FaUserShield className="mx-auto text-5xl mb-4 opacity-20" />
            <p className="text-xs font-black uppercase tracking-widest">No matching users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">User Details</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Branch & Location</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Role & Access</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((user) => (
                  <tr key={user._id} className="hover:bg-indigo-50/30 transition-colors group">
                    {/* User Info */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-200">
                          {user.name?.charAt(0) || user.username?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-800 truncate">{user.name || "Untitled User"}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                            <span className="text-indigo-400 italic">@{user.username}</span> • {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Branch Info */}
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-700">{user.branch?.name || "Independent"}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{user.branch?.code || "NO CODE"} • {user.branch?.location || "N/A"}</span>
                      </div>
                    </td>

                    {/* Role Info */}
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase inline-block ${
                        user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' 
                        ? "bg-indigo-100 text-indigo-700" 
                        : "bg-slate-100 text-slate-600"
                      }`}>
                        {user.role}
                      </span>
                    </td>

                    {/* Status Info */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${user.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                        <span className={`text-[10px] font-black tracking-widest uppercase ${user.status === 'ACTIVE' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {user.status}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEdit(user)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                          title="Edit User"
                        >
                          <FaEdit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user)}
                          disabled={actionLoading === user._id}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                          title="Delete User"
                        >
                          <FaTrash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 md:p-12 relative">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="absolute right-10 top-10 w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <FaTimes />
              </button>

              <div className="mb-10 text-center">
                <div className="w-20 h-20 bg-indigo-100 rounded-[2rem] flex items-center justify-center text-indigo-600 mx-auto mb-6">
                  <FaEdit size={32} />
                </div>
                <h2 className="text-3xl font-black text-slate-800">Edit User Profile</h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-2">Updating settings for @{editingUser.username}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
                   <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-2">Full Legal Name</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                      value={editingData.name}
                      onChange={(e) => setEditingData({...editingData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-2">Login Username</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                      value={editingData.username}
                      onChange={(e) => setEditingData({...editingData, username: e.target.value})}
                    />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-2">Email Address</label>
                    <input 
                      type="email"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all transition-all"
                      value={editingData.email}
                      onChange={(e) => setEditingData({...editingData, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-2">System Role</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none"
                      value={editingData.role}
                      onChange={(e) => setEditingData({...editingData, role: e.target.value})}
                    >
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-2">Access Status</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none"
                      value={editingData.status}
                      onChange={(e) => setEditingData({...editingData, status: e.target.value})}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="col-span-full">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-2">Reset Password (Optional)</label>
                    <div className="relative">
                      <FaLock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input 
                        type="password"
                        placeholder="Leave blank to keep current password..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-12 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        value={editingData.password}
                        onChange={(e) => setEditingData({...editingData, password: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12 flex gap-4">
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-5 rounded-[2rem] bg-slate-100 text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Discard
                </button>
                <button 
                  onClick={handleSaveEdit}
                  disabled={actionLoading}
                  className="flex-[2] py-5 rounded-[2rem] bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-3"
                >
                  {actionLoading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <FaSave />}
                  Apply Updates
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
