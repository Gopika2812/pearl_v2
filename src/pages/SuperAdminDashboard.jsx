import { useEffect, useState } from "react";
import { FaCheck, FaTimes, FaTrash, FaUser, FaBriefcase, FaShieldAlt } from "react-icons/fa";
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
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-poppins text-secondary">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-10">
            <h1 className="text-2xl md:text-3xl font-black text-secondary flex items-center gap-4 tracking-tight">
              <div className="p-3 bg-secondary rounded-2xl text-white shadow-xl shadow-secondary/20">
                <FaShieldAlt size={24} />
              </div>
              Super Admin Dashboard
            </h1>
            <p className="text-secondary/60 mt-1 font-medium text-sm">System-wide operational overview and stats</p>
          </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-[24px]">
          <p className="text-secondary/40 text-[10px] font-black uppercase tracking-widest mb-2"><FaUser className="inline mr-2" /> Pending Verification</p>
          <p className="text-4xl font-black text-secondary">{pendingRegistrations.length}</p>
        </div>
        <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-[24px]">
          <p className="text-secondary/40 text-[10px] font-black uppercase tracking-widest mb-2"><FaCheck className="inline mr-2" /> Processed Today</p>
          <p className="text-4xl font-black text-emerald-500">0</p>
        </div>
        <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-[24px]">
          <p className="text-secondary/40 text-[10px] font-black uppercase tracking-widest mb-2"><FaTimes className="inline mr-2" /> Denied Today</p>
          <p className="text-4xl font-black text-rose-500">0</p>
        </div>
      </div>

      {/* Pending Registrations List */}
      {pendingRegistrations.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 p-20 rounded-[40px] text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-200 mx-auto mb-4">
            <FaCheck size={32} />
          </div>
          <p className="text-secondary font-black text-lg">Clear Queue</p>
          <p className="text-secondary/40 text-sm font-medium mt-1">All registration requests have been processed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {pendingRegistrations.map((registration) => (
            <div
              key={registration._id}
              className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm hover:shadow-xl hover:shadow-secondary/5 transition-all animate-in fade-in slide-in-from-bottom-2"
            >
              <div className="flex justify-between items-start mb-8">
                 <div className="flex items-center gap-4">
                   <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-white text-xl font-black">
                     {registration.username.charAt(0).toUpperCase()}
                   </div>
                   <div>
                     <h3 className="text-lg font-black text-secondary tracking-tight">{registration.username}</h3>
                     <p className="text-xs font-bold text-secondary/40 truncate max-w-[200px]">{registration.email}</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <span className="text-[10px] font-black text-secondary/30 uppercase tracking-widest block mb-1">Assigned Role</span>
                   <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                     {registration.role}
                   </span>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <span className="text-[9px] font-black text-secondary/30 uppercase tracking-widest block mb-2">Branch</span>
                  <span className="text-sm font-black text-secondary">{registration.branchCode}</span>
                </div>
                <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50">
                  <span className="text-[9px] font-black text-amber-600/40 uppercase tracking-widest block mb-2">OTP Pin</span>
                  <span className="text-xl font-black text-amber-600 tracking-widest">{registration.otp}</span>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-gray-50">
                <button
                  onClick={() => handleApprove(registration._id, registration.otp)}
                  disabled={approvingId === registration._id}
                  className="w-full bg-secondary text-white font-black py-4 rounded-2xl hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/10 disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  <FaCheck />
                  {approvingId === registration._id ? "Processing..." : "Approve User"}
                </button>
                
                <div className="relative group">
                  <textarea
                    placeholder="Enter reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-rose-200 focus:bg-white transition-all outline-none text-xs font-bold text-secondary mb-3 resize-none min-h-[80px]"
                  />
                  <button
                    onClick={() => handleReject(registration._id)}
                    disabled={rejectingId === registration._id || !rejectionReason.trim()}
                    className="w-full text-rose-500 hover:bg-rose-50 font-black py-3 rounded-xl transition-all disabled:opacity-30 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
                  >
                    <FaTimes />
                    {rejectingId === registration._id ? "Rejecting..." : "Reject User"}
                  </button>
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
