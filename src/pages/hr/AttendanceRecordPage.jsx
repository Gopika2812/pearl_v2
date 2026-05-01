import React, { useState, useEffect } from "react";
import { 
  FaCalendarAlt, FaMapMarkerAlt, FaClock, FaUserShield, 
  FaSearch, FaFilter, FaDownload, FaUser, FaArrowRight 
} from "react-icons/fa";
import { useBranch } from "../../context/BranchContext";
import { fetchWithAuth, API_BASE } from "../../api";
import { toast } from "react-toastify";

const AttendanceRecordPage = () => {
  const { branch } = useBranch();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchLogs = async () => {
    if (!branch?._id) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/attendance/logs?branchId=${branch._id}&date=${date}`);
      const data = await res.json();
      if (data.success) {
        const records = await Promise.all(data.data.map(async (log) => {
          const updatedLog = { ...log };
          
          const resolveAddress = async (l) => {
            if (!l?.lat || (l.address && l.address !== "Location Captured")) return l.address;
            try {
              // Service 1: BigDataCloud
              const fbRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${l.lat}&longitude=${l.lng}&localityLanguage=en`);
              const fbData = await fbRes.json();
              if (fbData && fbData.city) {
                return `${fbData.locality || fbData.principalSubdivision || ""}, ${fbData.city || ""}`.trim().replace(/^,/, "");
              }
              // Service 2: Nominatim
              const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${l.lat}&lon=${l.lng}&zoom=18`);
              const nomData = await nomRes.json();
              if (nomData && nomData.display_name) {
                const parts = nomData.display_name.split(",").slice(0, 5);
                return [...new Set(parts)].join(", ");
              }
            } catch (e) {
              console.error("Geocoding repair failed:", e);
            }
            return l.address || "Location Captured";
          };

          if (updatedLog.presentLocation) {
            updatedLog.presentLocation.address = await resolveAddress(updatedLog.presentLocation);
          }
          if (updatedLog.leaveLocation) {
            updatedLog.leaveLocation.address = await resolveAddress(updatedLog.leaveLocation);
          }
          return updatedLog;
        }));

        setLogs(records);
      }
    } catch (error) {
      toast.error("Failed to fetch attendance logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [branch?._id, date]);

  const filteredLogs = logs.filter(log => 
    log.employeeId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.employeeId?.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status) {
      case "Present": return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "Absent": return "bg-rose-50 text-rose-600 border-rose-100";
      case "Leave": return "bg-amber-50 text-amber-600 border-amber-100";
      default: return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  return (
    <div className="space-y-8 pt-10 md:pt-14 px-4 md:px-0 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Attendance Records</h1>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest mt-1">Detailed history and tracking logs</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border-2 border-slate-100 focus-within:border-indigo-500 transition-all">
            <FaCalendarAlt className="text-indigo-500" />
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-sm font-black text-slate-700 uppercase cursor-pointer outline-none"
            />
          </div>
          <button className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-500 hover:text-white transition-all shadow-sm">
            <FaDownload />
          </button>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
          <FaSearch className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        </div>
        <input 
          type="text"
          placeholder="Search by employee name or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border-2 border-slate-100 rounded-3xl py-5 pl-14 pr-6 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:ring-0 transition-all shadow-sm"
        />
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Employee Details</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">In Time</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Out Time</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Work Info</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Captured Location</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Logged By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading Records...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-30">
                      <FaCalendarAlt className="text-6xl text-slate-300" />
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No records found for this date</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center font-bold">
                          {log.employeeId?.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800 uppercase leading-tight">{log.employeeId?.name || "Unknown"}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{log.employeeId?.role || "Staff"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${getStatusColor(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      {log.presentTime ? (
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                          <span className="text-[11px] font-bold text-slate-600 uppercase">{new Date(log.presentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase italic">Not Recorded</span>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      {log.leaveTime ? (
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                          <span className="text-[11px] font-bold text-slate-600 uppercase">{new Date(log.leaveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase italic">Not Recorded</span>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <FaClock className="text-indigo-400 text-xs" />
                          <span className="text-xs font-black text-slate-700">{log.workingHours?.toFixed(2) || "0.00"} Hrs</span>
                        </div>
                        {log.overtimeHours > 0 && (
                          <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full w-fit">
                            +{log.overtimeHours.toFixed(2)} OT
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="max-w-[200px]">
                        {log.presentLocation?.address ? (
                          <div className="flex items-start gap-2 group/loc">
                            <FaMapMarkerAlt className="text-rose-500 mt-1 flex-shrink-0 group-hover/loc:animate-bounce" />
                            <span className="text-[10px] font-bold text-slate-500 leading-relaxed truncate-2-lines" title={log.presentLocation.address}>
                              {log.presentLocation.address}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300 uppercase italic">No GPS Data</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center">
                          <FaUserShield className="text-xs" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 truncate max-w-[100px]">
                          {log.markedBy?.name || "System"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Mobile Disclaimer */}
      <div className="flex flex-col items-center gap-2 mb-8 md:hidden">
        <div className="flex items-center gap-2 text-indigo-500 animate-pulse">
          <FaArrowRight className="text-xs" />
          <span className="text-[10px] font-black uppercase tracking-widest">Swipe left to view more</span>
          <FaArrowRight className="text-xs" />
        </div>
      </div>
    </div>
  );
};

export default AttendanceRecordPage;
