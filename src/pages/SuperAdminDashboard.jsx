import { useEffect, useState } from "react";
import { FaCheck, FaTimes, FaTrash, FaUser, FaBriefcase } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Check if user is super admin
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      navigate("/super-admin-login");
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== "SUPER_ADMIN") {
      toast.error("You do not have permission to access this page");
      navigate("/branch-login");
      return;
    }
  }, [navigate]);

  // Fetch pending registrations
  useEffect(() => {
    fetchPendingRegistrations();
  }, []);

  const fetchPendingRegistrations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/super-admin/pending-registrations`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        setPendingRegistrations(data.data);
      } else {
        toast.error(data.message || "Failed to load pending registrations");
      }
    } catch (error) {
      console.error("Error fetching pending registrations:", error);
      toast.error("Failed to load pending registrations");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (registrationId, otp) => {
    if (!otp || otp.length !== 6) {
      toast.error("Please enter the correct 6-digit OTP");
      return;
    }

    try {
      setApprovingId(registrationId);
      const token = localStorage.getItem("token");

      // In real implementation, verify OTP first
      // For now, we'll directly approve
      const res = await fetch(
        `${API_BASE}/super-admin/approve-registration/${registrationId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (data.success) {
        toast.success("✅ Registration approved!");
        setPendingRegistrations(
          pendingRegistrations.filter((reg) => reg._id !== registrationId)
        );
        setApprovingId(null);
      } else {
        toast.error(data.message || "Failed to approve registration");
      }
    } catch (error) {
      console.error("Error approving registration:", error);
      toast.error("Failed to approve registration");
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (registrationId) => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    try {
      setRejectingId(registrationId);
      const token = localStorage.getItem("token");

      const res = await fetch(
        `${API_BASE}/super-admin/reject-registration/${registrationId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: rejectionReason }),
        }
      );

      const data = await res.json();

      if (data.success) {
        toast.success("✅ Registration rejected!");
        setPendingRegistrations(
          pendingRegistrations.filter((reg) => reg._id !== registrationId)
        );
        setRejectingId(null);
        setRejectionReason("");
      } else {
        toast.error(data.message || "Failed to reject registration");
      }
    } catch (error) {
      console.error("Error rejecting registration:", error);
      toast.error("Failed to reject registration");
    } finally {
      setRejectingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block">
          <div className="animate-spin text-primary text-4xl">⟳</div>
          <p className="text-gray-600 font-semibold mt-4">Loading pending registrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pt-20 md:pt-4 md:pl-20 px-4 md:px-6 pb-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Super Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Approve or reject pending user registrations</p>
        </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
          <p className="text-gray-600 text-sm"><FaUser className="inline mr-2" /> Total Pending</p>
          <p className="text-3xl font-bold text-blue-600">{pendingRegistrations.length}</p>
        </div>
        <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-lg">
          <p className="text-gray-600 text-sm"><FaCheck className="inline mr-2" /> Approved Today</p>
          <p className="text-3xl font-bold text-green-600">0</p>
        </div>
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg">
          <p className="text-gray-600 text-sm"><FaTimes className="inline mr-2" /> Rejected Today</p>
          <p className="text-3xl font-bold text-red-600">0</p>
        </div>
      </div>

      {/* Pending Registrations List */}
      {pendingRegistrations.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 p-8 rounded-lg text-center">
          <p className="text-gray-600 text-lg">No pending registrations</p>
          <p className="text-gray-500 text-sm mt-2">All users have been approved or rejected</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingRegistrations.map((registration) => (
            <div
              key={registration._id}
              className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:shadow-lg transition"
            >
              {/* Registration Details */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-xs text-gray-500 font-semibold">Username</p>
                  <p className="text-lg font-bold text-gray-900">{registration.username}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold">Email</p>
                  <p className="text-lg text-gray-700">{registration.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold">Branch Code</p>
                  <p className="text-lg font-bold text-primary">{registration.branchCode}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold">Role</p>
                  <p className="text-lg font-bold text-secondary flex items-center gap-2">
                    <FaBriefcase /> {registration.role}
                  </p>
                </div>
              </div>

              {/* OTP Display */}
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded mb-6">
                <p className="text-xs text-gray-600 font-semibold">OTP Code (Valid for 5 minutes)</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">{registration.otp}</p>
              </div>

              {/* Approval Section */}
              <div className="border-t pt-6">
                <div className="space-y-4">
                  {/* Approve Button */}
                  <div>
                    <button
                      onClick={() => handleApprove(registration._id, registration.otp)}
                      disabled={approvingId === registration._id}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <FaCheck />
                      {approvingId === registration._id
                        ? "Approving..."
                        : "Approve Registration"}
                    </button>
                  </div>

                  {/* Reject Section */}
                  <div>
                    <textarea
                      placeholder="Rejection reason (required to reject)..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-red-500 outline-none mb-3 resize-none"
                      rows="3"
                    />
                    <button
                      onClick={() => handleReject(registration._id)}
                      disabled={rejectingId === registration._id || !rejectionReason.trim()}
                      className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <FaTimes />
                      {rejectingId === registration._id ? "Rejecting..." : "Reject Registration"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
