import React, { useEffect, useState, useMemo } from "react";
import { FaBook, FaPlus, FaSync, FaSearch, FaUser, FaFilter, FaCalendarAlt, FaSortAmountDown, FaSortAmountUp, FaChevronLeft, FaChevronRight, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import ManualJournalFormModal from "../../components/ManualJournalFormModal";

const BranchJournalEntries = () => {
  const { currentBranch, user } = useBranch();
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Default dates: Start and end of current month
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  
  const [fromDate, setFromDate] = useState(firstDay);
  const [toDate, setToDate] = useState(lastDay);

  // Pagination & Sorting State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: "journalDate", direction: "desc" });

  const [selectedGroup, setSelectedGroup] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const ACCOUNT_GROUPS = [
    "Indirect Expenses", "Direct Expenses", "Indirect Income", "Direct Income",
    "Fixed Assets", "Current Assets", "Current Liabilities", "Sundry Debtors", 
    "Sundry Creditors", "Capital Account", "Loans (Liability)"
  ];

  const fetchJournals = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      let url = `${API_BASE}/manual-journals?branchId=${currentBranch._id}&page=${page}&limit=50`;
      if (fromDate) url += `&fromDate=${fromDate}`;
      if (toDate) url += `&toDate=${toDate}`;

      const res = await fetchWithAuth(url);
      const result = await res.json();
      
      if (result.success) {
        setJournals(result.data || []);
        setTotalPages(result.totalPages || 1);
        setTotalCount(result.totalCount || 0);
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      toast.error(err.message || "Failed to fetch journals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, [currentBranch?._id, fromDate, toDate, page]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const processedJournals = useMemo(() => {
    let items = [...journals];

    // Filter by general search term
    if (searchTerm) {
      const lowSearch = searchTerm.toLowerCase();
      items = items.filter(j => 
        j.journalId?.toLowerCase().includes(lowSearch) ||
        j.by.partyName?.toLowerCase().includes(lowSearch) ||
        j.to.partyName?.toLowerCase().includes(lowSearch) ||
        j.by.partyGroup?.toLowerCase().includes(lowSearch) ||
        j.to.partyGroup?.toLowerCase().includes(lowSearch) ||
        j.userName?.toLowerCase().includes(lowSearch) ||
        j.narration?.toLowerCase().includes(lowSearch)
      );
    }

    // Filter by Group
    if (selectedGroup) {
      items = items.filter(j => 
        j.by.partyGroup === selectedGroup || 
        j.to.partyGroup === selectedGroup
      );
    }

    // Sort items
    items.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      if (sortConfig.key === "journalDate") {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return items;
  }, [journals, searchTerm, sortConfig, selectedGroup]);

  return (
    <div className="min-h-screen bg-[#f8fafc] pt-20 md:pt-6 md:pl-24 pb-12">
      <ManualJournalFormModal 
        isOpen={createModalOpen} 
        onClose={() => setCreateModalOpen(false)} 
        onRefresh={fetchJournals} 
        currentBranch={currentBranch}
      />

      <div className="w-full px-4 sm:px-8">
        {/* HEADER SECTION */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-100 rotate-3 hover:rotate-0 transition-transform duration-300">
              <FaBook className="text-white text-2xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Journal Book</h1>
                <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-1">
                  {totalCount} Entries
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Branch Manual Accounting Records</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition shadow-xl shadow-indigo-100"
            >
              <FaPlus /> Create Journal
            </button>
            <button
              onClick={() => { setPage(1); fetchJournals(); }}
              className="p-4 bg-white text-slate-400 border border-slate-100 rounded-2xl hover:text-indigo-600 hover:border-indigo-100 transition shadow-sm"
              title="Refresh"
            >
              <FaSync className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* FILTERS & SEARCH */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 mb-8 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          <div className="relative flex-[2]">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="Search by ID, Name, Group or User..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-10 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold text-slate-700 transition"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
              >
                <FaTimes />
              </button>
            )}
          </div>

          <div className="flex-1 min-w-[200px]">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full py-4 px-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-600 transition cursor-pointer appearance-none"
            >
              <option value="">Filter by All Groups</option>
              {ACCOUNT_GROUPS.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-transparent focus-within:border-indigo-100 transition">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">From</span>
              <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="bg-transparent text-xs font-bold text-slate-700 outline-none" />
            </div>
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-transparent focus-within:border-indigo-100 transition">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To</span>
              <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="bg-transparent text-xs font-bold text-slate-700 outline-none" />
            </div>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 uppercase text-[10px] font-black tracking-[0.2em]">
                  <th className="px-8 py-6 text-left cursor-pointer hover:text-indigo-600 transition" onClick={() => handleSort("journalId")}>
                    <div className="flex items-center gap-2">Journal ID {sortConfig.key === "journalId" && (sortConfig.direction === "asc" ? <FaSortAmountUp /> : <FaSortAmountDown />)}</div>
                  </th>
                  <th className="px-8 py-6 text-left cursor-pointer hover:text-indigo-600 transition" onClick={() => handleSort("journalDate")}>
                    <div className="flex items-center gap-2">Date / Time {sortConfig.key === "journalDate" && (sortConfig.direction === "asc" ? <FaSortAmountUp /> : <FaSortAmountDown />)}</div>
                  </th>
                  <th className="px-8 py-6 text-left">Debit Party (BY)</th>
                  <th className="px-8 py-6 text-left">Credit Party (TO)</th>
                  <th className="px-8 py-6 text-right cursor-pointer hover:text-indigo-600 transition" onClick={() => handleSort("amount")}>
                    <div className="flex items-center justify-end gap-2">Amount {sortConfig.key === "amount" && (sortConfig.direction === "asc" ? <FaSortAmountUp /> : <FaSortAmountDown />)}</div>
                  </th>
                  <th className="px-8 py-6 text-center">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-[4px] border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Records...</p>
                      </div>
                    </td>
                  </tr>
                ) : processedJournals.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-8 py-32 text-center opacity-40">
                      <FaBook className="text-6xl mx-auto mb-6 text-slate-200" />
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No Journal Entries Found</p>
                    </td>
                  </tr>
                ) : (
                  processedJournals.map((journal) => (
                    <tr key={journal._id} className="group hover:bg-slate-50/50 transition-all duration-300">
                      <td className="px-8 py-6">
                        <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-[11px] font-black tracking-tight group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          {journal.journalId}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-bold text-slate-700">{new Date(journal.journalDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{new Date(journal.journalDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">DR</div>
                          <div className="min-w-0">
                            <div className="text-sm font-black text-slate-800 truncate">{journal.by?.partyName}</div>
                            <div className="text-[9px] text-indigo-500 font-black uppercase tracking-widest">{journal.by?.partyGroup || "N/A"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-emerald-50 text-emerald-500 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">CR</div>
                          <div className="min-w-0">
                            <div className="text-sm font-black text-slate-800 truncate">{journal.to?.partyName}</div>
                            <div className="text-[9px] text-indigo-500 font-black uppercase tracking-widest">{journal.to?.partyGroup || "N/A"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="text-base font-black text-slate-900">₹{journal.amount?.toLocaleString() || '0'}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{journal.paymentMode}</div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full">
                          <div className="w-4 h-4 bg-slate-300 rounded-full flex items-center justify-center"><FaUser className="text-white text-[8px]" /></div>
                          <span className="text-[10px] font-black text-slate-500 uppercase">{journal.userName}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINATION CONTROLS */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-8 py-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              Showing page <span className="text-indigo-600">{page}</span> of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-600 hover:text-white transition disabled:opacity-30 disabled:hover:bg-slate-50 disabled:hover:text-slate-400"
              >
                <FaChevronLeft size={12} />
              </button>
              <div className="flex gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const pNum = i + 1;
                  // Show max 5 page numbers
                  if (totalPages > 5 && Math.abs(pNum - page) > 2 && pNum !== 1 && pNum !== totalPages) return null;
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${page === pNum ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-600 hover:text-white transition disabled:opacity-30 disabled:hover:bg-slate-50 disabled:hover:text-slate-400"
              >
                <FaChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BranchJournalEntries;
