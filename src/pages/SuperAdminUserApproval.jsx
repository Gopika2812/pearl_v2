import { useEffect, useState } from "react";
import { FaCheck, FaEdit, FaIdBadge, FaKey, FaMapMarkerAlt, FaSave, FaTimes, FaUserCheck } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

const ROLES = [
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "SALES_OWNER", label: "Sales Owner" },
  { value: "SALESMAN", label: "Salesman" },
  { value: "DELIVERY_MAN", label: "Delivery Man" },
];

const STATUS_COLORS = {
  PENDING: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", badge: "bg-yellow-100" },
  APPROVED: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", badge: "bg-green-100" },
  REJECTED: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", badge: "bg-red-100" },
};

export default function SuperAdminUserApproval() {
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null); // Track which user is being edited
  const [editingRole, setEditingRole] = useState(null); // Track the new role being edited

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/super-admin/all-registrations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        // Initialize local role state for each user
        const usersWithRoles = data.data.map(user => ({
          ...user,
          selectedRole: user.role
        }));
        setAllUsers(usersWithRoles);
      } else {
        toast.error(data.message || "Failed to fetch users");
      }
    } catch (error) {
      console.error("Fetch All Users Error:", error);
      toast.error("An error occurred while fetching registrations.");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (id, newRole) => {
    setAllUsers(prev => prev.map(user => 
      user._id === id ? { ...user, selectedRole: newRole } : user
    ));
  };

  const handleEditRole = (user) => {
    setEditingUserId(user._id);
    setEditingRole(user.selectedRole);
  };

  const handleSaveRoleChange = async (user) => {
    if (editingRole === user.selectedRole) {
      setEditingUserId(null);
      setEditingRole(null);
      return;
    }

    try {
      setActionLoading(user._id);
      const token = localStorage.getItem("token");
      
      // Get the BranchUser ID from the approved user
      // We need to fetch the BranchUser to get its ID first
      const branchUsers = await fetch(`${API_BASE}/branch-users?username=${user.username}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const branchUserData = await branchUsers.json();
      const branchUserId = branchUserData.data?.[0]?._id;

      if (!branchUserId) {
        toast.error("Could not find user record. Please refresh and try again.");
        return;
      }

      const res = await fetch(`${API_BASE}/super-admin/update-user/${branchUserId}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ role: editingRole }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`✅ Role updated to ${editingRole} for ${user.username}!`);
        setAllUsers(prev => prev.map(u => 
          u._id === user._id ? { ...u, selectedRole: editingRole, role: editingRole } : u
        ));
        setEditingUserId(null);
        setEditingRole(null);
      } else {
        toast.error(data.message || "Failed to update role");
      }
    } catch (error) {
      console.error("Save Role Change Error:", error);
      toast.error("An error occurred while saving role change.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (user) => {
    try {
      setActionLoading(user._id);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/super-admin/approve-registration/${user._id}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ role: user.selectedRole }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`✅ User ${user.username} approved successfully!`);
        setAllUsers(prev => prev.map(u => 
          u._id === user._id ? { ...u, status: "APPROVED" } : u
        ));
      } else {
        toast.error(data.message || "Failed to approve user");
      }
    } catch (error) {
      console.error("Approve User Error:", error);
      toast.error("An error occurred during approval.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (user) => {
    const reason = window.prompt(`Reason for rejecting ${user.username}:`, "Incorrect details provided");
    if (reason === null) return; // cancelled

    try {
      setActionLoading(user._id);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/super-admin/reject-registration/${user._id}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();
      if (data.success) {
        toast.warn(`❌ User ${user.username} rejected.`);
        setAllUsers(prev => prev.map(u => 
          u._id === user._id ? { ...u, status: "REJECTED" } : u
        ));
      } else {
        toast.error(data.message || "Failed to reject user");
      }
    } catch (error) {
      console.error("Reject User Error:", error);
      toast.error("An error occurred during rejection.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-secondary flex items-center gap-3">
            <FaUserCheck className="text-primary" />
            User Approvals & Management
          </h1>
          <p className="text-gray-500 mt-1">Review, approve, and manage user registrations and roles across all branches.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-full font-semibold border border-yellow-200">
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
            {allUsers.filter(u => u.status === "PENDING").length} Pending
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full font-semibold border border-green-200">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            {allUsers.filter(u => u.status === "APPROVED").length} Approved
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium font-outfit">Fetching all registrations...</p>
        </div>
      ) : allUsers.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100 px-6">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
            <FaUserCheck className="text-gray-300 text-3xl" />
          </div>
          <h3 className="text-xl font-bold text-secondary mb-2">No user registrations</h3>
          <p className="text-gray-500 max-w-md mx-auto">When new users register through the application, their requests will appear here for your review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {allUsers.map((user) => {
            const statusColor = STATUS_COLORS[user.status] || STATUS_COLORS.PENDING;
            const isEditing = editingUserId === user._id;
            const isPending = user.status === "PENDING";
            const isApproved = user.status === "APPROVED";
            const isRejected = user.status === "REJECTED";

            return (
              <div key={user._id} className={`bg-white rounded-2xl shadow-sm border ${statusColor.border} overflow-hidden hover:shadow-md transition-shadow`}>
                <div className="p-6 md:p-8">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    {/* User Primary Info */}
                    <div className="flex items-start gap-5 flex-1">
                      <div className={`w-16 h-16 ${statusColor.bg} rounded-2xl flex items-center justify-center flex-shrink-0 ${statusColor.text} border ${statusColor.border}`}>
                        <FaIdBadge className="text-2xl" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="text-xl font-bold text-secondary">{user.name}</h4>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColor.badge} ${statusColor.text}`}>
                            {user.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-y-2 gap-x-4 mt-2">
                          <span className="flex items-center gap-1.5 text-sm text-gray-500">
                            <FaUserCheck className="text-primary/70" />
                            @{user.username}
                          </span>
                          <span className="flex items-center gap-1.5 text-sm text-gray-500">
                            <FaMapMarkerAlt className="text-primary/70" />
                            Branch: <span className="font-bold text-secondary">{user.branchCode}</span>
                          </span>
                          <span className="text-xs text-gray-400">
                            {isPending && `Requested: ${new Date(user.createdAt).toLocaleDateString()}`}
                            {isApproved && `Approved: ${new Date(user.updatedAt).toLocaleDateString()}`}
                            {isRejected && `Rejected: ${new Date(user.updatedAt).toLocaleDateString()}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Area */}
                    {isPending && (
                      <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                        {/* Role Selection */}
                        <div className="w-full sm:w-48">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Verify Role</label>
                          <div className="relative">
                            <select
                              value={user.selectedRole}
                              onChange={(e) => handleRoleChange(user._id, e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-secondary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none transition"
                            >
                              {ROLES.map(role => (
                                <option key={role.value} value={role.value}>{role.label}</option>
                              ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                              <FaCheck className="text-[10px]" />
                            </div>
                          </div>
                        </div>

                        {/* Approve / Reject Buttons */}
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <button
                            onClick={() => handleReject(user)}
                            disabled={actionLoading === user._id}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-50 text-red-500 font-bold text-sm hover:bg-red-500 hover:text-white transition disabled:opacity-50"
                          >
                            <FaTimes />
                            Reject
                          </button>
                          <button
                            onClick={() => handleApprove(user)}
                            disabled={actionLoading === user._id}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-secondary shadow-lg shadow-primary/20 transform hover:-translate-y-0.5 transition disabled:opacity-50"
                          >
                            {actionLoading === user._id ? (
                              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                            ) : (
                              <FaCheck />
                            )}
                            Approve User
                          </button>
                        </div>
                      </div>
                    )}

                    {isApproved && (
                      <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                        {/* Role Display / Edit */}
                        {isEditing ? (
                          <>
                            <div className="w-full sm:w-48">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Change Role</label>
                              <div className="relative">
                                <select
                                  value={editingRole}
                                  onChange={(e) => setEditingRole(e.target.value)}
                                  className="w-full bg-green-50 border border-green-300 rounded-xl px-4 py-3 text-sm font-semibold text-green-700 focus:ring-2 focus:ring-green-300 focus:border-green-500 outline-none appearance-none transition"
                                >
                                  {ROLES.map(role => (
                                    <option key={role.value} value={role.value}>{role.label}</option>
                                  ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-green-600">
                                  <FaCheck className="text-[10px]" />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <button
                                onClick={() => handleSaveRoleChange(user)}
                                disabled={actionLoading === user._id}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-500 text-white font-bold text-sm hover:bg-green-600 transition disabled:opacity-50"
                              >
                                {actionLoading === user._id ? (
                                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                  <FaSave />
                                )}
                                Save
                              </button>
                              <button
                                onClick={() => setEditingUserId(null)}
                                disabled={actionLoading === user._id}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200 transition disabled:opacity-50"
                              >
                                <FaTimes />
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-center sm:text-right">
                              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Current Role</p>
                              <p className="text-lg font-bold text-secondary">{ROLES.find(r => r.value === user.selectedRole)?.label}</p>
                            </div>
                            <button
                              onClick={() => handleEditRole(user)}
                              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-50 text-blue-600 font-bold text-sm hover:bg-blue-600 hover:text-white transition"
                            >
                              <FaEdit />
                              Edit Role
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {isRejected && (
                      <div className="text-right">
                        <span className="inline-block px-4 py-2 rounded-xl bg-red-50 text-red-600 font-semibold text-sm">
                          ❌ Rejected
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Banner */}
                <div className={`${statusColor.bg} px-6 py-2 border-t ${statusColor.border} flex items-center justify-between`}>
                  <span className={`text-[11px] font-bold ${statusColor.text} uppercase tracking-widest`}>
                    Authentication: OTP Verified 
                  </span>
                  <span className={`text-[11px] font-bold ${statusColor.text} uppercase tracking-widest flex items-center gap-1.5`}>
                    <FaKey className="text-[10px]" /> Email: {user.email}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
