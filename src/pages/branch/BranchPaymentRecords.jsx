import React, { useEffect, useState } from "react";
import { FaFileInvoiceDollar, FaSearch, FaArrowLeft } from "react-icons/fa";
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
            {/* Search */}
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

            {/* Start Date */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest pl-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-red-50/20 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700 font-medium"
              />
            </div>

            {/* End Date */}
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
                            p.paymentType === 'vendor_payment' ? 'bg-orange-50 border-orange-200 text-orange-600' :
                            p.paymentType === 'expense' ? 'bg-red-50 border-red-200 text-red-600' :
                            'bg-gray-50 border-gray-200 text-gray-600'
                          }`}>
                            {p.paymentType?.replace('_', ' ').toUpperCase()}
                          </span>
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
                           <button 
                            onClick={() => toast.info("Viewing record: " + p.paymentId)}
                            className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                           >
                             <FaFileInvoiceDollar size={14} />
                           </button>
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
    </div>
  );
}
