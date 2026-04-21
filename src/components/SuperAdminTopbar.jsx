import { useEffect, useRef, useState } from "react";
import {
  FaBars, FaBell, FaBuilding, FaChevronDown, FaEye,
  FaShieldAlt, FaSignOutAlt,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api";
import { useBranch } from "../context/BranchContext";

const SuperAdminTopbar = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { superAdminViewBranch, setSuperAdminViewBranch } = useBranch();
  const [tokenStats, setTokenStats] = useState({ todayTotal: 0, todayPending: 0 });
  const [time, setTime] = useState(new Date());
  const [openProfile, setOpenProfile] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);

  const profileRef = useRef(null);
  const branchDropdownRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch global token stats for Super Admin
  useEffect(() => {
    const fetchTokenStats = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        
        const res = await fetch(`${API_BASE}/tokens/stats/super-admin`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setTokenStats(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch super admin token stats:", err);
      }
    };

    fetchTokenStats();
    const interval = setInterval(fetchTokenStats, 60000); // refresh every minute
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

  // Fetch all branches for the dropdown
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await fetch(`${API_BASE}/branches`);
        const data = await res.json();
        if (data.success) setBranches(data.data || []);
      } catch (err) {
        console.error("Failed to fetch branches:", err);
      }
    };
    fetchBranches();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setOpenProfile(false);
      }
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target)) {
        setBranchDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setSuperAdminViewBranch(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/super-admin-login");
  };

  const handleBranchSelect = (branch) => {
    setSuperAdminViewBranch(branch);
    setBranchDropdownOpen(false);
    // Navigate to branch home so super admin can use branch pages
    navigate("/branch-home");
  };

  const handleClearBranch = () => {
    setSuperAdminViewBranch(null);
    navigate("/super-admin/branch-management");
  };

  return (
    <header className="fixed top-0 left-0 right-0 md:left-20 z-30 group md:h-[64px]">
      <div className="absolute top-0 left-0 right-0 h-4 bg-transparent z-50 hidden md:block" />
      <div className="bg-white shadow h-full w-full transform md:-translate-y-full md:group-hover:translate-y-0 transition-all duration-300 relative z-40">
        <div className="flex items-center justify-between px-4 md:px-6 h-full w-full md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">

          {/* Left: Mobile hamburger + Time + Super Admin badge */}
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

            {/* Super Admin Badge */}
            <div className="hidden md:flex items-center gap-2 ml-4 pl-4 border-l border-gray-300">
              <FaShieldAlt className="text-yellow-500 text-sm" />
              <span className="text-xs font-semibold text-gray-700">SUPER ADMIN</span>
            </div>
          </div>

          {/* Centre: Branch Switcher */}
          <div className="flex-1 flex items-center justify-center gap-3">
            <div className="relative" ref={branchDropdownRef}>
              <button
                onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition font-semibold text-sm ${
                  superAdminViewBranch
                    ? "border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100"
                    : "border-[#319bab] bg-[#f0fafb] text-[#319bab] hover:bg-[#e0f5f8]"
                }`}
              >
                {superAdminViewBranch ? (
                  <FaEye size={13} className="flex-shrink-0" />
                ) : (
                  <FaBuilding size={13} className="flex-shrink-0" />
                )}
                <span className="max-w-[200px] truncate text-sm">
                  {superAdminViewBranch ? superAdminViewBranch.name : "Select Branch to View"}
                </span>
                <FaChevronDown
                  size={10}
                  className={`flex-shrink-0 transition-transform ${branchDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Viewing badge */}
              {superAdminViewBranch && (
                <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  VIEWING
                </span>
              )}

              {/* Branch dropdown list */}
              {branchDropdownOpen && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                  <div className="p-3 bg-gray-50 border-b flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Select Branch to View
                    </p>
                    {superAdminViewBranch && (
                      <button
                        onClick={handleClearBranch}
                        className="text-[10px] text-red-500 hover:text-red-700 font-semibold"
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>
                  <ul className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                    {branches.length > 0 ? (
                      branches.map((b) => (
                        <li
                          key={b._id}
                          onClick={() => handleBranchSelect(b)}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${
                            superAdminViewBranch?._id === b._id
                              ? "bg-orange-50 font-bold text-orange-700"
                              : "hover:bg-gray-50 text-gray-700"
                          }`}
                        >
                          <FaBuilding size={12} className="flex-shrink-0 text-gray-400" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{b.name}</p>
                            <p className="text-[10px] text-gray-400">{b.location || b.code}</p>
                          </div>
                          {superAdminViewBranch?._id === b._id && (
                            <FaEye size={12} className="text-orange-500 flex-shrink-0" />
                          )}
                        </li>
                      ))
                    ) : (
                      <li className="px-4 py-4 text-sm text-gray-400 text-center">
                        No branches found
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4 relative">
            {/* Alerts */}
            <button className="hidden sm:flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-md text-sm hover:bg-primary/20 transition relative group/alerts">
              <FaBell />
              <span>Alerts</span>
              {tokenStats.todayTotal > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1 rounded-full border border-white">
                  {tokenStats.todayTotal}
                </span>
              )}
              
              {/* Tooltip summary */}
              <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl p-3 hidden group-hover/alerts:block z-[60] animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 border-b pb-2">Tokens Today</p>
                <div className="space-y-2">
                   <div className="flex justify-between items-center px-1">
                     <span className="text-xs font-bold text-gray-600">Total Raised</span>
                     <span className="text-xs font-black text-primary">{tokenStats.todayTotal}</span>
                   </div>
                   <div className="flex justify-between items-center px-1">
                     <span className="text-xs font-bold text-gray-600">Pending</span>
                     <span className="text-xs font-black text-amber-600">{tokenStats.todayPending}</span>
                   </div>
                </div>
              </div>
            </button>

            {/* Profile */}
            <div className="relative" ref={profileRef}>
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

              {/* Profile Dropdown */}
              {openProfile && (
                <div className="absolute right-0 top-14 w-56 bg-white border rounded-lg shadow-lg overflow-hidden z-50">
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
      </div>
    </header>
  );
};

export default SuperAdminTopbar;
