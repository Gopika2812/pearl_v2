import { useEffect, useState, useCallback } from "react";
import { FaCheck, FaTimes, FaTrash, FaUser, FaBriefcase, FaShieldAlt, FaFilter, FaCalendar, FaBuilding, FaChartLine, FaMoneyBillWave, FaUndo, FaArrowUp, FaArrowDown, FaSync } from "react-icons/fa";
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

  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [stats, setStats] = useState({
    totalPurchase: 0,
    totalSales: 0,
    totalCreditNote: 0,
    totalDebitNote: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);

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

  // Fetch pending registrations and branches
  useEffect(() => {
    fetchPendingRegistrations();
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/super-admin/branches`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBranches(data.data);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const token = localStorage.getItem("token");
      const queryParams = new URLSearchParams();
      if (selectedBranch) queryParams.append("branchId", selectedBranch);
      if (startDate) queryParams.append("startDate", startDate);
      if (endDate) queryParams.append("endDate", endDate);

      const res = await fetch(`${API_BASE}/super-admin/dashboard-stats?${queryParams.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      } else {
        toast.error("Failed to load dashboard stats");
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Failed to load dashboard stats");
    } finally {
      setStatsLoading(false);
    }
  }, [selectedBranch, startDate, endDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleClearFilters = () => {
    setStartDate(today);
    setEndDate(today);
    setSelectedBranch("");
  };

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

      {/* Filter Section */}
      <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-[24px] mb-8">
        <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-2 text-secondary/70">
            <FaFilter />
            <span className="font-bold text-sm uppercase tracking-wider">Filters</span>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-48">
              <FaBuilding className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none font-medium"
              >
                <option value="">All Branches</option>
                {branches.map(b => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-40">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium"
                />
              </div>
              <span className="text-gray-400 font-bold">to</span>
              <div className="relative flex-1 md:w-40">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium"
                />
              </div>
            </div>

            <button
              onClick={handleClearFilters}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl font-bold transition-colors text-sm"
            >
              <FaSync />
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 relative">
        {statsLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-[24px]">
            <div className="animate-spin text-primary text-2xl">⟳</div>
          </div>
        )}
        <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-[24px] hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <FaMoneyBillWave size={64} />
          </div>
          <p className="text-secondary/40 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Purchase Invoice
          </p>
          <p className="text-3xl font-black text-secondary mt-4">₹ {stats.totalPurchase.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        
        <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-[24px] hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <FaChartLine size={64} />
          </div>
          <p className="text-secondary/40 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Sales Invoice
          </p>
          <p className="text-3xl font-black text-secondary mt-4">₹ {stats.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-[24px] hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <FaArrowUp size={64} />
          </div>
          <p className="text-secondary/40 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Credit Note
          </p>
          <p className="text-3xl font-black text-secondary mt-4">₹ {stats.totalCreditNote.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-[24px] hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <FaArrowDown size={64} />
          </div>
          <p className="text-secondary/40 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Debit Note
          </p>
          <p className="text-3xl font-black text-secondary mt-4">₹ {stats.totalDebitNote.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-black text-secondary tracking-tight">Pending Registrations</h2>
      </div>

      {/* Stats */}

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
