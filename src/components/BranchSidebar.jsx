import { useState, useEffect } from "react";
import {
  FaBox,
  FaBuilding,
  FaChartBar,
  FaChartLine,
  FaChevronDown,
  FaCog,
  FaDollarSign,
  FaFileAlt,
  FaHandshake,
  FaHome,
  FaLink,
  FaShieldAlt,
  FaShoppingCart,
  FaSignOutAlt,
  FaTimes,
  FaTruck,
  FaUsers,
  FaBook,
  FaLock,
  FaMoneyBillWave,
  FaDownload,
  FaPlusCircle,
  FaHistory,
  FaBookOpen,
} from "react-icons/fa";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useBranch } from "../context/BranchContext";

import { PAGE_CONFIG, ICON_MAP, getFlattenedPages } from "../utils/pageConfig";

const BranchSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { branch, logout, superAdminViewBranch, setSuperAdminViewBranch, user } = useBranch();
  
  // Dropdown states managed dynamically by ID
  const [openDropdowns, setOpenDropdowns] = useState({});

  const toggleDropdown = (id) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const isSuperAdminViewing = !!superAdminViewBranch;

  const handleBackToSuperAdmin = () => {
    setSuperAdminViewBranch(null);
    navigate("/super-admin/branch-management");
    if (onClose) onClose();
  };

  useEffect(() => {
    // Auto-open dropdowns if current path is inside them
    const newOpenDropdowns = {};
    PAGE_CONFIG.forEach(cat => {
      cat.items.forEach(item => {
        if (item.isDropdown && item.subItems.some(sub => sub.path === location.pathname)) {
          newOpenDropdowns[item.id] = true;
        }
      });
    });
    setOpenDropdowns(prev => ({ ...prev, ...newOpenDropdowns }));
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/branch-login");
  };

  // Permission check helper
  const isAllowed = (page) => {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
    
    const allowedPages = user.allowedPages || [];
    return allowedPages.includes(page.id);
  };

  const renderMenuItem = (item, isMobile = false) => {
    if (!isAllowed(item)) return null;
    const active = location.pathname === item.path;
    
    return (
      <Link
        key={item.id}
        to={item.path}
        className={`mx-3 mb-1 flex items-center gap-4 px-3 py-3.5 rounded-2xl transition-all duration-300 relative group/item ${
          active
            ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 font-bold"
            : "hover:bg-white/5 text-slate-400 hover:text-white"
        }`}
        onClick={isMobile ? onClose : undefined}
        title={item.name}
      >
        <div className={`w-8 flex justify-center flex-shrink-0 transition-transform duration-300 ${active ? "scale-110" : "group-hover/item:scale-110"}`}>
          <span className="text-xl">{ICON_MAP[item.icon]}</span>
        </div>
        <span className={`text-[13px] font-bold uppercase tracking-wide whitespace-nowrap transition-all duration-500 ${!isMobile ? "opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0" : ""}`}>
          {item.name}
        </span>
        {active && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-l-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
        )}
      </Link>
    );
  };

  const renderDropdown = (item, isMobile = false) => {
    const allowedSubItems = item.subItems.filter(sub => isAllowed(sub));
    if (allowedSubItems.length === 0) return null;

    const isOpen = !!openDropdowns[item.id];

    return (
      <div key={item.id} className="mx-3 mb-1">
        <button
          onClick={() => toggleDropdown(item.id)}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/10 text-white/90 transition-colors"
          title={item.name}
        >
          <div className="w-8 flex justify-center flex-shrink-0">
            <span className="text-lg">{ICON_MAP[item.icon]}</span>
          </div>
          <span className={`text-sm flex-1 text-left whitespace-nowrap transition-opacity duration-300 ${!isMobile ? "opacity-0 group-hover:opacity-100 w-0 group-hover:w-auto overflow-hidden" : ""}`}>
            {item.name}
          </span>
          <div className={`w-4 overflow-hidden transition-opacity duration-300 ${!isMobile ? "opacity-0 group-hover:opacity-100" : ""}`}>
            <FaChevronDown className={`text-xs transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </button>
        {isOpen && (
          <div className={`mt-1 ml-4 space-y-1 pl-3 border-l-2 border-white/20 overflow-hidden transition-opacity duration-300 ${!isMobile ? "opacity-0 group-hover:opacity-100" : ""}`}>
            {allowedSubItems.map((sub) => {
              const active = location.pathname === sub.path;
              return (
                <Link
                  key={sub.id}
                  to={sub.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active ? "bg-white/20 text-white font-semibold" : "hover:bg-white/10 text-white/80"
                  }`}
                  onClick={isMobile ? onClose : undefined}
                  title={sub.name}
                >
                  <div className="w-6 flex justify-center flex-shrink-0">
                    <span className="text-sm">{ICON_MAP[sub.icon]}</span>
                  </div>
                  <span className="whitespace-nowrap">{sub.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };


  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside
        className="hidden md:flex md:flex-col w-20 hover:w-64 transition-all duration-500 ease-in-out h-screen bg-slate-900/95 backdrop-blur-xl text-white shadow-2xl fixed left-0 top-0 group z-50 overflow-x-hidden border-r border-white/5"
        onMouseLeave={() => setOpenDropdowns({})}
      >
        {/* Header with Glass Effect */}
        <div className="px-4 py-8 flex items-center h-[100px] mb-4">
          <div className="flex items-center gap-4 w-full px-2">
            <div className="relative flex-shrink-0">
              <img
                src="/logo.jpeg"
                alt="Pearls ERP Logo"
                className="w-10 h-10 object-contain rounded-xl shadow-lg shadow-black/20"
              />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
            </div>
            <div className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-2 group-hover:translate-x-0">
              <p className="font-black text-sm tracking-tight text-white uppercase italic">Pearls <span className="text-emerald-400 not-italic">ERP</span></p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{branch?.name}</p>
            </div>
          </div>
        </div>

        {/* Navigation - Modern Scrollbar */}
        <nav className="flex-1 overflow-y-auto no-scrollbar py-2 space-y-1">
          {PAGE_CONFIG.map(category => (
            <div key={category.category}>
              {category.items.map(item => (
                item.isDropdown 
                  ? renderDropdown(item)
                  : renderMenuItem(item)
              ))}
            </div>
          ))}
        </nav>

        {/* Viewing-branch indicator for Super Admin */}
        {isSuperAdminViewing && (
          <div className="mx-3 mb-2 rounded-lg overflow-hidden">
            {/* Collapsed: just a shield icon centered */}
            <div className="flex justify-center group-hover:hidden">
              <div className="w-10 h-10 flex items-center justify-center bg-orange-500/20 border border-orange-400/40 rounded-lg">
                <FaShieldAlt className="text-orange-300 text-sm" />
              </div>
            </div>
            {/* Expanded: full admin view info */}
            <div className="hidden group-hover:block bg-orange-500/20 border border-orange-400/40 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <FaShieldAlt className="text-orange-300 text-sm flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-orange-200 font-semibold uppercase">Admin View</p>
                  <p className="text-xs text-white font-bold truncate">{superAdminViewBranch?.name}</p>
                </div>
              </div>
              <div className="mt-2">
                <button
                  onClick={handleBackToSuperAdmin}
                  className="w-full flex items-center gap-2 text-orange-200 hover:text-white text-xs font-semibold transition"
                >
                  <FaShieldAlt size={10} /> Back to Super Admin
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="p-4 border-t border-white/20 flex justify-center group-hover:justify-start">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors text-sm font-semibold justify-center group-hover:justify-start overflow-hidden"
            title="Logout"
          >
            <div className="w-6 flex justify-center flex-shrink-0">
              <FaSignOutAlt />
            </div>
            <span className="opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-300 w-0 group-hover:w-auto">Logout</span>
          </button>
        </div>
      </aside>

      {/* MOBILE OVERLAY */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/40 transition-opacity ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={onClose}
      />

      {/* MOBILE SIDEBAR */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-72 bg-gradient-to-b from-secondary to-secondary/90 text-white shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close Button */}
        <div className="flex justify-end p-4 border-b border-white/20">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 transition"
          >
            <FaTimes size={22} />
          </button>
        </div>

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/20">
          <div className="flex flex-col gap-2">
            <img
              src="/logo.jpeg"
              alt="Pearls ERP Logo"
              className="h-10 object-contain rounded-lg"
            />
            <div className="text-xs text-white/80">
              <p className="font-bold text-white">{branch?.name}</p>
              <p>{branch?.location}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-2">
          {PAGE_CONFIG.map(category => (
            <div key={category.category}>
              {category.items.map(item => (
                item.isDropdown 
                  ? renderDropdown(item, true)
                  : renderMenuItem(item, true)
              ))}
            </div>
          ))}

          {/* Super Admin Back Button - Mobile */}
          {isSuperAdminViewing && (
            <div className="mx-2 mb-2 px-4 py-3 bg-orange-500/20 border border-orange-400/40 rounded-xl">
              <p className="text-[10px] text-orange-200 font-semibold uppercase mb-1">Admin View: {superAdminViewBranch?.name}</p>
              <button
                onClick={handleBackToSuperAdmin}
                className="flex items-center gap-2 text-orange-200 hover:text-white text-sm font-semibold transition"
              >
                <FaShieldAlt size={12} /> Back to Super Admin
              </button>
            </div>
          )}

        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition text-sm font-semibold"
          >
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default BranchSidebar;
