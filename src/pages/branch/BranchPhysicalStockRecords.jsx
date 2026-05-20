import React, { useState, useEffect, useRef } from "react";
import { FaHistory, FaSort, FaSortUp, FaSortDown, FaFilter, FaSearch, FaCalendarAlt, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
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
  const [viewMode, setViewMode] = useState("LIST"); // LIST | VOUCHER

  // Group search & dropdown refs
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const groupDropRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (groupDropRef.current && !groupDropRef.current.contains(event.target)) {
        setIsGroupDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProductGroups = productGroups.filter(g => 
    g.name && g.name.toLowerCase().includes(groupSearchTerm.toLowerCase())
  );


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

    try {
      const vchRes = await fetchWithAuth(`${API_BASE}/physical-stock/next-vch-id?branchId=${currentBranch._id}`);
      const vchData = await vchRes.json();
      const voucherId = vchData.success ? vchData.nextVchId : null;

      for (const id of selectedRecords) {
        try {
          const res = await fetchWithAuth(`${API_BASE}/physical-stock/${id}/approve`, {
            method: "POST",
            body: JSON.stringify({ 
              userId: user?._id || user?.id, 
              username: user?._id === "662f3a694939794936d76813" ? "superadmin" : (user?.username || user?.fullName),
              role: user?.role,
              voucherId: voucherId 
            })
          });
          const data = await res.json();
          if (data.success) successCount++;
          else failCount++;
        } catch {
          failCount++;
        }
      }
    } catch (err) {
      toast.error("Voucher generation failed");
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

  const exportToTally = () => {
    const dataToExport = selectedRecords.length > 0 
      ? records.filter(r => selectedRecords.includes(r._id))
      : filteredSorted;

    if (dataToExport.length === 0) return toast.warning("No data to export");
    
    const sourceItems = dataToExport.filter(r => r.outwardQty > 0);
    const destinationItems = dataToExport.filter(r => r.inwardQty > 0);

    const worksheetData = [
      ["Stock Journal Voucher"],
      [`Branch: ${currentBranch?.name}`],
      [`Period: ${fromDate} to ${toDate}`],
      [""],
      ["Item Name", "Godown", "Quantity", "Rate", "Amount"],
      ["Source (Consumption)", "", "", "", ""]
    ];

    let totalSource = 0;
    sourceItems.forEach(r => {
      const qty = r.outwardQty;
      const rate = r.productId?.purchasingPrice || 0;
      const amt = qty * rate;
      totalSource += amt;
      worksheetData.push([
        r.productName,
        currentBranch?.name || "Main Location",
        `${qty} ${r.productId?.units || 'pkt'}`,
        rate.toFixed(2),
        amt.toFixed(2)
      ]);
    });
    worksheetData.push(["", "", "", "Total Source:", totalSource.toFixed(2)]);
    worksheetData.push([""]);
    
    worksheetData.push(["Destination (Production)", "", "", "", ""]);
    let totalDest = 0;
    destinationItems.forEach(r => {
      const qty = r.inwardQty;
      const rate = r.productId?.purchasingPrice || 0;
      const amt = qty * rate;
      totalDest += amt;
      worksheetData.push([
        r.productName,
        currentBranch?.name || "Main Location",
        `${qty} ${r.productId?.units || 'pkt'}`,
        rate.toFixed(2),
        amt.toFixed(2)
      ]);
    });
    worksheetData.push(["", "", "", "Total Destination:", totalDest.toFixed(2)]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Stock Journal Voucher");
    XLSX.writeFile(wb, `Tally_Stock_Journal_${toDate}.xlsx`);
    toast.success("Tally Voucher exported!");
  };

  const toggleSelectAll = (filtered) => {
    if (selectedRecords.length === filtered.length) setSelectedRecords([]);
    else setSelectedRecords(filtered.map(r => r._id));
  };

  const isFieldVisible = (fieldId) => {
    if (!user) return false;
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
                <button onClick={exportToTally}
                  className="px-5 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20 w-full">
                  Tally Export
                </button>
                <a href="/branch/physical-stock"
                  className="px-5 py-3 bg-gray-800 text-white text-[10px] font-black uppercase rounded-xl hover:bg-900 transition text-center w-full shadow-lg shadow-gray-200">
                  + New
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* FILTERS & VIEW TOGGLE */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 mb-4 flex flex-col md:flex-row items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
            <button 
              onClick={() => setViewMode("LIST")}
              className={`flex-1 md:w-32 px-4 py-2 text-[10px] font-black uppercase rounded-lg transition ${viewMode === "LIST" ? "bg-white text-violet-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
              Detailed List
            </button>
            <button 
              onClick={() => setViewMode("VOUCHER")}
              className={`flex-1 md:w-32 px-4 py-2 text-[10px] font-black uppercase rounded-lg transition ${viewMode === "VOUCHER" ? "bg-white text-violet-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
              Grouped (VCH)
            </button>
          </div>
          <div className="w-px h-6 bg-gray-200 hidden md:block" />
          <div className="relative w-full md:flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
            <input type="text" placeholder="Search SJ ID, product..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-violet-400 transition" />
          </div>
          <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-56" ref={groupDropRef}>
              <button type="button" onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[10px] font-black text-gray-700 outline-none w-full flex items-center justify-between gap-2 uppercase tracking-wider shadow-sm hover:bg-gray-100 transition-colors">
                <span>
                  {groupFilter === "ALL" 
                    ? "ALL GROUPS" 
                    : (productGroups.find(g => g._id === groupFilter)?.name || "UNKNOWN GROUP").toUpperCase()
                  }
                </span>
                <FaChevronDown size={8} className={`text-gray-400 transition-transform ${isGroupDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isGroupDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2 min-w-[220px]">
                  <div className="relative mb-2">
                    <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={10} />
                    <input type="text" placeholder="Search group..."
                      value={groupSearchTerm} onChange={e => setGroupSearchTerm(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-7 pr-2.5 py-1.5 text-[11px] font-bold text-gray-700 outline-none focus:border-violet-400 focus:bg-white transition" />
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    <button type="button" onClick={() => {
                      setGroupFilter("ALL");
                      setIsGroupDropdownOpen(false);
                      setGroupSearchTerm("");
                    }}
                      className={`w-full text-left px-2.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors ${groupFilter === "ALL" ? "bg-violet-50 text-violet-700" : "text-gray-600 hover:bg-gray-50"}`}>
                      ALL GROUPS
                    </button>
                    {filteredProductGroups.length > 0 ? (
                      filteredProductGroups.map(g => (
                        <button key={g._id} type="button" onClick={() => {
                          setGroupFilter(g._id);
                          setIsGroupDropdownOpen(false);
                          setGroupSearchTerm("");
                        }}
                          className={`w-full text-left px-2.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors ${groupFilter === g._id ? "bg-violet-50 text-violet-700" : "text-gray-600 hover:bg-gray-50"}`}>
                          {g.name}
                        </button>
                      ))
                    ) : (
                      <div className="text-[10px] font-bold text-gray-400 text-center py-2">No groups found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
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
          {/* DESKTOP VIEW */}
          <div className="hidden md:block bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                {viewMode === "LIST" ? (
                  <>
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
                        <Th label="Group" col="productGroupName" />
                        <Th label="Product" col="productName" />
                        <Th label="System" col="systemQty" right />
                        <Th label="Damage" col="damagedQty" right />
                        <Th label="Expired" col="expiredQty" right />
                        <Th label="Phys" col="physicalQty" right />
                        <Th label="MRP" col="mrp" right />
                        <Th label="In ↑" col="inwardQty" right />
                        <Th label="Out ↓" col="outwardQty" right />
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Batch/Exp</th>
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap">Approved By</th>
                        <Th label="Status" col="status" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loading ? (
                        <tr><td colSpan="15" className="px-6 py-20 text-center"><div className="w-8 h-8 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mx-auto" /></td></tr>
                      ) : (
                        filteredSorted.map(r => (
                          <tr key={r._id} className={`hover:bg-gray-50/80 transition-colors group ${selectedRecords.includes(r._id) ? "bg-violet-50/50" : ""}`}>
                            <td className="px-4 py-4">
                              {r.status !== "APPROVED" && (
                                <input type="checkbox" 
                                  checked={selectedRecords.includes(r._id)}
                                  onChange={() => toggleSelect(r._id)}
                                  className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                              )}
                            </td>
                            <td className="px-4 py-4 font-black text-violet-600 text-[11px]">{r.sjId}</td>
                            <td className="px-4 py-4">
                              <p className="text-[10px] font-black text-gray-800 uppercase">{new Date(r.entryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>
                              <p className="text-[9px] text-gray-400 font-bold">{new Date(r.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</p>
                            </td>
                            <td className="px-4 py-4 text-[10px] font-black text-gray-600">{r.productGroupName || "-"}</td>
                            <td className="px-4 py-4 font-black text-gray-800 text-[11px] min-w-[200px]">{r.productName}</td>
                            <td className="px-4 py-4 text-right font-black text-blue-600">{r.systemQty}</td>
                            <td className="px-4 py-4 text-right font-black text-rose-500">{r.damagedQty || 0}</td>
                            <td className="px-4 py-4 text-right font-black text-orange-500">{r.expiredQty || 0}</td>
                            <td className="px-4 py-4 text-right font-black text-gray-800">{r.physicalQty}</td>
                            <td className="px-4 py-4 text-right font-black text-blue-600">₹{r.mrp || 0}</td>
                            <td className="px-4 py-4 text-right">
                              {r.inwardQty > 0 ? <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-black">+{r.inwardQty}</span> : "-"}
                            </td>
                            <td className="px-4 py-4 text-right">
                              {r.outwardQty > 0 ? <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[10px] font-black">-{r.outwardQty}</span> : "-"}
                            </td>
                            <td className="px-4 py-4">
                              {r.batch && <p className="text-[9px] font-bold text-gray-600">B: {r.batch}</p>}
                              {r.expiryDate && <p className="text-[9px] font-bold text-orange-500">E: {new Date(r.expiryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {r.approvedBy?.username ? (
                                <div>
                                  <p className="text-[10px] font-black text-emerald-600">{r.approvedBy.username}</p>
                                  {r.voucherId && <p className="text-[8px] font-black text-violet-400 uppercase tracking-tighter">VCH: {r.voucherId}</p>}
                                </div>
                              ) : <span className="text-gray-300 text-[10px]">Pending</span>}
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${r.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100">
                        <th className="px-6 py-4 w-10">
                          <input type="checkbox" 
                            checked={selectedRecords.length > 0 && Object.values(filteredSorted.reduce((acc, r) => {
                              const vchId = r.voucherId || `NO_VCH_${r._id}`;
                              if (!acc[vchId]) acc[vchId] = { id: vchId, items: r.status !== "APPROVED" ? [r] : [] };
                              return acc;
                            }, {})).every(vch => vch.items.every(item => selectedRecords.includes(item._id)))}
                            onChange={() => {
                              const allIds = filteredSorted.map(r => r._id);
                              if (selectedRecords.length === allIds.length) setSelectedRecords([]);
                              else setSelectedRecords(allIds);
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                        </th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 w-16">Voucher</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Date</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Items</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Inward Val</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Outward Val</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Approved By</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loading ? (
                        <tr><td colSpan="7" className="px-6 py-20 text-center"><div className="w-8 h-8 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mx-auto" /></td></tr>
                      ) : (
                        Object.values(filteredSorted.reduce((acc, r) => {
                          const vchId = r.voucherId || `NO_VCH_${r._id}`;
                          if (!acc[vchId]) acc[vchId] = { id: vchId, date: r.entryDate, items: [], status: r.status, approvedBy: r.approvedBy, isIndividual: !r.voucherId };
                          acc[vchId].items.push(r);
                          return acc;
                        }, {})).map(vch => (
                          <React.Fragment key={vch.id}>
                            <tr className="hover:bg-violet-50/50 cursor-pointer transition-colors group">
                              <td className="px-6 py-4">
                                <input type="checkbox" 
                                  checked={vch.items.every(item => selectedRecords.includes(item._id))}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const ids = vch.items.map(i => i._id);
                                    if (vch.items.every(item => selectedRecords.includes(item._id))) {
                                      setSelectedRecords(prev => prev.filter(id => !ids.includes(id)));
                                    } else {
                                      setSelectedRecords(prev => [...new Set([...prev, ...ids])]);
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                              </td>
                              <td className="px-6 py-4" onClick={() => setExpandedRow(expandedRow === vch.id ? null : vch.id)}>
                                <div className="flex items-center gap-3">
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition ${expandedRow === vch.id ? "bg-violet-600 text-white" : "bg-violet-100 text-violet-600"}`}>
                                    {expandedRow === vch.id ? <FaChevronUp size={8} /> : <FaChevronDown size={8} />}
                                  </div>
                                  <span className={`text-[11px] font-black ${vch.isIndividual ? "text-gray-400 italic" : "text-violet-600"}`}>
                                    {vch.isIndividual ? "Single Item" : vch.id}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-[10px] font-black text-gray-800 uppercase">{new Date(vch.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-[10px] font-black">{vch.items.length} Product{vch.items.length > 1 ? "s" : ""}</span>
                              </td>
                              <td className="px-6 py-4 text-right font-black text-emerald-600 text-[11px]">
                                {vch.items.reduce((sum, item) => sum + (item.inwardQty || 0), 0)} Qty
                              </td>
                              <td className="px-6 py-4 text-right font-black text-rose-500 text-[11px]">
                                {vch.items.reduce((sum, item) => sum + (item.outwardQty || 0), 0)} Qty
                              </td>
                              <td className="px-6 py-4">
                                {vch.approvedBy?.username ? (
                                  <p className="text-[10px] font-black text-emerald-600">{vch.approvedBy.username}</p>
                                ) : <span className="text-gray-300 text-[10px]">Pending</span>}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${vch.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                  {vch.status}
                                </span>
                              </td>
                            </tr>
                            {expandedRow === vch.id && (
                              <tr className="bg-gray-50/50">
                                <td colSpan="7" className="p-0">
                                  <div className="p-4 border-l-4 border-violet-600 bg-white ml-6 my-2 rounded-xl shadow-inner overflow-hidden">
                                    <table className="w-full text-left">
                                      <thead>
                                        <tr className="border-b border-gray-100">
                                          <th className="px-3 py-2 text-[9px] font-black text-gray-400 uppercase">SJ ID</th>
                                          <th className="px-3 py-2 text-[9px] font-black text-gray-400 uppercase">Product</th>
                                          <th className="px-3 py-2 text-[9px] font-black text-gray-400 uppercase text-right">System</th>
                                          <th className="px-3 py-2 text-[9px] font-black text-gray-400 uppercase text-right">Phys</th>
                                          <th className="px-3 py-2 text-[9px] font-black text-gray-400 uppercase text-right text-emerald-600">In ↑</th>
                                          <th className="px-3 py-2 text-[9px] font-black text-gray-400 uppercase text-right text-rose-500">Out ↓</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-50">
                                        {vch.items.map(item => (
                                          <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-3 py-2 text-[10px] font-bold text-violet-500">{item.sjId}</td>
                                            <td className="px-3 py-2 text-[10px] font-black text-gray-700">{item.productName}</td>
                                            <td className="px-3 py-2 text-right text-[10px] font-bold text-gray-400">{item.systemQty}</td>
                                            <td className="px-3 py-2 text-right text-[10px] font-black text-gray-800">{item.physicalQty}</td>
                                            <td className="px-3 py-2 text-right text-[10px] font-black text-emerald-600">{item.inwardQty || "-"}</td>
                                            <td className="px-3 py-2 text-right text-[10px] font-black text-rose-500">{item.outwardQty || "-"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </>
                )}
              </table>
            </div>
          </div>

          {/* MOBILE VIEW */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="p-10 text-center animate-pulse text-[10px] font-black text-gray-400 uppercase">Fetching records...</div>
            ) : filteredSorted.length === 0 ? (
              <div className="p-10 text-center text-[10px] font-black text-gray-300 uppercase italic">No records found</div>
            ) : viewMode === "LIST" ? (
              filteredSorted.map(r => (
                <div key={r._id} className={`bg-white p-4 rounded-2xl border ${selectedRecords.includes(r._id) ? "border-violet-500 bg-violet-50/20" : "border-gray-200"} shadow-sm`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      {r.status !== "APPROVED" && (
                        <input type="checkbox" checked={selectedRecords.includes(r._id)} onChange={() => toggleSelect(r._id)} />
                      )}
                      <div>
                        <p className="text-[11px] font-black text-violet-600">{r.sjId}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">{new Date(r.entryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${r.status === "APPROVED" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>{r.status}</span>
                  </div>
                  <h3 className="text-[11px] font-black text-gray-800 uppercase mb-2 leading-tight">{r.productName}</h3>
                  <div className="grid grid-cols-3 gap-2 border-t border-gray-50 pt-2">
                    <div className="text-center"><p className="text-[8px] font-bold text-gray-400 uppercase">System</p><p className="text-[10px] font-black text-blue-600">{r.systemQty}</p></div>
                    <div className="text-center"><p className="text-[8px] font-bold text-gray-400 uppercase">Physical</p><p className="text-[10px] font-black text-gray-700">{r.physicalQty}</p></div>
                    <div className="text-center">
                      <p className="text-[8px] font-bold text-gray-400 uppercase">Adj</p>
                      <p className={`text-[10px] font-black ${r.inwardQty > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                        {r.inwardQty > 0 ? `+${r.inwardQty}` : r.outwardQty > 0 ? `-${r.outwardQty}` : "0"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              Object.values(filteredSorted.reduce((acc, r) => {
                const vchId = r.voucherId || `IND_${r._id}`;
                if (!acc[vchId]) acc[vchId] = { id: vchId, date: r.entryDate, items: [], status: r.status };
                acc[vchId].items.push(r);
                return acc;
              }, {})).map(vch => (
                <div key={vch.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="p-4 flex justify-between items-center" onClick={() => setExpandedRow(expandedRow === vch.id ? null : vch.id)}>
                    <div>
                      <p className="text-[11px] font-black text-violet-600 uppercase">{vch.id.startsWith("IND_") ? "Single Adjustment" : vch.id}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">{new Date(vch.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-700">{vch.items.length} Items</p>
                        <p className="text-[8px] font-black uppercase text-emerald-600">+{vch.items.reduce((s,i)=>s+(i.inwardQty||0),0)} / <span className="text-rose-500">-{vch.items.reduce((s,i)=>s+(i.outwardQty||0),0)}</span></p>
                      </div>
                      <FaChevronDown className={`text-gray-300 transition-transform ${expandedRow === vch.id ? "rotate-180" : ""}`} size={10} />
                    </div>
                  </div>
                  {expandedRow === vch.id && (
                    <div className="bg-gray-50 p-3 border-t border-gray-100 space-y-2">
                      {vch.items.map(item => (
                        <div key={item._id} className="bg-white p-2 rounded-lg border border-gray-100 flex justify-between items-center">
                          <p className="text-[9px] font-black text-gray-700 uppercase flex-1 truncate mr-2">{item.productName}</p>
                          <div className="flex gap-3">
                            <span className="text-[9px] font-black text-blue-500">S:{item.systemQty}</span>
                            <span className="text-[9px] font-black text-gray-700">P:{item.physicalQty}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
