import { useState, useEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
import BranchSalesOrder from "./pages/branch/BranchSalesOrder";
import BranchSummary from "./pages/branch/BranchSummary";
import BranchSuppliers from "./pages/branch/BranchSuppliers";
import BranchOtherPayment from "./pages/branch/BranchOtherPayment";
import BranchOtherReceipt from "./pages/branch/BranchOtherReceipt";
import BranchProductRecords from "./pages/branch/BranchProductRecords";
import BranchLockedPrices from "./pages/branch/BranchLockedPrices";
import BranchAdminRequests from "./pages/branch/BranchAdminRequests";
import BranchStockSummary from "./pages/branch/BranchStockSummary";
import BranchLoginPage from "./pages/BranchLoginPage";
import BranchRegisterPage from "./pages/BranchRegisterPage";
import UserRegistrationPage from "./pages/UserRegistrationPage";
import SuperAdminLoginPage from "./pages/SuperAdminLoginPage";
import SuperAdminBranchManagement from "./pages/SuperAdminBranchManagement";
import SuperAdminControlSystem from "./pages/SuperAdminControlSystem";
import SuperAdminAuditLogs from "./pages/SuperAdminAuditLogs";
import SuperAdminUserApproval from "./pages/SuperAdminUserApproval";
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
  const { superAdminViewBranch, user } = useBranch();

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
    if (isBranchRoute && !superAdminViewBranch && user) {
      // Skip check for ADMIN and SUPER_ADMIN roles
      if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return;

      // Map paths to permission IDs
      const pathPermissionMap = {
        "/branch-home": "home",
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
        "/branch/journals": "journals",
        "/branch/insights": "insights",
        "/branch/quick-links": "quick-links",
        "/branch/summary": "summary",
        "/admin/branches": "admin-branches",
      };

      const requiredPermission = pathPermissionMap[location.pathname];
      const allowedPages = user.allowedPages || [];

      // If page has a defined permission and user doesn't have it, redirect
          if (requiredPermission && !allowedPages.includes(requiredPermission)) {
            if (location.pathname !== "/branch-home") {
              toast.error("You don't have permission to access that page");
              navigate("/branch-home");
            }
          }
        }
      }, [location.pathname, isBranchRoute, superAdminViewBranch, navigate, user]);
    
      const dayBookRoute = <Route path="/branch/day-book" element={<ProtectedRoute element={<BranchDayBook />} />} />;

  return (
    <>
      <ToastContainer />

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
                  />
                ) : (
                  <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                  />
                )}
              </>
            )}

            {/* Main Content Area */}
            <div className="flex-1 min-h-screen flex flex-col">
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

              <div className={`flex-1 ${isInsightsRoute ? "p-0" : "p-6"}`}>
                <Routes>
                  <Route path="/" element={<BranchLoginPage />} />
                  <Route path="/branch/other-payment" element={<BranchOtherPayment />} />
                  <Route path="/branch/other-receipt" element={<BranchOtherReceipt />} />
                  <Route path="/branch/recycling" element={<BranchRecycling />} />
                  <Route path="/branch-login" element={<BranchLoginPage />} />
                  <Route path="/branch-register" element={<BranchRegisterPage />} />
                  <Route path="/user-register" element={<UserRegistrationPage />} />
                  <Route path="/super-admin-login" element={<SuperAdminLoginPage />} />
                  <Route path="/super-admin/dashboard" element={<ProtectedRoute element={<SuperAdminBranchManagement />} role={["SUPER_ADMIN"]} />} />
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
                  <Route path="/branch/customers" element={<ProtectedRoute element={<BranchCustomers />} />} />
                  <Route path="/branch/journals" element={<ProtectedRoute element={<BranchJournalEntries />} />} />
                  <Route path="/branch/stock-journal" element={<ProtectedRoute element={<BranchStockJournal />} />} />
                  <Route path="/branch/quick-links" element={<ProtectedRoute element={<BranchQuickLinks />} />} />
                  <Route path="/branch/receipt" element={<ProtectedRoute element={<BranchReceipt />} />} />
                  <Route path="/branch/summary" element={<ProtectedRoute element={<BranchSummary />} />} />
                  <Route path="/branch/product-records" element={<ProtectedRoute element={<BranchProductRecords />} />} />
                  <Route path="/branch/stock-summary" element={<ProtectedRoute element={<BranchStockSummary />} />} />
                  <Route path="/branch/locked-prices" element={<ProtectedRoute element={<BranchLockedPrices />} />} />
                  <Route path="/branch/day-book" element={<ProtectedRoute element={<BranchDayBook />} />} />
                  <Route path="/branch/admin-requests" element={<ProtectedRoute element={<BranchAdminRequests />} role={["ADMIN"]} />} />

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
                    path="/super-admin/user-approvals"
                    element={<ProtectedRoute element={<SuperAdminUserApproval />} role={["SUPER_ADMIN"]} />}
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
