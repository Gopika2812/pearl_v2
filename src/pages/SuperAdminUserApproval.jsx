import { useState, useEffect } from "react";
import { FaUserCheck, FaUserTimes, FaCheck, FaTimes, FaShieldAlt, FaKey, FaMapMarkerAlt, FaIdBadge } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

const ROLES = [
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "SALES_OWNER", label: "Sales Owner" },
  { value: "SALESMAN", label: "Salesman" },
  { value: "DELIVERY_MAN", label: "Delivery Man" },
];

export default function SuperAdminUserApproval() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // stores registrationId of the action being processed

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/super-admin/pending-registrations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        // Initialize local role state for each user
        const usersWithRoles = data.data.map(user => ({
          ...user,
          selectedRole: user.role
        }));
        setPendingUsers(usersWithRoles);
      } else {
        toast.error(data.message || "Failed to fetch pending users");
      }
    } catch (error) {
      console.error("Fetch Pending Users Error:", error);
      toast.error("An error occurred while fetching pending registrations.");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (id, newRole) => {
    setPendingUsers(prev => prev.map(user => 
      user._id === id ? { ...user, selectedRole: newRole } : user
    ));
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
        setPendingUsers(prev => prev.filter(u => u._id !== user._id));
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
        setPendingUsers(prev => prev.filter(u => u._id !== user._id));
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
            User Approvals
          </h1>
          <p className="text-gray-500 mt-1">Review and approve new user registrations across all branches.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full font-semibold text-sm">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
          {pendingUsers.length} Pending Requests
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium font-outfit">Fetching registration requests...</p>
        </div>
      ) : pendingUsers.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100 px-6">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
            <FaUserCheck className="text-gray-300 text-3xl" />
          </div>
          <h3 className="text-xl font-bold text-secondary mb-2">No pending approvals</h3>
          <p className="text-gray-500 max-w-md mx-auto">When new users register through the application, their requests will appear here for your review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {pendingUsers.map((user) => (
            <div key={user._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6 md:p-8">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  {/* User Primary Info */}
                  <div className="flex items-start gap-5">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-primary/20 rounded-2xl flex items-center justify-center flex-shrink-0 text-primary border border-primary/20">
                      <FaIdBadge className="text-2xl" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-secondary">{user.name}</h4>
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
                          Requested: {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
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
                </div>
              </div>

              {/* Status Banner */}
              <div className="bg-gray-50 px-6 py-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  Authentication: OTP Verified 
                </span>
                <span className="text-[11px] font-bold text-secondary uppercase tracking-widest flex items-center gap-1.5">
                  <FaKey className="text-primary text-[10px]" /> Email: {user.email}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
