import React, { useEffect, useState } from "react";
import { FaCheck, FaTimes, FaShieldAlt, FaHistory, FaBuilding, FaUser, FaChevronDown, FaChevronUp, FaExternalLinkAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

export default function SuperAdminCreditRequests() {
  const navigate = useNavigate();
  const [creditRequests, setCreditRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

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

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-secondary font-black uppercase tracking-widest text-[10px]">Accessing Requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-poppins text-secondary">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Compact Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center text-white shadow-lg">
              <FaShieldAlt size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-secondary tracking-tight uppercase">Credit Requests</h1>
              <p className="text-[10px] font-bold text-secondary/40 uppercase tracking-[0.2em]">Live Authorization Stream</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                <span className="text-[9px] font-black text-secondary/30 uppercase tracking-widest mr-2">Pending</span>
                <span className="text-sm font-black text-rose-500">{creditRequests.length}</span>
            </div>
            <button 
              onClick={fetchCreditRequests}
              className="p-2.5 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition shadow-sm text-secondary/40 hover:text-secondary"
            >
               <FaHistory size={14} />
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden">
          {creditRequests.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-500 mx-auto mb-4">
                <FaCheck size={32} />
              </div>
              <p className="text-secondary font-black text-lg">System Clear</p>
              <p className="text-secondary/40 text-[10px] font-bold uppercase tracking-widest">All authorization requests processed</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 text-[10px] font-black text-secondary/40 uppercase tracking-[0.2em] border-b border-gray-100">
                    <th className="px-6 py-5">Customer Name</th>
                    <th className="px-6 py-5">Branch</th>
                    <th className="px-6 py-5 text-right">Debit / Limit</th>
                    <th className="px-6 py-5 text-center">History</th>
                    <th className="px-6 py-5 text-center">Actions</th>
                    <th className="px-6 py-5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {creditRequests.map((req) => (
                    <React.Fragment key={req._id}>
                      <tr 
                        className={`group transition-all cursor-pointer ${expandedId === req._id ? "bg-secondary/5" : "hover:bg-gray-50/50"}`}
                        onClick={() => toggleExpand(req._id)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-secondary text-white flex items-center justify-center text-[10px] font-black shadow-sm">
                              {req.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-black text-secondary tracking-tight">{req.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-secondary/80 uppercase tracking-tighter">{req.branchId?.code}</span>
                            <span className="text-[9px] font-bold text-secondary/30">{req.branchId?.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-rose-600 italic">₹{req.debit?.toLocaleString()}</span>
                            <span className="text-[9px] font-bold text-secondary/30 tracking-widest uppercase">Limit: ₹{req.creditLimit?.toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${req.historyCount > 5 ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}>
                              {req.historyCount || 0} REQS
                           </span>
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                           <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={() => handleAction(req._id, "approve")}
                                disabled={processingId === req._id}
                                className="h-8 w-24 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shadow-emerald-500/20"
                              >
                                <FaCheck size={10} />
                                <span className="text-[9px] font-black uppercase tracking-widest">Approve</span>
                              </button>
                              <button 
                                onClick={() => handleAction(req._id, "reject")}
                                disabled={processingId === req._id}
                                className="h-8 w-24 border border-rose-100 text-rose-500 hover:bg-rose-50 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                              >
                                <FaTimes size={10} />
                                <span className="text-[9px] font-black uppercase tracking-widest">Reject</span>
                              </button>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-center text-secondary/20 group-hover:text-secondary/40 transition-colors">
                           {expandedId === req._id ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                        </td>
                      </tr>
                      
                      {/* Expandable Section */}
                      {expandedId === req._id && (
                        <tr className="bg-white border-x-4 border-secondary/10">
                          <td colSpan="6" className="px-12 py-6">
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-4">
                                   <p className="text-[10px] font-black text-secondary/30 uppercase tracking-[0.2em] border-b pb-2">Requester Details</p>
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-secondary/40">
                                         <FaUser size={14} />
                                      </div>
                                      <div>
                                         <p className="text-xs font-black text-secondary tracking-tight uppercase">{req.creditLimitRequestBy}</p>
                                         <p className="text-[9px] font-bold text-secondary/40 tracking-widest">STAFF MEMBER</p>
                                      </div>
                                   </div>
                                   <div>
                                      <p className="text-[9px] font-black text-secondary/30 uppercase tracking-widest mb-1">Time Stamp</p>
                                      <p className="text-xs font-bold text-secondary italic">{new Date(req.creditLimitRequestAt).toLocaleString()}</p>
                                   </div>
                                </div>

                                <div className="space-y-4">
                                   <p className="text-[10px] font-black text-secondary/30 uppercase tracking-[0.2em] border-b pb-2">Context & Metrics</p>
                                   <div className="grid grid-cols-2 gap-4">
                                      <div className="p-3 bg-gray-50 rounded-xl">
                                         <p className="text-[8px] font-black text-secondary/30 uppercase mb-1 tracking-widest">Over Limit By</p>
                                         <p className="text-sm font-black text-rose-500 italic">₹{(req.debit - req.creditLimit).toLocaleString()}</p>
                                      </div>
                                      <div className="p-3 bg-gray-50 rounded-xl">
                                         <p className="text-[8px] font-black text-secondary/30 uppercase mb-1 tracking-widest">Risk Factor</p>
                                         <p className="text-sm font-black text-amber-600">{Math.round((req.debit / req.creditLimit) * 100)}%</p>
                                      </div>
                                   </div>
                                   <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest">
                                      <FaHistory /> View Full History Log <FaExternalLinkAlt size={8} />
                                   </div>
                                </div>

                                <div className="bg-secondary/5 p-6 rounded-2xl flex flex-col justify-between border border-secondary/10">
                                   <p className="text-[10px] font-black text-secondary/40 uppercase tracking-widest leading-relaxed">
                                      Security Note: Approval will allow this branch to process the current order. Permanent credit limit remains unchanged.
                                   </p>
                                   <div className="mt-4 flex gap-2">
                                      <div className="h-1.5 flex-1 bg-rose-200 rounded-full overflow-hidden">
                                         <div className="h-full bg-rose-500" style={{ width: '80%' }}></div>
                                      </div>
                                      <span className="text-[9px] font-black text-rose-600">HIGH PRIORITY</span>
                                   </div>
                                </div>
                             </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Add CSS for hiding scrollbars but keeping functionality
const style = document.createElement('style');
style.textContent = `
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;
document.head.appendChild(style);
