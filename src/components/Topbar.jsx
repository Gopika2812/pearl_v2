import { useEffect, useState } from "react";
import { FaBars, FaBell, FaBuilding, FaChevronDown, FaSignOutAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useBranch } from "../context/BranchContext";

const Topbar = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { currentBranch, user, logout } = useBranch();
  const [time, setTime] = useState(new Date());
  const [openProfile, setOpenProfile] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/branch-login");
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

        {/* Branch Display */}
        {currentBranch && (
          <div className="hidden md:flex items-center gap-2 ml-4 pl-4 border-l border-gray-300">
            <FaBuilding className="text-primary text-sm" />
            <span className="text-xs font-semibold text-gray-700">
              {currentBranch.name}
            </span>
          </div>
        )}
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
            src="https://i.pravatar.cc/150?img=12"
            alt="Profile"
            className="w-8 h-8 rounded-full border"
          />
          <span className="hidden sm:block text-sm font-semibold text-gray-800">
            {user?.username || "Admin"}
          </span>
          <FaChevronDown className="text-gray-500 text-xs" />
        </button>

        {/* Dropdown */}
        {openProfile && (
          <div className="absolute right-0 top-14 w-48 bg-white border rounded-lg shadow-lg overflow-hidden">
            {currentBranch && (
              <div className="px-4 py-2 text-xs text-gray-500 border-b">
                <p className="font-semibold text-gray-700 mb-1">Current Branch</p>
                <p className="text-gray-600">{currentBranch.name}</p>
              </div>
            )}
            <button
              onClick={() => {
                setOpenProfile(false);
                navigate("/branch-login");
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 text-gray-700 border-t"
            >
              <FaBuilding size={14} />
              Switch Branch
            </button>
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
        </div>
      </div>
    </header>
  );
};

export default Topbar;
