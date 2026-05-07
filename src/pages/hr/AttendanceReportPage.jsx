import React, { useState, useEffect } from "react";
import { 
  FaCalendarAlt, FaUser, FaFilter, FaDownload, 
  FaSearch, FaClock, FaCheckCircle, FaTimesCircle, FaMinusCircle,
  FaBuilding
} from "react-icons/fa";
import { useBranch } from "../../context/BranchContext";
import { fetchWithAuth, API_BASE } from "../../api";
import { toast } from "react-toastify";

const AttendanceReportPage = () => {
  const { currentBranch, user } = useBranch();
  const isSuperAdmin = ["SUPERADMIN", "SUPER_ADMIN"].includes(user?.role?.toUpperCase());
  
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    employeeId: "",
    branchId: currentBranch?._id || "",
    status: ""
  });

  const fetchBranches = async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/branches`);
      const data = await res.json();
      if (data.success) setBranches(data.data || []);
    } catch (err) {
      console.error("Failed to fetch branches:", err);
    }
  };

  const fetchEmployees = async () => {
    const targetBranchId = filters.branchId || currentBranch?._id;
    if (!targetBranchId) {
      setEmployees([]);
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/employees/list?branchId=${targetBranchId}`);
      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        return;
      }
      const data = await res.json();
      if (data.success) {
        setEmployees(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch employees:", error);
    }
  };

  useEffect(() => {
    console.log("🛠️ AttendanceReport State:", { 
      userRole: user?.role, 
      isSuperAdmin, 
      branchId: currentBranch?._id 
    });
  }, [user, isSuperAdmin, currentBranch]);

  // Core fetch function — accepts explicit params to avoid stale closure bug
  const fetchAttendance = async (overrideFilters) => {
    if (!user) {
      console.warn("⚠️ fetchAttendance skipped: user context not found");
      return;
    }
    if (!isSuperAdmin && !currentBranch?._id) {
      console.warn("⚠️ fetchAttendance skipped: No branch for non-superadmin");
      setLoading(false);
      return;
    }
    
    // Use override if provided (from useEffect), otherwise use current filter state
    const activeFilters = overrideFilters || filters;
    setLoading(true);
    
    try {
      const params = new URLSearchParams();
      const bId = activeFilters.branchId || (isSuperAdmin ? "" : currentBranch?._id || "");
      if (bId) params.set("branchId", bId);
      params.set("startDate", activeFilters.startDate);
      params.set("endDate", activeFilters.endDate);
      if (activeFilters.employeeId) params.set("employeeId", activeFilters.employeeId);
      if (activeFilters.status) params.set("status", activeFilters.status);

      console.log(`🚀 Fetching Attendance: /hr/attendance/logs?${params.toString()}`);
      const res = await fetchWithAuth(`${API_BASE}/hr/attendance/logs?${params.toString()}`);
      
      if (res.status === 401) {
        toast.error("Unauthorized. Please log in again.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.success) setAttendance(data.data);
    } catch (error) {
      toast.error("Failed to fetch attendance records");
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (isSuperAdmin) {
      fetchBranches();
      fetchAttendance();
    } else if (currentBranch?._id) {
      fetchEmployees();
      fetchAttendance();
    } else {
      setLoading(false);
    }
  }, []);

  // When top-bar branch changes, update filters AND fetch with new values immediately
  useEffect(() => {
    if (!currentBranch) return;
    const newFilters = { ...filters, branchId: currentBranch._id, employeeId: "" };
    setFilters(newFilters);
    fetchEmployees();
    fetchAttendance(newFilters); // pass explicit values — no stale state
  }, [currentBranch?._id]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    fetchAttendance(); // button click — state is already settled by now
  };

  const exportToCSV = () => {
    if (!attendance.length) {
      toast.warning("No data to export.");
      return;
    }

    const headers = [
      "Date",
      "Employee Name",
      "Role",
      "Branch",
      "Status",
      "Check In",
      "Check Out",
      "Work Hours",
      "Overtime Hours",
      "Location",
      "Submitted By"
    ];

    const escape = (val) => {
      const str = String(val ?? "");
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    const rows = attendance.map((log) => {
      const bName =
        log.branch?.name ||
        log.employeeId?.branch?.name ||
        log.employeeId?.branchName ||
        "—";

      const checkIn = log.presentTime
        ? new Date(log.presentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "—";
      const checkOut = log.leaveTime
        ? new Date(log.leaveTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "—";
      const date = new Date(log.date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      return [
        date,
        log.employeeId?.name || "Unknown",
        log.employeeId?.role || "Staff",
        bName,
        log.status || "—",
        checkIn,
        checkOut,
        (log.workingHours ?? 0).toFixed(2),
        (log.overtimeHours ?? 0).toFixed(2),
        log.presentLocation?.address || "No Data",
        log.markedByName || log.markedBy?.name || log.markedBy?.fullName || "Self",
      ].map(escape);
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Attendance_${filters.startDate}_to_${filters.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${attendance.length} records successfully!`);
  };

  // Calculate stats
  const stats = {
    present: attendance.filter(a => a.status === "Present").length,
    absent: attendance.filter(a => a.status === "Absent").length,
    leave: attendance.filter(a => a.status === "Leave").length,
    totalOT: attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0)
  };

  return (
    <div className="space-y-8 pt-6 px-4 md:px-0 max-w-7xl mx-auto font-poppins">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Attendance Intelligence</h1>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest mt-1">Comprehensive branch attendance analysis</p>
        </div>
        <button 
          onClick={exportToCSV}
          disabled={!attendance.length || loading}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FaDownload /> Export Report {attendance.length > 0 && `(${attendance.length})`}
        </button>
      </div>

      {/* Filters Grid */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${isSuperAdmin ? '5' : '4'} gap-6`}>
          {isSuperAdmin && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Branch</label>
              <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-2xl border-2 border-slate-100 focus-within:border-indigo-500 transition-all">
                <FaBuilding className="text-indigo-500" />
                <select 
                  name="branchId"
                  value={filters.branchId}
                  onChange={(e) => {
                    handleFilterChange(e);
                    // Clear employee filter when branch changes
                    setFilters(prev => ({ ...prev, employeeId: "" }));
                  }}
                  className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-700 outline-none w-full appearance-none cursor-pointer"
                >
                  <option value="">All Branches</option>
                  {branches.map(b => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Start Date</label>
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-2xl border-2 border-slate-100 focus-within:border-indigo-500 transition-all">
              <FaCalendarAlt className="text-indigo-500" />
              <input 
                type="date" 
                name="startDate"
                value={filters.startDate} 
                onChange={handleFilterChange}
                className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-700 outline-none w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">End Date</label>
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-2xl border-2 border-slate-100 focus-within:border-indigo-500 transition-all">
              <FaCalendarAlt className="text-indigo-500" />
              <input 
                type="date" 
                name="endDate"
                value={filters.endDate} 
                onChange={handleFilterChange}
                className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-700 outline-none w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Employee</label>
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-2xl border-2 border-slate-100 focus-within:border-indigo-500 transition-all">
              <FaUser className="text-indigo-500" />
              <select 
                name="employeeId"
                value={filters.employeeId}
                onChange={handleFilterChange}
                className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-700 outline-none w-full appearance-none cursor-pointer"
              >
                <option value="">All Employees</option>
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-end">
            <button 
              onClick={applyFilters}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
              <FaFilter /> Apply Parameters
            </button>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem]">
          <FaCheckCircle className="text-emerald-500 text-xl mb-3" />
          <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest">Total Present</p>
          <p className="text-3xl font-black text-emerald-700">{stats.present}</p>
        </div>
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem]">
          <FaTimesCircle className="text-rose-500 text-xl mb-3" />
          <p className="text-[10px] font-black text-rose-600/60 uppercase tracking-widest">Total Absent</p>
          <p className="text-3xl font-black text-rose-700">{stats.absent}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem]">
          <FaMinusCircle className="text-amber-500 text-xl mb-3" />
          <p className="text-[10px] font-black text-amber-600/60 uppercase tracking-widest">Total Leaves</p>
          <p className="text-3xl font-black text-amber-700">{stats.leave}</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem]">
          <FaClock className="text-indigo-500 text-xl mb-3" />
          <p className="text-[10px] font-black text-indigo-600/60 uppercase tracking-widest">Overtime Hours</p>
          <p className="text-3xl font-black text-indigo-700">{stats.totalOT.toFixed(1)}h</p>
        </div>
      </div>

      {/* Report Table */}
      {!currentBranch?._id && !isSuperAdmin ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-20 text-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <FaBuilding className="text-3xl text-indigo-500" />
          </div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">No Branch Selected</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest max-w-md mx-auto">
            Please select a branch from the top bar to view its attendance analytics and operational intelligence.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Date</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Employee</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Branch</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">In / Out</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Work Hours</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Overtime</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Location</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Submitted By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compiling Records...</p>
                      </div>
                    </td>
                  </tr>
                ) : attendance.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-8 py-20 text-center opacity-30">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No data matching filters</p>
                    </td>
                  </tr>
                ) : (
                  attendance.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <p className="text-xs font-black text-slate-700 uppercase">{new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </td>
                      <td className="px-8 py-6">
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase leading-tight">{log.employeeId?.name || "Unknown"}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{log.employeeId?.role || "Staff"}</p>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {(() => {
                          const bName = log.branch?.name 
                            || log.employeeId?.branch?.name 
                            || log.employeeId?.branchName
                            || null;
                          if (!bName) console.warn("🔴 No branch for log:", log._id, "emp:", log.employeeId);
                          return (
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50/50 px-3 py-1.5 rounded-lg border border-indigo-100 inline-block">
                              {bName || "—"}
                            </p>
                          );
                        })()}
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                          log.status === "Present" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          log.status === "Absent" ? "bg-rose-50 text-rose-600 border-rose-100" :
                          "bg-amber-50 text-amber-600 border-amber-100"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-700">
                            <span className="text-emerald-500 mr-2">IN:</span> 
                            {log.presentTime ? new Date(log.presentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                          </p>
                          <p className="text-[10px] font-bold text-slate-700">
                            <span className="text-rose-500 mr-2">OUT:</span> 
                            {log.leaveTime ? new Date(log.leaveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                          </p>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs font-black text-slate-700 uppercase">{log.workingHours?.toFixed(2) || "0.00"} Hrs</p>
                      </td>
                      <td className="px-8 py-6">
                        <p className={`text-xs font-black uppercase ${log.overtimeHours > 0 ? "text-amber-600" : "text-slate-400"}`}>
                          {log.overtimeHours?.toFixed(2) || "0.00"} Hrs
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-[10px] font-bold text-slate-500 max-w-[200px] truncate" title={log.presentLocation?.address}>
                          {log.presentLocation?.address || "No Data"}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-[10px] font-black text-slate-400 uppercase italic">
                          {log.markedByName || log.markedBy?.name || log.markedBy?.fullName || "Self"}
                        </p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceReportPage;
