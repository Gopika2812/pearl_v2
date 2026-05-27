import { useState, useEffect } from "react";
import { 
  FaHome, FaPhone, FaCalendarCheck, FaClock, FaTicketAlt, FaCheckCircle, FaCheck,
  FaInbox, FaChartLine, FaFileInvoiceDollar, FaMoneyBillWave, FaUsers, 
  FaBan, FaFileSignature, FaUser, FaTimes, FaRunning, FaMapMarkerAlt, 
  FaComment, FaLock, FaEnvelope, FaBuilding, FaChevronRight, FaAddressCard, FaIdCard, FaShieldAlt 
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { useBranch } from "../../context/BranchContext";
import { API_BASE, fetchWithAuth } from "../../api";
import { toast } from "react-toastify";

// Helper for date ranges
const getDateRange = (rangeType) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  const start = new Date(today);
  const end = new Date(today);
  end.setHours(23,59,59,999);

  switch(rangeType) {
    case 'today':
      return { startDate: start, endDate: end };
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      return { startDate: start, endDate: end };
    case 'thisWeek':
      start.setDate(start.getDate() - start.getDay()); // Sunday as start
      return { startDate: start, endDate: end };
    case 'thisMonth':
      start.setDate(1);
      return { startDate: start, endDate: end };
    case 'thisYear':
      start.setMonth(0, 1);
      return { startDate: start, endDate: end };
    default:
      return { startDate: start, endDate: end };
  }
}

export default function BranchHome() {
  const { branch, user, currentBranch } = useBranch();
  const [tokens, setTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  
  // Dashboard state (Super Admin Only)
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [filterType, setFilterType] = useState("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Non-SuperAdmin State (Personal Dashboard)
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (currentBranch?._id) {
      fetchMyTokens();
      if (isSuperAdmin) {
        fetchDashboardStats();
      } else {
        fetchTodayAttendance();
        fetchAttendanceLogs();
      }
    }
  }, [currentBranch?._id, filterType, isSuperAdmin]);

  const fetchMyTokens = async () => {
    setLoadingTokens(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/tokens/reminders/my`);
      const data = await res.json();
      if (data.success) {
        setTokens(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching tokens:", err);
    } finally {
      setLoadingTokens(false);
    }
  };

  const fetchDashboardStats = async (startOverride, endOverride) => {
    setLoadingStats(true);
    try {
      let startDate, endDate;
      
      if (startOverride && endOverride) {
        startDate = new Date(startOverride);
        endDate = new Date(endOverride);
      } else if (filterType !== 'custom') {
        const range = getDateRange(filterType);
        startDate = range.startDate;
        endDate = range.endDate;
      } else {
        if (!customStart || !customEnd) return;
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const res = await fetchWithAuth(`${API_BASE}/branches/${currentBranch._id}/dashboard-stats?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Standard User: Fetch Today's Attendance Status
  const fetchTodayAttendance = async () => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const res = await fetchWithAuth(`${API_BASE}/hr/attendance/daily?branchId=${currentBranch?._id}&date=${todayStr}`);
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        const record = data.data[0];
        if (record.presentLocation) {
          record.presentLocation.address = await resolveAddress(record.presentLocation);
        }
        if (record.leaveLocation) {
          record.leaveLocation.address = await resolveAddress(record.leaveLocation);
        }
        setTodayAttendance(record);
      } else {
        setTodayAttendance(null);
      }
    } catch (err) {
      console.error("Error fetching today's attendance:", err);
    }
  };

  // Standard User: Fetch Attendance Logs
  const fetchAttendanceLogs = async () => {
    setLoadingAttendance(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/attendance/logs?branchId=${currentBranch?._id}`);
      const data = await res.json();
      if (data.success) {
        // Resolve client-side addresses for the logs in the history list if needed
        const resolvedLogs = await Promise.all((data.data || []).map(async (log) => {
          const updatedLog = { ...log };
          if (updatedLog.presentLocation) {
            updatedLog.presentLocation.address = await resolveAddress(updatedLog.presentLocation);
          }
          if (updatedLog.leaveLocation) {
            updatedLog.leaveLocation.address = await resolveAddress(updatedLog.leaveLocation);
          }
          return updatedLog;
        }));
        setAttendanceLogs(resolvedLogs);
      }
    } catch (err) {
      console.error("Error fetching attendance logs:", err);
    } finally {
      setLoadingAttendance(false);
    }
  };

  // Geolocation helpers
  const getPosition = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          (error) => {
            reject(error);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    });
  };

  const resolveAddress = async (l) => {
    if (!l?.lat || (l.address && l.address !== "Location Captured")) return l.address;
    try {
      const fbRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${l.lat}&longitude=${l.lng}&localityLanguage=en`);
      const fbData = await fbRes.json();
      if (fbData && fbData.city) {
        return `${fbData.locality || fbData.principalSubdivision || ""}, ${fbData.city || ""}`.trim().replace(/^,/, "");
      }
      const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${l.lat}&lon=${l.lng}&zoom=18`);
      const nomData = await nomRes.json();
      if (nomData && nomData.display_name) {
        const parts = nomData.display_name.split(",").slice(0, 7);
        return [...new Set(parts)].join(", ");
      }
    } catch (e) {
      console.error("Client-side geocoding failed:", e);
    }
    return l.address || "Location Captured";
  };

  // Handle Mark Attendance (GPS Clock-In/Out)
  const handleMarkAttendance = async (status, customComment = "") => {
    if (!currentBranch?._id) {
      toast.error("Branch details not fully loaded.");
      return;
    }
    try {
      setFetchingLocation(true);
      toast.info("Capturing exact GPS Coordinates...", { autoClose: 1500 });
      const location = await getPosition();
      console.log("📍 Dashboard GPS Captured:", location);

      if (!location || !location.lat || isNaN(location.lat)) {
        throw new Error("Could not retrieve precise coordinates. Please enable GPS and allow location access.");
      }

      let workingHours = 0;
      if ((status === "Leave" || status === "Absent") && todayAttendance?.status === "Present" && todayAttendance?.presentTime) {
        const presentTime = new Date(todayAttendance.presentTime);
        const leaveTime = new Date();
        const diffHrs = (leaveTime - presentTime) / (1000 * 60 * 60);
        workingHours = diffHrs;

        if (diffHrs > 9 && !customComment) {
          const note = prompt(`Overtime of ${diffHrs.toFixed(2)} hours detected. Please specify the shift overtime description:`);
          if (note === null) {
            setFetchingLocation(false);
            return;
          }
          customComment = note || "Overtime shift";
        }
      }

      const todayStr = new Date().toISOString().split("T")[0];
      const res = await fetchWithAuth(`${API_BASE}/hr/attendance/mark`, {
        method: "POST",
        body: JSON.stringify({
          employeeId: user?.id || user?._id,
          date: todayStr,
          status,
          location,
          comment: customComment,
          branchId: currentBranch?._id
        })
      });
      const data = await res.json();
      if (data.success) {
        const record = data.data;
        if (record.presentLocation) {
          record.presentLocation.address = await resolveAddress(record.presentLocation);
        }
        if (record.leaveLocation) {
          record.leaveLocation.address = await resolveAddress(record.leaveLocation);
        }
        setTodayAttendance(record);
        toast.success(`Attendance successfully clocked: ${status}`);
        fetchAttendanceLogs(); // refresh timeline
      } else {
        toast.error(data.message || "Failed to mark attendance.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to capture location.");
    } finally {
      setFetchingLocation(false);
    }
  };

  const handleCustomFilter = () => {
    if (!customStart || !customEnd) return;
    setFilterType("custom");
    fetchDashboardStats(customStart, customEnd);
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  // ----------------------------------------------------
  // RENDER STANDARD USER DASHBOARD
  // ----------------------------------------------------
  if (!isSuperAdmin) {
    const isPresent = (todayAttendance?.status === "Present" || !!todayAttendance?.presentTime) && !todayAttendance?.leaveTime;
    const isLeft = !!todayAttendance?.leaveTime;
    const isFinished = !!todayAttendance?.leaveTime || todayAttendance?.status === "Absent" || todayAttendance?.status === "Leave";
    const userInitials = (user?.name || user?.username || "BU").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

    return (
      <div className="min-h-screen bg-slate-50 pt-20 md:pt-4 md:pl-20 px-4 md:px-6 pb-10">
        <div className="max-w-[1400px] mx-auto space-y-6">
          
          {/* HEADER BANNER */}
          <div className="bg-[#00376B] text-white rounded-3xl shadow-xl p-8 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#319CD3] rounded-full mix-blend-screen filter blur-3xl opacity-40 translate-x-1/2 -translate-y-1/2"></div>
            <div className="relative z-10">
              <h1 className="text-3xl font-black mb-1">
                Welcome back, {user?.name || user?.username} 👋
              </h1>
              <p className="text-[#319CD3] font-semibold tracking-wide flex items-center gap-2">
                <span>Branch Workspace:</span> 
                <span className="text-white bg-white/10 px-2 py-0.5 rounded text-xs font-bold">{branch?.name || "Global Headquarters"}</span> 
                <span>|</span> 
                <span>Location:</span> 
                <span className="text-white">{branch?.location || "Not Set"}</span>
              </p>
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/20 shadow-lg">
                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]"></div>
                <span className="text-sm font-bold text-white tracking-widest uppercase">System Online</span>
              </div>
            </div>
          </div>

          {/* MAIN COLUMN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* LEFT / CENTER COLUMN: PROFILE & ATTENDANCE */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* PROFILE & ROLES INFO CARD */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm hover:shadow-md transition duration-300 relative overflow-hidden">
                <div className="absolute -right-16 -top-16 w-36 h-36 bg-sky-50 rounded-full opacity-60"></div>
                
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <FaIdCard className="text-sky-500 text-sm" /> 
                  Personal Identification & Credentials
                </h3>

                <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                  {/* Beautiful Avatar */}
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#00376B] to-[#319CD3] text-white flex items-center justify-center font-black text-2xl shadow-lg border-2 border-white ring-4 ring-sky-100 flex-shrink-0 animate-in zoom-in duration-500">
                    {userInitials}
                  </div>

                  <div className="flex-1 space-y-6 w-full text-center md:text-left">
                    <div>
                      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-center md:justify-start">
                        <h2 className="text-2xl font-black text-slate-800 uppercase">{user?.name || user?.username}</h2>
                        <span className="w-fit mx-auto md:mx-0 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-[10px] tracking-widest uppercase rounded-full shadow-sm">
                          {user?.role || "BRANCH MEMBER"}
                        </span>
                      </div>
                      <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mt-1">{branch?.name}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <FaEnvelope className="text-slate-400 flex-shrink-0" />
                        <div className="text-left">
                          <p className="text-[8px] font-black text-slate-400 uppercase">Email Address</p>
                          <p className="text-xs font-bold text-slate-700 truncate">{user?.email || "No Email Provided"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <FaPhone className="text-slate-400 flex-shrink-0" />
                        <div className="text-left">
                          <p className="text-[8px] font-black text-slate-400 uppercase">Phone Contact</p>
                          <p className="text-xs font-bold text-slate-700">{user?.phone || branch?.phone || "-"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <FaBuilding className="text-slate-400 flex-shrink-0" />
                        <div className="text-left">
                          <p className="text-[8px] font-black text-slate-400 uppercase">GSTIN / TAX CODE</p>
                          <p className="text-xs font-bold text-slate-700">{branch?.gstin || "Not Registered"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <FaAddressCard className="text-slate-400 flex-shrink-0" />
                        <div className="text-left">
                          <p className="text-[8px] font-black text-slate-400 uppercase">Branch Identification</p>
                          <p className="text-xs font-bold text-slate-700">{branch?.code || "HQ-001"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Micro-Permissions Badges */}
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <FaShieldAlt className="text-emerald-500" /> Active Security Permissions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[9px] font-black uppercase">Clock Attendance</span>
                    <span className="px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-100 rounded-lg text-[9px] font-black uppercase">Create Vouchers</span>
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[9px] font-black uppercase">Inventory View</span>
                    <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-100 rounded-lg text-[9px] font-black uppercase">Receive Reminders</span>
                  </div>
                </div>
              </div>

              {/* LIVE GEOLOCATION ATTENDANCE WIDGET */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm hover:shadow-md transition duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-50 pb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <FaCalendarCheck className="text-indigo-500 text-sm" /> 
                    Live GPS Attendance & Clocking Center
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Today's Date:</span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[9px] font-black rounded-lg border border-slate-200">
                      {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  
                  {/* Status Indicator */}
                  <div className="md:col-span-1 bg-slate-50 border border-slate-100 p-6 rounded-2xl flex flex-col items-center justify-center text-center h-full">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">CLOCKING STATUS</p>
                    {isPresent ? (
                      <div className="space-y-2 animate-in zoom-in duration-500">
                        <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-100 mx-auto text-xl relative">
                          <FaCheck className="animate-pulse" />
                          <span className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping opacity-75"></span>
                        </div>
                        <p className="text-xs font-black text-emerald-600 uppercase tracking-wider">ACTIVE ON DUTY</p>
                      </div>
                    ) : isLeft ? (
                      <div className="space-y-2 animate-in zoom-in duration-500">
                        <div className="w-14 h-14 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-amber-100 mx-auto text-xl">
                          <FaRunning />
                        </div>
                        <p className="text-xs font-black text-amber-600 uppercase tracking-wider">SHIFT COMPLETED</p>
                      </div>
                    ) : todayAttendance?.status === "Absent" ? (
                      <div className="space-y-2 animate-in zoom-in duration-500">
                        <div className="w-14 h-14 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-rose-100 mx-auto text-xl">
                          <FaTimes />
                        </div>
                        <p className="text-xs font-black text-rose-600 uppercase tracking-wider">MARKED ABSENT</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-14 h-14 bg-slate-300 text-slate-500 rounded-full flex items-center justify-center mx-auto text-xl border-4 border-slate-200">
                          <FaUser />
                        </div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-wider">NOT SIGNED IN</p>
                      </div>
                    )}
                  </div>

                  {/* Actions & GPS Coordinates */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleMarkAttendance("Present")}
                        disabled={isPresent || isFinished || fetchingLocation}
                        className={`py-4 px-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition duration-300 ${
                          isPresent || isFinished
                          ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                          : "bg-white text-emerald-600 border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50 shadow-[0_4px_0_0_#10b98115] active:translate-y-0.5 active:shadow-none"
                        }`}
                      >
                        <FaCheckCircle className="text-base" />
                        <span>{fetchingLocation ? "Capturing..." : isPresent ? "CLOCK-IN RECORDED" : "CLOCK IN (GPS)"}</span>
                      </button>

                      <button
                        onClick={() => handleMarkAttendance("Leave")}
                        disabled={isFinished || (!isPresent && !todayAttendance) || fetchingLocation}
                        className={`py-4 px-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition duration-300 ${
                          isFinished || (!isPresent && !todayAttendance)
                          ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                          : "bg-white text-amber-600 border-2 border-amber-100 hover:border-amber-500 hover:bg-amber-50 shadow-[0_4px_0_0_#f59e0b15] active:translate-y-0.5 active:shadow-none"
                        }`}
                      >
                        <FaRunning className="text-base" />
                        <span>{isLeft ? "SHIFT FINISHED" : "CLOCK OUT"}</span>
                      </button>
                    </div>

                    {/* GPS Details Card */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <FaMapMarkerAlt className={`text-sm mt-0.5 ${isPresent ? "text-emerald-500 animate-bounce" : isLeft ? "text-amber-500" : "text-slate-400"}`} />
                        <div className="space-y-1">
                          <p className="text-[8px] font-black text-slate-400 uppercase">ACTIVE GPS LOCATION ADDRESS</p>
                          <p className="text-[10px] font-black text-slate-700 leading-relaxed uppercase">
                            {isPresent ? (
                              todayAttendance?.presentLocation?.address || "Resolving Precise Location..."
                            ) : isLeft ? (
                              todayAttendance?.leaveLocation?.address || "Resolving Location..."
                            ) : "Geolocation Inactive. Click 'Clock In' to capture location."}
                          </p>
                        </div>
                      </div>

                      {(todayAttendance?.presentLocation?.lat || todayAttendance?.leaveLocation?.lat) && (
                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 border-t border-slate-100/50 pt-2.5">
                          <span className="uppercase">LAT / LNG Coords:</span>
                          <span className="font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-100">
                            {isPresent ? (
                              `${Number(todayAttendance.presentLocation.lat).toFixed(6)}, ${Number(todayAttendance.presentLocation.lng).toFixed(6)}`
                            ) : (
                              `${Number(todayAttendance.leaveLocation?.lat || 0).toFixed(6)}, ${Number(todayAttendance.leaveLocation?.lng || 0).toFixed(6)}`
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Attendance details: Shift logs */}
                {todayAttendance && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-6 mt-6">
                    {todayAttendance.presentTime && (
                      <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl flex items-center justify-between">
                        <span className="text-[9px] font-black text-emerald-800 uppercase">SIGN-IN TIME</span>
                        <span className="text-xs font-black text-emerald-700">
                          {new Date(todayAttendance.presentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    )}
                    {todayAttendance.leaveTime && (
                      <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl flex items-center justify-between">
                        <span className="text-[9px] font-black text-amber-800 uppercase">SIGN-OUT TIME</span>
                        <span className="text-xs font-black text-amber-700">
                          {new Date(todayAttendance.leaveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    )}
                    {todayAttendance.workingHours > 0 && (
                      <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl flex items-center justify-between">
                        <span className="text-[9px] font-black text-indigo-800 uppercase">TOTAL LOGGED</span>
                        <span className="text-xs font-black text-indigo-700">
                          {todayAttendance.workingHours.toFixed(2)} Hrs
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RECENT ATTENDANCE HISTORY LIST */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <FaClock className="text-sky-500 text-sm" /> 
                    Attendance Records & History
                  </h3>
                  <Link to="/branch/hr/attendance" className="text-sky-500 hover:text-[#00376B] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 group">
                    Full Records <FaChevronRight className="text-[8px] group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>

                {loadingAttendance ? (
                  <div className="py-12 text-center text-slate-400 animate-pulse uppercase text-[10px] font-black tracking-widest">
                    Retrieving Shift History Logs...
                  </div>
                ) : attendanceLogs.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                    <FaCalendarCheck className="text-slate-200 text-3xl mx-auto mb-3" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Attendance Logs recorded in this period</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-wider">
                          <th className="py-3 pr-4">Work Date</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Clock In</th>
                          <th className="py-3 px-4">Clock Out</th>
                          <th className="py-3 px-4 text-center">Duration</th>
                          <th className="py-3 pl-4">Location Address</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-[11px] font-bold text-slate-700">
                        {attendanceLogs.slice(0, 5).map((log) => {
                          const dateObj = new Date(log.date);
                          const isLogPresent = log.status === "Present" || !!log.presentTime;
                          const isLogLeave = log.status === "Leave" && !log.presentTime;
                          const isLogAbsent = log.status === "Absent" && !log.presentTime;
                          
                          return (
                            <tr key={log._id} className="hover:bg-slate-50/50 transition">
                              <td className="py-3 pr-4 font-black">
                                {dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                  isLogPresent ? "bg-emerald-50 text-emerald-700" :
                                  isLogLeave ? "bg-amber-50 text-amber-700" :
                                  "bg-rose-50 text-rose-700"
                                }`}>
                                  {isLogPresent ? "Present" : log.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-500 font-mono text-[10px]">
                                {log.presentTime ? new Date(log.presentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                              </td>
                              <td className="py-3 px-4 text-slate-500 font-mono text-[10px]">
                                {log.leaveTime ? new Date(log.leaveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                              </td>
                              <td className="py-3 px-4 text-center text-slate-800 font-black">
                                {log.workingHours > 0 ? `${Number(log.workingHours).toFixed(2)} Hrs` : "-"}
                              </td>
                              <td className="py-3 pl-4 text-slate-400 font-medium max-w-[200px] truncate" title={log.presentLocation?.address || log.leaveLocation?.address}>
                                {log.presentLocation?.address || log.leaveLocation?.address || "Address Not Available"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT COLUMN: ACTIVE REMINDERS & TOKENS */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* TOKENS & TASKS CARD */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[650px] hover:shadow-md transition duration-300">
                <div className="bg-[#00376B] p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FaTicketAlt className="text-[#319CD3] text-lg" />
                    <h3 className="text-white font-black text-[10px] uppercase tracking-[0.2em]">Active Tasks & Reminders</h3>
                  </div>
                  <div className="bg-[#319CD3] px-2.5 py-1 rounded-md text-white text-[10px] font-black">{tokens.length}</div>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto space-y-3 no-scrollbar bg-slate-50/50">
                  {loadingTokens ? (
                     <div className="py-12 text-center animate-pulse text-[#319CD3] font-black uppercase text-[10px] tracking-[0.2em]">Synchronizing personal tasks...</div>
                  ) : tokens.length === 0 ? (
                    <div className="py-24 text-center text-slate-400">
                      <FaInbox className="text-gray-300 text-5xl mx-auto mb-4 opacity-70" />
                      <p className="text-gray-400 font-black uppercase text-[10px] tracking-[0.2em] mb-1">Inbox Zero</p>
                      <p className="text-xs text-slate-400/70 font-semibold px-4">You have no active pending tasks assigned currently.</p>
                    </div>
                  ) : (
                    tokens.map(t => (
                      <Link 
                        to="/branch/tokenization" 
                        key={t._id}
                        className="block p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-[#319CD3] hover:shadow-md transition duration-300 group"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[9px] font-black text-[#319CD3] tracking-wider uppercase group-hover:text-[#00376B] transition-colors">{t.tokenId}</span>
                          <span className="text-[9px] font-bold text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h4 className="text-xs font-black text-slate-800 truncate mb-1 group-hover:text-[#00376B] transition-colors">{t.customer?.name || "Internal Dispatch"}</h4>
                        <p className="text-[10px] font-medium text-slate-400 leading-relaxed line-clamp-2">{t.message}</p>
                        
                        <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400 group-hover:text-[#319CD3] transition-colors">
                          <span>Task Status: {t.status}</span>
                          <span className="flex items-center gap-1">Open in Workspace <FaChevronRight className="text-[7px]" /></span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER SUPER ADMIN DASHBOARD (DEFAULT VIEW)
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20 px-4 md:px-6 pb-10">
      <div className="max-w-[1400px] mx-auto">
        
        {/* TOP BRANDING BANNER */}
        <div className="bg-[#00376B] text-white rounded-2xl shadow-xl p-8 mb-6 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#319CD3] rounded-full mix-blend-screen filter blur-3xl opacity-40 translate-x-1/2 -translate-y-1/2"></div>
          <div className="relative z-10">
            <h1 className="text-3xl font-black mb-1">
              Welcome back to {branch?.name} 👋
            </h1>
            <p className="text-[#319CD3] font-semibold tracking-wide">
              Logged in as: <span className="text-white">{user?.username}</span> | Location: <span className="text-white">{branch?.location}</span>
            </p>
          </div>
          <div className="relative z-10 w-full md:w-auto">
             <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/20 shadow-lg">
               <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]"></div>
               <span className="text-sm font-bold text-white tracking-widest uppercase">System Online</span>
             </div>
          </div>
        </div>

        {/* DASHBOARD FILTERS */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col xl:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap bg-gray-100 p-1.5 rounded-xl w-full xl:w-auto gap-1">
            {['today', 'yesterday', 'thisWeek', 'thisMonth', 'thisYear'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`flex-1 xl:flex-none px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                  filterType === type 
                  ? "bg-[#319CD3] text-white shadow-md" 
                  : "text-gray-500 hover:text-[#00376B] hover:bg-white"
                }`}
              >
                {type.replace(/([A-Z])/g, ' $1')}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <input 
              type="date" 
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="flex-1 xl:flex-none px-4 py-2.5 bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700 rounded-xl focus:outline-none focus:border-[#319CD3]" 
            />
            <span className="text-gray-400 font-black text-xs">TO</span>
            <input 
              type="date" 
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="flex-1 xl:flex-none px-4 py-2.5 bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700 rounded-xl focus:outline-none focus:border-[#319CD3]" 
            />
            <button 
              onClick={handleCustomFilter}
              className="w-full xl:w-auto px-6 py-2.5 bg-[#00376B] text-white rounded-xl text-xs font-black tracking-widest hover:bg-[#002855] transition-colors shadow-sm"
            >
              APPLY FILTER
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* LEFT: MAIN KPI STATS */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Sales & Purchases Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
               {/* Total Sales */}
               <div className="bg-white p-5 rounded-2xl shadow-sm border-b-[6px] border-[#319CD3] hover:shadow-md transition">
                 <div className="flex justify-between items-start mb-3">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Sales Order</p>
                   <FaChartLine className="text-[#319CD3] text-xl opacity-60" />
                 </div>
                 <h3 className="text-2xl font-black text-[#00376B]">{loadingStats ? "..." : formatCurrency(stats?.totalSalesValue)}</h3>
               </div>
               
               {/* Sales Invoices */}
               <div className="bg-white p-5 rounded-2xl shadow-sm border-b-[6px] border-emerald-500 hover:shadow-md transition">
                 <div className="flex justify-between items-start mb-3">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sales Invoiced</p>
                   <FaFileInvoiceDollar className="text-emerald-500 text-xl opacity-60" />
                 </div>
                 <h3 className="text-2xl font-black text-gray-800">{loadingStats ? "..." : formatCurrency(stats?.totalSalesInvoiceValue)}</h3>
               </div>
               
               {/* Total Purchases */}
               <div className="bg-white p-5 rounded-2xl shadow-sm border-b-[6px] border-purple-500 hover:shadow-md transition">
                 <div className="flex justify-between items-start mb-3">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Purchase Order</p>
                   <FaChartLine className="text-purple-500 text-xl opacity-60" />
                 </div>
                 <h3 className="text-2xl font-black text-gray-800">{loadingStats ? "..." : formatCurrency(stats?.totalPurchaseOrderValue)}</h3>
               </div>
               
               {/* Purchase Invoices */}
               <div className="bg-white p-5 rounded-2xl shadow-sm border-b-[6px] border-orange-500 hover:shadow-md transition">
                 <div className="flex justify-between items-start mb-3">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Purchase Invoiced</p>
                   <FaFileInvoiceDollar className="text-orange-500 text-xl opacity-60" />
                 </div>
                 <h3 className="text-2xl font-black text-gray-800">{loadingStats ? "..." : formatCurrency(stats?.purchaseInvoiceValues)}</h3>
               </div>
            </div>

            {/* Financials & Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Accounts Panel */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                   <FaMoneyBillWave className="text-[#319CD3] text-lg" />
                   <h3 className="text-xs font-black text-[#00376B] uppercase tracking-widest">Accounts Flow</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <span className="text-xs font-black text-emerald-800 uppercase tracking-wider">Receipts (IN)</span>
                    <span className="text-xl font-black text-emerald-700">{loadingStats ? "..." : formatCurrency(stats?.receiptValue)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 bg-rose-50 rounded-xl border border-rose-100">
                    <span className="text-xs font-black text-rose-800 uppercase tracking-wider">Payments (OUT)</span>
                    <span className="text-xl font-black text-rose-700">{loadingStats ? "..." : formatCurrency(stats?.paymentValue)}</span>
                  </div>
                </div>
              </div>

              {/* Outstanding Orders Panel */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                   <FaFileSignature className="text-[#319CD3] text-lg" />
                   <h3 className="text-xs font-black text-[#00376B] uppercase tracking-widest">Pending Conversion</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center px-4 py-3 bg-amber-50 rounded-xl border border-amber-100">
                    <span className="text-xs font-black text-amber-800 uppercase tracking-wider">Uninvoiced Sales</span>
                    <span className="text-2xl font-black text-amber-600">{loadingStats ? "..." : stats?.notGeneratedSalesInvoiceCount} <span className="text-xs text-amber-800/50">Orders</span></span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100">
                    <span className="text-xs font-black text-indigo-800 uppercase tracking-wider">Uninvoiced Purchases</span>
                    <span className="text-2xl font-black text-indigo-600">{loadingStats ? "..." : stats?.notGeneratedPurchaseInvoiceCount} <span className="text-xs text-indigo-800/50">Orders</span></span>
                  </div>
                </div>
              </div>

            </div>

            {/* Global Standing & Exceptions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="bg-[#00376B] p-6 rounded-2xl shadow-sm text-white border border-[#002855]">
                 <div className="flex justify-between items-start mb-4">
                   <p className="text-[10px] font-black text-[#319CD3] uppercase tracking-widest">Total Customer Debits</p>
                   <div className="p-2 bg-white/10 rounded-lg"><FaUsers className="text-[#319CD3]" /></div>
                 </div>
                 <h3 className="text-2xl font-black truncate">{loadingStats ? "..." : formatCurrency(stats?.totalCustomerDebit)}</h3>
               </div>
               
               <div className="bg-[#319CD3] p-6 rounded-2xl shadow-sm text-white border border-[#2380af]">
                 <div className="flex justify-between items-start mb-4">
                   <p className="text-[10px] font-black text-[#00376B] uppercase tracking-widest">Total Customer Credits</p>
                   <div className="p-2 bg-black/10 rounded-lg"><FaUsers className="text-[#00376B]" /></div>
                 </div>
                 <h3 className="text-2xl font-black truncate">{loadingStats ? "..." : formatCurrency(stats?.totalCustomerCredit)}</h3>
               </div>

               <div className="bg-red-50 border border-red-100 p-6 rounded-2xl shadow-sm">
                 <div className="flex justify-between items-start mb-4">
                   <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Canceled Orders Val</p>
                   <div className="p-2 bg-red-100 rounded-lg"><FaBan className="text-red-500" /></div>
                 </div>
                 <h3 className="text-2xl font-black text-red-600 truncate">{loadingStats ? "..." : formatCurrency(stats?.cancelOrdersValue)}</h3>
               </div>
            </div>

          </div>

          {/* RIGHT: TOKENS & QUICK INFO */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Quick Branch Info */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-5">Branch Identity</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Code</p>
                  <p className="text-sm font-black text-[#00376B]">{branch?.code || "-"}</p>
                </div>
                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Phone</p>
                  <p className="text-sm font-black text-[#00376B]">{branch?.phone || "-"}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">GSTIN</p>
                  <p className="text-sm font-black text-[#00376B]">{branch?.gstin || "-"}</p>
                </div>
              </div>
            </div>

            {/* Tokens */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[520px]">
              <div className="bg-[#00376B] p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FaTicketAlt className="text-[#319CD3] text-lg" />
                  <h3 className="text-white font-black text-[10px] uppercase tracking-[0.2em]">Active Tasks</h3>
                </div>
                <div className="bg-[#319CD3] px-2.5 py-1 rounded-md text-white text-[10px] font-black">{tokens.length}</div>
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto space-y-3 no-scrollbar bg-slate-50">
                {loadingTokens ? (
                   <div className="py-12 text-center animate-pulse text-[#319CD3] font-black uppercase text-[10px] tracking-[0.2em]">Synchronizing...</div>
                ) : tokens.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <FaInbox className="text-gray-300 text-4xl mx-auto mb-4 opacity-70" />
                    <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.2em]">Inbox Zero</p>
                  </div>
                ) : (
                  tokens.map(t => (
                    <Link 
                      to="/branch/tokenization" 
                      key={t._id}
                      className="block p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-[#319CD3] hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-black text-[#319CD3] tracking-wider uppercase group-hover:text-[#00376B] transition-colors">{t.tokenId}</span>
                        <span className="text-[9px] font-bold text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</span>
                      </div>
                      <h4 className="text-xs font-black text-gray-800 truncate mb-1 group-hover:text-[#00376B] transition-colors">{t.customer?.name || "Internal Dispatch"}</h4>
                      <p className="text-[10px] font-medium text-gray-500 line-clamp-2 leading-relaxed">{t.message}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
