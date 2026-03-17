import { FaBars, FaBell, FaSignOutAlt, FaUser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useBranch } from "../context/BranchContext";

export default function BranchTopbar({ onMenuClick }) {
  const { branch, user, logout } = useBranch();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/branch-login");
  };

  return (
    <div className="fixed top-0 right-0 left-0 md:left-20 z-40 group md:h-[72px]">
      {/* Invisible hover trigger zone at the very top */}
      <div className="absolute top-0 left-0 right-0 h-4 bg-transparent z-50 hidden md:block" />
      <div className="bg-white shadow-md px-6 py-4 transform md:-translate-y-full md:group-hover:translate-y-0 transition-all duration-300 w-full h-full relative">
        <div className="flex items-center justify-between md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <FaBars size={20} className="text-secondary" />
        </button>

        {/* Branch & User Info */}
        <div className="hidden md:flex items-center gap-6 flex-1">
          <div>
            <p className="text-xs text-gray-500">Current Branch</p>
            <p className="font-bold text-gray-900">{branch?.name}</p>
          </div>
          <div className="h-8 w-px bg-gray-200"></div>
          <div>
            <p className="text-xs text-gray-500">Logged in as</p>
            <p className="font-bold text-gray-900">{user?.username}</p>
          </div>
        </div>

        {/* Right Side Icons */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="p-2 rounded-lg hover:bg-gray-100 transition relative">
            <FaBell size={18} className="text-secondary" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition">
            <FaUser size={18} className="text-secondary" />
            <span className="font-bold text-gray-900">{user?.role}</span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition font-bold"
          >
            <FaSignOutAlt size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
