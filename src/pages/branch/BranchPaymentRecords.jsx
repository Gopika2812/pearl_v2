import React, { useEffect, useState } from "react";
import { FaFileInvoiceDollar, FaSearch, FaArrowLeft, FaUndo, FaCheckCircle, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : "https://pearls-erp-2026.onrender.com/api";

export default function BranchPaymentRecords() {
  const { currentBranch, user } = useBranch();
  
  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    // Global Super Admin or Branch Admin (local) bypass checks
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    
    const key = `payment-records_${fieldId}`;
    return user.fieldPermissions?.[key] !== false; // Default to true if not explicitly restricted
  };
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Return Modal State
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [returnNarration, setReturnNarration] = useState("");
  const [returnBank, setReturnBank] = useState("ICICI");
  const [returnLoading, setReturnLoading] = useState(false);

  useEffect(() => {
    if (currentBranch?._id) fetchPayments();
  }, [currentBranch]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/payments?branchId=${currentBranch._id}`, {
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      setPayments(result.data || []);
    } catch (error) {
      console.error("Error fetching payments:", error);
      toast.error("Failed to load payment records");
    } finally {
      setLoading(false);
    }
  };

  const handleReturnPayment = async () => {
    if (!selectedPayment) return;
    if (!returnNarration) return toast.error("Please enter a narration");
    
    setReturnLoading(true);
    try {
      const response = await fetch(`${API_BASE}/payments/${selectedPayment._id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnNarration, returnBank }),
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success("Payment returned successfully!");
        setReturnModalOpen(false);
        setSelectedPayment(null);
        setReturnNarration("");
        fetchPayments();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Return error:", error);
      toast.error(error.message || "Failed to return payment");
    } finally {
      setReturnLoading(false);
    }
  };

  const filteredPayments = payments.filter(p => {
    // 1. Term Filter
    let matchesTerm = true;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const id = (p.paymentId || "").toLowerCase();
      const type = (p.paymentType || "").toLowerCase();
      const recipient = (p.vendor?.name || p.description || "").toLowerCase();
      matchesTerm = id.includes(searchLower) || type.includes(searchLower) || recipient.includes(searchLower);
    }

    // 2. Date Filter
    let matchesDate = true;
    const paymentDate = new Date(p.paymentDate || p.createdAt);
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (paymentDate < start) matchesDate = false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (paymentDate > end) matchesDate = false;
    }

    return matchesTerm && matchesDate;
  });

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full max-w-full mx-auto px-3 sm:px-6 py-4">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate("/branch/po-payment")}
                className="bg-white/20 hover:bg-white/30 p-3 rounded-xl transition"
              >
                <FaArrowLeft className="text-xl" />
              </button>
              <div>
                <h1 className="text-4xl font-bold">Payment Records</h1>
                <p className="text-red-100 mt-2">History of all outgoing payments (Vendors, Expenses, etc.)</p>
              </div>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-red-200 text-xs font-bold uppercase tracking-wider">Filtered Outflow</p>
              <p className="text-3xl font-black">₹{filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8 border border-red-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest pl-2">Lookup Payment</label>
              <div className="relative">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400" />
                <input
                  type="text"
                  placeholder="ID, Type or Recipient..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-red-50/20 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-medium text-gray-700"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest pl-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-red-50/20 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest pl-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 bg-red-50/20 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700 font-medium"
              />
            </div>
          </div>
        </div>

        {/* MAIN TABLE */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          {loading ? (
            <div className="p-20 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
              <p className="text-gray-500 font-medium">Fetching payment history...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-20 text-center">
              <FaFileInvoiceDollar className="text-6xl text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">No payment records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {isFieldAllowed("paymentId") && <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Payment ID</th>}
                    {isFieldAllowed("date") && <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>}
                    {isFieldAllowed("type") && <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>}
                    {isFieldAllowed("recipient") && <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Recipient / Description</th>}
                    {isFieldAllowed("mode") && <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Mode</th>}
                    {isFieldAllowed("amount") && <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>}
                    {isFieldAllowed("action") && <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredPayments.map((p) => (
                    <tr key={p._id} className="hover:bg-red-50/30 transition-colors group">
                      {isFieldAllowed("paymentId") && (
                        <td className="px-6 py-4">
                          <span className="font-bold text-red-600 group-hover:text-red-700">{p.paymentId}</span>
                        </td>
                      )}
                      {isFieldAllowed("date") && (
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDateTime(p.paymentDate || p.createdAt)}
                        </td>
                      )}
                      {isFieldAllowed("type") && (
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                            p.isReturned ? 'bg-red-50 border-red-200 text-red-600' :
                            p.paymentType === 'vendor_payment' ? 'bg-orange-50 border-orange-200 text-orange-600' :
                            p.paymentType === 'expense' ? 'bg-red-50 border-red-200 text-red-600' :
                            'bg-gray-50 border-gray-200 text-gray-600'
                          }`}>
                            {p.isReturned ? 'PAYMENT RETURNED' : p.paymentType?.replace('_', ' ').toUpperCase()}
                          </span>
                          {p.isReturned && (
                            <div className="mt-1 flex items-center gap-1 text-[8px] font-black text-red-600 uppercase">
                              <FaUndo size={8} /> {p.returnBank}
                            </div>
                          )}
                        </td>
                      )}
                      {isFieldAllowed("recipient") && (
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-800">{p.vendor?.name || p.description || "N/A"}</p>
                          {p.purchaseOrder?.invoiceId && (
                            <p className="text-xs text-gray-500 font-bold">PO: {p.purchaseOrder.invoiceId}</p>
                          )}
                        </td>
                      )}
                      {isFieldAllowed("mode") && (
                        <td className="px-6 py-4 text-center">
                          <span className="text-[10px] font-black px-2 py-1 bg-gray-100 text-gray-600 rounded uppercase">
                            {p.paymentMethod}
                          </span>
                        </td>
                      )}
                      {isFieldAllowed("amount") && (
                        <td className="px-6 py-4 text-right">
                          <p className="text-lg font-black text-gray-900">₹{p.amount?.toLocaleString()}</p>
                        </td>
                      )}
                      {isFieldAllowed("action") && (
                        <td className="px-6 py-4 text-center">
                           <div className="flex items-center justify-center gap-2">
                             <button 
                              onClick={() => toast.info("Viewing record: " + p.paymentId)}
                              className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                              title="View Details"
                             >
                               <FaFileInvoiceDollar size={14} />
                             </button>
                             
                             {!p.isReturned && p.paymentType === 'vendor_payment' && (
                               <button 
                                onClick={() => {
                                  setSelectedPayment(p);
                                  setReturnModalOpen(true);
                                }}
                                className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                                title="Return Payment"
                               >
                                 <FaUndo size={14} />
                               </button>
                             )}
                             
                             {p.isReturned && (
                               <FaCheckCircle className="text-emerald-500" size={14} title="Returned" />
                             )}
                           </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* RETURN MODAL */}
      {returnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300 border-2 border-red-500">
            <div className="bg-red-50 px-6 py-5 border-b border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <FaUndo size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-red-900 uppercase tracking-tighter">
                    Payment Return
                  </h2>
                  <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Mark payment as returned</p>
                </div>
              </div>
              <button onClick={() => setReturnModalOpen(false)} className="text-gray-400 hover:text-red-600 transition">
                <FaTimes size={16} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase">Payment ID</span>
                  <span className="text-xs font-black text-red-600">{selectedPayment?.paymentId}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-gray-400 uppercase">Amount</span>
                  <span className="text-sm font-black text-gray-900">₹{selectedPayment?.amount?.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">Return Bank Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {["ICICI", "STATE_BANK"].map((bank) => (
                      <button
                        key={bank}
                        onClick={() => setReturnBank(bank)}
                        className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
                          returnBank === bank 
                            ? "bg-red-50 border-red-500 text-red-600" 
                            : "bg-white border-gray-100 text-gray-400 hover:border-red-200"
                        }`}
                      >
                        {bank.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">Return Narration</label>
                  <textarea
                    placeholder="Why is this payment being returned?"
                    className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 text-xs font-medium text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-red-500 transition h-24 resize-none"
                    value={returnNarration}
                    onChange={(e) => setReturnNarration(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setReturnModalOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-400 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReturnPayment}
                  disabled={returnLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {returnLoading ? "Processing..." : "Confirm Return"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
