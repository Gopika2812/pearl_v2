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
} from "react-icons/fa";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useBranch } from "../context/BranchContext";

const BranchSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { branch, logout, superAdminViewBranch, setSuperAdminViewBranch, user } = useBranch();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [soOpen, setSoOpen] = useState(false);

  const isSuperAdminViewing = !!superAdminViewBranch;

  const handleBackToSuperAdmin = () => {
    setSuperAdminViewBranch(null);
    navigate("/super-admin/branch-management");
    if (onClose) onClose();
  };

  const menuItemsTop = [
    { name: "Home", path: "/branch-home", icon: <FaHome /> },
  ];

  const purchaseItems = [
    { name: "Create PO", path: "/branch/po", icon: <FaShoppingCart /> },
    { name: "Purchase List", path: "/branch/purchase-orders", icon: <FaBox /> },
    { name: "Restocking", path: "/branch/recycling", icon: <FaBox /> },
    { name: "Debit Note", path: "/branch/debit-note", icon: <FaFileAlt /> },
    { name: "Payment", path: "/branch/po-payment", icon: <FaDollarSign /> },
  ];

  const salesItems = [
    { name: "Create SO", path: "/branch/sales-order", icon: <FaShoppingCart /> },
    { name: "Invoiced Order", path: "/branch/invoiced-order", icon: <FaFileAlt /> },
    { name: "Credit Note", path: "/branch/credit-note", icon: <FaFileAlt /> },
    { name: "Claims", path: "/branch/claims", icon: <FaFileAlt /> },
    { name: "Receipt", path: "/branch/receipt", icon: <FaDollarSign /> },
  ];

  const menuItemsBottom = [
    { name: "Loading & Dispatch", path: "/branch/dispatch", icon: <FaTruck /> },
    { name: "Suppliers (Creditors)", path: "/branch/suppliers", icon: <FaHandshake /> },
    { name: "Customers (Debtors)", path: "/branch/customers", icon: <FaUsers /> },
    { name: "Product Records", path: "/branch/product-records", icon: <FaBox /> },
    { name: "Journal Master", path: "/branch/journals", icon: <FaBook /> },
    { name: "Insights & Analysis", path: "/branch/insights", icon: <FaChartLine /> },
    { name: "Quick Links", path: "/branch/quick-links", icon: <FaLink /> },
    { name: "Admin Requests", path: "/branch/admin-requests", icon: <FaShieldAlt /> },
  ];

  const summaryItems = [
    { name: "Summary", path: "/branch/summary", icon: <FaChartBar /> },
  ];



  useEffect(() => {
    // Auto-open dropdowns if current path is inside them
    if (purchaseItems.some(i => i.path === location.pathname)) setPoOpen(true);
    if (salesItems.some(i => i.path === location.pathname)) setSoOpen(true);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/branch-login");
  };

  // Permission check helper
  const isAllowed = (path) => {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
    
    const allowedPages = user.allowedPages || [];
    
    const pathPermissionMap = {
      "/branch-home": "home",
      "/branch/po": "create-po",
      "/branch/purchase-orders": "purchase-list",
      "/branch/recycling": "restocking",
      "/branch/debit-note": "debit-note",
      "/branch/po-payment": "payment-po",
      "/branch/sales-order": "create-so",
      "/branch/invoiced-order": "invoiced-order",
      "/branch/credit-note": "credit-note",
      "/branch/claims": "claims",
      "/branch/receipt": "receipt",
      "/branch/dispatch": "dispatch",
      "/branch/suppliers": "suppliers",
      "/branch/customers": "customers",
      "/branch/product-records": "product-records",
      "/branch/journals": "journals",
      "/branch/insights": "insights",
      "/branch/quick-links": "quick-links",
      "/branch/summary": "summary",
      "/branch/admin-requests": "admin-requests",
    };

    const permissionId = pathPermissionMap[path];
    if (!permissionId) return true; // Pages without specific permission ID are public within branch

    const result = allowedPages.includes(permissionId);
    // console.log(`Path: ${path}, ID: ${permissionId}, Allowed: ${result}, UserPages:`, allowedPages);
    return result;
  };

  const filteredTop = menuItemsTop.filter(i => isAllowed(i.path));
  const filteredPurchase = purchaseItems.filter(i => isAllowed(i.path));
  const filteredSales = salesItems.filter(i => isAllowed(i.path));
  const filteredBottom = menuItemsBottom.filter(i => isAllowed(i.path));
  const filteredSummary = summaryItems.filter(i => isAllowed(i.path));

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex md:flex-col w-20 hover:w-64 transition-all duration-300 h-screen bg-gradient-to-b from-secondary to-secondary/90 text-white shadow-xl fixed left-0 top-0 group z-50 overflow-x-hidden">
        {/* Header */}
        <div className="px-4 py-6 border-b border-white/10 flex items-center h-[96px]">
          <div className="flex items-center gap-3 w-full">
            <img
              src="/logo.jpeg"
              alt="Pearls ERP Logo"
              className="w-12 h-12 flex-shrink-0 object-contain rounded-lg"
            />
            <div className="text-xs text-white/80 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <p className="font-bold text-white">{branch?.name}</p>
              <p>{branch?.location}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar py-4">
          {filteredTop.map((item, index) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={index}
                to={item.path}
                className={`mx-3 mb-1 flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                  active
                    ? "bg-white text-secondary shadow-md font-semibold"
                    : "hover:bg-white/10 text-white/90"
                }`}
                title={item.name}
              >
                <div className="w-8 flex justify-center flex-shrink-0">
                  <span className="text-lg">{item.icon}</span>
                </div>
                <span className="text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">{item.name}</span>
              </Link>
            );
          })}

          {/* PURCHASE ORDER DROPDOWN */}
          {filteredPurchase.length > 0 && (
            <div className="mx-3 mb-1 mt-2">
              <button
                onClick={() => setPoOpen(!poOpen)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/10 text-white/90 transition-colors"
                title="Purchase Order"
              >
                <div className="w-8 flex justify-center flex-shrink-0">
                  <span className="text-lg"><FaShoppingCart /></span>
                </div>
                <span className="text-sm flex-1 text-left whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-0 group-hover:w-auto overflow-hidden">Purchase Order</span>
                <div className="w-4 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <FaChevronDown className={`text-xs transition-transform ${poOpen ? "rotate-180" : ""}`} />
                </div>
              </button>
              {poOpen && (
                <div className="mt-1 ml-4 space-y-1 pl-3 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300 group-hover:border-l-2 group-hover:border-white/20">
                  {filteredPurchase.map((item, idx) => {
                    const active = location.pathname === item.path;
                    return (
                      <Link
                        key={idx}
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          active ? "bg-white/20 text-white font-semibold" : "hover:bg-white/10 text-white/80"
                        }`}
                        title={item.name}
                      >
                        <div className="w-6 flex justify-center flex-shrink-0">
                          <span className="text-sm">{item.icon}</span>
                        </div>
                        <span className="whitespace-nowrap">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SALES ORDER DROPDOWN */}
          {filteredSales.length > 0 && (
            <div className="mx-3 mb-1">
              <button
                onClick={() => setSoOpen(!soOpen)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/10 text-white/90 transition-colors"
                title="Sales Order"
              >
                <div className="w-8 flex justify-center flex-shrink-0">
                  <span className="text-lg"><FaShoppingCart /></span>
                </div>
                <span className="text-sm flex-1 text-left whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-0 group-hover:w-auto overflow-hidden">Sales Order</span>
                <div className="w-4 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <FaChevronDown className={`text-xs transition-transform ${soOpen ? "rotate-180" : ""}`} />
                </div>
              </button>
              {soOpen && (
                <div className="mt-1 ml-4 space-y-1 pl-3 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300 group-hover:border-l-2 group-hover:border-white/20">
                  {filteredSales.map((item, idx) => {
                    const active = location.pathname === item.path;
                    return (
                      <Link
                        key={idx}
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          active ? "bg-white/20 text-white font-semibold" : "hover:bg-white/10 text-white/80"
                        }`}
                        title={item.name}
                      >
                        <div className="w-6 flex justify-center flex-shrink-0">
                          <span className="text-sm">{item.icon}</span>
                        </div>
                        <span className="whitespace-nowrap">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {filteredBottom.map((item, index) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={index + "bot"}
                to={item.path}
                className={`mx-3 mb-1 flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                  active
                    ? "bg-white text-secondary shadow-md font-semibold"
                    : "hover:bg-white/10 text-white/90"
                }`}
                title={item.name}
              >
                <div className="w-8 flex justify-center flex-shrink-0">
                  <span className="text-lg">{item.icon}</span>
                </div>
                <span className="text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">{item.name}</span>
              </Link>
            );
          })}



          {/* SUMMARY SECTION */}
          {/* <div className="mx-3 mb-1 mt-4">
            <button
              onClick={() => setSummaryOpen(!summaryOpen)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 text-white/90 transition"
            >
              <span className="text-lg"><FaChartBar /></span>
              <span className="text-sm flex-1 text-left">Summary</span>
              <FaChevronDown
                className={`text-xs transition-transform ${
                  summaryOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {summaryOpen && (
              <div className="mt-2 ml-4 space-y-1 border-l-2 border-white/20 pl-3">
                {summaryItems.map((item, idx) => {
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={idx}
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition ${
                        active
                          ? "bg-white/20 text-white font-semibold"
                          : "hover:bg-white/10 text-white/80"
                      }`}
                    >
                      <span className="text-sm">{item.icon}</span>
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div> */}
        </nav>

        {/* Viewing-branch indicator for Super Admin */}
        {isSuperAdminViewing && (
          <div className="mx-3 mb-2 px-3 py-2 bg-orange-500/20 border border-orange-400/40 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <FaShieldAlt className="text-orange-300 text-sm flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-orange-200 font-semibold uppercase">Admin View</p>
                <p className="text-xs text-white font-bold truncate">{superAdminViewBranch?.name}</p>
              </div>
            </div>
            <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button
                onClick={handleBackToSuperAdmin}
                className="w-full flex items-center gap-2 text-orange-200 hover:text-white text-xs font-semibold transition"
              >
                <FaShieldAlt size={10} /> Back to Super Admin
              </button>
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
          {filteredTop.map((item, index) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={index}
                to={item.path}
                className={`mx-2 mb-1 flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  active
                    ? "bg-white text-secondary shadow-md font-semibold"
                    : "hover:bg-white/10 text-white/90"
                }`}
                onClick={onClose}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}

          {/* PURCHASE ORDER DROPDOWN MOBILE */}
          <div className="mx-2 mb-1 mt-2">
            <button
              onClick={() => setPoOpen(!poOpen)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 text-white/90 transition"
            >
              <span className="text-lg"><FaShoppingCart /></span>
              <span className="text-sm flex-1 text-left">Purchase Order</span>
              <FaChevronDown className={`text-xs transition-transform ${poOpen ? "rotate-180" : ""}`} />
            </button>
            {poOpen && (
              <div className="mt-1 ml-4 space-y-1 border-l-2 border-white/20 pl-3">
                {filteredPurchase.map((item, idx) => {
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={idx}
                      to={item.path}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition ${
                        active ? "bg-white/20 text-white font-semibold" : "hover:bg-white/10 text-white/80"
                      }`}
                    >
                      <span className="text-sm">{item.icon}</span>
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* SALES ORDER DROPDOWN MOBILE */}
          <div className="mx-2 mb-1">
            <button
              onClick={() => setSoOpen(!soOpen)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 text-white/90 transition"
            >
              <span className="text-lg"><FaShoppingCart /></span>
              <span className="text-sm flex-1 text-left">Sales Order</span>
              <FaChevronDown className={`text-xs transition-transform ${soOpen ? "rotate-180" : ""}`} />
            </button>
            {soOpen && (
              <div className="mt-1 ml-4 space-y-1 border-l-2 border-white/20 pl-3">
                {filteredSales.map((item, idx) => {
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={idx}
                      to={item.path}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition ${
                        active ? "bg-white/20 text-white font-semibold" : "hover:bg-white/10 text-white/80"
                      }`}
                    >
                      <span className="text-sm">{item.icon}</span>
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {filteredBottom.map((item, index) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={index + "bot"}
                to={item.path}
                className={`mx-2 mb-1 flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  active
                    ? "bg-white text-secondary shadow-md font-semibold"
                    : "hover:bg-white/10 text-white/90"
                }`}
                onClick={onClose}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}



          {/* MOBILE SUMMARY SECTION */}
          {filteredSummary.length > 0 && (
            <div className="mx-2 mb-1 mt-4">
              <button
                onClick={() => setSummaryOpen(!summaryOpen)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 text-white/90 transition"
              >
                <span className="text-lg"><FaChartBar /></span>
                <span className="text-sm flex-1 text-left">Summary</span>
                <FaChevronDown
                  className={`text-xs transition-transform ${
                    summaryOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {summaryOpen && (
                <div className="mt-2 ml-4 space-y-1 border-l-2 border-white/20 pl-3">
                  {filteredSummary.map((item, idx) => {
                    const active = location.pathname === item.path;
                    return (
                      <Link
                        key={idx}
                        to={item.path}
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition ${
                          active
                            ? "bg-white/20 text-white font-semibold"
                            : "hover:bg-white/10 text-white/80"
                        }`}
                      >
                        <span className="text-sm">{item.icon}</span>
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
