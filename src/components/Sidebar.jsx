import { useState, useEffect } from "react";
import {
    FaBook,
    FaBox,
    FaBuilding,
    FaCalculator,
    FaChartBar,
    FaChevronDown,
    FaCog,
    FaEllipsisH,
    FaFileAlt,
    FaFileInvoice,
    FaHome,
    FaMoneyBillWave,
    FaShoppingCart,
    FaSignOutAlt,
    FaTimes,
    FaTruck,
    FaUserClock,
    FaUsers,
    FaUserTie,
} from "react-icons/fa";
import { Link, useLocation, useNavigate } from "react-router-dom";

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [adminOpen, setAdminOpen] = useState(false);
  const [user, setUser] = useState(null);

  // Load user from localStorage on mount and when route changes
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
    { name: "Home", path: "/", icon: <FaHome /> },
  ];

  const adminItems = [
    { name: "Branch Management", path: "/admin/branches", icon: <FaBuilding /> },
  ];

  const handleLogout = () => {
    // Clear JWT token and user data
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    
    // Redirect to login
    navigate("/branch-login");
  };

  return (
    <>
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside className="hidden md:flex md:flex-col w-64 h-screen bg-gradient-to-b from-secondary to-secondary/90 text-white shadow-xl fixed left-0 top-0">
        <div className="px-6 py-6 border-b border-white/10 flex justify-center">
          <img
            src="/logo.jpeg"
            alt="Pearls ERP Logo"
            className="h-12 w-[180px] lg:w-[180px] object-contain rounded-lg"
          />
        </div>


        <nav className="flex-1 overflow-y-auto py-4">
          {menu.map((item, index) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={index}
                to={item.path}
                className={`mx-3 mb-1 flex items-center gap-3 px-4 py-3 rounded-xl transition ${active
                  ? "bg-white text-secondary shadow-md font-semibold"
                  : "hover:bg-white/10 text-white/90"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}

          {/* ADMIN SECTION - Only show for ADMIN users */}
          {user?.role === "ADMIN" && (
            <div className="mx-3 mb-1 mt-4">
              <button
                onClick={() => setAdminOpen(!adminOpen)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 text-white/90 transition"
              >
                <span className="text-lg"><FaCog /></span>
                <span className="text-sm flex-1 text-left">Admin</span>
                <FaChevronDown
                  className={`text-xs transition-transform ${adminOpen ? "rotate-180" : ""}`}
                />
              </button>

              {adminOpen && (
                <div className="mt-2 ml-4 space-y-1 border-l-2 border-white/20 pl-3">
                  {adminItems.map((item, idx) => {
                    const active = location.pathname === item.path;
                    return (
                      <Link
                        key={idx}
                        to={item.path}
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition ${active
                          ? "bg-white/20 text-white font-semibold"
                          : "hover:bg-white/10 text-white/80"}`}
                      >
                        <span className="text-sm">{item.icon}</span>
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-white/20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-white text-secondary px-4 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-semibold"
          >
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </aside>

      {/* ================= MOBILE OVERLAY ================= */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/40 transition-opacity ${isOpen ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
        onClick={onClose}
      />

      {/* ================= MOBILE SIDEBAR ================= */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-72 bg-gradient-to-b from-secondary to-secondary/90 text-white shadow-2xl z-50 transform transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"
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
                className={`mx-2 mb-1 flex items-center gap-3 px-4 py-3 rounded-xl transition ${active
                  ? "bg-white text-secondary shadow-md font-semibold"
                  : "hover:bg-white/10 text-white/90"
                  }`}
                onClick={onClose}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}

          {/* ADMIN SECTION MOBILE - Only show for ADMIN users */}
          {user?.role === "ADMIN" && (
            <div className="mx-2 mb-1 mt-4">
              <button
                onClick={() => setAdminOpen(!adminOpen)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 text-white/90 transition"
              >
                <span className="text-lg"><FaCog /></span>
                <span className="text-sm flex-1 text-left">Admin</span>
                <FaChevronDown
                  className={`text-xs transition-transform ${adminOpen ? "rotate-180" : ""}`}
                />
              </button>

              {adminOpen && (
                <div className="mt-2 ml-4 space-y-1 border-l-2 border-white/20 pl-3">
                  {adminItems.map((item, idx) => {
                    const active = location.pathname === item.path;
                    return (
                      <Link
                        key={idx}
                        to={item.path}
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition ${active
                          ? "bg-white/20 text-white font-semibold"
                          : "hover:bg-white/10 text-white/80"}`}
                      >
                        <span className="text-sm">{item.icon}</span>
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* LOGOUT */}
        <div className="p-4 border-t border-white/20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-white text-secondary px-4 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-semibold"
          >
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

