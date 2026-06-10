import React, { useEffect, useState, useRef } from "react";
import { FaBars, FaBell, FaSignOutAlt, FaUser, FaCalendarDay, FaTruck, FaExclamationTriangle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { API_BASE, fetchWithAuth } from "../api";
import { useBranch } from "../context/BranchContext";

export default function BranchTopbar({ onMenuClick }) {
  const { currentBranch, user, logout, isSalesOrderLocked, changeActiveBranch } = useBranch();
  const navigate = useNavigate();
  const [upcomingOrders, setUpcomingOrders] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [delayedPickups, setDelayedPickups] = useState(0);
  const dropdownRef = useRef(null);

  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [soldOutAlerts, setSoldOutAlerts] = useState([]);
  const [showExpiryModal, setShowExpiryModal] = useState(false);

  const fetchExpiryAlerts = async () => {
    if (!currentBranch?._id) return;
    try {
      const [expiryRes, soldOutRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/products/alerts/expiry?branchId=${currentBranch._id}`),
        fetchWithAuth(`${API_BASE}/products/alerts/sold-out?branchId=${currentBranch._id}`)
      ]);
      const expiryData = await expiryRes.json();
      const soldOutData = await soldOutRes.json();

      let activeExpiry = [];
      let activeSoldOut = [];

      if (expiryData.success && expiryData.data) {
        let dismissedExpiry = [];
        try {
          const stored = localStorage.getItem("dismissedExpiryAlerts");
          dismissedExpiry = stored ? JSON.parse(stored) : [];
        } catch {}

        activeExpiry = expiryData.data.filter(alert => {
          const key = `${currentBranch._id}_${alert.productId}_${alert.batch}_${alert.qty}_${alert.expiryDate}`;
          return !dismissedExpiry.includes(key);
        });
      }

      if (soldOutData.success && soldOutData.data) {
        let dismissedSoldOut = [];
        try {
          const stored = localStorage.getItem("dismissedSoldOutAlerts");
          dismissedSoldOut = stored ? JSON.parse(stored) : [];
        } catch {}

        activeSoldOut = soldOutData.data.filter(alert => {
          const key = `${currentBranch._id}_${alert.productId}_${alert.batch}_${alert.qty}_${alert.expiryDate}`;
          return !dismissedSoldOut.includes(key);
        });
      }

      setExpiryAlerts(activeExpiry);
      setSoldOutAlerts(activeSoldOut);

      const sessionKey = `expiry_alert_shown_${currentBranch._id}`;
      const alreadyShown = sessionStorage.getItem(sessionKey);
      const totalActiveCount = activeExpiry.length + activeSoldOut.length;
      if (totalActiveCount > 0 && !alreadyShown) {
        setShowExpiryModal(true);
        sessionStorage.setItem(sessionKey, "true");
      }
    } catch (err) {
      console.error("Error fetching alerts:", err);
    }
  };

  const handleDismissAlert = (alertToDismiss, isSoldOut = false) => {
    const branchId = currentBranch?._id;
    const key = `${branchId}_${alertToDismiss.productId}_${alertToDismiss.batch}_${alertToDismiss.qty}_${alertToDismiss.expiryDate}`;
    const storageKey = isSoldOut ? "dismissedSoldOutAlerts" : "dismissedExpiryAlerts";
    
    let currentDismissed = [];
    try {
      const stored = localStorage.getItem(storageKey);
      currentDismissed = stored ? JSON.parse(stored) : [];
    } catch {}

    const updated = [...currentDismissed, key];
    localStorage.setItem(storageKey, JSON.stringify(updated));

    if (isSoldOut) {
      const remaining = soldOutAlerts.filter(a => {
        const aKey = `${branchId}_${a.productId}_${a.batch}_${a.qty}_${a.expiryDate}`;
        return aKey !== key;
      });
      setSoldOutAlerts(remaining);
      if (remaining.length === 0 && expiryAlerts.length === 0) {
        setShowExpiryModal(false);
      }
    } else {
      const remaining = expiryAlerts.filter(a => {
        const aKey = `${branchId}_${a.productId}_${a.batch}_${a.qty}_${a.expiryDate}`;
        return aKey !== key;
      });
      setExpiryAlerts(remaining);
      if (remaining.length === 0 && soldOutAlerts.length === 0) {
        setShowExpiryModal(false);
      }
    }
  };

  const handleClearAllAlerts = () => {
    const branchId = currentBranch?._id;
    
    if (expiryAlerts.length > 0) {
      let currentDismissed = [];
      try {
        const stored = localStorage.getItem("dismissedExpiryAlerts");
        currentDismissed = stored ? JSON.parse(stored) : [];
      } catch {}
      const keysToDismiss = expiryAlerts.map(alert => 
        `${branchId}_${alert.productId}_${alert.batch}_${alert.qty}_${alert.expiryDate}`
      );
      const updated = [...currentDismissed, ...keysToDismiss];
      localStorage.setItem("dismissedExpiryAlerts", JSON.stringify(updated));
      setExpiryAlerts([]);
    }

    if (soldOutAlerts.length > 0) {
      let currentDismissed = [];
      try {
        const stored = localStorage.getItem("dismissedSoldOutAlerts");
        currentDismissed = stored ? JSON.parse(stored) : [];
      } catch {}
      const keysToDismiss = soldOutAlerts.map(alert => 
        `${branchId}_${alert.productId}_${alert.batch}_${alert.qty}_${alert.expiryDate}`
      );
      const updated = [...currentDismissed, ...keysToDismiss];
      localStorage.setItem("dismissedSoldOutAlerts", JSON.stringify(updated));
      setSoldOutAlerts([]);
    }

    setShowExpiryModal(false);
  };

  const handleTakeAction = () => {
    const branchId = currentBranch?._id;
    
    let currentDismissed = [];
    try {
      const stored = localStorage.getItem("dismissedExpiryAlerts");
      currentDismissed = stored ? JSON.parse(stored) : [];
    } catch {}

    const keysToDismiss = expiryAlerts.map(alert => 
      `${branchId}_${alert.productId}_${alert.batch}_${alert.qty}_${alert.expiryDate}`
    );

    const updated = [...currentDismissed, ...keysToDismiss];
    localStorage.setItem("dismissedExpiryAlerts", JSON.stringify(updated));

    setExpiryAlerts([]);
    if (soldOutAlerts.length === 0) {
      setShowExpiryModal(false);
    }
    navigate("/branch/recycling");
  };

  const handleMakePO = () => {
    const branchId = currentBranch?._id;
    
    let currentDismissed = [];
    try {
      const stored = localStorage.getItem("dismissedSoldOutAlerts");
      currentDismissed = stored ? JSON.parse(stored) : [];
    } catch {}

    const keysToDismiss = soldOutAlerts.map(alert => 
      `${branchId}_${alert.productId}_${alert.batch}_${alert.qty}_${alert.expiryDate}`
    );

    const updated = [...currentDismissed, ...keysToDismiss];
    localStorage.setItem("dismissedSoldOutAlerts", JSON.stringify(updated));

    setSoldOutAlerts([]);
    if (expiryAlerts.length === 0) {
      setShowExpiryModal(false);
    }
    navigate("/branch/po");
  };

  const getExpiryLabel = (expiryDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);
    const diffTime = exp - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return <span className="text-rose-600 font-bold uppercase tracking-tighter">EXPIRED!</span>;
    } else if (diffDays === 0) {
      return <span className="text-rose-500 font-bold uppercase tracking-tighter">Expires Today!</span>;
    } else if (diffDays === 1) {
      return <span className="text-amber-500 font-bold">Expires Tomorrow</span>;
    } else {
      return <span className="text-amber-600 font-semibold">Expires in {diffDays} days</span>;
    }
  };

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

  const fetchDelayedPickups = async () => {
    if (!currentBranch?._id) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/invoices/stats/delayed-pickups?branchId=${currentBranch._id}`);
      const data = await res.json();
      if (data.success) {
        setDelayedPickups(data.count || 0);
      }
    } catch (err) {
      console.error("Error fetching delayed pickups:", err);
    }
  };

  useEffect(() => {
    fetchUpcomingOrders();
    fetchDelayedPickups();
    fetchExpiryAlerts();

    const handleRefresh = () => {
      fetchExpiryAlerts();
    };
    window.addEventListener("refresh-expiry-alerts", handleRefresh);
    window.addEventListener("refresh-sold-out-alerts", handleRefresh);

    const interval = setInterval(() => {
      fetchUpcomingOrders();
      fetchDelayedPickups();
      fetchExpiryAlerts();
    }, 300000); // Refresh every 5 mins

    return () => {
      clearInterval(interval);
      window.removeEventListener("refresh-expiry-alerts", handleRefresh);
      window.removeEventListener("refresh-sold-out-alerts", handleRefresh);
    };
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
    <div className="fixed top-0 right-0 left-0 md:left-20 z-40 transition-all duration-300 p-2 md:p-4 flex flex-col items-center pointer-events-none gap-1.5">
      {/* SO Lock Warning Banner — shows only when deliveries are overdue */}
      {isSalesOrderLocked && user?.role !== "SUPER_ADMIN" && user?.role !== "SUPERADMIN" && (
        <div className="w-full max-w-[1600px] bg-rose-500 text-white px-5 py-2 rounded-2xl text-[11px] font-black shadow-lg flex items-center justify-center gap-2 pointer-events-auto animate-pulse-slow border border-rose-400/50">
          <FaExclamationTriangle className="shrink-0" />
          <span>⚠️ Sales Order menu is disabled — pending deliveries older than 50 hours exist. Ask <strong>Saravan Sir</strong> to enable.</span>
        </div>
      )}
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
            {user?.allowedBranches && user.allowedBranches.length > 1 ? (
              <select
                value={currentBranch?._id || currentBranch?.id || ""}
                onChange={(e) => {
                  const targetId = e.target.value;
                  const targetBranch = user.allowedBranches.find(b => (b._id || b.id) === targetId);
                  if (targetBranch) {
                    changeActiveBranch(targetBranch);
                  }
                }}
                className="font-black text-slate-800 tracking-tight leading-none bg-transparent hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-200 py-1.5 px-3 -ml-3 outline-none cursor-pointer transition-all duration-200 text-sm"
              >
                {user.allowedBranches.map((br) => (
                  <option key={br._id || br.id} value={br._id || br.id} className="font-bold text-slate-800 bg-white">
                    {br.name} ({br.code})
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-black text-slate-800 tracking-tight leading-none">{currentBranch?.name}</span>
            )}
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
          {/* Expiry & Sold-Out Alerts Button */}
          {(expiryAlerts.length > 0 || soldOutAlerts.length > 0) && (
            <button
              onClick={() => setShowExpiryModal(true)}
              className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 transition-all relative group text-rose-600 border border-rose-100 shadow-sm"
              title={`${expiryAlerts.length + soldOutAlerts.length} Inventory Alerts active`}
            >
              <div className="relative">
                <FaExclamationTriangle size={18} className="text-rose-500 animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                {expiryAlerts.length + soldOutAlerts.length}
              </span>
            </button>
          )}

          {/* Delayed Pickups Notification */}
          {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "MANAGER") && delayedPickups > 0 && (
            <button
              onClick={() => navigate("/branch/delivery-flow?status=PENDING")}
              className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 transition-all relative group text-amber-600 border border-amber-100 shadow-sm"
              title={`${delayedPickups} Orders not completed/picked for more than 50 hours`}
            >
              <div className="relative">
                <FaTruck size={18} />
                <FaExclamationTriangle size={10} className="absolute -top-2 -right-2 text-rose-500 animate-bounce" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                {delayedPickups}
              </span>
            </button>
          )}

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

      {/* Expiry & Sold-Out Warning Modal */}
      {showExpiryModal && (expiryAlerts.length > 0 || soldOutAlerts.length > 0) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden transform transition-all duration-300 scale-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className={`p-6 text-white flex items-center justify-between gap-3 ${
              expiryAlerts.length > 0 && soldOutAlerts.length > 0
                ? "bg-gradient-to-r from-rose-500 to-amber-500"
                : expiryAlerts.length > 0
                ? "bg-rose-500"
                : "bg-amber-500"
            }`}>
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2.5 rounded-2xl">
                  <FaExclamationTriangle size={24} className="text-white animate-bounce" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider leading-none mb-1">
                    {expiryAlerts.length > 0 && soldOutAlerts.length > 0
                      ? "Inventory Batch Alerts"
                      : expiryAlerts.length > 0
                      ? "Batch Expiry Warning"
                      : "Batch Sold Out Warning"}
                  </h3>
                  <p className="text-xs text-white/90 font-semibold">
                    {expiryAlerts.length > 0 && soldOutAlerts.length > 0
                      ? "Attention required for the following product batches!"
                      : expiryAlerts.length > 0
                      ? "The following product batches will expire within 5 days!"
                      : "The following product batches have sold out completely!"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClearAllAlerts}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 active:scale-95 transition-all text-white text-[10px] font-black uppercase tracking-wider rounded-lg shrink-0 cursor-pointer"
              >
                Clear All
              </button>
            </div>

            {/* Content / Table */}
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              {expiryAlerts.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-rose-500 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                    Expiring Soon
                  </h4>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                    {expiryAlerts.map((alert, idx) => (
                      <div key={idx} className="p-4 bg-slate-50/30 hover:bg-slate-50 transition flex justify-between items-center text-xs">
                        <div className="text-left pr-2">
                          <div className="font-black text-slate-800 text-sm">{alert.name}</div>
                          <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                            Batch: <span className="text-slate-600">{alert.batch}</span> | Qty: <span className="text-slate-600">{alert.qty}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right shrink-0">
                          <div className="flex flex-col items-end">
                            <div className="font-black text-rose-600">
                              Exp: {new Date(alert.expiryDate).toLocaleDateString("en-IN")}
                            </div>
                            <div className="text-[10px] font-bold mt-0.5">
                              {getExpiryLabel(alert.expiryDate)}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                              MRP: ₹{alert.mrp}
                            </div>
                          </div>
                          
                          {/* Dismiss cross mark */}
                          <button
                            onClick={() => handleDismissAlert(alert, false)}
                            className="p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all font-black text-sm cursor-pointer"
                            title="Dismiss Alert"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {soldOutAlerts.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-600 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                    Sold Out Batches
                  </h4>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                    {soldOutAlerts.map((alert, idx) => (
                      <div key={idx} className="p-4 bg-slate-50/30 hover:bg-slate-50 transition flex justify-between items-center text-xs">
                        <div className="text-left pr-2">
                          <div className="font-black text-slate-800 text-sm">{alert.name}</div>
                          <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                            Batch: <span className="text-slate-600">{alert.batch}</span> | Qty: <span className="text-rose-600 font-black">SOLD OUT</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right shrink-0">
                          <div className="flex flex-col items-end">
                            <div className="font-black text-slate-500">
                              Exp: {alert.expiryDate ? new Date(alert.expiryDate).toLocaleDateString("en-IN") : "N/A"}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                              MRP: ₹{alert.mrp}
                            </div>
                            <button
                              onClick={() => {
                                handleDismissAlert(alert, true);
                                navigate("/branch/po");
                              }}
                              className="mt-1 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm active:scale-95 transition-all"
                            >
                              Make PO
                            </button>
                          </div>
                          
                          {/* Dismiss cross mark */}
                          <button
                            onClick={() => handleDismissAlert(alert, true)}
                            className="p-1 rounded-lg text-slate-300 hover:text-amber-500 hover:bg-amber-50 transition-all font-black text-sm cursor-pointer"
                            title="Dismiss Alert"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 flex-wrap">
              {expiryAlerts.length > 0 && (
                <button
                  onClick={handleTakeAction}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-xs font-black uppercase tracking-widest transition shadow-md active:scale-95 cursor-pointer"
                >
                  Restock / Recycle
                </button>
              )}
              {soldOutAlerts.length > 0 && (
                <button
                  onClick={handleMakePO}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-black uppercase tracking-widest transition shadow-md active:scale-95 cursor-pointer"
                >
                  Make Purchase Order
                </button>
              )}
              <button
                onClick={() => setShowExpiryModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-black uppercase tracking-widest transition shadow-md active:scale-95 cursor-pointer"
              >
                Close Warning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
