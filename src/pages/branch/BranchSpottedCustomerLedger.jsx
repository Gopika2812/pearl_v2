import { useEffect, useState } from "react";
import { FaSearch, FaSort, FaEye, FaCalendarAlt, FaUser, FaPhoneAlt, FaFileInvoiceDollar, FaMoneyBillWave, FaMobileAlt } from "react-icons/fa";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import { toast } from "react-toastify";

const BranchSpottedCustomerLedger = () => {
  const { currentBranch } = useBranch();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "dateTime", direction: "desc" });
  
  // Date states
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination states
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    totalRecords: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 50
  });

  // Totals state from backend
  const [totals, setTotals] = useState({ totalCash: 0, totalUpi: 0 });

  useEffect(() => {
    if (currentBranch?._id) {
      fetchRecords();
    }
  }, [currentBranch, sortConfig, fromDate, toDate, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, fromDate, toDate]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(
        `${API_BASE}/spotted-customer-ledger/${currentBranch._id}?search=${searchTerm}&sortField=${sortConfig.key}&sortOrder=${sortConfig.direction}&fromDate=${fromDate}&toDate=${toDate}&page=${page}&limit=50`
      );
      const data = await res.json();
      if (data.success) {
        setRecords(data.data);
        setPagination(data.pagination || { totalRecords: 0, totalPages: 1, currentPage: 1, limit: 50 });
        setTotals(data.totals || { totalCash: 0, totalUpi: 0 });
      }
    } catch (error) {
      toast.error("Failed to fetch ledger records");
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredRecords = records.filter(record => 
    record.salesInvoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.collectedByUsername?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] pt-20 md:pt-4 md:pl-20 px-4 pb-10 font-sans">
      <div className="w-full">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between mb-8 gap-6">
          <div className="flex-1">
            <h1 className="text-3xl font-black text-gray-800 tracking-tighter uppercase flex items-center gap-3">
              <span className="bg-[#319bab] text-white p-2 rounded-xl shadow-lg shadow-[#319bab]/20">
                <FaFileInvoiceDollar size={24} />
              </span>
              Spotted Customers Ledger
            </h1>
            <p className="text-gray-500 font-bold text-xs uppercase tracking-widest mt-1 ml-14">Track payments for temporary spotted customers</p>
            
            <div className="flex flex-wrap items-center gap-4 mt-6">
              <div className="relative">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Invoice, Name or Phone..."
                  className="pl-12 pr-6 py-3 bg-white border-2 border-gray-100 rounded-2xl w-full md:w-80 shadow-sm focus:ring-4 focus:ring-[#319bab]/10 focus:border-[#319bab] outline-none transition-all font-semibold text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border-2 border-gray-100 shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter px-1">From</span>
                  <input 
                    type="date" 
                    className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 px-1" 
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className="w-px h-8 bg-gray-100"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter px-1">To</span>
                  <input 
                    type="date" 
                    className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 px-1" 
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
                {(fromDate || toDate) && (
                  <button 
                    onClick={() => { setFromDate(""); setToDate(""); }}
                    className="ml-2 p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] shadow-sm flex flex-col min-w-[180px]">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">Total Cash</span>
              <span className="text-3xl font-black text-emerald-700 tracking-tighter">₹{(totals?.totalCash || 0).toLocaleString()}</span>
              <div className="mt-2 h-1 w-12 bg-emerald-200 rounded-full"></div>
            </div>
            
            <div className="bg-blue-50 border border-blue-100 p-6 rounded-[2rem] shadow-sm flex flex-col min-w-[180px]">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">Total UPI</span>
              <span className="text-3xl font-black text-blue-700 tracking-tighter">₹{(totals?.totalUpi || 0).toLocaleString()}</span>
              <div className="mt-2 h-1 w-12 bg-blue-200 rounded-full"></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-gray-100 overflow-hidden w-full">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-[#319bab] transition-colors" onClick={() => handleSort("salesInvoiceNumber")}>
                    <div className="flex items-center gap-2">
                      <FaFileInvoiceDollar /> SI Number {sortConfig.key === "salesInvoiceNumber" && <FaSort className="text-[#319bab]" />}
                    </div>
                  </th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-[#319bab] transition-colors" onClick={() => handleSort("name")}>
                    <div className="flex items-center gap-2">
                      <FaUser /> Customer Name {sortConfig.key === "name" && <FaSort className="text-[#319bab]" />}
                    </div>
                  </th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <div className="flex items-center gap-2">
                      <FaPhoneAlt /> Phone
                    </div>
                  </th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-[#319bab] transition-colors" onClick={() => handleSort("grandTotal")}>
                    <div className="flex items-center gap-2">
                      Total Bill {sortConfig.key === "grandTotal" && <FaSort className="text-[#319bab]" />}
                    </div>
                  </th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <div className="flex items-center gap-2">
                      <FaMoneyBillWave /> Cash
                    </div>
                  </th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <div className="flex items-center gap-2">
                      <FaMobileAlt /> GPay / UPI
                    </div>
                  </th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-[#319bab] transition-colors" onClick={() => handleSort("dateTime")}>
                    <div className="flex items-center gap-2">
                      <FaCalendarAlt /> Date & Time {sortConfig.key === "dateTime" && <FaSort className="text-[#319bab]" />}
                    </div>
                  </th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-[#319bab] transition-colors" onClick={() => handleSort("collectedByUsername")}>
                    <div className="flex items-center gap-2">
                      <FaUser className="text-gray-300" /> Collected By {sortConfig.key === "collectedByUsername" && <FaSort className="text-[#319bab]" />}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-[#319bab] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Records...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-8 py-20 text-center text-gray-400 font-bold uppercase tracking-widest">
                      No records found
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr key={record._id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-[#319bab] tracking-tight">{record.salesInvoiceNumber}</span>
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200" title="View Bill">
                            <FaEye size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-gray-700">{record.name}</td>
                      <td className="px-8 py-6 text-sm font-medium text-gray-500">{record.phoneNumber}</td>
                      <td className="px-8 py-6">
                        <span className="text-sm font-black text-gray-800">₹{record.grandTotal?.toLocaleString()}</span>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${record.cashAmount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                          ₹{record.cashAmount?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${record.upiAmount > 0 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                          ₹{record.upiAmount?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-gray-700">{new Date(record.dateTime).toLocaleDateString()}</span>
                          <span className="text-[10px] font-medium text-gray-400">{new Date(record.dateTime).toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-[#319bab] uppercase tracking-tighter">{record.collectedByUsername || "N/A"}</span>
                          <span className="text-[8px] text-gray-400 font-bold">Staff / Admin</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* PAGINATION CONTROLS */}
          {!loading && (pagination?.totalPages || 0) > 1 && (
            <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Showing Page {pagination?.currentPage} of {pagination?.totalPages} ({pagination?.totalRecords} Records)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                {[...Array(pagination?.totalPages || 0)].map((_, i) => {
                  const pNum = i + 1;
                  // Only show current, first, last, and neighbors
                  if (
                    pNum === 1 ||
                    pNum === pagination.totalPages ||
                    (pNum >= page - 1 && pNum <= page + 1)
                  ) {
                    return (
                      <button
                        key={pNum}
                        onClick={() => setPage(pNum)}
                        className={`w-10 h-10 rounded-xl text-xs font-black transition ${
                          page === pNum
                            ? "bg-[#319bab] text-white shadow-lg shadow-[#319bab]/20"
                            : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  }
                  if (pNum === page - 2 || pNum === page + 2) {
                    return <span key={pNum} className="text-gray-400">...</span>;
                  }
                  return null;
                })}
                <button
                  disabled={page === (pagination?.totalPages || 1)}
                  onClick={() => setPage(prev => Math.min(pagination?.totalPages || 1, prev + 1))}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BranchSpottedCustomerLedger;
