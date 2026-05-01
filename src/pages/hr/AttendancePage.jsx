import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { FaCalendarCheck, FaUser, FaCheck, FaTimes, FaRunning, FaMapMarkerAlt, FaClock, FaComment, FaTrashAlt, FaRegCommentDots } from "react-icons/fa";
import { fetchWithAuth, API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

const AttendancePage = () => {
  const { currentBranch } = useBranch();
  const [employees, setEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [commentModal, setCommentModal] = useState(null); // { employeeId, status, location, hours }
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isSuperAdmin = ["SUPERADMIN", "SUPER_ADMIN"].includes(currentUser?.role?.toUpperCase());

  useEffect(() => {
    if (currentBranch?._id) {
      fetchEmployees();
    }
  }, [currentBranch]);

  useEffect(() => {
    if (employees.length > 0) {
      fetchDailyAttendance();
    }
  }, [employees, date]);

  const fetchEmployees = async () => {
    if (!currentBranch?._id) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/employees/list?branchId=${currentBranch._id}`);
      const data = await res.json();
      if (data.success) {
        setEmployees(data.data);
      }
    } catch (err) {
      toast.error("Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyAttendance = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/attendance/daily?branchId=${currentBranch?._id}&date=${date}`);
      const data = await res.json();
      if (data.success) {
        const records = {};
        
        // Use Promise.all to handle potential client-side geocoding for missing addresses
        await Promise.all(data.data.map(async (record) => {
          const updatedRecord = { ...record };
          const loc = updatedRecord.presentLocation;
          const leaveLoc = updatedRecord.leaveLocation;
          
          const resolveAddress = async (l) => {
            if (!l?.lat || (l.address && l.address !== "Location Captured")) return l.address;
            try {
              // Try BigDataCloud
              const fbRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${l.lat}&longitude=${l.lng}&localityLanguage=en`);
              const fbData = await fbRes.json();
              if (fbData && fbData.city) {
                return `${fbData.locality || fbData.principalSubdivision || ""}, ${fbData.city || ""}`.trim().replace(/^,/, "");
              }
              // Try Nominatim as secondary fallback
              const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${l.lat}&lon=${l.lng}&zoom=18`);
              const nomData = await nomRes.json();
              if (nomData && nomData.display_name) {
                const parts = nomData.display_name.split(",").slice(0, 5);
                return [...new Set(parts)].join(", ");
              }
            } catch (e) {
              console.error("Client-side geocoding failed:", e);
            }
            return l.address || "Location Captured";
          };

          if (loc) updatedRecord.presentLocation = { ...loc, address: await resolveAddress(loc) };
          if (leaveLoc) updatedRecord.leaveLocation = { ...leaveLoc, address: await resolveAddress(leaveLoc) };
          
          records[record.employeeId] = updatedRecord;
        }));

        console.log("📍 Daily Attendance Records (Resolved):", records);
        setAttendanceRecords(records);
      }
    } catch (err) {
      console.error("Failed to fetch daily attendance:", err);
    }
  };

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

  const handleRevert = async (employeeId) => {
    if (!window.confirm("Are you sure you want to revert this attendance? This will delete today's record.")) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/attendance/revert`, {
        method: "POST",
        body: JSON.stringify({ employeeId, date })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setAttendanceRecords(prev => {
          const newRecords = { ...prev };
          if (data.data) {
            newRecords[employeeId] = data.data;
          } else {
            delete newRecords[employeeId];
          }
          return newRecords;
        });
      }
    } catch (err) {
      toast.error("Failed to revert attendance");
    }
  };

  const handleApprove = async (employeeId) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/attendance/approve`, {
        method: "POST",
        body: JSON.stringify({ employeeId, date })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Attendance approved");
        setAttendanceRecords(prev => ({ ...prev, [employeeId]: data.data }));
      }
    } catch (err) {
      toast.error("Failed to approve attendance");
    }
  };

  const handleMark = async (employeeId, status, customComment = "") => {
    try {
      setFetchingLocation(true);
      const existingRecord = attendanceRecords[employeeId];
      
      toast.info("Capturing GPS Location...", { autoClose: 1500 });
      const location = await getPosition();
      console.log("📍 Captured Location:", location);

      if (!location || !location.lat || isNaN(location.lat)) {
        throw new Error("Could not retrieve precise GPS coordinates. Please ensure GPS is enabled and you have allowed location access.");
      }
      
      // Calculate working hours if marking Leave/Absent after Present
      let workingHours = 0;
      if ((status === "Leave" || status === "Absent") && existingRecord?.status === "Present" && existingRecord?.presentTime) {
        const presentTime = new Date(existingRecord.presentTime);
        const leaveTime = new Date();
        const diffHrs = (leaveTime - presentTime) / (1000 * 60 * 60);
        workingHours = diffHrs;

        // Requirement: If > 9 hours, prompt for comment
        if (diffHrs > 9 && !customComment) {
          setCommentModal({ employeeId, status, location, hours: diffHrs });
          return;
        }
      }

      const res = await fetchWithAuth(`${API_BASE}/hr/attendance/mark`, {
        method: "POST",
        body: JSON.stringify({
          employeeId,
          date,
          status,
          location,
          comment: customComment,
          branchId: currentBranch?._id
        })
      });
      const data = await res.json();
      if (data.success) {
        console.log("✅ Mark Success. Data:", data.data);
        
        // If backend failed to get address, try client-side fallback with multiple services
        const resolveClientSide = async (l) => {
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
            console.error("Client-side geocoding failed:", e);
          }
          return l.address || "Location Captured";
        };

        if (data.data.presentLocation) {
          data.data.presentLocation.address = await resolveClientSide(data.data.presentLocation);
        }
        if (data.data.leaveLocation) {
          data.data.leaveLocation.address = await resolveClientSide(data.data.leaveLocation);
        }
        
        setAttendanceRecords(prev => ({ ...prev, [employeeId]: data.data }));
        toast.success(`Attendance updated: ${status}`);
        setCommentModal(null);
      }
    } catch (err) {
      toast.error(err.message || "Failed to mark attendance");
    } finally {
      setFetchingLocation(false);
    }
  };

  const CommentModal = () => {
    if (!commentModal) return null;
    const [text, setText] = useState("");

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 px-8 py-10 text-white">
            <FaComment className="text-4xl mb-4 opacity-50" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Overtime Detected</h2>
            <p className="text-orange-100 text-[10px] font-bold uppercase tracking-widest mt-1">
              Working hours: {commentModal.hours.toFixed(2)} hrs. Please add a comment.
            </p>
          </div>
          <div className="p-8 space-y-6">
            <textarea 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:border-orange-500 focus:ring-0 transition-all outline-none min-h-[120px]"
              placeholder="Enter reason for overtime..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex gap-4">
              <button 
                onClick={() => setCommentModal(null)}
                className="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleMark(commentModal.employeeId, commentModal.status, text)}
                disabled={!text.trim()}
                className="flex-1 py-4 bg-orange-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg shadow-orange-200 disabled:opacity-50"
              >
                Save & Mark
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pt-10 md:pt-14 px-4 md:px-0">
      <CommentModal />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tight">Employee Attendance</h1>
          <p className="text-slate-500 text-[10px] md:text-sm font-medium uppercase tracking-widest">Mark daily presence and tracking</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-[1.5rem] border-2 border-slate-100 shadow-sm hover:border-indigo-500 transition-all group w-fit">
          <FaCalendarCheck className="text-indigo-500 group-hover:scale-110 transition-transform" />
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-sm font-black text-slate-700 uppercase cursor-pointer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-10">
        {employees.map((emp) => {
          const record = attendanceRecords[emp._id];
          const isPresent = record?.status === "Present";
          const isLeft = record?.status === "Leave";
          const isFinished = record?.status === "Leave" || record?.status === "Absent";
          
          return (
            <div key={emp._id} className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 p-5 md:p-8 shadow-sm hover:shadow-md transition-all duration-500 group">
              <div className="flex items-center gap-5 mb-8">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl transition-all ${isPresent ? "bg-emerald-50 text-emerald-500" : "bg-indigo-50 text-indigo-500"}`}>
                  <FaUser />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-800 uppercase text-sm leading-tight">{emp.name}</h3>
                      <span className="text-[10px] font-black bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-md">ID: {emp.employeeCode}</span>
                    </div>
                    {record && isSuperAdmin && (
                      <button 
                        onClick={() => handleRevert(emp._id)}
                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        title="Revert Attendance (Super Admin Only)"
                      >
                        <FaTrashAlt className="text-xs" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{emp.role}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="flex flex-col gap-2">
                    <button 
                     onClick={() => handleMark(emp._id, "Present")}
                     disabled={isPresent || isFinished || fetchingLocation}
                     className={`w-full flex flex-col items-center justify-center gap-1 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 relative overflow-hidden group/btn ${
                       isPresent || isFinished
                       ? "bg-slate-100 text-slate-400 opacity-80" 
                       : "bg-white text-emerald-600 border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50 shadow-[0_6px_0_0_#10b98120] active:shadow-none active:translate-y-1"
                     } ${fetchingLocation ? "animate-pulse" : ""}`}
                    >
                      {isPresent ? (
                        <div className="flex flex-col items-center gap-1 animate-in zoom-in duration-500">
                          <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
                            <FaCheck className="text-[10px]" />
                          </div>
                          <span className="text-emerald-600 font-black">Presented</span>
                        </div>
                      ) : (
                        <>
                          <FaCheck className={`text-sm transition-transform duration-500 ${fetchingLocation ? "animate-spin" : "group-hover/btn:scale-125"}`} /> 
                          <span>{fetchingLocation ? "Locating..." : "Present"}</span>
                        </>
                      )}
                    </button>
                    <div className="mt-1 flex flex-col items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50/50 rounded-xl border border-emerald-100/50 animate-in fade-in slide-in-from-top-1 duration-500 min-h-[30px]">
                      <div className="flex items-center gap-1.5">
                        <FaMapMarkerAlt className="text-[8px] text-emerald-500 flex-shrink-0" />
                        <span className="text-[8px] font-black text-emerald-700 uppercase whitespace-normal break-words text-center leading-relaxed">
                          {record?.presentLocation?.address && record.presentLocation.address !== "Location Captured" ? (
                            record.presentLocation.address
                          ) : (
                            record?.presentLocation?.lat ? (
                              `${Number(record.presentLocation.lat).toFixed(4)}, ${Number(record.presentLocation.lng).toFixed(4)}`
                            ) : "Fetching..."
                          )}
                        </span>
                      </div>
                    </div>
                   {record?.presentTime && (
                     <p className="text-[8px] font-black text-emerald-500/60 text-center uppercase tracking-widest mt-1">
                       In: {new Date(record.presentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                     </p>
                   )}
                 </div>
                 
                 <div className="flex flex-col gap-2">
                    <button 
                     onClick={() => handleMark(emp._id, "Leave")}
                     disabled={isFinished || (!isPresent && !record) || fetchingLocation}
                     className={`w-full flex flex-col items-center justify-center gap-1 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 relative overflow-hidden group/btn ${
                       isFinished || (!isPresent && !record)
                       ? "bg-slate-100 text-slate-400 opacity-80" 
                       : "bg-white text-amber-600 border-2 border-amber-100 hover:border-amber-500 hover:bg-amber-50 shadow-[0_6px_0_0_#f59e0b20] active:shadow-none active:translate-y-1"
                     } ${fetchingLocation ? "animate-pulse" : ""}`}
                    >
                      {isLeft ? (
                        <div className="flex flex-col items-center gap-1 animate-in zoom-in duration-500">
                          <div className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-amber-200">
                            <FaRunning className="text-[10px]" />
                          </div>
                          <span className="text-amber-600 font-black">Left</span>
                        </div>
                      ) : (
                        <>
                          <FaRunning className={`text-sm transition-transform duration-500 ${fetchingLocation ? "animate-spin" : "group-hover/btn:scale-125"}`} /> 
                          <span>{fetchingLocation ? "Locating..." : "Leave"}</span>
                        </>
                      )}
                    </button>
                    <div className="mt-1 flex flex-col items-center justify-center gap-1.5 px-3 py-2 bg-amber-50/50 rounded-xl border border-amber-100/50 animate-in fade-in slide-in-from-top-1 duration-500 min-h-[30px]">
                      <div className="flex items-center gap-1.5">
                        <FaMapMarkerAlt className="text-[8px] text-amber-500 flex-shrink-0" />
                        <span className="text-[8px] font-black text-amber-700 uppercase whitespace-normal break-words text-center leading-relaxed">
                          {record?.leaveLocation?.address && record.leaveLocation.address !== "Location Captured" ? (
                            record.leaveLocation.address
                          ) : (
                            record?.leaveLocation?.lat ? (
                              `${Number(record.leaveLocation.lat).toFixed(4)}, ${Number(record.leaveLocation.lng).toFixed(4)}`
                            ) : "Fetching..."
                          )}
                        </span>
                      </div>
                    </div>
                    {record?.leaveTime && !isPresent && (
                      <p className="text-[8px] font-black text-amber-500/60 text-center uppercase tracking-widest mt-1">
                        Out: {new Date(record.leaveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                 </div>

                 <button 
                  onClick={() => handleMark(emp._id, "Absent")}
                  disabled={isFinished || isPresent}
                  className={`col-span-2 flex items-center justify-center gap-3 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all ${
                    isFinished || isPresent
                    ? "bg-slate-50 text-slate-300 opacity-50 cursor-not-allowed" 
                    : "bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white border border-rose-100"
                  }`}
                 >
                   <FaTimes className="text-[10px]" /> Mark as Absent
                 </button>
              </div>

              {/* Status & Location Info */}
              <div className="space-y-4 pt-6 border-t border-slate-100">
                {record?.workingHours > 0 && (
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2">
                    <div className="flex items-center gap-2">
                      <FaClock className="text-indigo-400 text-[10px]" />
                      <span className="text-[9px] font-black text-slate-400 uppercase">Working Hours</span>
                    </div>
                    <span className="text-xs font-black text-slate-700">{record.workingHours.toFixed(2)} Hrs</span>
                  </div>
                )}

                {record?.comment && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <FaComment /> Note
                    </p>
                    <p className="text-[10px] font-bold text-amber-800 leading-tight italic">"{record.comment}"</p>
                  </div>
                )}

                {record && !record.isApproved && date < new Date().toISOString().split("T")[0] && (
                  <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-3xl flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></div>
                      <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Pending Admin Approval</span>
                    </div>
                    <button 
                      onClick={() => handleApprove(emp._id)}
                      className="w-full py-3 bg-white text-rose-600 text-[10px] font-black uppercase rounded-2xl border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-95"
                    >
                      Approve This Entry
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AttendancePage;
