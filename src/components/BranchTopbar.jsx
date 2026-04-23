import React, { useEffect, useState, useRef } from "react";
import { FaBars, FaBell, FaSignOutAlt, FaUser, FaCalendarDay } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { API_BASE, fetchWithAuth } from "../api";
import { useBranch } from "../context/BranchContext";

export default function BranchTopbar({ onMenuClick }) {
  const { currentBranch, user, logout } = useBranch();
  const navigate = useNavigate();
  const [upcomingOrders, setUpcomingOrders] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const fetchUpcomingOrders = async () => {
    if (!currentBranch?._id) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/financial-reports/upcoming-orders?branchId=${currentBranch._id}`);
      const data = await res.json();
      if (data.success) {
        setUpcomingOrders(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching upcoming orders:", err);
    }
  };

  useEffect(() => {
    fetchUpcomingOrders();
    const interval = setInterval(fetchUpcomingOrders, 300000); // Refresh every 5 mins
    return () => clearInterval(interval);
  }, [currentBranch?._id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/branch-login");
  };

  return (
    <div className="fixed top-0 right-0 left-0 md:left-20 z-40 transition-all duration-300 h-16 md:h-[80px] p-2 md:p-4 flex items-center justify-center pointer-events-none">
      <div className="bg-white/90 backdrop-blur-md shadow-xl px-4 md:px-8 py-3 rounded-3xl w-full max-w-[1600px] relative pointer-events-auto border border-gray-100/50 flex items-center justify-between">
        
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
            <span className="font-black text-slate-800 tracking-tight leading-none">{currentBranch?.name}</span>
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
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all relative group text-slate-600 hover:text-slate-900 border border-slate-100"
            >
              <FaBell size={18} />
              {upcomingOrders.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                  {upcomingOrders.length}
                </span>
              )}
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-black uppercase text-slate-500 tracking-widest">Upcoming Orders</span>
                  <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold">{upcomingOrders.length}</span>
                </div>
                
                <div className="max-h-96 overflow-y-auto">
                  {upcomingOrders.length === 0 ? (
                    <div className="p-8 text-center bg-white">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <FaCalendarDay className="text-slate-300" size={20} />
                      </div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">No Upcoming Orders</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {upcomingOrders.map((order, idx) => (
                        <div key={idx} className="p-4 hover:bg-slate-50 transition cursor-default">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${
                              order.type === 'SO' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {order.type === 'SO' ? 'Sales Order' : 'Purchase Order'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 italic">
                              {new Date(order.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                          <div className="font-black text-slate-800 text-xs truncate mb-0.5">{order.name}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {order.id}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {upcomingOrders.length > 0 && (
                  <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                    <button 
                      onClick={() => {
                        setShowDropdown(false);
                        navigate(upcomingOrders[0].type === 'SO' ? '/branch/sales-orders' : '/branch/purchase-orders');
                      }}
                      className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition tracking-widest"
                    >
                      View All Orders
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

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
