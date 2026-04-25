import React, { useState, useEffect } from "react";
import {
  FaTruck, FaSearch, FaCalendarAlt, FaHistory, FaFileInvoice, FaUser, FaSync, FaFilter, FaCheckCircle, FaExclamationCircle, FaMapMarkerAlt
} from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

const BranchDeliveryRecords = () => {
  const { currentBranch, user } = useBranch();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFromDate, setFilterFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [filterToDate, setFilterToDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterStatus, setFilterStatus] = useState("COMPLETED");
  const [filterStorage, setFilterStorage] = useState("");
  const [filterChecker, setFilterChecker] = useState("");
  const [filterDelivery, setFilterDelivery] = useState("");
  const [branchUsers, setBranchUsers] = useState([]);

  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [currentPage, setCurrentPage] = useState(1);

  const fetchBranchUsers = async () => {
    if (!currentBranch?._id) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/branch-users/branch/${currentBranch._id}`);
      const data = await res.json();
      if (data.success) {
        setBranchUsers(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch branch users", err);
    }
  };

  const fetchRecords = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      let url = `${API_BASE}/invoices?branchId=${currentBranch._id}&page=${currentPage}&limit=50`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (filterFromDate) url += `&fromDate=${filterFromDate}`;
      if (filterToDate) url += `&toDate=${filterToDate}`;
      if (filterStatus) url += `&deliveryStatus=${filterStatus}`;
      if (filterStorage) url += `&storageMan=${encodeURIComponent(filterStorage)}`;
      if (filterChecker) url += `&stockChecker=${encodeURIComponent(filterChecker)}`;
      if (filterDelivery) url += `&deliveryPerson=${encodeURIComponent(filterDelivery)}`;

      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (data.success) {
        setInvoices(data.data || []);
        setPagination(data.pagination || { total: 0, pages: 1 });
        if (data.data?.length > 0) {
          toast.success(`Found ${data.data.length} records`);
        }
      }
    } catch (err) {
      toast.error("Failed to fetch delivery records: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranchUsers();
  }, [currentBranch]);

  useEffect(() => {
    fetchRecords();
  }, [currentBranch, currentPage, filterFromDate, filterToDate, filterStatus, filterStorage, filterChecker, filterDelivery]);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchRecords();
  };

  const formatIST = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-poppins">
      {/* HEADER SECTION */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <FaHistory className="text-white text-xl" />
              </div>
              <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                Delivery <span className="text-indigo-600">Records</span>
              </h1>
            </div>
            <p className="text-slate-500 text-sm font-medium">History and analysis of all delivery transactions</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 border-r border-slate-100">
                <FaCalendarAlt className="text-indigo-400 text-xs" />
                <input
                  type="date"
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                  className="text-[11px] font-bold text-slate-600 outline-none bg-transparent"
                />
              </div>
              <div className="flex items-center gap-2 px-3">
                <input
                  type="date"
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                  className="text-[11px] font-bold text-slate-600 outline-none bg-transparent"
                />
              </div>
            </div>
            <button
              onClick={() => { setFilterFromDate(""); setFilterToDate(""); }}
              className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-rose-500 transition-colors shadow-sm"
              title="Clear Dates"
            >
              <FaSync className="text-xs" />
            </button>
            <button
              onClick={fetchRecords}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* FILTERS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Delivery Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="ALL">All Transactions</option>
            <option value="COMPLETED">Delivered Only</option>
            <option value="PENDING">Reverted / Pending</option>
            <option value="PICKED">Picked (In-Transit)</option>
          </select>
        </div>
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Storage Man</label>
          <select
            value={filterStorage}
            onChange={(e) => setFilterStorage(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All Staff</option>
            {branchUsers.map(u => <option key={u._id} value={u.username}>{u.username}</option>)}
          </select>
        </div>
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Stock Checker</label>
          <select
            value={filterChecker}
            onChange={(e) => setFilterChecker(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All Staff</option>
            {branchUsers.map(u => <option key={u._id} value={u.username}>{u.username}</option>)}
          </select>
        </div>
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Delivery Person</label>
          <select
            value={filterDelivery}
            onChange={(e) => setFilterDelivery(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All Staff</option>
            {branchUsers.map(u => <option key={u._id} value={u.username}>{u.username}</option>)}
          </select>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="mb-6">
        <form onSubmit={handleSearch} className="relative group">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            placeholder="Search by Invoice Number or Customer Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all font-medium text-slate-600"
          />
        </form>
      </div>

      {/* RECORDS TABLE */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 bg-indigo-600 rounded-full"></div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Transaction History</h2>
          </div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
            Total: {pagination.total} Records
          </span>
        </div>

        {/* Desktop Table (Hidden on mobile) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Record ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">SI Information</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Details</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Staff</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Records...</span>
                    </div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-20">
                      <FaHistory size={48} className="text-slate-400 mb-2" />
                      <span className="text-sm font-bold text-slate-500 uppercase">No records found matching criteria</span>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const isReverted = inv.deliveryStatus === 'PENDING';
                  return (
                    <tr key={inv._id} className={`transition-colors group ${isReverted ? 'bg-slate-50/80 opacity-60 grayscale-[0.5]' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-6 py-4">
                        <div className={`inline-block px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase ${inv.deliveryLogId ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400 border border-dashed border-slate-200'}`}>
                          {inv.deliveryLogId || "NO-ID"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-sm ${isReverted ? 'bg-slate-200 text-slate-500' : 'bg-indigo-50 text-indigo-600'}`}>
                            SI
                          </div>
                          <div>
                            <div className={`text-sm font-black ${isReverted ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-800'}`}>{inv.invoiceNumber}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Created: {formatIST(inv.createdAt || inv.invoiceDate)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 mb-1">
                          <FaUser className={`text-[10px] ${isReverted ? 'text-slate-300' : 'text-indigo-400'}`} />
                          <span className={`text-xs font-black uppercase tracking-tight ${isReverted ? 'text-slate-400' : 'text-slate-700'}`}>{inv.customer?.name}</span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-400">{inv.area || inv.customer?.address || "No Area Listed"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-black text-slate-300 uppercase w-12">Storage:</span>
                            <span className={`text-[10px] font-bold ${isReverted ? 'text-slate-400' : 'text-slate-600'}`}>{inv.storageMan || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-black text-slate-300 uppercase w-12">Checker:</span>
                            <span className={`text-[10px] font-bold ${isReverted ? 'text-slate-400' : 'text-slate-600'}`}>{inv.stockChecker || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-black text-slate-300 uppercase w-12">Delivery:</span>
                            <span className={`text-[10px] font-bold ${isReverted ? 'text-slate-400' : 'text-slate-600'}`}>{inv.deliveryPerson || "N/A"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg mb-1.5 ${inv.deliveryStatus === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' :
                            inv.deliveryStatus === 'PICKED' ? 'bg-amber-50 text-amber-600' :
                              'bg-rose-50 text-rose-500'
                          }`}>
                          {inv.deliveryStatus === 'COMPLETED' ? <FaCheckCircle /> : <FaExclamationCircle />}
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {inv.deliveryStatus === 'COMPLETED' ? 'Delivered' :
                              inv.deliveryStatus === 'PENDING' ? 'Reverted' : inv.deliveryStatus}
                          </span>
                        </div>
                        {inv.deliveryCompletedAt && (
                          <div className="text-[10px] font-bold text-slate-500">{formatIST(inv.deliveryCompletedAt)}</div>
                        )}

                        {/* PAYMENT METHODS */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {inv.deliveryPaymentType && inv.deliveryPaymentType !== "NONE" ? (
                            inv.deliveryPaymentType.split(",").map((type, idx) => (
                              <span key={idx} className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border shadow-sm ${isReverted ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                }`}>
                                {type}
                              </span>
                            ))
                          ) : (
                            <span className="text-[8px] font-black text-slate-300 uppercase italic">No payment info</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards (Visible on small screens) */}
        <div className="lg:hidden divide-y divide-slate-100">
          {loading ? (
             <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading...</div>
          ) : invoices.length === 0 ? (
             <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No records found</div>
          ) : (
            invoices.map((inv) => (
              <div key={inv._id} className="p-4 bg-white">
                <div className="flex items-start justify-between mb-3">
                  <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${inv.deliveryLogId ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {inv.deliveryLogId || "PENDING"}
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${inv.deliveryStatus === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {inv.deliveryStatus}
                  </div>
                </div>
                <div className="mb-3">
                  <div className="text-sm font-black text-slate-800 tracking-tight">{inv.invoiceNumber}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{inv.customer?.name}</div>
                  <div className="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-1">
                    <FaMapMarkerAlt className="text-indigo-400" /> {inv.area || "No Area"}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                   <div>
                     <div className="text-[8px] font-black text-slate-300 uppercase">Storage</div>
                     <div className="text-[10px] font-bold text-slate-600 truncate">{inv.storageMan || "-"}</div>
                   </div>
                   <div>
                     <div className="text-[8px] font-black text-slate-300 uppercase">Checker</div>
                     <div className="text-[10px] font-bold text-slate-600 truncate">{inv.stockChecker || "-"}</div>
                   </div>
                   <div>
                     <div className="text-[8px] font-black text-slate-300 uppercase">Delivery</div>
                     <div className="text-[10px] font-bold text-slate-600 truncate">{inv.deliveryPerson || "-"}</div>
                   </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* PAGINATION */}
        <div className="bg-slate-50/80 p-4 flex items-center justify-between border-t border-slate-100">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="px-4 py-2 bg-white rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Page {currentPage} of {pagination.pages}
          </span>
          <button
            disabled={currentPage === pagination.pages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="px-4 py-2 bg-white rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default BranchDeliveryRecords;
