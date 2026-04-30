import { useEffect, useState } from "react";
import { FaCheck, FaTimes, FaUser, FaShieldAlt, FaHistory, FaBuilding, FaWhatsapp, FaCreditCard } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

export default function SuperAdminCreditRequests() {
  const navigate = useNavigate();
  const [creditRequests, setCreditRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

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
    fetchCreditRequests();
  }, [navigate]);

  const fetchCreditRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/customers/credit-requests/all`);
      const data = await res.json();
      if (data.success) {
        setCreditRequests(data.data || []);
      } else {
        toast.error(data.message || "Failed to load requests");
      }
    } catch (error) {
      console.error("Error fetching credit requests:", error);
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (customerId, action) => {
    try {
      setProcessingId(customerId);
      const endpoint = action === "approve" ? "approve-credit-bypass" : "reject-credit-bypass";
      
      const res = await fetch(`${API_BASE}/customers/${customerId}/${endpoint}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`✅ Credit bypass ${action}ed!`);
        setCreditRequests(prev => prev.filter(req => req._id !== customerId));
      } else {
        toast.error(data.message || `Failed to ${action} request`);
      }
    } catch (error) {
      console.error(`Error during ${action}:`, error);
      toast.error(`Failed to ${action} request`);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-secondary font-black uppercase tracking-widest text-xs">Accessing Requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-poppins text-secondary">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-secondary flex items-center gap-4 tracking-tight">
              <div className="p-3 bg-rose-500 rounded-2xl text-white shadow-xl shadow-rose-500/20">
                <FaShieldAlt size={24} />
              </div>
              Credit Limit Requests
            </h1>
            <p className="text-secondary/60 mt-1 font-medium text-sm italic">Review and authorize billing bypass requests across all branches</p>
          </div>
          
          <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
             <div className="text-right">
                <p className="text-[10px] font-black text-secondary/30 uppercase tracking-widest">Active Requests</p>
                <p className="text-xl font-black text-rose-500">{creditRequests.length}</p>
             </div>
             <div className="w-px h-8 bg-gray-100"></div>
             <FaHistory className="text-gray-300 text-xl" />
          </div>
        </div>

        {/* Requests List */}
        {creditRequests.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 p-20 rounded-[40px] text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mx-auto mb-4">
              <FaCheck size={32} />
            </div>
            <p className="text-secondary font-black text-lg">No Pending Requests</p>
            <p className="text-secondary/40 text-sm font-medium mt-1">All credit limit bypasses have been processed.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {creditRequests.map((req) => (
              <div
                key={req._id}
                className="bg-white border border-gray-100 rounded-[32px] overflow-hidden shadow-sm hover:shadow-xl hover:shadow-secondary/5 transition-all animate-in fade-in slide-in-from-bottom-2 duration-500"
              >
                {/* Branch Banner */}
                <div className="bg-secondary/5 px-8 py-2 flex items-center justify-between border-b border-gray-100">
                   <div className="flex items-center gap-2 text-[10px] font-black text-secondary/40 uppercase tracking-widest">
                      <FaBuilding size={10} />
                      {req.branchId?.name} ({req.branchId?.code})
                   </div>
                   <div className="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                      SECURE OVERRIDE REQ
                   </div>
                </div>

                <div className="p-8">
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-white text-xl font-black shadow-lg shadow-secondary/20">
                        {req.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-secondary tracking-tight">{req.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                           <FaWhatsapp className="text-emerald-500" size={12} />
                           <p className="text-xs font-bold text-secondary/40">{req.whatsapp}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                       <div className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm border border-amber-200">
                          <FaHistory size={12} />
                          <span className="text-[10px] font-black uppercase tracking-tighter">{req.historyCount || 0} Lifetime Requests</span>
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-5 bg-rose-50 rounded-2xl border border-rose-100 shadow-inner">
                      <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block mb-2">Current Debt</span>
                      <span className="text-2xl font-black text-rose-600 italic">₹{req.debit?.toLocaleString()}</span>
                    </div>
                    <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                      <span className="text-[9px] font-black text-secondary/30 uppercase tracking-widest block mb-2">Approved Limit</span>
                      <span className="text-2xl font-black text-secondary italic">₹{req.creditLimit?.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-secondary/5 rounded-2xl mb-8 border border-secondary/10">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-secondary shadow-sm">
                           <FaUser size={12} />
                        </div>
                        <div>
                           <p className="text-[9px] font-black text-secondary/40 uppercase tracking-widest">Requested By</p>
                           <p className="text-xs font-bold text-secondary">{req.creditLimitRequestBy}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] font-black text-secondary/40 uppercase tracking-widest">Date & Time</p>
                        <p className="text-xs font-bold text-secondary">{new Date(req.creditLimitRequestAt).toLocaleString()}</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleAction(req._id, "approve")}
                      disabled={processingId === req._id}
                      className="bg-emerald-500 text-white font-black py-4 rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95"
                    >
                      <FaCheck />
                      {processingId === req._id ? "Processing..." : "Approve Bypass"}
                    </button>
                    
                    <button
                      onClick={() => handleAction(req._id, "reject")}
                      disabled={processingId === req._id}
                      className="bg-white border-2 border-rose-200 text-rose-500 font-black py-4 rounded-2xl hover:bg-rose-50 transition-all disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95"
                    >
                      <FaTimes />
                      {processingId === req._id ? "Processing..." : "Reject Access"}
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
