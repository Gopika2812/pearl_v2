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
    <div className="fixed top-0 right-0 left-0 md:left-20 z-40 transition-all duration-300 md:h-[80px] p-4 flex items-center justify-center pointer-events-none">
      <div className="bg-white/90 backdrop-blur-md shadow-xl px-8 py-3 rounded-2xl w-full max-w-7xl relative pointer-events-auto border border-gray-100/50 flex items-center justify-between">
        
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition shadow-sm"
        >
          <FaBars size={18} className="text-slate-700" />
        </button>

        {/* Left Side: Branch Info */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Branch</span>
            <span className="font-black text-slate-800 tracking-tight leading-none">{branch?.name}</span>
          </div>
          <div className="h-6 w-px bg-slate-200"></div>
          <div className="flex flex-col text-slate-500">
             <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Status</span>
             <div className="flex items-center gap-1.5 leading-none">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-bold text-emerald-600">Online</span>
             </div>
          </div>
        </div>

        {/* Right Side: User & Actions */}
        <div className="flex items-center gap-5">
          {/* Notifications */}
          <button className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all relative group text-slate-600 hover:text-slate-900 border border-slate-100">
            <FaBell size={18} />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full"></span>
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-0.5">Welcome</span>
              <span className="text-sm font-black text-slate-800 leading-none">{user?.username}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center border border-slate-200 text-slate-600 shadow-inner group cursor-pointer hover:border-slate-300 transition-all">
              <FaUser size={16} />
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="group flex items-center justify-center w-10 h-10 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all border border-rose-100 shadow-sm shadow-rose-500/5"
            title="Logout"
          >
            <FaSignOutAlt size={18} className="transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>
    </div>
  );
}
