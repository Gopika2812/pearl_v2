import {
  FaBook,
  FaFileInvoice,
  FaHome,
  FaMoneyBillWave,
  FaShoppingCart,
  FaSignOutAlt,
  FaTimes,
  FaTruck,
  FaUsers,
  FaUserTie,
} from "react-icons/fa";
import { Link, useLocation } from "react-router-dom";

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();

  const menu = [
    { name: "Home", path: "/", icon: <FaHome /> },
    { name: "Purchase Order", path: "/purchase-order", icon: <FaShoppingCart /> },
    { name: "Sales Order", path: "/sales-order", icon: <FaFileInvoice /> },
    { name: "Pearls Book", path: "/pearls-book", icon: <FaBook /> },
    { name: "CRM", path: "/crm", icon: <FaUsers /> },
    { name: "Loading & Dispatch", path: "/dispatch", icon: <FaTruck /> },
    { name: "Employees Book", path: "/employees", icon: <FaUserTie /> },
    { name: "Employee Dashboard", path: "/employeepage", icon: <FaUsers /> },
    { name: "Payroll & Attendance", path: "/hr-control", icon: <FaMoneyBillWave /> },
  ];

  const handleLogout = () => {
    alert("Logged out successfully");
  };

  return (
    <>
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside className="hidden md:flex md:flex-col w-64 h-screen bg-gradient-to-b from-primary to-primary/90 text-white shadow-xl fixed left-0 top-0">
        <div className="px-6 py-6 border-b border-white/20">
          <h1 className="text-2xl font-bold tracking-wide">Pearls ERP</h1>
          <p className="text-xs text-white/70 mt-1">
            Retail Management System
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {menu.map((item, index) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={index}
                to={item.path}
                className={`mx-3 mb-1 flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  active
                    ? "bg-white text-primary shadow-md font-semibold"
                    : "hover:bg-white/10 text-white/90"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-white text-primary px-4 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-semibold"
          >
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </aside>

      {/* ================= MOBILE OVERLAY ================= */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/40 transition-opacity ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={onClose}
      />

      {/* ================= MOBILE SIDEBAR ================= */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-72 bg-gradient-to-b from-primary to-primary/90 text-white shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* CLOSE */}
        <div className="flex justify-end p-4 border-b border-white/20">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 transition"
          >
            <FaTimes size={22} />
          </button>
        </div>

        {/* NAV */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {menu.map((item, index) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={index}
                to={item.path}
                className={`mx-2 mb-1 flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  active
                    ? "bg-white text-primary shadow-md font-semibold"
                    : "hover:bg-white/10 text-white/90"
                }`}
                onClick={onClose}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* LOGOUT */}
        <div className="p-4 border-t border-white/20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-white text-primary px-4 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-semibold"
          >
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
