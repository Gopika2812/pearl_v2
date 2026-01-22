import { useEffect, useState } from "react";
import { FaBars, FaBell, FaChevronDown, FaSignOutAlt } from "react-icons/fa";

const Topbar = ({ onMenuClick }) => {
  const [time, setTime] = useState(new Date());
  const [openProfile, setOpenProfile] = useState(false);

  const user = {
    name: "Admin",
    role: "Administrator",
    image: "https://i.pravatar.cc/150?img=12",
  };

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    alert("Logged out successfully");
  };

  return (
    <header className="fixed top-0 left-0 right-0 md:left-64 h-16 bg-white shadow z-30 flex items-center justify-between px-4 md:px-6">

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
          <img
            src={user.image}
            alt="Profile"
            className="w-8 h-8 rounded-full border"
          />
          <span className="hidden sm:block text-sm font-semibold text-gray-800">
            {user.name}
          </span>
          <FaChevronDown className="text-gray-500 text-xs" />
        </button>

        {/* Dropdown */}
        {openProfile && (
          <div className="absolute right-0 top-14 w-40 bg-white border rounded-lg shadow-lg overflow-hidden">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
            >
              <FaSignOutAlt />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
