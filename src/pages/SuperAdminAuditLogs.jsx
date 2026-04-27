import { useEffect, useState } from "react";
import {
  FaClipboardList, FaBuilding, FaUser, FaClock, FaInfoCircle,
  FaSearch, FaChevronDown, FaChevronUp, FaFilter, FaTimes, FaFileExport
} from "react-icons/fa";
import { API_BASE } from "../api";
import { useBranch } from "../context/BranchContext";
import { useNavigate } from "react-router-dom";

const ACTION_META = {
  LOGIN:            { label: "Login",             color: "text-purple-700 bg-purple-100 border-purple-200" },
  // Sales Order
  CREATE_SO:        { label: "Create SO",         color: "text-green-700 bg-green-100 border-green-200" },
  UPDATE_SO:        { label: "Update SO",         color: "text-blue-700 bg-blue-100 border-blue-200" },
  CANCEL_SO:        { label: "Cancel SO",         color: "text-red-700 bg-red-100 border-red-200" },
  INVOICE_SO:       { label: "Invoice SO",        color: "text-indigo-700 bg-indigo-100 border-indigo-200" },
  RE_INVOICE_SO:    { label: "Re-Invoice SO",     color: "text-cyan-700 bg-cyan-100 border-cyan-200" },
  BACK_ORDER_EDIT:  { label: "Back Order Edit",   color: "text-orange-700 bg-orange-100 border-orange-200" },
  REQUEST_REEDIT:   { label: "Request Re-Edit",   color: "text-amber-700 bg-amber-100 border-amber-200" },
  APPROVE_REEDIT:   { label: "Approve Re-Edit",   color: "text-emerald-700 bg-emerald-100 border-emerald-200" },
  CANCEL_BILL:      { label: "Cancel Bill",       color: "text-rose-700 bg-rose-100 border-rose-200" },
  UPDATE_SALES_ORDER: { label: "Update SO",       color: "text-blue-700 bg-blue-100 border-blue-200" },
  CANCEL_INVOICE:   { label: "Cancel SI",       color: "text-rose-700 bg-rose-100 border-rose-200" },
  DELETE_INVOICE:   { label: "Delete SI",       color: "text-red-700 bg-red-100 border-red-200" },
  PRINT_BILL:       { label: "Print Bill",       color: "text-orange-700 bg-orange-100 border-orange-200" },
  GENERATE_EINVOICE: { label: "E-Invoice",      color: "text-blue-700 bg-blue-100 border-blue-200" },
  // Purchase Order
  CREATE_PO:        { label: "Create PO",         color: "text-green-700 bg-green-100 border-green-200" },
  UPDATE_PO:        { label: "Update PO",         color: "text-blue-700 bg-blue-100 border-blue-200" },
  INVOICE_PO:       { label: "Invoice PO",        color: "text-indigo-700 bg-indigo-100 border-indigo-200" },
  RE_INVOICE_PO:    { label: "Re-Invoice PO",     color: "text-cyan-700 bg-cyan-100 border-cyan-200" },
  CANCEL_PO:        { label: "Cancel PO",         color: "text-red-700 bg-red-100 border-red-200" },
  // Resources
  CREATE_SALESMAN:  { label: "New Salesman",      color: "text-teal-700 bg-teal-100 border-teal-200" },
  UPDATE_SALESMAN:  { label: "Update Salesman",   color: "text-blue-700 bg-blue-100 border-blue-200" },
  DELETE_SALESMAN:  { label: "Delete Salesman",   color: "text-red-700 bg-red-100 border-red-200" },
  CREATE_DELIVERYMAN: { label: "New Deliveryman", color: "text-teal-700 bg-teal-100 border-teal-200" },
  UPDATE_DELIVERYMAN: { label: "Update Deliveryman", color: "text-blue-700 bg-blue-100 border-blue-200" },
  DELETE_DELIVERYMAN: { label: "Delete Deliveryman", color: "text-red-700 bg-red-100 border-red-200" },
  // Product & Price
  UPDATE_PRODUCT:   { label: "Update Product",    color: "text-blue-700 bg-blue-100 border-blue-200" },
  UPDATE_PRODUCT_PRICE: { label: "Price Change",  color: "text-orange-700 bg-orange-100 border-orange-200" },
  CREATE_PRICE_REQUEST: { label: "Unlock Request", color: "text-purple-700 bg-purple-100 border-purple-200" },
  UPDATE_PRICE_REQUEST_STATUS: { label: "Unlock Approval", color: "text-indigo-700 bg-indigo-100 border-indigo-200" },
  // Users
  UPDATE_USER:      { label: "Update User",       color: "text-blue-700 bg-blue-100 border-blue-200" },
  DELETE_USER:      { label: "Delete User",       color: "text-red-700 bg-red-100 border-red-200" },
};

const getActionMeta = (action) =>
  ACTION_META[action] || { label: action.replace(/_/g, " "), color: "text-gray-700 bg-gray-100 border-gray-200" };

const SuperAdminAuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    branchId: "",
    action: "",
    username: "",
    startDate: "",
    endDate: "",
    page: 1,
  });
  const [expandedLog, setExpandedLog] = useState(null);
  const { setSuperAdminViewBranch } = useBranch();
  const navigate = useNavigate();

  const handleLogClick = (log) => {
    if (!log.branchId) return;

    // 1. Set the super admin view branch context (Teleport)
    setSuperAdminViewBranch(log.branchId);

    // 2. Extract ID from description (e.g., CSSO/649/26-27 or GFSI/038/26-27)
    // Matches patterns like AA/123/22-23 or AAAA/123/22-23
    const idMatch = log.description.match(/[A-Z]{1,5}\/\d{1,5}\/\d{2,4}-\d{2,4}/i);
    const searchId = idMatch ? idMatch[0] : "";

    // 3. Navigate based on action
    const action = log.action.toUpperCase();
    if (action.includes("INVOICE") || action.includes("BILL") || action.includes("PRINT")) {
      navigate(`/branch/sales-invoices?search=${searchId}`);
    } else if (action.includes("SO") || action.includes("ORDER")) {
      navigate(`/branch/sales-orders?search=${searchId}`);
    } else if (action.includes("CUSTOMER")) {
      navigate(`/branch/customers?search=${searchId}`);
    }
  };

  useEffect(() => { fetchBranches(); }, []);
  useEffect(() => { fetchLogs(); }, [filters]);

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_BASE}/branches`);
      const data = await res.json();
      if (data.success) setBranches(data.data);
    } catch (err) { console.error("Error fetching branches:", err); }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Remove empty params
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== "" && v !== null && v !== undefined)
      );
      const query = new URLSearchParams(params).toString();
      const res = await fetch(`${API_BASE}/audit-logs?${query}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setPagination(data.pagination);
      }
    } catch (err) { console.error("Error fetching logs:", err); }
    finally { setLoading(false); }
  };

  const syncHistory = async () => {
    if (!window.confirm("This will scan all Sales Orders and Invoices to recover missing audit logs. Proceed?")) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/audit-logs/sync-historical`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchLogs();
      } else {
        alert("Sync failed: " + data.message);
      }
    } catch (err) {
      console.error("Sync error:", err);
      alert("Failed to sync historical data.");
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({ branchId: "", action: "", username: "", startDate: "", endDate: "", page: 1 });
  };

  const hasActiveFilters = filters.branchId || filters.action || filters.username || filters.startDate || filters.endDate;

  /** Smart full diff — shows every key that changed between before & after */
  const renderDiff = (before, after) => {
    if (!before && !after) return null;
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    const skipKeys = new Set(["_id", "__v", "createdAt", "updatedAt"]);
    const changed = [];

    allKeys.forEach((key) => {
      if (skipKeys.has(key)) return;
      const bVal = before?.[key];
      const aVal = after?.[key];
      const bStr = JSON.stringify(bVal);
      const aStr = JSON.stringify(aVal);
      if (bStr !== aStr) {
        changed.push({ key, before: bVal, after: aVal });
      }
    });

    if (changed.length === 0) return <p className="text-xs text-gray-400 italic mt-1">No field-level changes recorded.</p>;

    return (
      <div className="mt-2 rounded-lg border border-blue-100 overflow-hidden bg-blue-50/40">
        <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
            Field Changes ({changed.length})
          </span>
        </div>
        <div className="divide-y divide-blue-50">
          {changed.map(({ key, before: bVal, after: aVal }) => {
            const isItems = key === "items" || key === "sampleItems";
            const isArray = Array.isArray(bVal) || Array.isArray(aVal);
            const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());

            // Special handling for items array to show qty changes
            if (isItems && isArray) {
              const bArr = bVal || [];
              const aArr = aVal || [];
              const itemChanges = [];
              
              // Build map of new items
              const aMap = {};
              aArr.forEach(i => { if (i.productId) aMap[String(i.productId)] = i; });
              
              const bMap = {};
              bArr.forEach(i => { if (i.productId) bMap[String(i.productId)] = i; });

              const allPids = new Set([...Object.keys(aMap), ...Object.keys(bMap)]);
              allPids.forEach(pid => {
                const bi = bMap[pid];
                const ai = aMap[pid];
                if (!bi && ai) itemChanges.push({ name: ai.name, action: "ADDED", qty: ai.qty });
                else if (bi && !ai) itemChanges.push({ name: bi.name, action: "REMOVED", qty: bi.qty });
                else if (bi.qty !== ai.qty || bi.price !== ai.price) {
                  itemChanges.push({ name: ai.name, action: "CHANGED", oldQty: bi.qty, newQty: ai.qty, oldPrice: bi.price, newPrice: ai.price });
                }
              });

              if (itemChanges.length === 0) return null;

              return (
                <div key={key} className="px-3 py-2 text-xs bg-white/50">
                   <div className="font-semibold text-gray-600 mb-1">{label} Array</div>
                   <div className="space-y-1 mt-1">
                     {itemChanges.map((ic, idx) => (
                       <div key={idx} className="flex items-center gap-2 text-[10px]">
                         <span className={`px-1 rounded font-bold ${ic.action === "ADDED" ? "bg-green-100 text-green-700" : ic.action === "REMOVED" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                           {ic.action}
                         </span>
                         <span className="font-medium text-gray-700 truncate max-w-[120px]">{ic.name}</span>
                         {ic.action === "CHANGED" ? (
                           <span className="text-gray-500">
                             {ic.oldQty !== ic.newQty && <span>Qty: {ic.oldQty} → {ic.newQty}</span>}
                             {ic.oldPrice !== ic.newPrice && <span className="ml-1 text-orange-600">(₹{ic.oldPrice} → ₹{ic.newPrice})</span>}
                           </span>
                         ) : (
                           <span className="text-gray-500">Qty: {ic.qty}</span>
                         )}
                       </div>
                     ))}
                   </div>
                </div>
              );
            }

            return (
              <div key={key} className="px-3 py-2 text-xs">
                <div className="font-semibold text-gray-600 mb-1">{label}</div>
                <div className="flex items-center flex-wrap gap-2">
                  <span className="line-through text-red-500 bg-red-50 px-2 py-0.5 rounded">
                    {bVal !== undefined && bVal !== null ? (typeof bVal === "object" ? "JSON" : String(bVal)) : "—"}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded">
                    {aVal !== undefined && aVal !== null ? (typeof aVal === "object" ? "JSON" : String(aVal)) : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-6 pb-10 w-full">
      <div className="w-full">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <FaClipboardList className="text-primary text-sm" />
              </span>
              Audit Logs Dashboard
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Every action tracked — logins, orders, invoices, prints &amp; slips
              {pagination.total > 0 && (
                <span className="ml-2 bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                  {pagination.total.toLocaleString()} records
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={syncHistory}
              title="Sync missing historical logs from Sales Orders"
              className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-all font-medium text-sm border border-indigo-200"
            >
              <FaClock className="mr-2 opacity-70" /> Sync History
            </button>
            <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 font-medium text-sm">
              <FaFileExport className="mr-2" /> Export Logs
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <FaFilter className="text-primary text-xs" /> Filters
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-semibold"
              >
                <FaTimes className="text-[10px]" /> Clear All
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Username search */}
            <div className="relative lg:col-span-1">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input
                type="text"
                placeholder="Search username…"
                className="w-full pl-8 pr-3 py-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-primary focus:bg-white outline-none text-sm transition"
                value={filters.username}
                onChange={(e) => setFilters({ ...filters, username: e.target.value, page: 1 })}
              />
            </div>

            {/* Branch */}
            <select
              className="px-3 py-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-primary focus:bg-white outline-none text-sm transition"
              value={filters.branchId}
              onChange={(e) => setFilters({ ...filters, branchId: e.target.value, page: 1 })}
            >
              <option value="">All Branches</option>
              {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>

            {/* Action */}
            <select
              className="px-3 py-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-primary focus:bg-white outline-none text-sm transition"
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
            >
              <option value="">All Actions</option>
              {Object.entries(ACTION_META).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>

            {/* Start Date */}
            <input
              type="date"
              className="px-3 py-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-primary focus:bg-white outline-none text-sm transition"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })}
            />

            {/* End Date */}
            <input
              type="date"
              className="px-3 py-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-primary focus:bg-white outline-none text-sm transition"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })}
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading && logs.length === 0 ? (
            <div className="p-20 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-500">Loading audit logs…</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-20 text-center text-gray-500">
              <FaInfoCircle className="text-4xl mx-auto mb-4 opacity-20" />
              <p className="font-medium">No audit logs found for the selected filters</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-3 text-primary text-sm underline">Clear filters</button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Branch</th>
                    <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="px-5 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => {
                    const meta = getActionMeta(log.action);
                    const isExpanded = expandedLog === log._id;
                    return (
                      <tr key={log._id} className="hover:bg-gray-50/70 transition-colors">

                        {/* Timestamp */}
                        <td className="px-5 py-4 min-w-[120px]">
                          <div className="text-sm text-gray-900 font-semibold">
                            {new Date(log.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </div>
                          <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <FaClock className="text-[9px]" />
                            {new Date(log.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </div>
                        </td>

                        {/* User */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                              <FaUser className="text-xs" />
                            </div>
                            <span className="text-sm font-semibold text-gray-800">{log.username}</span>
                          </div>
                        </td>

                        {/* Branch */}
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                            <FaBuilding className="text-[10px]" />
                            {log.branchId?.name || "System"}
                          </span>
                        </td>

                        {/* Action badge */}
                        <td className="px-5 py-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${meta.color}`}>
                            {meta.label}
                          </span>
                        </td>

                        {/* Details */}
                        <td className="px-5 py-4 max-w-sm">
                          <div className="flex flex-col">
                            <button
                              onClick={() => handleLogClick(log)}
                              className="text-sm text-left text-gray-600 hover:text-primary hover:underline transition-colors decoration-primary/30 underline-offset-4 font-medium"
                              title="Click to view this record"
                            >
                              {log.description.includes(" Changes: ") ? log.description.split(" Changes: ")[0] : log.description}
                            </button>
                            
                            {log.description.includes(" Changes: ") && (
                              <div className="mt-3 bg-orange-50/50 p-3 rounded-xl border border-orange-100/50 shadow-sm">
                                <div className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                                  MODIFICATION RECORDS
                                </div>
                                <div className="grid grid-cols-1 gap-1.5">
                                  {log.description.split(" Changes: ")[1].split(" | ").map((change, idx) => (
                                    <div key={idx} className="flex items-start gap-2 text-[10px] text-gray-700 bg-white/60 p-1.5 rounded-md border border-orange-50/50">
                                      <span className="text-orange-400 font-bold mt-0.5">•</span>
                                      <span className="font-bold leading-tight">{change}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          {log.changes && (log.changes.before || log.changes.after) && (
                            <>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setExpandedLog(isExpanded ? null : log._id)}
                                  className="mt-1.5 text-primary hover:underline text-xs font-semibold inline-flex items-center gap-1"
                                >
                                  {isExpanded ? "Hide Changes" : "Show Changes"}
                                  {isExpanded ? <FaChevronUp className="text-[8px]" /> : <FaChevronDown className="text-[8px]" />}
                                </button>
                              </div>
                              {isExpanded && renderDiff(log.changes.before, log.changes.after)}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="mt-6 flex justify-center items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
              disabled={filters.page <= 1}
              className="px-4 py-2 rounded-xl border text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Prev
            </button>
            {[...Array(Math.min(pagination.pages, 10))].map((_, i) => {
              const pg = i + 1;
              return (
                <button
                  key={pg}
                  onClick={() => setFilters(f => ({ ...f, page: pg }))}
                  className={`w-10 h-10 rounded-xl font-bold text-sm transition ${
                    filters.page === pg
                      ? "bg-primary text-white shadow-md shadow-primary/20"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {pg}
                </button>
              );
            })}
            {pagination.pages > 10 && <span className="text-gray-400 text-sm">…{pagination.pages} pages</span>}
            <button
              onClick={() => setFilters(f => ({ ...f, page: Math.min(pagination.pages, f.page + 1) }))}
              disabled={filters.page >= pagination.pages}
              className="px-4 py-2 rounded-xl border text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminAuditLogs;
