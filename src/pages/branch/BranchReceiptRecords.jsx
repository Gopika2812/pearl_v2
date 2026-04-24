import React, { useEffect, useState } from "react";
import { FaFileAlt, FaSearch, FaArrowLeft } from "react-icons/fa";
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : "https://pearls-erp-2026.onrender.com/api";

export default function BranchReceiptRecords() {
  const { currentBranch, user } = useBranch();
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL"); // ALL, CASH, BANK, CHEQUE

  useEffect(() => {
    if (currentBranch?._id) fetchReceipts();
  }, [currentBranch]);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/receipts?branchId=${currentBranch._id}`, {
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      setReceipts(result.data || []);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      toast.error("Failed to load receipt records");
    } finally {
      setLoading(false);
    }
  };

  const filteredReceipts = React.useMemo(() => {
    return receipts.filter(r => {
      // 1. Term Filter
      let matchesTerm = true;
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const id = (r.receiptId || "").toLowerCase();
        const inv = (r.originalInvoiceId || "").toLowerCase();
        const cust = (r.customer?.name || "").toLowerCase();
        matchesTerm = id.includes(searchLower) || inv.includes(searchLower) || cust.includes(searchLower);
      }

      // 2. Date Filter
      let matchesDate = true;
      const createdAt = new Date(r.createdAt);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (createdAt < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (createdAt > end) matchesDate = false;
      }

      // 3. Ledger/Mode Filter
      let matchesFilter = true;
      if (activeFilter === "CASH") matchesFilter = r.paymentMethod === "CASH";
      else if (activeFilter === "BANK") matchesFilter = ["BANK_TRANSFER", "UPI", "CREDIT_CARD", "DEBIT_CARD"].includes(r.paymentMethod);
      else if (activeFilter === "CHEQUE") matchesFilter = r.paymentMethod === "CHEQUE";

      return matchesTerm && matchesDate && matchesFilter;
    });
  }, [receipts, searchTerm, startDate, endDate, activeFilter]);

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
      <div className="w-full mx-auto px-3 sm:px-6 py-4">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate("/branch/receipts")}
                className="bg-white/20 hover:bg-white/30 p-3 rounded-xl transition"
              >
                <FaArrowLeft className="text-xl" />
              </button>
              <div>
                <h1 className="text-4xl font-bold">Receipt Records</h1>
                <p className="text-blue-100 mt-2">Historical list of all customer payments</p>
              </div>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-blue-200 text-xs font-bold uppercase tracking-wider">Filtered Collection</p>
              <p className="text-3xl font-black">₹{filteredReceipts.reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8 border border-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            {/* Search */}
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest pl-2">Lookup Receipt</label>
              <div className="relative">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" />
                <input
                  type="text"
                  placeholder="ID, Invoice or Customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-blue-50/20 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700"
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
                className="w-full px-4 py-3 bg-blue-50/20 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest pl-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 bg-blue-50/20 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium"
              />
            </div>
          </div>
        </div>

        {/* LEDGER FILTER BUTTONS */}
        <div className="flex flex-wrap gap-4 mb-8">
            <button 
                onClick={() => setActiveFilter("CASH")}
                className={`flex-1 min-w-[150px] py-4 rounded-2xl border-2 font-black uppercase tracking-widest text-xs transition-all shadow-sm ${activeFilter === "CASH" ? "bg-green-600 text-white border-green-600 shadow-green-200" : "bg-white text-gray-400 border-gray-100 hover:border-green-200"}`}
            >
                Cash Ledger
            </button>
            <button 
                onClick={() => setActiveFilter("BANK")}
                className={`flex-1 min-w-[150px] py-4 rounded-2xl border-2 font-black uppercase tracking-widest text-xs transition-all shadow-sm ${activeFilter === "BANK" ? "bg-purple-600 text-white border-purple-600 shadow-purple-200" : "bg-white text-gray-400 border-gray-100 hover:border-purple-200"}`}
            >
                Bank Receipt Ledger
            </button>
            <button 
                onClick={() => setActiveFilter("CHEQUE")}
                className={`flex-1 min-w-[150px] py-4 rounded-2xl border-2 font-black uppercase tracking-widest text-xs transition-all shadow-sm ${activeFilter === "CHEQUE" ? "bg-orange-600 text-white border-orange-600 shadow-orange-200" : "bg-white text-gray-400 border-gray-100 hover:border-orange-200"}`}
            >
                Cheque Ledger
            </button>
            <button 
                onClick={() => setActiveFilter("ALL")}
                className={`py-4 px-8 rounded-2xl border-2 font-black uppercase tracking-widest text-xs transition-all ${activeFilter === "ALL" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-300 border-gray-100 hover:border-gray-200"}`}
            >
                Show All
            </button>
        </div>

        {/* MAIN TABLE */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          {loading ? (
            <div className="p-20 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500 font-medium">Fetching receipt history...</p>
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="p-20 text-center">
              <FaFileAlt className="text-6xl text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">No receipt records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Receipt ID</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Invoice / Ref</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Mode</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredReceipts.map((r) => (
                    <tr key={r._id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-bold text-blue-600 group-hover:text-blue-700">{r.receiptId}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDateTime(r.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {r.originalInvoiceId || "STANDALONE"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-800">{r.customer?.name || "N/A"}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase ${
                          r.paymentMethod === 'CASH' ? 'bg-green-100 text-green-700' :
                          r.paymentMethod === 'CHEQUE' ? 'bg-orange-100 text-orange-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {r.paymentMethod}
                        </span>
                        {r.reference && (
                          <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase truncate max-w-[120px] mx-auto">
                            {r.reference}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-lg font-black text-gray-900">₹{r.amount?.toLocaleString()}</p>
                      </td>
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
