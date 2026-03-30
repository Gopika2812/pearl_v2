import { useEffect, useState } from "react";
import { FaCheck, FaTimes, FaHistory, FaFileInvoice, FaUser, FaClock, FaCheckCircle, FaTimesCircle, FaCreditCard, FaShoppingCart } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

export default function BranchAdminRequests() {
  const { branch, user } = useBranch();
  const [reEditRequests, setReEditRequests] = useState([]);
  const [creditRequests, setCreditRequests] = useState([]);
  const [poRequests, setPoRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (branch?._id) {
      fetchAllRequests();
    }
  }, [branch?._id]);

  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      // Fetch Re-edit requests (SO)
      const reEditRes = await fetch(`${API_BASE}/sales-orders/re-edit-requests/branch/${branch?._id}`);
      const reEditData = await reEditRes.json();
      if (reEditData.success) setReEditRequests(reEditData.data);

      // Fetch Credit Limit requests
      const creditRes = await fetch(`${API_BASE}/customers/credit-requests/branch/${branch?._id}`);
      const creditData = await creditRes.json();
      if (creditData.success) setCreditRequests(creditData.data);

      // Fetch PO Requests
      const poRes = await fetch(`${API_BASE}/purchase-orders/requests/branch/${branch?._id}`);
      const poData = await poRes.json();
      if (poData.success) setPoRequests(poData.data);

    } catch (err) {
      toast.error("Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  const handleReEditAction = async (id, action) => {
    try {
      const res = await fetch(`${API_BASE}/sales-orders/${id}/${action}-re-edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Re-edit ${action === 'approve' ? 'Approved' : 'Rejected'}`);
        fetchAllRequests();
      } else {
        toast.error(data.message || `Failed to ${action} request`);
      }
    } catch (err) {
      toast.error("Error updating request");
    }
  };

  const handlePOAction = async (id, action, type) => {
    try {
      const res = await fetch(`${API_BASE}/purchase-orders/${id}/${action}-${type}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`PO ${type} ${action === 'approve' ? 'Approved' : 'Rejected'}`);
        fetchAllRequests();
      } else {
        toast.error(data.message || `Failed to ${action} request`);
      }
    } catch (err) {
      toast.error("Error updating request");
    }
  };

  const handleCreditAction = async (customerId, action) => {
    try {
      const res = await fetch(`${API_BASE}/customers/${customerId}/${action}-credit-bypass`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Credit Bypass ${action === 'approve' ? 'Approved' : 'Rejected'}`);
        fetchAllRequests();
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
                Admin Permissions
              </h1>
              <p className="text-gray-500 mt-2 font-medium tracking-tight uppercase text-xs tracking-[0.2em]">Manage re-edit and credit limit bypass requests</p>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Section 1: Credit Limit Requests */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-secondary p-6 flex items-center justify-between">
              <h3 className="text-white font-bold flex items-center gap-2">
                <FaCreditCard className="text-white" />
                Credit Limit Bypass Requests ({creditRequests.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left font-black text-gray-400 uppercase tracking-widest text-[10px]">Customer</th>
                    <th className="px-6 py-4 text-left font-black text-gray-400 uppercase tracking-widest text-[10px]">Balance / Limit</th>
                    <th className="px-6 py-4 text-left font-black text-gray-400 uppercase tracking-widest text-[10px]">Requested By</th>
                    <th className="px-6 py-4 text-center font-black text-gray-400 uppercase tracking-widest text-[10px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-400 italic">Loading...</td></tr>
                  ) : creditRequests.length === 0 ? (
                    <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-400 italic font-bold">No pending credit limit requests</td></tr>
                  ) : (
                    creditRequests.map((req) => (
                      <tr key={req._id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="font-black text-gray-900">{req.name}</p>
                          <p className="text-[10px] text-gray-400">{req.whatsapp}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-black text-red-600">₹{req.debit?.toLocaleString()}</span>
                            <span className="text-[10px] text-gray-400">Limit: ₹{req.creditLimit?.toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-600 flex items-center gap-2">
                              <FaUser size={10} /> {req.creditLimitRequestBy}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(req.creditLimitRequestAt).toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleCreditAction(req._id, "approve")}
                              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition"
                            >
                              <FaCheck size={10} /> <span className="text-[10px] font-bold uppercase">Approve</span>
                            </button>
                            <button
                              onClick={() => handleCreditAction(req._id, "reject")}
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition"
                            >
                              <FaTimes size={10} /> <span className="text-[10px] font-bold uppercase">Reject</span>
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

          {/* Section 2: Re-edit Requests */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-900 p-6 flex items-center justify-between">
              <h3 className="text-white font-bold flex items-center gap-2">
                <FaFileInvoice className="text-secondary" />
                Pending Re-edit Requests ({reEditRequests.length})
              </h3>
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
                    <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-400 italic">Loading...</td></tr>
                  ) : reEditRequests.length === 0 ? (
                    <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-400 italic font-bold">No pending re-edit requests</td></tr>
                  ) : (
                    reEditRequests.map((req) => (
                      <tr key={req._id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4 font-black text-gray-900">{req.invoiceId || "N/A"}</td>
                        <td className="px-6 py-4 font-bold text-gray-700">{req.customer?.name}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-[10px]">
                            <span className="font-bold text-gray-600 flex items-center gap-1"><FaUser size={8} /> {req.reEditRequestBy}</span>
                            <span className="text-gray-400 flex items-center gap-1 mt-0.5"><FaClock size={8} /> {new Date(req.reEditRequestAt).toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-black text-gray-900">₹{req.grandTotal?.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleReEditAction(req._id, "approve")} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition uppercase text-[10px] font-bold"><FaCheck size={10} /> Approve</button>
                            <button onClick={() => handleReEditAction(req._id, "reject")} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition uppercase text-[10px] font-bold"><FaTimes size={10} /> Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Purchase Order Requests */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-indigo-900 p-6 flex items-center justify-between">
              <h3 className="text-white font-bold flex items-center gap-2">
                <FaShoppingCart className="text-secondary" />
                Purchase Order Admin Requests ({poRequests.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left font-black text-gray-400 uppercase tracking-widest text-[10px]">Invoice ID</th>
                    <th className="px-6 py-4 text-left font-black text-gray-400 uppercase tracking-widest text-[10px]">Vendor</th>
                    <th className="px-6 py-4 text-left font-black text-gray-400 uppercase tracking-widest text-[10px]">Type</th>
                    <th className="px-6 py-4 text-left font-black text-gray-400 uppercase tracking-widest text-[10px]">Requested By</th>
                    <th className="px-6 py-4 text-left font-black text-gray-400 uppercase tracking-widest text-[10px]">Total Amount</th>
                    <th className="px-6 py-4 text-center font-black text-gray-400 uppercase tracking-widest text-[10px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-400 italic">Loading...</td></tr>
                  ) : poRequests.length === 0 ? (
                    <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-400 italic font-bold">No pending purchase order requests</td></tr>
                  ) : (
                    poRequests.map((req) => {
                      const isEdit = req.editRequestStatus === "PENDING";
                      const type = isEdit ? "edit" : "cancel";
                      const requestedBy = isEdit ? req.editRequestBy : req.cancelRequestBy;
                      const requestedAt = isEdit ? req.editRequestAt : req.cancelRequestAt;

                      return (
                        <tr key={req._id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-6 py-4 font-black text-gray-900">{req.invoiceId || "N/A"}</td>
                          <td className="px-6 py-4 font-bold text-gray-700">{req.vendor}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${isEdit ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                              {type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col text-[10px]">
                              <span className="font-bold text-gray-600 flex items-center gap-1"><FaUser size={8} /> {requestedBy}</span>
                              <span className="text-gray-400 flex items-center gap-1 mt-0.5"><FaClock size={8} /> {new Date(requestedAt).toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-black text-gray-900">₹{req.grandTotal?.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => handlePOAction(req._id, "approve", type)} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition uppercase text-[10px] font-bold"><FaCheck size={10} /> Approve</button>
                              <button onClick={() => handlePOAction(req._id, "reject", type)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition uppercase text-[10px] font-bold"><FaTimes size={10} /> Reject</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
