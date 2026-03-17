import { useState } from "react";
import {
  FaClock,
  FaMapMarkerAlt,
  FaPlay,
  FaStop,
  FaUserCircle,
} from "react-icons/fa";

/* ---------------- SAMPLE EMPLOYEE DATA ---------------- */
const sampleEmployee = {
  id: "EMP003",
  name: "Ravi Kumar",
  phone: "9988776655",
  email: "ravi@pearls.com",
  department: "Delivery",
  shiftStart: "09:00",
  shiftEnd: "18:00",
  image: "https://i.pravatar.cc/150?img=56",
  goals: [
    { goal: "Complete 15 deliveries", progress: "10/15" },
    { goal: "Maintain customer satisfaction >90%", progress: "85%" },
  ],
  salaryPerHour: 100,
  overtimeRate: 150,
  earlyPunchFine: 50,
  earlyCheckoutFine: 75,
};

/* ---------------- SAMPLE ATTENDANCE ---------------- */
const sampleAttendance = [
  {
    date: "2026-01-22",
    login: "09:05",
    logout: "18:30",
  },
];

/* ---------------- SAMPLE DELIVERY LOGS ---------------- */
const sampleDeliveryLogs = [
  {
    id: 1,
    startTime: "10:15",
    startLocation: "Pearls Warehouse, Tirunelveli",
    stopTime: "11:05",
    stopLocation: "Palayamkottai,Tirunelveli",
  },
];

export default function EmployeeDashboardPage() {
  const [employee] = useState(sampleEmployee);
  const [attendance] = useState(sampleAttendance);
  const [deliveryLogs, setDeliveryLogs] = useState(sampleDeliveryLogs);
  const [activeTrip, setActiveTrip] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState("full");
  const [leaveForm, setLeaveForm] = useState({
    startDate: "",
    endDate: "",
    startHours: "",
    endHours: "",
    reason: "",
  });
  const [appliedLeaves, setAppliedLeaves] = useState([]);

  const today = new Date().toISOString().split("T")[0];
  const todayLog = attendance.find((a) => a.date === today);
  const todayLeave = appliedLeaves.find((l) => l.date === today);

  /* ---------------- CALCULATIONS ---------------- */
  const calcHours = (login, logout) => {
    if (!login || !logout) return 0;
    const [lh, lm] = login.split(":").map(Number);
    const [oh, om] = logout.split(":").map(Number);
    let hours = oh - lh + (om - lm) / 60;
    return parseFloat(hours.toFixed(2));
  };

  const calcOvertime = (totalHours, shiftHours = 9) =>
    totalHours > shiftHours ? totalHours - shiftHours : 0;

  const calcFine = (login, logout) => {
    const [lh, lm] = login.split(":").map(Number);
    const [oh, om] = logout.split(":").map(Number);
    const [sh, sm] = employee.shiftStart.split(":").map(Number);
    const [eh, em] = employee.shiftEnd.split(":").map(Number);

    let fine = 0;
    if (lh < sh || (lh === sh && lm < sm)) fine += employee.earlyPunchFine;
    if (oh < eh || (oh === eh && om < em)) fine += employee.earlyCheckoutFine;
    return fine;
  };

  const totalHours = todayLog
    ? calcHours(todayLog.login, todayLog.logout)
    : 0;

  const overtimeHours = calcOvertime(totalHours);
  const fineAmount = todayLog
    ? calcFine(todayLog.login, todayLog.logout)
    : 0;

  const salary =
    totalHours * employee.salaryPerHour +
    overtimeHours * employee.overtimeRate -
    fineAmount;

  /* ---------------- DELIVERY LOGIC ---------------- */
  const getCurrentTime = () =>
    new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const getMockLocation = () => "Live Location: Coimbatore, Tamil Nadu";

  const handleStart = () => {
    const newTrip = {
      id: Date.now(),
      startTime: getCurrentTime(),
      startLocation: getMockLocation(),
      stopTime: null,
      stopLocation: null,
    };
    setActiveTrip(newTrip);
    setDeliveryLogs((prev) => [...prev, newTrip]);
  };

  const handleStop = () => {
    if (!activeTrip) return;

    const updatedLogs = deliveryLogs.map((log) =>
      log.id === activeTrip.id
        ? {
            ...log,
            stopTime: getCurrentTime(),
            stopLocation: getMockLocation(),
          }
        : log
    );

    setDeliveryLogs(updatedLogs);
    setActiveTrip(null);
  };

  const handleApplyLeave = () => {
    const newLeave = {
      id: Date.now(),
      date: today,
      type: leaveType,
      ...leaveForm,
    };

    setAppliedLeaves((prev) => [...prev, newLeave]);
    setShowLeaveModal(false);
    setLeaveForm({
      startDate: "",
      endDate: "",
      startHours: "",
      endHours: "",
      reason: "",
    });
};

  return (
    <div className="min-h-screen bg-gray-50 pt-20 px-3 sm:px-6 md:pl-20 space-y-6">

      {/* PROFILE */}
      <div className="bg-white rounded-2xl shadow border p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
  <div className="flex items-center gap-4">
    <img
      src={employee.image}
      alt={employee.name}
      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border"
    />
    <div>
      <div className="text-xl sm:text-2xl font-bold text-primary">
        {employee.name}
      </div>
      <div className="text-sm text-gray-500">
        {employee.department}
      </div>
      <div className="text-xs sm:text-sm text-gray-500">
        {employee.email}
      </div>
      <div className="text-xs sm:text-sm text-gray-500">
        {employee.phone}
      </div>
    </div>
  </div>

  <button
    onClick={() => setShowLeaveModal(true)}
    className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-primary/90 transition text-sm lg:ml-auto"
  >
    Apply Leave
  </button>
</div>


      {/* GOALS */}
      <div className="bg-white rounded-2xl shadow border p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-primary mb-3 flex items-center gap-2">
          <FaUserCircle />
          Goals & Progress
        </h2>
        <div className="space-y-2 text-sm">
          {employee.goals.map((g, idx) => (
            <div key={idx} className="flex justify-between items-center">
              <span>{g.goal}</span>
              <span className="font-semibold text-gray-700">
                {g.progress}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* TODAY ATTENDANCE */}
      <div className="bg-white rounded-2xl shadow border p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-primary mb-3 flex items-center gap-2">
          <FaClock />
          Today's Attendance
        </h2>

        {todayLeave ? (
          <div className="text-center text-red-600 font-semibold">
            On Leave ({todayLeave.type === "full" ? "Full Day" : "Half Day"})
          </div>
        ) : todayLog ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 text-xs sm:text-sm">
            {[
              ["Date", todayLog.date],
              ["Login", todayLog.login],
              ["Logout", todayLog.logout],
              ["Total Hrs", totalHours],
              ["OT Hrs", overtimeHours],
              ["Fine ₹", fineAmount],
            ].map(([label, value], i) => (
              <div
                key={i}
                className="bg-gray-50 p-3 rounded-lg text-center"
              >
                <div className="text-gray-500">{label}</div>
                <div className="font-medium">{value}</div>
              </div>
            ))}

            <div className="bg-primary text-white p-3 rounded-lg text-center col-span-2 sm:col-span-1">
              <div>Salary ₹</div>
              <div className="font-bold">
                {salary.toFixed(2)}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">
            No attendance recorded for today
          </div>
        )}
      </div>

      {/* DELIVERY LOGS */}
      <div className="bg-white rounded-2xl shadow border p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-primary flex items-center gap-2">
            <FaMapMarkerAlt />
            Today's Delivery Logs
          </h2>

          <div className="flex gap-3">
            <button
              onClick={handleStart}
              disabled={!!activeTrip}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shadow transition ${
                activeTrip
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              <FaPlay />
              Start
            </button>

            <button
              onClick={handleStop}
              disabled={!activeTrip}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shadow transition ${
                !activeTrip
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              <FaStop />
              Stop
            </button>
          </div>
        </div>

        {/* MOBILE CARD VIEW */}
        <div className="block sm:hidden space-y-3">
          {deliveryLogs.map((log, idx) => (
            <div
              key={log.id}
              className="border rounded-xl p-4 shadow-sm bg-gray-50"
            >
              <div className="flex justify-between mb-2">
                <span className="text-xs text-gray-500">
                  Trip #{idx + 1}
                </span>
              </div>

              <div className="text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Departure Time
                  </span>
                  <span className="font-medium">
                    {log.startTime || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Departure Location
                  </span>
                  <span className="font-medium text-right">
                    {log.startLocation || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Arrival Time
                  </span>
                  <span className="font-medium">
                    {log.stopTime || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Arrival Location
                  </span>
                  <span className="font-medium text-right">
                    {log.stopLocation || "-"}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {deliveryLogs.length === 0 && (
            <div className="text-center text-gray-500">
              No delivery logs yet
            </div>
          )}
        </div>

        {/* TABLE VIEW FOR TABLET + DESKTOP */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full border text-sm rounded-lg overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 border text-left">#</th>
                <th className="p-3 border text-left">
                  Departure Time
                </th>
                <th className="p-3 border text-left">
                  Departure Location
                </th>
                <th className="p-3 border text-left">
                  Arrival Time
                </th>
                <th className="p-3 border text-left">
                  Arrival Location
                </th>
              </tr>
            </thead>
            <tbody>
              {deliveryLogs.map((log, idx) => (
                <tr
                  key={log.id}
                  className="hover:bg-gray-50 transition"
                >
                  <td className="p-3 border">{idx + 1}</td>
                  <td className="p-3 border">
                    {log.startTime || "-"}
                  </td>
                  <td className="p-3 border">
                    {log.startLocation || "-"}
                  </td>
                  <td className="p-3 border">
                    {log.stopTime || "-"}
                  </td>
                  <td className="p-3 border">
                    {log.stopLocation || "-"}
                  </td>
                </tr>
              ))}

              {deliveryLogs.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="p-4 text-center text-gray-500"
                  >
                    No delivery logs yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg p-6 space-y-4">

            <h2 className="text-lg font-semibold text-primary">
              Apply Leave
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <input disabled value={employee.id} className="border rounded-lg p-2" />
              <input disabled value={employee.name} className="border rounded-lg p-2" />
              <input disabled value={employee.department} className="border rounded-lg p-2 sm:col-span-2" />
            </div>

            <div>
              <label className="text-sm font-medium">Leave Type</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="border rounded-lg p-2 w-full mt-1"
              >
                <option value="full">Full Day</option>
                <option value="half">Half Day</option>
              </select>
            </div>

            {leaveType === "full" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="date" value={leaveForm.startDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                  className="border rounded-lg p-2" />
                <input type="date" value={leaveForm.endDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                  className="border rounded-lg p-2" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="time" value={leaveForm.startHours}
                  onChange={(e) => setLeaveForm({ ...leaveForm, startHours: e.target.value })}
                  className="border rounded-lg p-2" />
                <input type="time" value={leaveForm.endHours}
                  onChange={(e) => setLeaveForm({ ...leaveForm, endHours: e.target.value })}
                  className="border rounded-lg p-2" />
              </div>
            )}

            <textarea
              placeholder="Reason"
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              className="border rounded-lg p-2 w-full"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyLeave}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm shadow"
              >
                Apply Leave
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
