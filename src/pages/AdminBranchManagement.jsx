import { useEffect, useState } from "react";
import { FaBuilding, FaCheck, FaEnvelope, FaPhone, FaPlus, FaTimes, FaTrash, FaUser } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

export default function AdminBranchManagement() {
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [loading, setLoading] = useState(false);

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

      const res = await fetch(`${API_BASE}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    <div className="min-h-screen bg-gray-100 pt-20 md:pt-16 md:pl-64 px-4 md:px-6 pb-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-secondary to-primary text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <FaBuilding />
                Branch Management
              </h1>
              <p className="text-blue-100">Create and manage branches and user credentials</p>
            </div>
            <button
              onClick={() => setShowBranchModal(true)}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition"
            >
              <FaPlus />
              New Branch
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Branches List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-primary text-white p-4 font-bold">
                📍 Branches ({branches.length})
              </div>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {branches.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <p>No branches created yet</p>
                    <p className="text-sm mt-2">Click "New Branch" to get started</p>
                  </div>
                ) : (
                  branches.map((branch) => (
                    <div
                      key={branch._id}
                      onClick={() => {
                        setSelectedBranch(branch);
                        fetchUsersForBranch(branch._id);
                      }}
                      className={`p-4 cursor-pointer transition ${
                        selectedBranch?._id === branch._id
                          ? "bg-primary/10 border-l-4 border-primary"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="font-bold text-gray-900">{branch.name}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="inline-block bg-gray-100 px-2 py-1 rounded">
                          {branch.code}
                        </span>
                        {branch.isMainBranch && (
                          <span className="inline-block bg-green-100 text-green-700 px-2 py-1 rounded ml-2 text-xs font-bold">
                            MAIN
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {branch.location}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBranch(branch._id);
                        }}
                        className="text-red-500 hover:text-red-700 text-sm mt-2 flex items-center gap-1"
                      >
                        <FaTrash size={12} />
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Branch Details & Users */}
          <div className="lg:col-span-2">
            {selectedBranch ? (
              <div className="space-y-6">
                {/* Branch Details */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {selectedBranch.name}
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Code</p>
                      <p className="text-gray-900">{selectedBranch.code}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Location</p>
                      <p className="text-gray-900">{selectedBranch.location || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Phone</p>
                      <p className="text-gray-900 flex items-center gap-2">
                        <FaPhone size={14} />
                        {selectedBranch.phone || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Email</p>
                      <p className="text-gray-900 flex items-center gap-2">
                        <FaEnvelope size={14} />
                        {selectedBranch.email || "—"}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-600 font-semibold">Address</p>
                      <p className="text-gray-900">{selectedBranch.address || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Manager</p>
                      <p className="text-gray-900">{selectedBranch.manager || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Status</p>
                      <p className="text-gray-900 flex items-center gap-2">
                        {selectedBranch.status === "ACTIVE" ? (
                          <>
                            <FaCheck className="text-green-500" />
                            Active
                          </>
                        ) : (
                          <>
                            <FaTimes className="text-red-500" />
                            Inactive
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Users List */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                  <div className="bg-primary text-white p-4 font-bold flex justify-between items-center">
                    <span>👤 Users ({users.length})</span>
                    <button
                      onClick={() => setShowUserModal(true)}
                      className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded-lg text-sm flex items-center gap-2 transition"
                    >
                      <FaPlus size={12} />
                      Add User
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Username</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Email</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Role</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Status</th>
                          <th className="px-6 py-3 text-center font-bold text-gray-700">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {users.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                              <p>No users for this branch</p>
                              <p className="text-xs mt-2">Click "Add User" to create credentials</p>
                            </td>
                          </tr>
                        ) : (
                          users.map((user) => (
                            <tr key={user._id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 font-semibold text-gray-900">
                                <FaUser className="inline mr-2 text-primary" size={12} />
                                {user.username}
                              </td>
                              <td className="px-6 py-4 text-gray-700">{user.email || "—"}</td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  user.role === "ADMIN"
                                    ? "bg-red-100 text-red-700"
                                    : user.role === "MANAGER"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}>
                                  {user.role}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {user.status === "ACTIVE" ? (
                                  <span className="text-green-600 font-bold flex items-center gap-1">
                                    <FaCheck /> Active
                                  </span>
                                ) : (
                                  <span className="text-red-600 font-bold flex items-center gap-1">
                                    <FaTimes /> Inactive
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <button
                                  onClick={() => handleDeleteUser(user._id)}
                                  className="text-red-500 hover:text-red-700 font-bold"
                                >
                                  <FaTrash />
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
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                <FaBuilding className="text-6xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Select a branch to view details and manage users</p>
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
