import { useState, useEffect } from "react";
import {
  FaHome,
  FaCog,
  FaUsers,
  FaSignOutAlt,
  FaTimes,
  FaShieldAlt,
  FaUsersCog,
  FaClipboardList,
  FaUserCheck,
} from "react-icons/fa";
import { Link, useLocation, useNavigate } from "react-router-dom";

const SuperAdminSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error("Error parsing user data:", error);
        setUser(null);
      }
    }
  }, [location.pathname]);

  const menu = [
    { name: "Branch Management", path: "/super-admin/branch-management", icon: <FaHome /> },
    { name: "User Approvals", path: "/super-admin/user-approvals", icon: <FaUserCheck /> },
    { name: "Control System", path: "/super-admin/control-system", icon: <FaUsersCog /> },
    { name: "Audit Logs", path: "/super-admin/audit-logs", icon: <FaClipboardList /> },
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/super-admin-login");
  };

  return (
    <>
      {/* ================= DESKTOP SIDEBAR ================= */}
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside className="hidden md:flex md:flex-col w-20 hover:w-64 transition-all duration-300 h-screen bg-gradient-to-b from-secondary to-secondary/90 text-white shadow-xl fixed left-0 top-0 z-50 overflow-x-hidden group">
        <div className="px-4 py-6 border-b border-white/10 flex items-center h-[96px]">
          <div className="flex items-center gap-3 w-full justify-center group-hover:justify-start">
            <img
              src="/logo.jpeg"
              alt="Pearls ERP Logo"
              className="w-12 h-12 flex-shrink-0 object-contain rounded-lg"
            />
            <span className="font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-0 group-hover:w-auto overflow-hidden">Super Admin</span>
          </div>
        </div>

        {/* Super Admin Badge */}
        <div className="mx-3 mt-4 mb-4 px-3 py-3 bg-yellow-400/20 border border-yellow-400/50 rounded-lg flex items-center gap-3 overflow-hidden">
          <div className="w-8 flex justify-center flex-shrink-0">
            <FaShieldAlt className="text-yellow-300 text-lg" />
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-0 group-hover:w-auto whitespace-nowrap">
            <p className="text-xs text-yellow-200 font-semibold">SUPER ADMIN</p>
            <p className="text-sm font-bold text-white">{user?.username || "Admin"}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4">
          {menu.map((item, index) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={index}
                to={item.path}
                onClick={() => onClose()}
                className={`mx-3 mb-1 flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                  active
                    ? "bg-white text-secondary shadow-md font-semibold"
                    : "hover:bg-white/10 text-white/90"
                }`}
                title={item.name}
              >
                <div className="w-8 flex justify-center flex-shrink-0">
                  <span className="text-lg">{item.icon}</span>
                </div>
                <span className="text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-0 group-hover:w-auto overflow-hidden">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-white/10 flex justify-center group-hover:justify-start">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 px-3 py-2 rounded-xl transition-colors text-sm font-semibold justify-center group-hover:justify-start overflow-hidden"
            title="Logout"
          >
            <div className="w-6 flex justify-center flex-shrink-0">
              <FaSignOutAlt />
            </div>
            <span className="opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-300 w-0 group-hover:w-auto">Logout</span>
          </button>
        </div>
      </aside>

      {/* ================= MOBILE SIDEBAR ================= */}
      <div
        className={`fixed inset-0 bg-black/50 md:hidden transition-opacity z-40 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-secondary to-secondary/90 text-white shadow-xl md:hidden z-50 transform transition-transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
          <img
            src="/logo.jpeg"
            alt="Pearls ERP Logo"
            className="h-10 w-[140px] object-contain rounded-lg"
          />
          <button
            onClick={onClose}
            className="text-white text-2xl hover:bg-white/10 p-2 rounded-lg transition"
          >
            <FaTimes />
          </button>
        </div>

        {/* Super Admin Badge */}
        <div className="mx-3 mt-4 mb-4 px-4 py-3 bg-yellow-400/20 border border-yellow-400/50 rounded-lg flex items-center gap-3">
          <FaShieldAlt className="text-yellow-300" />
          <div>
            <p className="text-xs text-yellow-200 font-semibold">SUPER ADMIN</p>
            <p className="text-sm font-bold text-white">{user?.username || "Admin"}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {menu.map((item, index) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={index}
                to={item.path}
                onClick={() => onClose()}
                className={`mx-3 mb-1 flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  active
                    ? "bg-white text-secondary shadow-md font-semibold"
                    : "hover:bg-white/10 text-white/90"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 transition font-semibold text-sm"
          >
            <FaSignOutAlt />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default SuperAdminSidebar;
