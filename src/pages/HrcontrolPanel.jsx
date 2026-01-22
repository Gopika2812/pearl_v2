import { useState } from "react";
import { FaClock, FaMoneyBill, FaPlus, FaTruck, FaUsers } from "react-icons/fa";

/* ---------------- SAMPLE DATA ---------------- */
const sampleAttendance = [
  { id: 1, employee: "Ravi Kumar", date: "2026-01-22", login: "09:10", logout: "18:40", lateBy: "10m", earlyOut: "-", totalHrs: 9.5, otHrs: 0.5, fine: 0, salary: 1050 },
  { id: 2, employee: "Suresh Patel", date: "2026-01-22", login: "08:50", logout: "17:30", lateBy: "-", earlyOut: "30m", totalHrs: 8.7, otHrs: 0, fine: 75, salary: 870 },
];

const sampleLeaves = [
  { id: 1, employee: "Anita Sharma", type: "Casual Leave", from: "2026-01-22", to: "2026-01-23", status: "Pending" },
  { id: 2, employee: "Ravi Kumar", type: "Sick Leave", from: "2026-01-20", to: "2026-01-20", status: "Approved" },
];

const sampleDeliveryLogs = [
  { id: 1, employee: "Ravi Kumar", start: "10:30", stop: "12:15", location: "MG Road", duration: "1h 45m", status: "Completed" },
  { id: 2, employee: "Suresh Patel", start: "11:00", stop: "-", location: "Airport Rd", duration: "-", status: "Active" },
];

export default function HRControlPanel() {
  const [activeTab, setActiveTab] = useState("Attendance");
  const [showOTModal, setShowOTModal] = useState(false);
  const [showFineModal, setShowFineModal] = useState(false);

  const tabs = ["Attendance", "Leave Logs", "Delivery Logs", "Payroll Rules"];

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pl-64 px-3 sm:px-6 space-y-6">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-primary">
          HR Control Panel
        </h1>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowOTModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition text-sm flex items-center justify-center gap-2"
          >
            <FaPlus /> Add OT Rule
          </button>
          <button
            onClick={() => setShowFineModal(true)}
            className="bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition text-sm flex items-center justify-center gap-2"
          >
            <FaPlus /> Add Fine Rule
          </button>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Logged Today" value="42" icon={<FaUsers />} />
        <SummaryCard title="Late Entries" value="6" icon={<FaClock />} />
        <SummaryCard title="OT Hours" value="18" icon={<FaMoneyBill />} />
        <SummaryCard title="Delivery Staff" value="9" icon={<FaTruck />} />
      </div>

      {/* TABS */}
      <div className="bg-white rounded-2xl shadow border p-2 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
              activeTab === tab
                ? "bg-primary text-white shadow"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Attendance" && <AttendanceTable data={sampleAttendance} />}
      {activeTab === "Leave Logs" && <LeaveTable data={sampleLeaves} />}
      {activeTab === "Delivery Logs" && <DeliveryTable data={sampleDeliveryLogs} />}
      {activeTab === "Payroll Rules" && <PayrollRules />}

      {showOTModal && <OTModal onClose={() => setShowOTModal(false)} />}
      {showFineModal && <FineModal onClose={() => setShowFineModal(false)} />}
    </div>
  );
}

/* ---------------- COMPONENTS ---------------- */

function SummaryCard({ title, value, icon }) {
  return (
    <div className="bg-white rounded-xl shadow border p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-xs sm:text-sm text-gray-500">{title}</div>
        <div className="text-lg sm:text-2xl font-bold text-primary">
          {value}
        </div>
      </div>
    </div>
  );
}

/* ---------------- ATTENDANCE ---------------- */

function AttendanceTable({ data }) {
  return (
    <>
      {/* MOBILE CARD VIEW */}
      <div className="block sm:hidden space-y-3">
        {data.map((row) => (
          <div key={row.id} className="bg-white border rounded-xl shadow p-4">
            <div className="font-semibold text-primary">{row.employee}</div>
            <div className="text-xs text-gray-500 mb-2">{row.date}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Login: <b>{row.login}</b></div>
              <div>Logout: <b>{row.logout}</b></div>
              <div>Late: <b>{row.lateBy}</b></div>
              <div>Early: <b>{row.earlyOut}</b></div>
              <div>Total: <b>{row.totalHrs}h</b></div>
              <div>OT: <b>{row.otHrs}h</b></div>
              <div className="text-red-600">Fine: ₹{row.fine}</div>
              <div className="text-green-600 font-semibold">
                Salary: ₹{row.salary}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* TABLET + DESKTOP */}
      <div className="hidden sm:block bg-white rounded-2xl shadow border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Employee</th>
              <th className="p-3">Date</th>
              <th className="p-3">Login</th>
              <th className="p-3">Logout</th>
              <th className="p-3">Late</th>
              <th className="p-3">Early</th>
              <th className="p-3">Total</th>
              <th className="p-3">OT</th>
              <th className="p-3">Fine</th>
              <th className="p-3">Salary</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{row.employee}</td>
                <td className="p-3 text-center">{row.date}</td>
                <td className="p-3 text-center">{row.login}</td>
                <td className="p-3 text-center">{row.logout}</td>
                <td className="p-3 text-center">{row.lateBy}</td>
                <td className="p-3 text-center">{row.earlyOut}</td>
                <td className="p-3 text-center">{row.totalHrs}</td>
                <td className="p-3 text-center">{row.otHrs}</td>
                <td className="p-3 text-center text-red-600">{row.fine}</td>
                <td className="p-3 text-center text-green-600 font-semibold">
                  {row.salary}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- LEAVES ---------------- */

function LeaveTable({ data }) {
  return (
    <>
      <div className="block sm:hidden space-y-3">
        {data.map((row) => (
          <div key={row.id} className="bg-white border rounded-xl shadow p-4">
            <div className="font-semibold">{row.employee}</div>
            <div className="text-sm">{row.type}</div>
            <div className="text-xs text-gray-500">
              {row.from} → {row.to}
            </div>
            <div className={`mt-2 font-semibold ${
              row.status === "Approved"
                ? "text-green-600"
                : row.status === "Pending"
                ? "text-orange-500"
                : "text-red-600"
            }`}>
              {row.status}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block bg-white rounded-2xl shadow border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Employee</th>
              <th className="p-3">Type</th>
              <th className="p-3">From</th>
              <th className="p-3">To</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{row.employee}</td>
                <td className="p-3 text-center">{row.type}</td>
                <td className="p-3 text-center">{row.from}</td>
                <td className="p-3 text-center">{row.to}</td>
                <td className={`p-3 text-center font-semibold ${
                  row.status === "Approved"
                    ? "text-green-600"
                    : row.status === "Pending"
                    ? "text-orange-500"
                    : "text-red-600"
                }`}>
                  {row.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- DELIVERY ---------------- */

function DeliveryTable({ data }) {
  return (
    <>
      <div className="block sm:hidden space-y-3">
        {data.map((row) => (
          <div key={row.id} className="bg-white border rounded-xl shadow p-4">
            <div className="font-semibold">{row.employee}</div>
            <div className="text-sm text-gray-500">{row.location}</div>
            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
              <div>Start: <b>{row.start}</b></div>
              <div>Stop: <b>{row.stop}</b></div>
              <div>Duration: <b>{row.duration}</b></div>
              <div className={`font-semibold ${
                row.status === "Active" ? "text-green-600" : "text-gray-500"
              }`}>
                {row.status}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block bg-white rounded-2xl shadow border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Employee</th>
              <th className="p-3">Start</th>
              <th className="p-3">Stop</th>
              <th className="p-3">Location</th>
              <th className="p-3">Duration</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{row.employee}</td>
                <td className="p-3 text-center">{row.start}</td>
                <td className="p-3 text-center">{row.stop}</td>
                <td className="p-3 text-center">{row.location}</td>
                <td className="p-3 text-center">{row.duration}</td>
                <td className={`p-3 text-center font-semibold ${
                  row.status === "Active" ? "text-green-600" : "text-gray-500"
                }`}>
                  {row.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- PAYROLL RULES ---------------- */

function PayrollRules() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl shadow border p-6">
        <h3 className="text-lg font-semibold text-primary mb-3">
          Overtime Rules
        </h3>
        <div className="text-sm text-gray-500">
          Define OT hours & salary rate
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow border p-6">
        <h3 className="text-lg font-semibold text-primary mb-3">
          Fine Rules
        </h3>
        <div className="text-sm text-gray-500">
          Define late login & early logout fines
        </div>
      </div>
    </div>
  );
}

/* ---------------- MODALS ---------------- */

function OTModal({ onClose }) {
  return (
    <ModalWrapper onClose={onClose} title="Add OT Rule">
      <div className="space-y-4">
        <Input label="OT Hours" />
        <Input label="Salary for 1 Hr ₹" />
        <Input label="Effective From" type="date" />
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200">
            Cancel
          </button>
          <button className="px-4 py-2 rounded-lg bg-primary text-white">
            Save Rule
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

function FineModal({ onClose }) {
  return (
    <ModalWrapper onClose={onClose} title="Add Fine Rule">
      <div className="space-y-4">
        <Input label="Late After (min)" />
        <Input label="Late Fine ₹" />
        <Input label="Early Logout Before (min)" />
        <Input label="Early Fine ₹" />
        <Input label="Effective From" type="date" />
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200">
            Cancel
          </button>
          <button className="px-4 py-2 rounded-lg bg-primary text-white">
            Save Rule
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

function ModalWrapper({ children, title, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6 relative">
        <h3 className="text-lg font-semibold text-primary mb-4">
          {title}
        </h3>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

function Input({ label, type = "number" }) {
  return (
    <div>
      <label className="text-sm text-gray-600">{label}</label>
      <input
        type={type}
        className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
