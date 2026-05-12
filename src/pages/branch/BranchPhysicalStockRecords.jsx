import React, { useState, useEffect } from "react";
import { FaHistory, FaSort, FaSortUp, FaSortDown, FaFilter, FaSearch, FaCalendarAlt, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

export default function BranchPhysicalStockRecords() {
  const { currentBranch, user } = useBranch();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [productGroups, setProductGroups] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [approving, setApproving] = useState(false);

  // Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [adjFilter, setAdjFilter] = useState("ALL"); // ALL | INWARD | OUTWARD

  // Sort
  const [sortConfig, setSortConfig] = useState({ key: "entryDate", direction: "desc" });

  useEffect(() => {
    if (currentBranch?._id) {
      fetchRecords();
      fetchGroups();
    }
  }, [currentBranch?._id]);

  const fetchGroups = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/product-groups?branchId=${currentBranch._id}`);
      const data = await res.json();
      if (Array.isArray(data)) setProductGroups(data);
      else if (data.success) setProductGroups(data.data || []);
    } catch {}
  };

  const fetchRecords = async () => {
    setLoading(true);
    setSelectedRecords([]);
    try {
      const url = `${API_BASE}/physical-stock?branchId=${currentBranch._id}&fromDate=${fromDate}&toDate=${toDate}&limit=500`;
      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (data.success) setRecords(data.data || []);
      else throw new Error(data.message);
    } catch (err) {
      toast.error(err.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRecords.length === 0) return;
    if (!isAdmin && !isFieldVisible("action_approve")) return toast.error("No permission to approve");
    
    if (!window.confirm(`Approve ${selectedRecords.length} selected records?`)) return;

    setApproving(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedRecords) {
      try {
        const res = await fetchWithAuth(`${API_BASE}/physical-stock/${id}/approve`, {
          method: "POST",
          body: JSON.stringify({ userId: user?._id || user?.id, username: user?.username || user?.fullName, role: user?.role })
        });
        const data = await res.json();
        if (data.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    setApproving(false);
    setSelectedRecords([]);
    fetchRecords();
    
    if (failCount === 0) toast.success(`Successfully approved ${successCount} records`);
    else toast.warning(`Approved ${successCount} records, ${failCount} failed`);
  };

  const toggleSelect = (id) => {
    setSelectedRecords(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = (filtered) => {
    if (selectedRecords.length === filtered.length) setSelectedRecords([]);
    else setSelectedRecords(filtered.map(r => r._id));
  };

  const isFieldVisible = (fieldId) => {
    if (!user) return false;
    // Show everything by default
    const key = `physical-stock-entry_${fieldId}`;
    if (user.fieldPermissions?.[key] === false) return false;
    return true;
  };

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  };

  const filteredSorted = [...records]
    .filter(r => {
      const matchSearch = !searchTerm ||
        r.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.sjId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.approvedBy?.username?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchGroup = groupFilter === "ALL" || r.productGroupId === groupFilter ||
        (r.productGroupId?._id || r.productGroupId) === groupFilter;
      const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
      const matchAdj = adjFilter === "ALL"
        || (adjFilter === "INWARD" && r.inwardQty > 0)
        || (adjFilter === "OUTWARD" && r.outwardQty > 0);
      return matchSearch && matchGroup && matchStatus && matchAdj;
    })
    .sort((a, b) => {
      let va, vb;
      switch (sortConfig.key) {
        case "sjId":       va = a.sjId; vb = b.sjId; break;
        case "entryDate":  va = new Date(a.entryDate); vb = new Date(b.entryDate); break;
        case "productName": va = a.productName; vb = b.productName; break;
        case "productGroupName": va = a.productGroupName; vb = b.productGroupName; break;
        case "systemQty":  va = a.systemQty; vb = b.systemQty; break;
        case "damagedQty": va = a.damagedQty || 0; vb = b.damagedQty || 0; break;
        case "expiredQty": va = a.expiredQty || 0; vb = b.expiredQty || 0; break;
        case "physicalQty": va = a.physicalQty; vb = b.physicalQty; break;
        case "inwardQty":  va = a.inwardQty; vb = b.inwardQty; break;
        case "outwardQty": va = a.outwardQty; vb = b.outwardQty; break;
        case "status":     va = a.status; vb = b.status; break;
        default: va = a[sortConfig.key]; vb = b[sortConfig.key];
      }
      if (va < vb) return sortConfig.direction === "asc" ? -1 : 1;
      if (va > vb) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

  const SortIcon = ({ col }) => {
    if (sortConfig.key !== col) return <FaSort className="inline ml-1 opacity-20" size={8} />;
    return sortConfig.direction === "asc"
      ? <FaSortUp className="inline ml-1 text-violet-500" size={8} />
      : <FaSortDown className="inline ml-1 text-violet-500" size={8} />;
  };

  const Th = ({ label, col, right = false }) => (
    <th onClick={() => handleSort(col)}
      className={`px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-violet-600 transition-colors whitespace-nowrap ${right ? "text-right" : ""}`}>
      {label}<SortIcon col={col} />
    </th>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] pt-20 md:pt-4 md:pl-20">
      <div className="w-full px-4 py-6">

        {/* HEADER */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-700 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20">
                <FaHistory className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight">Stock Journal Records</h1>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-0.5">
                  History • {currentBranch?.name}
                </p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-3">
              {selectedRecords.length > 0 && (
                <button onClick={handleBulkApprove} disabled={approving}
                  className="px-6 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2 animate-pulse">
                  {approving ? "Approving..." : `Approve Selected (${selectedRecords.length})`}
                </button>
              )}
              <div className="flex items-center bg-gray-50 border border-gray-200 px-3 py-2.5 rounded-xl gap-2 w-full md:w-auto">
                <FaCalendarAlt className="text-violet-500 text-xs" />
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="bg-transparent text-[10px] font-black outline-none text-gray-700 w-full" />
                <span className="text-gray-300">|</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="bg-transparent text-[10px] font-black outline-none text-gray-700 w-full" />
              </div>
              <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
                <button onClick={fetchRecords} disabled={loading}
                  className="px-5 py-3 bg-violet-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-violet-700 transition shadow-lg shadow-violet-600/20 disabled:opacity-50 w-full">
                  {loading ? "..." : "Search"}
                </button>
                <a href="/branch/physical-stock"
                  className="px-5 py-3 bg-gray-800 text-white text-[10px] font-black uppercase rounded-xl hover:bg-900 transition text-center w-full shadow-lg shadow-gray-200">
                  + New
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 mb-4 flex flex-col md:flex-row items-center gap-3">
          <div className="relative w-full md:flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
            <input type="text" placeholder="Search SJ ID, product..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-violet-400 transition" />
          </div>
          <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto">
            <select className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[10px] font-black text-gray-700 outline-none w-full"
              value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
              <option value="ALL">ALL GROUPS</option>
              {productGroups.map(g => <option key={g._id} value={g._id}>{g.name.toUpperCase()}</option>)}
            </select>
            <select className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[10px] font-black text-gray-700 outline-none w-full"
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">ALL STATUS</option>
              <option value="DRAFT">DRAFT</option>
              <option value="APPROVED">APPROVED</option>
            </select>
          </div>
          <select className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[10px] font-black text-gray-700 outline-none w-full md:w-48"
            value={adjFilter} onChange={e => setAdjFilter(e.target.value)}>
            <option value="ALL">ALL ADJUSTMENTS</option>
            <option value="INWARD">INWARD ONLY</option>
            <option value="OUTWARD">OUTWARD ONLY</option>
          </select>
        </div>

        <div className="space-y-4">
          {/* DESKTOP TABLE */}
          <div className="hidden md:block bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <th className="px-4 py-4 w-10">
                      <input type="checkbox" 
                        checked={selectedRecords.length > 0 && selectedRecords.length === filteredSorted.filter(r => r.status !== "APPROVED").length}
                        onChange={() => toggleSelectAll(filteredSorted.filter(r => r.status !== "APPROVED"))}
                        className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                    </th>
                    <Th label="SJ ID" col="sjId" />
                    <Th label="Date" col="entryDate" />
                    <Th label="Product Group" col="productGroupName" />
                    <Th label="Product" col="productName" />
                    <Th label="System Qty" col="systemQty" right />
                    <Th label="Damage" col="damagedQty" right />
                    <Th label="Expired" col="expiredQty" right />
                    <Th label="Physical Qty" col="physicalQty" right />
                    <Th label="MRP" col="mrp" right />
                    <Th label="Inward ↑" col="inwardQty" right />
                    <Th label="Outward ↓" col="outwardQty" right />
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Batch / Expiry</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Checked By</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Approved By</th>
                    <Th label="Status" col="status" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan="13" className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">Loading records...</p>
                      </div>
                    </td></tr>
                  ) : filteredSorted.length === 0 ? (
                    <tr><td colSpan="13" className="px-6 py-20 text-center">
                      <div className="opacity-30 flex flex-col items-center gap-2">
                        <FaHistory size={48} className="text-gray-400" />
                        <p className="text-lg font-bold text-gray-800">No records found</p>
                      </div>
                    </td></tr>
                  ) : (
                    filteredSorted.map(r => (
                      <React.Fragment key={r._id}>
                        <tr className={`hover:bg-gray-50/80 transition-colors group ${selectedRecords.includes(r._id) ? "bg-violet-50/50" : ""}`}>
                          <td className="px-4 py-4">
                            {r.status !== "APPROVED" && (
                              <input type="checkbox" 
                                checked={selectedRecords.includes(r._id)}
                                onChange={() => toggleSelect(r._id)}
                                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-xs font-black text-violet-600">{r.sjId}</span>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-[10px] font-black text-gray-800 uppercase">
                              {new Date(r.entryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </p>
                            <p className="text-[9px] text-gray-400 font-bold">
                              {new Date(r.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-[10px] font-black text-gray-600">{r.productGroupName || "-"}</td>
                          <td className="px-4 py-4">
                            <p className="text-xs font-black text-gray-800 max-w-[150px] truncate">{r.productName}</p>
                          </td>
                          <td className="px-4 py-4 text-right text-xs font-black text-blue-600">{r.systemQty}</td>
                          <td className="px-4 py-4 text-right text-xs font-black text-rose-500">{r.damagedQty || 0}</td>
                          <td className="px-4 py-4 text-right text-xs font-black text-orange-500">{r.expiredQty || 0}</td>
                          <td className="px-4 py-4 text-right text-xs font-black text-gray-800">{r.physicalQty}</td>
                          <td className="px-4 py-4 text-right text-xs font-black text-blue-600">₹{r.mrp || 0}</td>
                          <td className="px-4 py-4 text-right">
                            {r.inwardQty > 0
                              ? <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-black">+{r.inwardQty}</span>
                              : <span className="text-gray-200 text-[10px]">-</span>}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {r.outwardQty > 0
                              ? <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[10px] font-black">-{r.outwardQty}</span>
                              : <span className="text-gray-200 text-[10px]">-</span>}
                          </td>
                          <td className="px-4 py-4">
                            {r.batch && <p className="text-[9px] font-bold text-gray-600">Batch: {r.batch}</p>}
                            {r.expiryDate && <p className="text-[9px] font-bold text-orange-500">
                              Exp: {new Date(r.expiryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                            </p>}
                            {!r.batch && !r.expiryDate && <span className="text-gray-200 text-[10px]">-</span>}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1 max-w-[140px]">
                              {(r.checkedBy || []).map((c, i) => (
                                <span key={i} className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded text-[9px] font-black">
                                  {c.username}
                                </span>
                              ))}
                              {(!r.checkedBy || r.checkedBy.length === 0) && <span className="text-gray-200 text-[10px]">-</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {r.physicalEditLog?.length > 0 && (
                              <button onClick={() => setExpandedRow(expandedRow === r._id ? null : r._id)}
                                className="flex items-center gap-1 text-[9px] font-black text-gray-400 hover:text-violet-600 transition uppercase">
                                {r.physicalEditLog.length} edit{r.physicalEditLog.length > 1 ? "s" : ""}
                                {expandedRow === r._id ? <FaChevronUp size={8} /> : <FaChevronDown size={8} />}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {r.approvedBy?.username
                              ? <div>
                                  <p className="text-[10px] font-black text-emerald-600">{r.approvedBy.username}</p>
                                  {r.approvedBy.approvedAt && (
                                    <p className="text-[9px] text-gray-400 font-bold">
                                      {new Date(r.approvedBy.approvedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                    </p>
                                  )}
                                </div>
                              : <span className="text-gray-300 text-[10px]">Pending</span>}
                          </td>
                          <td className="px-4 py-4">
                            {r.status === "APPROVED"
                              ? <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase">✓ Approved</span>
                              : <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase">Draft</span>}
                          </td>
                        </tr>
                        {/* Edit History Expand Row */}
                        {expandedRow === r._id && (
                          <tr className="bg-violet-50/30">
                            <td colSpan="13" className="px-6 py-4">
                              <div className="bg-white rounded-xl border border-violet-100 p-4">
                                <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-3">Physical Qty Edit History</p>
                                <div className="space-y-2">
                                  {r.physicalEditLog.map((log, i) => (
                                    <div key={i} className="flex items-center gap-4 text-[10px]">
                                      <span className="font-black text-gray-600">{log.username}</span>
                                      <span className="text-gray-400">
                                        {log.oldQty !== null && log.oldQty !== undefined ? `${log.oldQty} →` : "Initial:"} <strong>{log.newQty}</strong>
                                      </span>
                                      <span className="text-gray-300">
                                        {new Date(log.editedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE COMPACT TABLE (Horizontal Scroll) */}
          <div className="md:hidden">
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-3 w-8 border-r border-gray-200">
                        <input type="checkbox" 
                          checked={selectedRecords.length > 0 && selectedRecords.length === filteredSorted.filter(r => r.status !== "APPROVED").length}
                          onChange={() => toggleSelectAll(filteredSorted.filter(r => r.status !== "APPROVED"))}
                          className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                      </th>
                      {["Date", "SJ ID", "Product", "Type", "Qty", "Phy Qty", "MRP", "Status"].map(h => (
                        <th key={h} className="px-3 py-3 font-black text-[9px] uppercase tracking-widest text-gray-400 border-r last:border-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="py-20 text-center">
                          <div className="w-8 h-8 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mx-auto mb-2" />
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Loading...</p>
                        </td>
                      </tr>
                    ) : filteredSorted.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest">
                          No records found
                        </td>
                      </tr>
                    ) : (
                      filteredSorted.map(r => (
                        <tr key={r._id} className={`hover:bg-gray-50 transition-colors ${selectedRecords.includes(r._id) ? "bg-violet-50/30" : ""}`}>
                          <td className="px-3 py-3 border-r border-gray-100 text-center">
                            {r.status !== "APPROVED" && (
                              <input type="checkbox" 
                                checked={selectedRecords.includes(r._id)}
                                onChange={() => toggleSelect(r._id)}
                                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                            )}
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100 text-[10px] font-bold text-gray-500">
                            {new Date(r.entryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100 font-black text-[10px] text-violet-600">
                            {r.sjId}
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100 min-w-[150px]">
                            <p className="font-black text-gray-700 text-[10px] uppercase truncate leading-tight">{r.productName}</p>
                            <p className="text-[8px] font-bold text-gray-400 uppercase">{r.productGroupName || "-"}</p>
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100 text-center">
                            {r.inwardQty > 0 && <span className="text-emerald-600 font-black text-[9px]">INWARD</span>}
                            {r.outwardQty > 0 && <span className="text-rose-500 font-black text-[9px]">OUTWARD</span>}
                            {r.inwardQty === 0 && r.outwardQty === 0 && <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100 text-center font-black text-[10px] text-gray-700">
                            {r.inwardQty || r.outwardQty || 0}
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100 text-center font-black text-[10px] text-gray-800">
                            {r.physicalQty}
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100 text-center font-black text-[10px] text-blue-600">
                            ₹{r.mrp || 0}
                          </td>
                          <td className="px-3 py-3">
                            {r.status === "APPROVED" 
                              ? <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase">Approved</span>
                              : <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-full uppercase">Draft</span>
                            }
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
      </div>
    </div>
  );
}
