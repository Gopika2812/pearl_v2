import {
    FaBox,
    FaChartLine,
    FaFileInvoice,
    FaPlus,
    FaRupeeSign,
    FaTruck,
    FaUsers,
    FaUserTie,
} from "react-icons/fa";

const Home = () => {
  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pl-20 px-4 sm:px-6 space-y-6">

      {/* HEADER */}
      <div className="bg-white rounded-2xl shadow border p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">
            Welcome to Pearls Agency
          </h1>
          <p className="text-gray-500 text-sm sm:text-base">
            Retailer ERP Management Dashboard
          </p>
        </div>

        <div className="text-xs sm:text-sm text-gray-400">
          Logged in as: <span className="font-semibold text-primary">Admin</span>
        </div>
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today Orders" value="24" icon={<FaBox />} />
        <StatCard title="Today Sales" value="₹48,200" icon={<FaRupeeSign />} />
        <StatCard title="Active Employees" value="18" icon={<FaUsers />} />
        <StatCard title="Pending Dispatch" value="5" icon={<FaTruck />} />
      </div>

      {/* QUICK ACTIONS */}
      <div className="bg-white rounded-2xl shadow border p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">
          Quick Actions
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <QuickAction title="New Sales Order" icon={<FaFileInvoice />} />
          <QuickAction title="New Purchase Order" icon={<FaPlus />} />
          <QuickAction title="Add Employee" icon={<FaUserTie />} />
          <QuickAction title="View Reports" icon={<FaChartLine />} />
        </div>
      </div>

      {/* ALERTS */}
      <div className="bg-white rounded-2xl shadow border p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">
          Alerts & Notifications
        </h2>

        <ul className="space-y-3 text-sm">
          <li className="flex items-center justify-between bg-red-50 border border-red-200 p-3 rounded-lg">
            <span>⚠ Low stock for Pearl Necklace</span>
            <button className="text-red-600 font-medium">View</button>
          </li>

          <li className="flex items-center justify-between bg-orange-50 border border-orange-200 p-3 rounded-lg">
            <span>⏰ 3 employees late today</span>
            <button className="text-orange-600 font-medium">View</button>
          </li>

          <li className="flex items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <span>📅 2 leave requests pending</span>
            <button className="text-blue-600 font-medium">View</button>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Home;

/* ---------------- COMPONENTS ---------------- */

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-white rounded-xl shadow border p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-lg">
        {icon}
      </div>
      <div>
        <div className="text-xs sm:text-sm text-gray-500">{title}</div>
        <div className="text-lg sm:text-xl font-bold text-primary">
          {value}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ title, icon }) {
  return (
    <button className="bg-primary/10 hover:bg-primary/20 transition rounded-xl p-4 flex flex-col items-center gap-2 text-primary shadow-sm">
      <div className="text-xl">{icon}</div>
      <div className="text-xs sm:text-sm font-medium text-center">
        {title}
      </div>
    </button>
  );
}
