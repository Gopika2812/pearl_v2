import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { FaCalendarCheck, FaUser, FaCheck, FaTimes, FaRunning, FaMapMarkerAlt, FaClock, FaComment } from "react-icons/fa";
import { fetchWithAuth, API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

const AttendancePage = () => {
  const { currentBranch } = useBranch();
  const [employees, setEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [commentModal, setCommentModal] = useState(null); // { employeeId, status, location, hours }

  useEffect(() => {
    fetchEmployees();
  }, [currentBranch]);

  useEffect(() => {
    if (employees.length > 0) {
      fetchDailyAttendance();
    }
  }, [employees, date]);

  const fetchEmployees = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/branch-users?branchId=${currentBranch?._id}`);
      const data = await res.json();
      if (data.success) {
        setEmployees(data.data.filter(u => u.status === "ACTIVE"));
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
        data.data.forEach(record => {
          records[record.employeeId] = record;
        });
        console.log("📍 Daily Attendance Records:", records);
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
          }
        );
      }
    });
  };

  const handleMark = async (employeeId, status, customComment = "") => {
    try {
      setFetchingLocation(true);
      toast.info("Capturing GPS Location...", { autoClose: 1500 });
      const location = await getPosition();
      console.log("📍 Captured Location:", location);

      if (!location || location.lat === undefined) {
        throw new Error("Could not retrieve precise GPS coordinates. Please allow location access.");
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
        console.log("🔍 Debug Info:", data.debug);
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
    <div className="space-y-6">
      <CommentModal />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Employee Attendance</h1>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Mark daily presence and tracking</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 uppercase"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map((emp) => {
          const record = attendanceRecords[emp._id];
          const isPresent = record?.status === "Present";
          const isFinished = record?.status === "Leave" || record?.status === "Absent";
          
          return (
            <div key={emp._id} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-500 group">
              <div className="flex items-center gap-5 mb-8">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl transition-all ${isPresent ? "bg-emerald-50 text-emerald-500" : "bg-indigo-50 text-indigo-500"}`}>
                  <FaUser />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 uppercase text-sm leading-tight">{emp.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{emp.role}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-6">
                 <div className="flex-1 flex flex-col gap-2">
                   <button 
                    onClick={() => handleMark(emp._id, "Present")}
                    disabled={isPresent || isFinished || fetchingLocation}
                    className={`w-full flex flex-col items-center justify-center gap-1 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                      isPresent || isFinished
                      ? "bg-slate-100 text-slate-400 opacity-80" 
                      : "bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white shadow-lg shadow-emerald-50"
                    } ${fetchingLocation ? "animate-pulse" : ""}`}
                   >
                     <FaCheck className="text-sm" /> 
                     {fetchingLocation ? "Locating..." : "Present"}
                   </button>
                   {record?.presentLocation?.lat != null && (
                     <div className="mt-2 flex items-center justify-center gap-1.5 px-3 py-1 bg-emerald-50/50 rounded-lg border border-emerald-100/50 animate-in fade-in slide-in-from-top-1 duration-500">
                       <FaMapMarkerAlt className="text-[10px] text-emerald-500" />
                       <span className="text-[9px] font-black text-emerald-700 tabular-nums">
                         {Number(record.presentLocation.lat).toFixed(4)}, {Number(record.presentLocation.lng).toFixed(4)}
                       </span>
                     </div>
                   )}
                   {isPresent && !record?.presentLocation?.lat && (
                     <div className="mt-2 text-[8px] font-bold text-slate-400 italic text-center">
                       Location not captured
                     </div>
                   )}
                 </div>
                 
                 <div className="flex-1 flex flex-col gap-2">
                   <button 
                    onClick={() => handleMark(emp._id, "Leave")}
                    disabled={isFinished || (!isPresent && !record) || fetchingLocation}
                    className={`w-full flex flex-col items-center justify-center gap-1 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                      isFinished || (!isPresent && !record)
                      ? "bg-slate-100 text-slate-400 opacity-80" 
                      : "bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white shadow-lg shadow-amber-50"
                    } ${fetchingLocation ? "animate-pulse" : ""}`}
                   >
                     <FaRunning className="text-sm" /> 
                     {fetchingLocation ? "Locating..." : "Leave"}
                   </button>
                   {record?.leaveLocation && (
                     <div className="mt-2 flex items-center justify-center gap-1.5 px-3 py-1 bg-amber-50/50 rounded-lg border border-amber-100/50 animate-in fade-in slide-in-from-top-1 duration-500">
                       <FaMapMarkerAlt className="text-[10px] text-amber-500" />
                       <span className="text-[9px] font-black text-amber-700 tabular-nums">
                         {record.leaveLocation.lat.toFixed(4)}, {record.leaveLocation.lng.toFixed(4)}
                       </span>
                     </div>
                   )}
                 </div>

                 <button 
                  onClick={() => handleMark(emp._id, "Absent")}
                  disabled={isFinished || isPresent}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    isFinished || isPresent
                    ? "bg-slate-50 text-slate-300 opacity-50 cursor-not-allowed" 
                    : "bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white shadow-lg shadow-rose-50"
                  }`}
                 >
                   <FaTimes className="text-sm" /> Absent
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AttendancePage;
