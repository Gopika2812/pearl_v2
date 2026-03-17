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
      <aside className="hidden md:flex md:flex-col w-20 hover:w-64 transition-all duration-300 h-screen bg-gradient-to-b from-secondary to-secondary/90 text-white shadow-xl fixed left-0 top-0 z-50 overflow-x-hidden group">
        <div className="px-4 py-6 border-b border-white/10 flex items-center h-[96px]">
          <div className="flex items-center gap-3 w-full justify-center group-hover:justify-start">
            <img
              src="/logo.jpeg"
              alt="Pearls ERP Logo"
              className="w-12 h-12 flex-shrink-0 object-contain rounded-lg"
            />
            <span className="font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-0 group-hover:w-auto overflow-hidden">Home</span>
          </div>
        </div>        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4">
          {menu.map((item, index) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={index}
                to={item.path}
                className={`mx-3 mb-1 flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${active
                  ? "bg-white text-secondary shadow-md font-semibold"
                  : "hover:bg-white/10 text-white/90"
                }`}
                title={item.name}
              >
                <div className="w-8 flex justify-center flex-shrink-0">
                  <span className="text-lg">{item.icon}</span>
                </div>
                <span className="text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">{item.name}</span>
              </Link>
            );
          })}

          {/* ADMIN SECTION - Only show for ADMIN users */}
          {user?.role === "ADMIN" && (
            <div className="mx-3 mb-1 mt-4">
              <button
                onClick={() => setAdminOpen(!adminOpen)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/10 text-white/90 transition-colors"
                title="Admin"
              >
                <div className="w-8 flex justify-center flex-shrink-0">
                  <span className="text-lg"><FaCog /></span>
                </div>
                <span className="text-sm flex-1 text-left whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-0 group-hover:w-auto overflow-hidden">Admin</span>
                <div className="w-4 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <FaChevronDown
                    className={`text-xs transition-transform ${adminOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {adminOpen && (
                <div className="mt-2 ml-4 space-y-1 pl-3 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300 group-hover:border-l-2 group-hover:border-white/20">
                  {adminItems.map((item, idx) => {
                    const active = location.pathname === item.path;
                    return (
                      <Link
                        key={idx}
                        to={item.path}
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${active
                          ? "bg-white/20 text-white font-semibold"
                          : "hover:bg-white/10 text-white/80"}`}
                        title={item.name}
                      >
                        <div className="w-6 flex justify-center flex-shrink-0">
                          <span className="text-sm">{item.icon}</span>
                        </div>
                        <span className="whitespace-nowrap">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-white/20 flex justify-center group-hover:justify-start">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 bg-white text-secondary px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-semibold justify-center group-hover:justify-start overflow-hidden"
            title="Logout"
          >
            <div className="w-6 flex justify-center flex-shrink-0">
              <FaSignOutAlt />
            </div>
            <span className="opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-300 w-0 group-hover:w-auto">Logout</span>
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

