import { useEffect, useState } from "react";
import { FaHistory, FaBuilding, FaUser, FaClock, FaInfoCircle, FaSearch, FaFilter, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { API_BASE } from "../api";

const SuperAdminAuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    branchId: "",
    action: "",
    page: 1
  });
  const [expandedLog, setExpandedLog] = useState(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_BASE}/branches`);
      const data = await res.json();
      if (data.success) {
        setBranches(data.data);
      }
    } catch (err) {
      console.error("Error fetching branches:", err);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams(filters).toString();
      const res = await fetch(`${API_BASE}/audit-logs?${query}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    if (action.includes("CREATE")) return "text-green-600 bg-green-100";
    if (action.includes("UPDATE")) return "text-blue-600 bg-blue-100";
    if (action.includes("DELETE")) return "text-red-600 bg-red-100";
    if (action === "LOGIN") return "text-purple-600 bg-purple-100";
    return "text-gray-600 bg-gray-100";
  };

  const renderDiff = (before, after) => {
    if (!before || !after) return null;
    
    // Basic diff for totals
    const fieldsToTrack = ['grandTotal', 'subtotal', 'totalTax'];
    
    return (
      <div className="mt-2 space-y-2 border-l-2 border-blue-200 pl-4 py-1">
        {fieldsToTrack.map(field => {
          if (before[field] !== after[field]) {
            return (
              <div key={field} className="text-sm">
                <span className="font-semibold capitalize">{field.replace(/([A-Z])/g, ' $1')}:</span>{' '}
                <span className="text-red-500 line-through">₹{before[field]}</span>{' '}
                <span className="text-green-600 font-bold">→ ₹{after[field]}</span>
              </div>
            );
          }
          return null;
        })}
        
        {/* Item count diff */}
        {before.items?.length !== after.items?.length && (
          <div className="text-sm">
            <span className="font-semibold">Items Count:</span>{' '}
            <span className="text-red-500">{before.items?.length} items</span>{' '}
            <span className="text-green-600 font-bold">→ {after.items?.length} items</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 px-4 md:px-8 pb-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <FaHistory className="text-primary" /> Edit Logs & Audit Trail
            </h1>
            <p className="text-gray-600 mt-1">Track every action across all branches</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              className="px-4 py-2 border rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-primary outline-none text-sm"
              value={filters.branchId}
              onChange={(e) => setFilters({ ...filters, branchId: e.target.value, page: 1 })}
            >
              <option value="">All Branches</option>
              {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>

            <select
              className="px-4 py-2 border rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-primary outline-none text-sm"
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
            >
              <option value="">All Actions</option>
              <option value="LOGIN">Login</option>
              <option value="CREATE_SO">Create Order</option>
              <option value="UPDATE_SO">Edit Order</option>
              <option value="DELETE_SO">Delete Order</option>
              <option value="FINALIZE_INVOICE">Finalize Invoice</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading && logs.length === 0 ? (
            <div className="p-20 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-500">Loading logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-20 text-center text-gray-500">
              <FaInfoCircle className="text-4xl mx-auto mb-4 opacity-20" />
              <p>No audit logs found matching your criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Branch</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 font-medium">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <FaClock className="text-[10px]" /> {new Date(log.createdAt).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <FaUser className="text-xs" />
                          </div>
                          <span className="text-sm font-semibold text-gray-700">{log.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                          <FaBuilding className="text-[10px]" /> {log.branchId?.name || "System"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getActionColor(log.action)}`}>
                          {log.action.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 max-w-md">
                          {log.description}
                          {log.changes && (
                            <button 
                              onClick={() => setExpandedLog(expandedLog === log._id ? null : log._id)}
                              className="ml-2 text-primary hover:underline text-xs font-semibold inline-flex items-center gap-1"
                            >
                              {expandedLog === log._id ? 'Hide Details' : 'Show Changes'}
                              {expandedLog === log._id ? <FaChevronUp className="text-[8px]" /> : <FaChevronDown className="text-[8px]" />}
                            </button>
                          )}
                          {expandedLog === log._id && log.changes && renderDiff(log.changes.before, log.changes.after)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            {[...Array(pagination.pages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setFilters({ ...filters, page: i + 1 })}
                className={`w-10 h-10 rounded-xl font-bold text-sm transition ${
                  filters.page === i + 1
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminAuditLogs;
