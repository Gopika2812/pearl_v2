import { useEffect, useState } from "react";
import { FaBuilding, FaCheck, FaEnvelope, FaPhone, FaPlus, FaTimes, FaTrash, FaUser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

export default function AdminBranchManagement() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [loading, setLoading] = useState(false);

  // Check if user is ADMIN
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      // Not logged in, redirect to login
      navigate("/branch-login");
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== "ADMIN") {
      // Not ADMIN, redirect to home
      toast.error("You do not have permission to access this page");
      navigate("/branch-home");
      return;
    }
  }, [navigate]);

  // Branch Form
  const [branchForm, setBranchForm] = useState({
    name: "",
    code: "",
    location: "",
    address: "",
    phone: "",
    email: "",
    manager: "",
    isMainBranch: false,
  });

  // User Form
  const [userForm, setUserForm] = useState({
    username: "",
    password: "",
    email: "",
    role: "STAFF",
  });

  // Fetch branches
  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_BASE}/branches`);
      const data = await res.json();
      if (data.success) {
        setBranches(data.data);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast.error("Failed to load branches");
    }
  };

  const fetchUsersForBranch = async (branchId) => {
    try {
      const res = await fetch(`${API_BASE}/branch-users/branch/${branchId}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    }
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!branchForm.name || !branchForm.code) {
        toast.error("Branch name and code are required");
        setLoading(false);
        return;
      }

      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/branches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(branchForm),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`✅ Branch created: ${data.data.name}`);
        setBranches([...branches, data.data]);
        setShowBranchModal(false);
        setBranchForm({
          name: "",
          code: "",
          location: "",
          address: "",
          phone: "",
          email: "",
          manager: "",
          isMainBranch: false,
        });
      } else {
        toast.error(data.message || "Failed to create branch");
      }
    } catch (error) {
      console.error("Error creating branch:", error);
      toast.error("Error creating branch");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!userForm.username || !userForm.password) {
        toast.error("Username and password are required");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/branch-users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...userForm,
          branchId: selectedBranch._id,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`✅ User created: ${data.data.username}`);
        setUsers([
          ...users,
          {
            _id: data.data.id,
            username: data.data.username,
            email: data.data.email,
            role: data.data.role,
            status: "ACTIVE",
          },
        ]);
        setShowUserModal(false);
        setUserForm({
          username: "",
          password: "",
          email: "",
          role: "STAFF",
        });
      } else {
        toast.error(data.message || "Failed to create user");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error("Error creating user");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBranch = async (branchId) => {
    if (!window.confirm("Are you sure you want to delete this branch?")) return;

    try {
      const res = await fetch(`${API_BASE}/branches/${branchId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Branch deleted");
        setBranches(branches.filter((b) => b._id !== branchId));
        setSelectedBranch(null);
        setUsers([]);
      } else {
        toast.error(data.message || "Failed to delete branch");
      }
    } catch (error) {
      console.error("Error deleting branch:", error);
      toast.error("Error deleting branch");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      const res = await fetch(`${API_BASE}/branch-users/${userId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("User deleted");
        setUsers(users.filter((u) => u._id !== userId));
      } else {
        toast.error(data.message || "Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Error deleting user");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-8 md:pl-24 px-4 md:px-8 pb-10 font-poppins">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-secondary text-white rounded-[32px] shadow-2xl p-10 mb-10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12 transition-transform group-hover:scale-110 duration-500">
            <FaBuilding size={120} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h1 className="text-4xl font-black mb-2 flex items-center gap-4 uppercase tracking-tighter">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20">
                  <FaBuilding />
                </div>
                Branch Terminal
              </h1>
              <p className="text-white/60 font-medium">Provision and manage infrastructure nodes and access protocols</p>
            </div>
            <button
              onClick={() => setShowBranchModal(true)}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 transition-all shadow-xl shadow-primary/20 uppercase tracking-widest text-xs"
            >
              <FaPlus />
              Initialize Node
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Branches List */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden sticky top-24">
              <div className="bg-gray-50/50 p-6 border-b border-gray-100 flex items-center justify-between">
                <span className="font-black text-xs uppercase tracking-widest text-secondary/40">📍 Active Nodes ({branches.length})</span>
              </div>
              <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto no-scrollbar">
                {branches.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-secondary/40 font-bold text-sm">No active nodes detected</p>
                  </div>
                ) : (
                  branches.map((branch) => (
                    <div
                      key={branch._id}
                      onClick={() => {
                        setSelectedBranch(branch);
                        fetchUsersForBranch(branch._id);
                      }}
                      className={`p-6 cursor-pointer transition-all relative group ${
                        selectedBranch?._id === branch._id
                          ? "bg-secondary text-white"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className={`font-black text-lg ${selectedBranch?._id === branch._id ? "text-white" : "text-secondary"}`}>{branch.name}</div>
                        {branch.isMainBranch && (
                          <span className={`text-[8px] font-black px-2 py-1 rounded ${
                            selectedBranch?._id === branch._id ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                          }`}>
                            HQ
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                          selectedBranch?._id === branch._id ? "border-white/20 text-white/60" : "border-gray-200 text-secondary/40"
                        }`}>
                          {branch.code}
                        </span>
                        <span className={`text-[10px] font-bold ${
                          selectedBranch?._id === branch._id ? "text-white/40" : "text-secondary/40"
                        }`}>
                          {branch.location}
                        </span>
                      </div>
                      <div className="mt-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBranch(branch._id);
                          }}
                          className={`p-2 rounded-lg transition-colors ${
                            selectedBranch?._id === branch._id ? "bg-white/10 text-white hover:bg-rose-500" : "bg-gray-100 text-gray-400 hover:text-rose-500"
                          }`}
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                      {selectedBranch?._id === branch._id && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Branch Details & Users */}
          <div className="lg:col-span-8">
            {selectedBranch ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Branch Details */}
                <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-8">
                  <div className="flex items-center gap-5 mb-10">
                    <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-white text-2xl font-black shadow-xl shadow-secondary/20">
                      {selectedBranch.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-secondary tracking-tighter">
                        {selectedBranch.name}
                      </h2>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-bold text-secondary/40 uppercase tracking-widest">{selectedBranch.code}</span>
                        <div className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest ${
                          selectedBranch.status === "ACTIVE" ? "text-primary" : "text-rose-500"
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${selectedBranch.status === "ACTIVE" ? "bg-primary" : "bg-rose-500"}`} />
                          {selectedBranch.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-10 gap-x-12">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-secondary/30 uppercase tracking-widest">Communication Protocol</label>
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-4 text-sm font-bold text-secondary">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-secondary/40"><FaPhone size={12} /></div>
                          {selectedBranch.phone || "—"}
                        </div>
                        <div className="flex items-center gap-4 text-sm font-bold text-secondary">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-secondary/40"><FaEnvelope size={12} /></div>
                          {selectedBranch.email || "—"}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-secondary/30 uppercase tracking-widest">Operational Metadata</label>
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl">
                          <span className="text-[10px] font-black text-secondary/40 uppercase">Location</span>
                          <span className="text-xs font-bold">{selectedBranch.location || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl">
                          <span className="text-[10px] font-black text-secondary/40 uppercase">Manager</span>
                          <span className="text-xs font-bold">{selectedBranch.manager || "—"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-black text-secondary/30 uppercase tracking-widest">Physical Coordinates</label>
                      <div className="mt-2 p-5 bg-gray-50 rounded-2xl text-sm font-bold text-secondary leading-relaxed border border-gray-100">
                        {selectedBranch.address || "No address data available"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Users List */}
                <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-secondary p-6 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                        <FaUser size={18} />
                      </div>
                      <div>
                        <h3 className="text-white font-black uppercase tracking-widest text-sm">Access Credentials</h3>
                        <p className="text-white/40 text-[10px] font-bold">Total Personnel: {users.length}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowUserModal(true)}
                      className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
                    >
                      <FaPlus size={10} />
                      New Profile
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50/50">
                          <th className="px-8 py-5 text-left text-[10px] font-black text-secondary/40 uppercase tracking-[0.2em]">Personnel</th>
                          <th className="px-8 py-5 text-left text-[10px] font-black text-secondary/40 uppercase tracking-[0.2em]">Contact</th>
                          <th className="px-8 py-5 text-left text-[10px] font-black text-secondary/40 uppercase tracking-[0.2em]">Protocol</th>
                          <th className="px-8 py-5 text-left text-[10px] font-black text-secondary/40 uppercase tracking-[0.2em]">Status</th>
                          <th className="px-8 py-5 text-center text-[10px] font-black text-secondary/40 uppercase tracking-[0.2em]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {users.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="px-8 py-16 text-center">
                              <p className="text-secondary/40 font-bold text-sm italic">No personnel records found for this node</p>
                            </td>
                          </tr>
                        ) : (
                          users.map((user) => (
                            <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-8 py-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                                    {user.username.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-bold text-secondary">{user.username}</span>
                                </div>
                              </td>
                              <td className="px-8 py-5 text-sm text-secondary/60 font-medium">{user.email || "—"}</td>
                              <td className="px-8 py-5">
                                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                  user.role === "ADMIN"
                                    ? "bg-rose-50 text-rose-600 border border-rose-100"
                                    : user.role === "MANAGER"
                                    ? "bg-primary/10 text-primary border border-primary/20"
                                    : "bg-gray-100 text-gray-600 border border-gray-200"
                                }`}>
                                  {user.role}
                                </span>
                              </td>
                              <td className="px-8 py-5">
                                <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${
                                  user.status === "ACTIVE" ? "text-primary" : "text-rose-500"
                                }`}>
                                  <div className={`w-1.5 h-1.5 rounded-full ${user.status === "ACTIVE" ? "bg-primary" : "bg-rose-500"}`} />
                                  {user.status}
                                </span>
                              </td>
                              <td className="px-8 py-5 text-center">
                                <button
                                  onClick={() => handleDeleteUser(user._id)}
                                  className="p-2 text-gray-300 hover:text-rose-500 transition-colors"
                                >
                                  <FaTrash size={14} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-24 text-center flex flex-col items-center justify-center">
                <div className="w-24 h-24 rounded-[32px] bg-gray-50 flex items-center justify-center text-gray-200 mb-8">
                  <FaBuilding size={48} />
                </div>
                <h2 className="text-2xl font-black text-secondary mb-2 uppercase tracking-tighter">Node Directory</h2>
                <p className="text-secondary/40 font-medium max-w-sm mx-auto">Select an infrastructure node from the sidebar to initialize management protocols.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="bg-gradient-to-r from-secondary to-primary text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <FaBuilding />
                Create New Branch
              </h2>
            </div>

            <form onSubmit={handleCreateBranch} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Branch Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pearl Foods - Tirunelveli"
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Branch Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PF-TRV"
                    value={branchForm.code}
                    onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tirunelveli"
                    value={branchForm.location}
                    onChange={(e) => setBranchForm({ ...branchForm, location: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="9429692970"
                    value={branchForm.phone}
                    onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="branch@email.com"
                    value={branchForm.email}
                    onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Manager
                  </label>
                  <input
                    type="text"
                    placeholder="Manager Name"
                    value={branchForm.manager}
                    onChange={(e) => setBranchForm({ ...branchForm, manager: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Address
                  </label>
                  <textarea
                    placeholder="Full address"
                    value={branchForm.address}
                    onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    rows="3"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mainBranch"
                    checked={branchForm.isMainBranch}
                    onChange={(e) => setBranchForm({ ...branchForm, isMainBranch: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="mainBranch" className="font-bold text-gray-700">
                    Mark as Main Branch
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-primary text-white py-2 rounded-lg font-bold hover:bg-opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <FaCheck />
                  {loading ? "Creating..." : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="bg-gradient-to-r from-secondary to-primary text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <FaUser />
                Add User to {selectedBranch?.name}
              </h2>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. admin"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="user@email.com"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="STAFF">Staff</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-primary text-white py-2 rounded-lg font-bold hover:bg-opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <FaCheck />
                  {loading ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
