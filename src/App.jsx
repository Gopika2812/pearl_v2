import { useState, useEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API_BASE } from "./api";

import BranchSidebar from "./components/BranchSidebar";
import BranchTopbar from "./components/BranchTopbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import SuperAdminSidebar from "./components/SuperAdminSidebar";
import SuperAdminTopbar from "./components/SuperAdminTopbar";
import { BranchProvider } from "./context/BranchContext";
import { InventoryProvider } from "./context/InventoryContext";
import { useBranch } from "./context/BranchContext";
import { fetchWithAuth } from "./api"; // Updated import
import { FaTicketAlt, FaExclamationTriangle, FaArrowRight } from "react-icons/fa"; // Added icons
import AdminBranchManagement from "./pages/AdminBranchManagement";
import APAgingPage from "./pages/APAgingPage";
import ARAgingPage from "./pages/ARAgingPage";
import BalanceSheetPage from "./pages/BalanceSheetPage";
import BranchCreditNote from "./pages/branch/BranchCreditNote";
import BranchClaims from "./pages/branch/BranchClaims";
import BranchCustomers from "./pages/branch/BranchCustomers";
import BranchDebitNote from "./pages/branch/BranchDebitNote";
import BranchDispatch from "./pages/branch/BranchDispatch";
import BranchHome from "./pages/branch/BranchHome";
import BranchDayBook from "./pages/branch/BranchDayBook";
import BranchInsights from "./pages/branch/BranchInsights";
import BranchInvoicedOrders from "./pages/branch/BranchInvoicedOrders";
import BranchSalesInvoices from "./pages/branch/BranchSalesInvoices";
import BranchJournalEntries from "./pages/branch/BranchJournalEntries";
import BranchStockJournal from "./pages/branch/BranchStockJournal";
import BranchPO from "./pages/branch/BranchPO";
import BranchPOPayment from "./pages/branch/BranchPOPayment";
import BranchPurchaseOrders from "./pages/branch/BranchPurchaseOrders";
import BranchPurchaseInvoices from "./pages/branch/BranchPurchaseInvoices";
import BranchQuickLinks from "./pages/branch/BranchQuickLinks";
import BranchReceipt from "./pages/branch/BranchReceipt";
import BranchRecycling from "./pages/branch/BranchRecycling";
import Tokenization from "./pages/branch/Tokenization";
import BranchSalesOrder from "./pages/branch/BranchSalesOrder";
import BranchSummary from "./pages/branch/BranchSummary";
import BranchSuppliers from "./pages/branch/BranchSuppliers";
import BranchSupplierTransactions from "./pages/branch/BranchSupplierTransactions";
import BranchOtherPayment from "./pages/branch/BranchOtherPayment";
import BranchOtherReceipt from "./pages/branch/BranchOtherReceipt";
import BranchProductRecords from "./pages/branch/BranchProductRecords";
import BranchLockedPrices from "./pages/branch/BranchLockedPrices";
import BranchAdminRequests from "./pages/branch/BranchAdminRequests";
import BranchStockSummary from "./pages/branch/BranchStockSummary";
import BranchLedger from "./pages/branch/BranchLedger";
import BranchExtraExpenseLedger from "./pages/branch/BranchExtraExpenseLedger";
import BranchReceiptRecords from "./pages/branch/BranchReceiptRecords";
import BranchPaymentRecords from "./pages/branch/BranchPaymentRecords";
import BranchFollowUp from "./pages/branch/BranchFollowUp";
import BranchFollowUpRecords from "./pages/branch/BranchFollowUpRecords";

import BranchProductConfig from "./pages/branch/BranchProductConfig";
import BranchCustomerLedger from "./pages/branch/BranchCustomerLedger";


import BranchLoginPage from "./pages/BranchLoginPage";
import BranchRegisterPage from "./pages/BranchRegisterPage";
import UserRegistrationPage from "./pages/UserRegistrationPage";
import SuperAdminLoginPage from "./pages/SuperAdminLoginPage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminBranchManagement from "./pages/SuperAdminBranchManagement";
import SuperAdminControlSystem from "./pages/SuperAdminControlSystem";
import SuperAdminAuditLogs from "./pages/SuperAdminAuditLogs";
import SuperAdminUserManagement from "./pages/SuperAdminUserManagement";
import CRMPage from "./pages/CRMPage";
import CustomerLogin from "./pages/CustomerLogin";
import CustomerSummary from "./pages/CustomerSummary";
import DispatchSheetPage from "./pages/DispatchSheetPage";
import EmployeeDashboardPage from "./pages/EmployeeDashboardPage";
import EmployeesBookPage from "./pages/EmployeesBookPage";
import Home from "./pages/Home";
import HRControlPanel from "./pages/HrcontrolPanel";
import HrLogin from "./pages/HrLogin";
import InventoryPurchaseOrder from "./pages/inventory/InventoryPurchaseOrder";
import InventorySalesOrder from "./pages/inventory/InventorySalesOrder";
import OthersSummary from "./pages/OthersSummary";
import PearlsBookPage from "./pages/PearlsBookPage";
import PearlsShopping from "./pages/PearlsShopping";
import ProductSummary from "./pages/ProductSummary";
import ProfitLossPage from "./pages/ProfitLossPage";
import ReorderingDashboard from "./pages/ReorderingDashboard";
import TrialBalancePage from "./pages/TrialBalancePage";
import VendorSummary from "./pages/VendorSummary";


function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { 
    superAdminViewBranch, 
    user, 
    currentBranch, 
    blockingTokens, 
    reminderTokens,
    isCheckingTokens, 
    refreshBlockingTokens 
  } = useBranch();

  // Reminder Tracking
  useEffect(() => {
    if (reminderTokens?.length > 0) {
      reminderTokens.forEach(token => {
        // Show a toast for each overdue token if work has started
        toast.info(
          <div className="flex flex-col gap-1">
            <span className="font-bold text-xs uppercase tracking-widest text-indigo-600">Task Completion Reminder</span>
            <span className="text-[10px] text-gray-700 font-medium">[{token.tokenId}] Work has been ongoing for over {currentBranch?.tokenBlockTime || 120} minutes. Please complete this task.</span>
          </div>,
          { autoClose: 10000, toastId: `reminder-${token._id}`, theme: "colored" }
        );
      });
    }
  }, [reminderTokens]);

  // Check if we're on a branch-specific page
  const isBranchRoute = location.pathname.startsWith("/branch/") || location.pathname === "/branch-home";
  const isInsightsRoute = location.pathname.startsWith("/branch/insights");
  
  // Check if we're on a super admin page
  const isSuperAdminRoute = location.pathname.startsWith("/super-admin/");

  // Super admin viewing a branch → treat as branch route for layout purposes
  const isSuperAdminViewingBranch = !!superAdminViewBranch && isBranchRoute;
  
  // Hide layout on login pages
  const hideLayout =
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname === "/branch-login" ||
    location.pathname === "/branch-register" ||
    location.pathname === "/user-register" ||
    location.pathname === "/super-admin-login" ||
    location.pathname === "/customer-login" ||
    location.pathname === "/pearls-shopping";

  // RBAC Permission Check
  useEffect(() => {
    // 📢 PERFORMANCE: Wake up the Render server in the background
    // This helps avoid the 50s cold start delay on the first real action.
    const wakeUpServer = async () => {
      try {
        await fetch(`${API_BASE}/health`);
        console.log("🚀 Server wake-up signal sent");
      } catch (err) {
        console.warn("⚠️ Server wake-up failed:", err.message);
      }
    };
    wakeUpServer();
  }, []);

  // Global Session & Status Check + RBAC Enforcement
  useEffect(() => {
    const verifyAccess = async () => {
      if (!isBranchRoute || superAdminViewBranch || !user) return;

      // 1. ACCOUNT STATUS VERIFICATION (Server-side check)
      // This ensures that if an admin blocks a user, they are kicked out immediately
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/branch-users/${user.id || user._id}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const latestUser = data.data;
            
            // Check if user or branch is deactivated
            if (latestUser.status !== "ACTIVE" || (latestUser.branch && latestUser.branch.status !== "ACTIVE")) {
              toast.error("🛑 Access revoked. Account or Branch is no longer active.");
              localStorage.clear();
              window.location.href = "/branch-login";
              return;
            }

            // Sync permissions if they changed in DB
            if (JSON.stringify(latestUser.allowedPages) !== JSON.stringify(user.allowedPages)) {
              localStorage.setItem("user", JSON.stringify(latestUser));
            }
          }
        } else if (res.status === 401) {
          localStorage.clear();
          navigate("/branch-login");
          return;
        }
      } catch (err) {
        console.warn("Status check failed:", err.message);
      }

      // 2. GRANULAR PERMISSION ENFORCEMENT
      // Skip check ONLY for SUPER_ADMIN. Normal branch ADMINS must respect allowedPages.
      if (user.role === "SUPER_ADMIN") return;

      const pathPermissionMap = {
        "/branch-home": "home",
        "/branch/tokenization": "tokenization",
        "/branch/po": "create-po",
        "/branch/purchase-orders": "purchase-list",
        "/branch/purchase-invoices": "purchase-invoice-list",
        "/branch/recycling": "restocking",
        "/branch/debit-note": "debit-note",
        "/branch/po-payment": "payment-po",
        "/branch/sales-order": "create-so",
        "/branch/sales-orders": "sales-order-list",
        "/branch/sales-invoices": "sales-invoice-list",
        "/branch/credit-note": "credit-note",
        "/branch/claims": "claims",
        "/branch/receipt": "receipt",
        "/branch/dispatch": "dispatch",
        "/branch/suppliers": "suppliers",
        "/branch/customers": "customers",
        "/branch/follow-up": "follow-up-form",
        "/branch/follow-up-records": "follow-up-records",
        "/branch/other-payment": "other-payment",
        "/branch/other-receipt": "other-receipt",
        "/branch/product-records": "product-records",
        "/branch/product-config": "product-config",
        "/branch/locked-prices": "locked-prices",
        "/branch/ledger": "ledgers",
        "/branch/journals": "journals",
        "/branch/day-book": "day-book",
        "/branch/extra-expense-ledger": "extra-expense-ledger",
        "/branch/stock-summary": "stock-summary",
        "/branch/quick-links": "quick-links",
        "/branch/admin-requests": "admin-requests",
        "/branch/tokenization": "tokenization",
        "/branch/insights": "insights",
        "/branch/receipt-records": "receipt",
        "/branch/payment-records": "payment-po",
        "/branch/summary": "summary",
      };

      const requiredPermission = pathPermissionMap[location.pathname];
      const allowedPages = user.allowedPages || [];

      let hasAccess = false;
      if (!requiredPermission) {
        hasAccess = true; // No permission required for this route
      } else if (allowedPages.includes(requiredPermission)) {
        hasAccess = true;
      } else if (requiredPermission === "quick-links") {
        // Special case for Quick Links: Allow if ANY master data module is allowed
        const masterModules = [
          "voucher_type", "warehouse", "product_group", "product_category", "product",
          "customer_category", "customer_group", "customer", "vendor",
          "sales_owner", "sales_man", "delivery_man", "token"
        ];
        hasAccess = masterModules.some(mod => allowedPages.includes(mod));
      }

      if (!hasAccess) {
        if (location.pathname !== "/branch-home") {
          toast.error("Access Denied: Permission not granted for this module.");
          navigate("/branch-home");
        }
      }
    };

    verifyAccess();
  }, [location.pathname, isBranchRoute, superAdminViewBranch, navigate, user]);



  // Redirect Logic: If blocking tokens exist and NOT on tokenization page, FORCE redirect
  useEffect(() => {
    if (blockingTokens.length > 0 && location.pathname !== "/branch/tokenization" && isBranchRoute) {
      // Use replace: true to prevent back button from trapping the user in a loop
      navigate("/branch/tokenization", { replace: true });
    }
  }, [blockingTokens, location.pathname, isBranchRoute, navigate]);

  const handleTakeToken = async (tokenId) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/tokens/${tokenId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "TAKEN", takenBy: user?.id })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Task Taken Successfully");
        refreshBlockingTokens(); // Refresh to update block state
        navigate("/branch/tokenization");
      }
    } catch (err) {
      toast.error("Failed to take task");
    }
  };

  const handleStartWorkInModal = async (tokenId) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/tokens/${tokenId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "IN_PROGRESS", takenBy: user?.id })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Work Started Successfully");
        refreshBlockingTokens(); // Refresh to lift block
        navigate("/branch/tokenization");
      }
    } catch (err) {
      toast.error("Failed to start work");
    }
  };

  const ForcedTokenModal = () => {
    if (blockingTokens.length === 0) return null;

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-500 border border-white/20">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-500 px-10 py-12 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/30 shadow-xl">
                <FaTicketAlt className="text-4xl text-white drop-shadow-lg" />
              </div>
              <h2 className="text-3xl font-black tracking-tight mb-2 uppercase">Action Required!</h2>
              <p className="text-indigo-100 font-bold text-xs uppercase tracking-widest leading-relaxed">
                {blockingTokens[0]?.blockType === "START_WORK" 
                  ? `You have a task taken but not started for over ${currentBranch?.tokenBlockTime || 120} minutes.` 
                  : `You have ${blockingTokens.length} mandatory ${blockingTokens.length === 1 ? 'task' : 'tasks'} assigned to you.`
                }
                <br /> 
                {blockingTokens[0]?.blockType === "START_WORK" 
                  ? "Click 'Start Work' to continue." 
                  : "Open a task to acknowledge and continue."
                }
              </p>
            </div>
          </div>

          <div className="p-8 max-h-[40vh] overflow-y-auto bg-slate-50/50">
            <div className="space-y-4">
              {blockingTokens.map((token, idx) => (
                <div key={token._id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between gap-4 transition-all hover:border-indigo-100">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center shrink-0 font-black text-xs">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{token.tokenId}</span>
                        <span className="text-[9px] font-black bg-amber-100 text-amber-600 px-2 py-0.5 rounded-lg uppercase tracking-tighter">PENDING</span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 leading-relaxed italic line-clamp-2">"{token.message}"</p>
                    </div>
                  </div>
                  {token.blockType === "START_WORK" ? (
                    <button 
                      onClick={() => handleStartWorkInModal(token._id)}
                      className="self-center px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg shadow-emerald-100"
                    >
                      Start Work
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleTakeToken(token._id)}
                      className="self-center px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
                    >
                      Open
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 bg-white border-t border-slate-100">
             <div className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
               System Locked Until Task is Acknowledged
             </div>
          </div>
        </div>
      </div>
    );
  };
    
      const dayBookRoute = <Route path="/branch/day-book" element={<ProtectedRoute element={<BranchDayBook />} />} />;

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={2500}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="colored"
        toastStyle={{
          background: "rgba(49, 155, 171, 0.95)",
          color: "#fff",
          backdropFilter: "blur(12px)",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(49,155,171,0.2)",
          border: "1px solid rgba(255,255,255,0.1)",
          fontSize: "14px",
          fontWeight: "600",
          fontFamily: "Inter, sans-serif"
        }}
      />
      
          <div className="flex">
            {/* Sidebar logic:
                - Super admin viewing a branch → BranchSidebar
                - Super admin pages normally → SuperAdminSidebar
                - Branch pages → BranchSidebar
                - Otherwise → Sidebar (legacy)
            */}
            {!hideLayout && !isInsightsRoute && (
              <>
                {isSuperAdminViewingBranch ? (
                  <BranchSidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    isBlocked={blockingTokens.length > 0}
                  />
                ) : isSuperAdminRoute ? (
                  <SuperAdminSidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                  />
                ) : isBranchRoute ? (
                  <BranchSidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    isBlocked={blockingTokens.length > 0}
                  />
                ) : (
                  <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                  />
                )}
              </>
            )}

            {/* Main Content Area: Offset by sidebar width (20 units = 80px) on desktop */}
            <div className={`flex-1 min-h-screen flex flex-col transition-all duration-300 w-full overflow-hidden ${(!hideLayout && !isInsightsRoute) || isSuperAdminRoute ? "md:ml-20" : ""}`}>
              {!hideLayout && (
                <>
                  {user?.role === "SUPER_ADMIN" ? (
                    <SuperAdminTopbar onMenuClick={() => setSidebarOpen(true)} />
                  ) : isBranchRoute && !isInsightsRoute ? (
                    <BranchTopbar onMenuClick={() => setSidebarOpen(true)} />
                  ) : (
                    !isInsightsRoute && <Topbar onMenuClick={() => setSidebarOpen(true)} />
                  )}
                </>
              )}

              <div className={`flex-1 transition-all duration-300 overflow-y-auto ${isInsightsRoute || isSuperAdminRoute ? "p-0" : "p-6"} ${!hideLayout ? "pt-16" : ""}`}>
                <Routes>
                  <Route path="/" element={<BranchLoginPage />} />
                  <Route path="/branch/other-payment" element={<BranchOtherPayment />} />
                  <Route path="/branch/other-receipt" element={<BranchOtherReceipt />} />
                  <Route path="/branch-login" element={<BranchLoginPage />} />
                  <Route path="/branch-register" element={<BranchRegisterPage />} />
                  <Route path="/user-register" element={<UserRegistrationPage />} />
                  <Route path="/super-admin-login" element={<SuperAdminLoginPage />} />
                  <Route path="/super-admin/dashboard" element={<ProtectedRoute element={<SuperAdminDashboard />} role={["SUPER_ADMIN"]} />} />
                  <Route path="/super-admin/branch-management" element={<ProtectedRoute element={<SuperAdminBranchManagement />} role={["SUPER_ADMIN"]} />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/login" element={<HrLogin />} />
                  <Route path="/customer-login" element={<CustomerLogin />} />
                  <Route path="/pearls-shopping" element={<PearlsShopping />} />

                  {/* BRANCH-SPECIFIC ROUTES - Protected */}
                  <Route path="/branch-home" element={<ProtectedRoute element={<BranchHome />} />} />
                  <Route path="/branch/insights" element={<ProtectedRoute element={<BranchInsights />} />} />
                  <Route path="/branch/po" element={<ProtectedRoute element={<BranchPO />} />} />
                  <Route path="/branch/purchase-orders" element={<ProtectedRoute element={<BranchPurchaseOrders />} />} />
                  <Route path="/branch/purchase-invoices" element={<ProtectedRoute element={<BranchPurchaseInvoices />} />} />
                  <Route path="/branch/recycling" element={<ProtectedRoute element={<BranchRecycling />} />} />
                  <Route path="/branch/debit-note" element={<ProtectedRoute element={<BranchDebitNote />} />} />
                  <Route path="/branch/po-payment" element={<ProtectedRoute element={<BranchPOPayment />} />} />
                  <Route path="/branch/sales-order" element={<ProtectedRoute element={<BranchSalesOrder />} />} />
                  <Route path="/branch/sales-orders" element={<ProtectedRoute element={<BranchInvoicedOrders />} />} />
                  <Route path="/branch/sales-invoices" element={<ProtectedRoute element={<BranchSalesInvoices />} />} />
                  <Route path="/branch/credit-note" element={<ProtectedRoute element={<BranchCreditNote />} />} />
                  <Route path="/branch/claims" element={<ProtectedRoute element={<BranchClaims />} />} />
                  <Route path="/branch/dispatch" element={<ProtectedRoute element={<BranchDispatch />} />} />
                  <Route path="/branch/suppliers" element={<ProtectedRoute element={<BranchSuppliers />} />} />
                  <Route path="/branch/supplier-transactions" element={<ProtectedRoute element={<BranchSupplierTransactions />} />} />
                  <Route path="/branch/customers" element={<ProtectedRoute element={<BranchCustomers />} />} />
                  <Route path="/branch/journals" element={<ProtectedRoute element={<BranchJournalEntries />} />} />
                  <Route path="/branch/stock-journal" element={<ProtectedRoute element={<BranchStockJournal />} />} />
                  <Route path="/branch/quick-links" element={<ProtectedRoute element={<BranchQuickLinks />} />} />
                  <Route path="/branch/receipt" element={<ProtectedRoute element={<BranchReceipt />} />} />
                  <Route path="/branch/receipt-records" element={<ProtectedRoute element={<BranchReceiptRecords />} />} />
                  <Route path="/branch/payment-records" element={<ProtectedRoute element={<BranchPaymentRecords />} />} />
                  <Route path="/branch/summary" element={<ProtectedRoute element={<BranchSummary />} />} />
                  <Route path="/branch/product-records" element={<ProtectedRoute element={<BranchProductRecords />} />} />
                  <Route path="/branch/stock-summary" element={<ProtectedRoute element={<BranchStockSummary />} />} />
                  <Route path="/branch/locked-prices" element={<ProtectedRoute element={<BranchLockedPrices />} />} />
                  <Route path="/branch/day-book" element={<ProtectedRoute element={<BranchDayBook />} />} />
                  <Route path="/branch/admin-requests" element={<ProtectedRoute element={<BranchAdminRequests />} role={["ADMIN"]} />} />
                  <Route path="/branch/extra-expense-ledger" element={<ProtectedRoute element={<BranchExtraExpenseLedger />} />} />
                  <Route path="/branch/product-config" element={<ProtectedRoute element={<BranchProductConfig />} />} />
                  <Route path="/branch/ledger" element={<ProtectedRoute element={<BranchLedger />} />} />
                  <Route path="/branch/customer-ledger/:customerId" element={<ProtectedRoute element={<BranchCustomerLedger />} />} />

                  <Route path="/branch/follow-up" element={<ProtectedRoute element={<BranchFollowUp />} />} />
                  <Route path="/branch/follow-up-records" element={<ProtectedRoute element={<BranchFollowUpRecords />} />} />
                  <Route path="/branch/tokenization" element={<ProtectedRoute element={<Tokenization />} />} />

                  {/* LEGACY ROUTES */}
                  <Route
                    path="/purchase-order"
                    element={<InventoryPurchaseOrder />}
                  />
                  <Route
                    path="/sales-order"
                    element={<InventorySalesOrder />}
                  />
                  <Route path="/pearls-book" element={<PearlsBookPage />} />
                  <Route path="/crm" element={<CRMPage />} />
                  <Route path="/dispatch" element={<DispatchSheetPage />} />
                  <Route path="/employees" element={<EmployeesBookPage />} />
                  <Route
                    path="/employeepage"
                    element={<EmployeeDashboardPage />}
                  />
                  <Route path="/hr-control" element={<HRControlPanel />} />
                  <Route
                    path="/summary/products"
                    element={<ProductSummary />}
                  />
                  <Route
                    path="/summary/customers"
                    element={<CustomerSummary />}
                  />
                  <Route
                    path="/summary/vendors"
                    element={<VendorSummary />}
                  />
                  <Route
                    path="/summary/others"
                    element={<OthersSummary />}
                  />
                  <Route
                    path="/reports/trial-balance"
                    element={<TrialBalancePage />}
                  />
                  <Route
                    path="/reports/balance-sheet"
                    element={<BalanceSheetPage />}
                  />
                  <Route
                    path="/reports/profit-loss"
                    element={<ProfitLossPage />}
                  />
                  <Route
                    path="/reports/ar-aging"
                    element={<ARAgingPage />}
                  />
                  <Route
                    path="/reports/ap-aging"
                    element={<APAgingPage />}
                  />
                  <Route
                    path="/reordering"
                    element={<ReorderingDashboard />}
                  />
                  <Route
                    path="/admin/branches"
                    element={<ProtectedRoute element={<AdminBranchManagement />} role={["ADMIN"]} />}
                  />
                  <Route
                    path="/super-admin/control-system"
                    element={<ProtectedRoute element={<SuperAdminControlSystem />} role={["SUPER_ADMIN"]} />}
                  />
                  <Route
                    path="/super-admin/audit-logs"
                    element={<ProtectedRoute element={<SuperAdminAuditLogs />} role={["SUPER_ADMIN"]} />}
                  />
                  <Route 
                    path="/super-admin/user-management" 
                    element={<ProtectedRoute element={<SuperAdminUserManagement />} role={["SUPER_ADMIN"]} />} 
                  />
                </Routes>
            </div>
          </div>
        </div>
      </>
  );
}

function App() {
  return (
    <BranchProvider>
      <InventoryProvider>
        <AppContent />
      </InventoryProvider>
    </BranchProvider>
  );
}

export default App;
