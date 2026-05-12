import { useEffect, useRef, useState } from "react";
import {
  FaBars, FaBell, FaBuilding, FaChevronDown, FaEye,
  FaShieldAlt, FaSignOutAlt, FaTruck, FaExclamationTriangle
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api";
import { useBranch } from "../context/BranchContext";

const SuperAdminTopbar = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { superAdminViewBranch, setSuperAdminViewBranch } = useBranch();
  const [tokenStats, setTokenStats] = useState({ todayTotal: 0, todayPending: 0 });
  const [pendingCreditRequests, setPendingCreditRequests] = useState(0);
  const [delayedPickups, setDelayedPickups] = useState(0);
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

  // Fetch global stats for Super Admin
  useEffect(() => {
    const fetchTokenStats = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/tokens/stats/super-admin`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) setTokenStats(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch token stats:", err);
      }
    };

    const fetchCreditRequestCount = async () => {
      try {
        const res = await fetch(`${API_BASE}/customers/credit-requests/total-count`);
        const data = await res.json();
        if (data.success) setPendingCreditRequests(data.count || 0);
      } catch (err) {
        console.error("Failed to fetch credit request count:", err);
      }
    };

    const fetchDelayedPickups = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const branchQuery = superAdminViewBranch ? `?branchId=${superAdminViewBranch._id}` : "";
        const res = await fetch(`${API_BASE}/invoices/stats/delayed-pickups${branchQuery}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) setDelayedPickups(data.count || 0);
      } catch (err) {
        console.error("Failed to fetch delayed pickups count:", err);
      }
    };

    fetchTokenStats();
    fetchCreditRequestCount();
    fetchDelayedPickups();

    const interval = setInterval(() => {
      fetchTokenStats();
      fetchCreditRequestCount();
      fetchDelayedPickups();
    }, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [superAdminViewBranch?._id]);

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
    
    // Only navigate to branch home if we are NOT on a global admin page
    const isGlobalPage = window.location.pathname.startsWith("/admin/");
    if (!isGlobalPage) {
      navigate("/branch-home");
    }
  };

  const handleClearBranch = () => {
    setSuperAdminViewBranch(null);
    const isGlobalPage = window.location.pathname.startsWith("/admin/");
    if (!isGlobalPage) {
      navigate("/super-admin/branch-management");
    }
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-20 z-50 transition-all duration-300 h-16 md:h-[80px] p-2 md:p-4 flex items-center justify-center pointer-events-none">
      <div className="bg-secondary/90 backdrop-blur-md shadow-2xl px-4 md:px-8 py-3 rounded-3xl w-full max-w-[1600px] relative pointer-events-auto border border-white/10 flex items-center justify-between">
        
        {/* Glow effect */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Left: Mobile hamburger + Time + Super Admin badge */}
          <div className="flex items-center gap-4 relative z-10">
            <button
              onClick={onMenuClick}
              className="md:hidden p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition text-white"
            >
              <FaBars size={18} />
            </button>

            <div className="hidden sm:flex flex-col">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">System Clock</span>
              <span className="text-xs font-bold text-white tracking-tight">
                {time.toLocaleDateString()} | {time.toLocaleTimeString()}
              </span>
            </div>

            {/* Super Admin Badge */}
            <div className="hidden md:flex items-center gap-3 ml-6 pl-6 border-l border-white/10">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <FaShieldAlt className="text-primary text-xs" />
              </div>
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Super Admin</span>
            </div>
          </div>

          {/* Centre: Branch Switcher */}
          <div className="flex-1 flex items-center justify-center relative z-10">
            <div className="relative" ref={branchDropdownRef}>
              <button
                onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border transition-all duration-300 font-bold text-[10px] uppercase tracking-widest ${
                  superAdminViewBranch
                    ? "border-primary bg-primary text-white shadow-lg shadow-primary/20"
                    : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {superAdminViewBranch ? (
                  <FaEye size={12} className="flex-shrink-0" />
                ) : (
                  <FaBuilding size={12} className="flex-shrink-0" />
                )}
                <span className="max-w-[100px] sm:max-w-[200px] truncate">
                  {superAdminViewBranch ? superAdminViewBranch.name : "Select Branch"}
                </span>
                <FaChevronDown
                  size={10}
                  className={`flex-shrink-0 transition-transform duration-300 ${branchDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Branch dropdown list */}
              {branchDropdownOpen && (
                <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 w-80 bg-white rounded-[24px] shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in zoom-in-95 duration-200">
                  <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
                    <p className="text-[10px] font-black text-secondary/40 uppercase tracking-widest">
                      Switch Branch
                    </p>
                    {superAdminViewBranch && (
                      <button
                        onClick={handleClearBranch}
                        className="text-[10px] text-rose-500 hover:text-rose-600 font-black uppercase tracking-widest"
                      >
                        ✕ Detach
                      </button>
                    )}
                  </div>
                  <ul className="max-h-80 overflow-y-auto no-scrollbar divide-y divide-gray-50">
                    {branches.map((b) => (
                      <li
                        key={b._id}
                        onClick={() => handleBranchSelect(b)}
                        className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-all ${
                          superAdminViewBranch?._id === b._id
                            ? "bg-secondary text-white"
                            : "hover:bg-gray-50 text-secondary"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${
                          superAdminViewBranch?._id === b._id ? "bg-white/20 text-white" : "bg-gray-100 text-secondary/40"
                        }`}>
                          {b.code.substring(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{b.name}</p>
                          <p className={`text-[10px] font-medium ${superAdminViewBranch?._id === b._id ? "text-white/40" : "text-secondary/40"}`}>{b.location || "Remote Node"}</p>
                        </div>
                        {superAdminViewBranch?._id === b._id && (
                          <FaEye size={14} className="text-primary" />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4 relative z-10">
            {/* Alerts */}
            <button className="hidden sm:flex items-center gap-2.5 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5 relative group/alerts">
              <FaBell className="text-primary" />
              <span>Ops</span>
              {tokenStats.todayTotal > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-secondary shadow-lg">
                  {tokenStats.todayTotal}
                </span>
              )}
              
              {/* Tooltip summary */}
              <div className="absolute top-full right-0 mt-3 w-64 bg-white border border-gray-100 rounded-[24px] shadow-2xl p-5 hidden group-hover/alerts:block z-[60] animate-in fade-in slide-in-from-top-2 duration-200 text-secondary">
                <p className="text-[10px] font-black text-secondary/30 uppercase tracking-widest mb-4 border-b border-gray-50 pb-3 italic text-left">Live Operational Stream</p>
                <div className="space-y-3">
                   <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                     <span className="text-[10px] font-black text-secondary/60 uppercase tracking-widest">Total Issued</span>
                     <span className="text-sm font-black text-secondary">{tokenStats.todayTotal}</span>
                   </div>
                   <div className="flex justify-between items-center bg-primary/5 p-3 rounded-xl">
                     <span className="text-[10px] font-black text-primary uppercase tracking-widest">Awaiting Verification</span>
                     <span className="text-sm font-black text-primary">{tokenStats.todayPending}</span>
                   </div>
                </div>
              </div>
            </button>

            {/* Delayed Pickups Notification */}
            {delayedPickups > 0 && (
              <button
                onClick={() => {
                  if (superAdminViewBranch) {
                    navigate("/branch-home"); // Or a specific delivery page if global
                  } else {
                    navigate("/admin/branches"); // Maybe a global delivery view if it exists
                  }
                }}
                className="flex items-center gap-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-amber-500/20 relative shadow-lg shadow-amber-500/5"
                title={`${delayedPickups} Orders not picked for more than 24 hours`}
              >
                <div className="relative">
                  <FaTruck className="text-amber-500" />
                  <FaExclamationTriangle className="absolute -top-1.5 -right-1.5 text-rose-500 text-[8px] animate-bounce" />
                </div>
                <span>Delivery Delay</span>
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-secondary shadow-lg">
                  {delayedPickups}
                </span>
              </button>
            )}

            {/* Credit Requests Badge */}
            {pendingCreditRequests > 0 && (
                <button 
                  onClick={() => navigate("/super-admin/credit-requests")}
                  className="flex items-center gap-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-rose-500/20 relative animate-pulse shadow-lg shadow-rose-500/5"
                >
                  <FaShieldAlt className="text-rose-500" />
                  <span>Credit Req</span>
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-secondary shadow-lg">
                    {pendingCreditRequests}
                  </span>
                </button>
            )}

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setOpenProfile(!openProfile)}
                className="flex items-center gap-3 bg-white/5 hover:bg-white/10 p-1 rounded-2xl transition-all border border-white/5 pr-4"
              >
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-black text-sm shadow-lg shadow-primary/20">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-[10px] font-black text-white tracking-tight leading-none mb-1 truncate max-w-[80px]">
                    {user?.username || "Admin"}
                  </span>
                  <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Master</span>
                </div>
                <FaChevronDown className={`text-white/40 text-[10px] transition-transform duration-300 ${openProfile ? "rotate-180" : ""}`} />
              </button>

              {/* Profile Dropdown */}
              {openProfile && (
                <div className="absolute right-0 top-14 w-72 bg-white border border-gray-100 rounded-[32px] shadow-2xl overflow-hidden z-50 animate-in zoom-in-95 duration-200 text-secondary">
                  <div className="p-8 bg-secondary text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12">
                      <FaShieldAlt size={80} />
                    </div>
                    <div className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white text-xl font-black mb-4">
                        {user?.username?.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-lg font-black tracking-tight">{user?.username || "Master Admin"}</p>
                      <p className="text-xs font-medium text-white/60 mb-3 truncate">{user?.email || "root@pearl.erp"}</p>
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/20 text-primary rounded-lg text-[9px] font-black uppercase tracking-widest">
                        <FaShieldAlt /> Administrator
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50/50">
                    <button
                      onClick={() => {
                        setOpenProfile(false);
                        navigate("/super-admin/branch-management");
                      }}
                      className="w-full flex items-center gap-4 px-6 py-4 text-xs font-black uppercase tracking-widest text-secondary/60 hover:text-secondary hover:bg-white rounded-2xl transition-all"
                    >
                      <FaBuilding size={14} className="text-primary" />
                      Branch Management
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-4 px-6 py-4 text-xs font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 rounded-2xl transition-all mt-1"
                    >
                      <FaSignOutAlt size={14} />
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
