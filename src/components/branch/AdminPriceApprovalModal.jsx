import { useEffect, useState } from "react";
import { FaCheck, FaTimes, FaUserLock } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";

export default function AdminPriceApprovalModal({ branchId, isOpen, onClose }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/price-requests/branch/${branchId}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      if (data.success) {
        setRequests(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch requests", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && branchId) {
      fetchRequests();
      // Auto-refresh every 10 seconds while modal is open
      const interval = setInterval(fetchRequests, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen, branchId]);

  const handleStatusUpdate = async (id, status) => {
    try {
      const res = await fetch(`${API_BASE}/price-requests/${id}/status`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Request ${status.toLowerCase()} successfully!`);
        setRequests(prev => prev.filter(r => r._id !== id));
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
        <div className="bg-[#319bab] p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <FaUserLock size={18} />
            </div>
            <div>
              <h2 className="font-black uppercase tracking-widest text-sm">Price Change Requests</h2>
              <p className="text-[10px] text-white/80">Manage staff requests to unlock pricing fields</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition">
            <FaTimes size={18} />
          </button>
        </div>

        <div className="p-4 max-h-[400px] overflow-y-auto bg-gray-50/50">
          {loading && requests.length === 0 ? (
            <div className="text-center py-10 text-gray-500 font-bold animate-pulse">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-gray-300 mb-2 flex justify-center"><FaUserLock size={40} /></div>
              <p className="text-gray-500 font-bold uppercase tracking-tight">No pending requests</p>
              <p className="text-[10px] text-gray-400 mt-1">All price changes are currently synchronized</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req._id} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex justify-between items-center hover:border-[#319bab]/30 transition group">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <span className="font-black text-[#319bab] uppercase tracking-tighter">{req.staffName}</span>
                       <span className="text-[10px] text-gray-400">requested for</span>
                    </div>
                    <div className="font-bold text-gray-800 text-sm">{req.productName}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold">₹{req.originalPrice}</span>
                      <span className="text-gray-400">→</span>
                      <span className="bg-blue-50 text-[#319bab] px-1.5 py-0.5 rounded font-black italic">REQUESTED UNLOCK</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <button 
                      onClick={() => handleStatusUpdate(req._id, "REJECTED")}
                      className="bg-red-50 text-red-600 p-3 rounded-xl hover:bg-red-600 hover:text-white transition shadow-sm active:scale-95"
                      title="Reject Request"
                    >
                      <FaTimes size={14} />
                    </button>
                    <button 
                      onClick={() => handleStatusUpdate(req._id, "APPROVED")}
                      className="bg-green-50 text-green-600 p-3 rounded-xl hover:bg-green-600 hover:text-white transition shadow-sm font-black flex items-center gap-2 active:scale-95"
                    >
                      <FaCheck size={14} />
                      <span className="uppercase tracking-widest text-[10px]">Approve</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-gray-100 flex justify-between items-center">
            <span className="text-[10px] text-gray-400 font-bold uppercase italic">Auto-refresh active (10s)</span>
            <button onClick={onClose} className="px-6 py-2 bg-gray-100 text-gray-500 rounded-xl font-black uppercase tracking-widest hover:bg-gray-200 transition">
              Close
            </button>
        </div>
      </div>
    </div>
  );
}
