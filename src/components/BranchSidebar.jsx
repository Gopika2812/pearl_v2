import { useState } from "react";
import {
  FaBox,
  FaChartBar,
  FaChevronDown,
  FaDollarSign,
  FaFileAlt,
  FaHome,
  FaLink,
  FaShoppingCart,
  FaSignOutAlt,
  FaTimes,
  FaTruck,
} from "react-icons/fa";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useBranch } from "../context/BranchContext";

const BranchSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { branch, logout } = useBranch();
  const [summaryOpen, setSummaryOpen] = useState(false);

  const menuItems = [
    { name: "Home", path: "/branch-home", icon: <FaHome /> },
    { name: "Purchase Order", path: "/branch/po", icon: <FaShoppingCart /> },
    { name: "Recycling Entry", path: "/branch/recycling", icon: <FaBox /> },
    { name: "Debit Note", path: "/branch/debit-note", icon: <FaFileAlt /> },
    { name: "PO Payment", path: "/branch/po-payment", icon: <FaDollarSign /> },
    { name: "Sales Order", path: "/branch/sales-order", icon: <FaShoppingCart /> },
    { name: "Credit Note", path: "/branch/credit-note", icon: <FaFileAlt /> },
    { name: "Receipt", path: "/branch/receipt", icon: <FaDollarSign /> },
    { name: "Loading & Dispatch", path: "/branch/dispatch", icon: <FaTruck /> },
    { name: "Quick Links", path: "/branch/quick-links", icon: <FaLink /> },
  ];

  const summaryItems = [
    { name: "Summary", path: "/branch/summary", icon: <FaChartBar /> },
  ];

  const handleLogout = () => {
    logout();
    navigate("/branch-login");
  };

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex md:flex-col w-64 h-screen bg-gradient-to-b from-secondary to-secondary/90 text-white shadow-xl fixed left-0 top-0">
        {/* Header */}
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex flex-col gap-2">
            <img
              src="/logo.jpeg"
              alt="Pearls ERP Logo"
              className="h-12 object-contain rounded-lg"
            />
            <div className="text-xs text-white/80">
              <p className="font-bold text-white">{branch?.name}</p>
              <p>{branch?.location}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {menuItems.map((item, index) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={index}
                to={item.path}
                className={`mx-3 mb-1 flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  active
                    ? "bg-white text-secondary shadow-md font-semibold"
                    : "hover:bg-white/10 text-white/90"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm">{item.name}</span>
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
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {menuItems.map((item, index) => {
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

          {/* SUMMARY SECTION MOBILE */}
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
                {summaryItems.map((item, idx) => {
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
