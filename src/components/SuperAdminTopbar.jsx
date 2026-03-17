import { useEffect, useState } from "react";
import { FaBars, FaBell, FaChevronDown, FaSignOutAlt, FaShieldAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const SuperAdminTopbar = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [openProfile, setOpenProfile] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/super-admin-login");
  };

  return (
    <header className="fixed top-0 left-0 right-0 md:left-20 z-30 group md:h-[64px]">
      <div className="absolute top-0 left-0 right-0 h-4 bg-transparent z-50 hidden md:block" />
      <div className="bg-white shadow h-full w-full transform md:-translate-y-full md:group-hover:translate-y-0 transition-all duration-300 relative z-40">
        <div className="flex items-center justify-between px-4 md:px-6 h-full w-full md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
          {/* Left: Hamburger (mobile) + Time */}
          <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg bg-transition hover:bg-primary/20 transition text-primary"
        >
          <FaBars size={20} />
        </button>

        <div className="text-xs sm:text-sm md:text-base font-semibold text-primary">
          {time.toLocaleDateString()} | {time.toLocaleTimeString()}
        </div>

        {/* Super Admin Display */}
        <div className="hidden md:flex items-center gap-2 ml-4 pl-4 border-l border-gray-300">
          <FaShieldAlt className="text-yellow-500 text-sm" />
          <span className="text-xs font-semibold text-gray-700">
            SUPER ADMIN
          </span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 relative">
        {/* Alerts */}
        <button className="hidden sm:flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-md text-sm hover:bg-primary/20 transition">
          <FaBell />
          Alerts
        </button>

        {/* Profile */}
        <button
          onClick={() => setOpenProfile(!openProfile)}
          className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400 text-gray-800 font-bold">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <span className="hidden sm:block text-sm font-semibold text-gray-800">
            {user?.username || "Admin"}
          </span>
          <FaChevronDown className="text-gray-500 text-xs" />
        </button>

        {/* Dropdown */}
        {openProfile && (
          <div className="absolute right-0 top-14 w-56 bg-white border rounded-lg shadow-lg overflow-hidden">
            {/* User Info */}
            <div className="px-4 py-3 bg-gradient-to-r from-yellow-50 to-yellow-100 border-b">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-400 text-gray-800 font-bold">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{user?.username || "Admin"}</p>
                  <p className="text-xs text-gray-600">{user?.email || "admin@pearlfoods.com"}</p>
                  <p className="text-xs font-semibold text-yellow-600 mt-1">
                    <FaShieldAlt className="inline mr-1" /> SUPER ADMIN
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="py-2">
              <button
                onClick={() => {
                  setOpenProfile(false);
                  navigate("/super-admin/branch-management");
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
              >
                <FaShieldAlt size={14} />
                Branch Management
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-red-50 text-red-600 border-t"
              >
                <FaSignOutAlt />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
        </div>
      </div>
    </header>
  );
};

export default SuperAdminTopbar;
