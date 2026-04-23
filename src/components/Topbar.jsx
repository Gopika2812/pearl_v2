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
    <header className="fixed top-0 right-0 left-0 md:left-20 z-40 transition-all duration-300 h-16 md:h-[80px] p-2 md:p-4 flex items-center justify-center pointer-events-none">
      <div className="bg-white/90 backdrop-blur-md shadow-xl px-4 md:px-8 py-3 rounded-2xl w-full max-w-[1600px] relative pointer-events-auto border border-gray-100/50 flex items-center justify-between">
        
        {/* Left: Hamburger (mobile) + Time */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition shadow-sm text-primary"
          >
            <FaBars size={18} />
          </button>

          <div className="hidden sm:flex flex-col">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">System Clock</span>
            <span className="text-xs font-bold text-slate-800 tracking-tight">
              {time.toLocaleDateString()} | {time.toLocaleTimeString()}
            </span>
          </div>

          {/* Branch Display */}
          {currentBranch && (
            <div className="hidden md:flex items-center gap-4 ml-4 pl-4 border-l border-slate-200">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Node</span>
                <span className="text-xs font-black text-slate-800">{currentBranch.name}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          {/* Alerts */}
          <button className="hidden sm:flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-100">
            <FaBell className="text-primary" />
            <span>Alerts</span>
          </button>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => setOpenProfile(!openProfile)}
              className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 p-1 rounded-2xl transition-all border border-slate-100 pr-4"
            >
              <img
                src="https://i.pravatar.cc/150?img=12"
                alt="Profile"
                className="w-9 h-9 rounded-xl border border-white shadow-sm"
              />
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-[10px] font-black text-slate-800 tracking-tight leading-none mb-0.5">
                  {user?.username || "Admin"}
                </span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Active Session</span>
              </div>
              <FaChevronDown className={`text-slate-400 text-[10px] transition-transform duration-300 ${openProfile ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown */}
            {openProfile && (
              <div className="absolute right-0 top-14 w-64 bg-white border border-slate-100 rounded-[24px] shadow-2xl overflow-hidden z-50 animate-in zoom-in-95 duration-200">
                <div className="p-6 bg-slate-50 border-b border-slate-100">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Authenticated As</p>
                   <p className="text-sm font-black text-slate-800">{user?.username || "Admin"}</p>
                </div>
                
                <div className="p-2">
                  <button
                    onClick={() => {
                      setOpenProfile(false);
                      navigate("/branch-login");
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary hover:bg-slate-50 rounded-xl transition-all"
                  >
                    <FaBuilding size={12} />
                    Switch Node
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 rounded-xl transition-all mt-1"
                  >
                    <FaSignOutAlt size={12} />
                    Terminate Session
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

export default Topbar;
