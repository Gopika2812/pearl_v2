import { useEffect, useState } from "react";
import { FaCheck, FaTimes, FaHistory, FaFileInvoice, FaUser, FaClock, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

export default function BranchAdminRequests() {
  const { branch, user } = useBranch();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (branch?._id) {
      fetchRequests();
    }
  }, [branch?._id]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sales-orders/re-edit-requests/branch/${branch?._id}`);
      const data = await res.json();
      if (data.success) {
        setRequests(data.data);
      } else {
        toast.error(data.message || "Failed to fetch requests");
      }
    } catch (err) {
      toast.error("Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      const res = await fetch(`${API_BASE}/sales-orders/${id}/${action}-re-edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Request ${action === 'approve' ? 'Approved' : 'Rejected'}`);
        fetchRequests(); // Refresh list
      } else {
        toast.error(data.message || `Failed to ${action} request`);
      }
    } catch (err) {
      toast.error("Error updating request");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20 px-4 md:px-6 pb-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-8 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/5 rounded-full -mr-32 -mt-32"></div>
            <div className="relative z-10">
              <h1 className="text-4xl font-black text-gray-900 flex items-center gap-4">
                <div className="p-3 bg-secondary/10 rounded-2xl text-secondary">
                  <FaHistory />
                </div>
                Re-edit Permissions
              </h1>
              <p className="text-gray-500 mt-2 font-medium tracking-tight uppercase text-xs tracking-[0.2em]">Manage re-edit requests from branch personnel</p>
            </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-900 p-6 flex items-center justify-between">
            <h3 className="text-white font-bold flex items-center gap-2">
              <FaFileInvoice className="text-secondary" />
              Pending Requests ({requests.length})
            </h3>
            <button 
                onClick={fetchRequests}
                className="text-xs font-bold text-gray-400 hover:text-white transition"
            >
                Refresh List
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left font-black text-gray-400 uppercase tracking-widest text-[10px]">Invoice ID</th>
                  <th className="px-6 py-4 text-left font-black text-gray-400 uppercase tracking-widest text-[10px]">Customer</th>
                  <th className="px-6 py-4 text-left font-black text-gray-400 uppercase tracking-widest text-[10px]">Requested By</th>
                  <th className="px-6 py-4 text-left font-black text-gray-400 uppercase tracking-widest text-[10px]">Amount</th>
                  <th className="px-6 py-4 text-center font-black text-gray-400 uppercase tracking-widest text-[10px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 font-bold italic">Loading requests...</td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 font-bold italic">No pending re-edit requests found</td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req._id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-black text-gray-900 group-hover:text-secondary transition-colors">{req.invoiceId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-700">{req.customer?.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-600 flex items-center gap-2">
                                <FaUser size={10} className="text-gray-400" /> {req.reEditRequestBy}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                                <FaClock size={8} /> {new Date(req.reEditRequestAt).toLocaleString()}
                            </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-black text-gray-900">
                        ₹{req.grandTotal?.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleAction(req._id, "approve")}
                            className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-xl shadow-lg shadow-green-500/20 transition-all hover:scale-110 active:scale-95 flex items-center gap-2 px-4"
                            title="Approve Re-edit"
                          >
                            <FaCheck size={12} />
                            <span className="text-[10px] font-black uppercase">Approve</span>
                          </button>
                          <button
                            onClick={() => handleAction(req._id, "reject")}
                            className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-xl shadow-lg shadow-red-500/20 transition-all hover:scale-110 active:scale-95 flex items-center gap-2 px-4"
                            title="Reject Request"
                          >
                            <FaTimes size={12} />
                            <span className="text-[10px] font-black uppercase">Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
