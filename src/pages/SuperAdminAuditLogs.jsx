import { useEffect, useState } from "react";
import {
  FaClipboardList, FaBuilding, FaUser, FaClock, FaInfoCircle,
  FaSearch, FaChevronDown, FaChevronUp, FaFilter, FaTimes, FaFileExport
} from "react-icons/fa";
import { API_BASE } from "../api";

const ACTION_META = {
  LOGIN:            { label: "Login",             color: "text-purple-700 bg-purple-100 border-purple-200" },
  CREATE_SO:        { label: "Create Order",       color: "text-green-700 bg-green-100 border-green-200" },
  UPDATE_SO:        { label: "Edit Order",         color: "text-blue-700 bg-blue-100 border-blue-200" },
  DELETE_SO:        { label: "Delete Order",       color: "text-red-700 bg-red-100 border-red-200" },
  FINALIZE_INVOICE: { label: "Generate Invoice",   color: "text-indigo-700 bg-indigo-100 border-indigo-200" },
  PRINT_BILL:       { label: "Print Bill",         color: "text-orange-700 bg-orange-100 border-orange-200" },
  GENERATE_SLIP:    { label: "Generate Slip",      color: "text-teal-700 bg-teal-100 border-teal-200" },
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

  const clearFilters = () => {
    setFilters({ branchId: "", action: "", username: "", startDate: "", endDate: "", page: 1 });
  };

  const hasActiveFilters = filters.branchId || filters.action || filters.username || filters.startDate || filters.endDate;

  /** Smart full diff — shows every key that changed between before & after */
  const renderDiff = (before, after) => {
    if (!before && !after) return null;
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    // Skip noisy internal/array keys we can't easily display
    const skipKeys = new Set(["_id", "__v", "createdAt", "updatedAt"]);
    const changed = [];

    allKeys.forEach((key) => {
      if (skipKeys.has(key)) return;
      const bVal = before?.[key];
      const aVal = after?.[key];
      // Stringify for deep compare
      const bStr = JSON.stringify(bVal);
      const aStr = JSON.stringify(aVal);
      if (bStr !== aStr) {
        changed.push({ key, before: bVal, after: aVal });
      }
    });

    if (changed.length === 0) return <p className="text-xs text-gray-400 italic mt-1">No field-level changes recorded.</p>;

    return (
      <div className="mt-2 rounded-lg border border-blue-100 overflow-hidden bg-blue-50/40">
        <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100">
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
            Field Changes ({changed.length})
          </span>
        </div>
        <div className="divide-y divide-blue-50">
          {changed.map(({ key, before: bVal, after: aVal }) => {
            const isArray = Array.isArray(bVal) || Array.isArray(aVal);
            const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
            return (
              <div key={key} className="px-3 py-2 text-xs">
                <div className="font-semibold text-gray-600 mb-1">{label}</div>
                {isArray ? (
                  <span className="text-gray-500 italic">
                    {Array.isArray(bVal) ? bVal.length : 0} items → {Array.isArray(aVal) ? aVal.length : 0} items
                  </span>
                ) : (
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="line-through text-red-500 bg-red-50 px-2 py-0.5 rounded">
                      {bVal !== undefined && bVal !== null ? String(bVal) : "—"}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded">
                      {aVal !== undefined && aVal !== null ? String(aVal) : "—"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 px-4 md:px-8 pb-10">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <FaClipboardList className="text-primary text-sm" />
              </span>
              Audit Logs
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Every action tracked — login, orders, invoices, prints &amp; slips
              {pagination.total > 0 && (
                <span className="ml-2 bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                  {pagination.total.toLocaleString()} records
                </span>
              )}
            </p>
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
                          <p className="text-sm text-gray-600">{log.description}</p>
                          {log.changes && (log.changes.before || log.changes.after) && (
                            <>
                              <button
                                onClick={() => setExpandedLog(isExpanded ? null : log._id)}
                                className="mt-1.5 text-primary hover:underline text-xs font-semibold inline-flex items-center gap-1"
                              >
                                {isExpanded ? "Hide Changes" : "Show Changes"}
                                {isExpanded ? <FaChevronUp className="text-[8px]" /> : <FaChevronDown className="text-[8px]" />}
                              </button>
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
