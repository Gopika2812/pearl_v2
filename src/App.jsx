import { useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
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
import AdminBranchManagement from "./pages/AdminBranchManagement";
import APAgingPage from "./pages/APAgingPage";
import ARAgingPage from "./pages/ARAgingPage";
import BalanceSheetPage from "./pages/BalanceSheetPage";
import BranchCreditNote from "./pages/branch/BranchCreditNote";
import BranchCustomers from "./pages/branch/BranchCustomers";
import BranchDebitNote from "./pages/branch/BranchDebitNote";
import BranchDispatch from "./pages/branch/BranchDispatch";
import BranchHome from "./pages/branch/BranchHome";
import BranchInsights from "./pages/branch/BranchInsights";
import BranchInvoicedOrders from "./pages/branch/BranchInvoicedOrders";
import BranchJournalEntries from "./pages/branch/BranchJournalEntries";
import BranchPO from "./pages/branch/BranchPO";
import BranchPOPayment from "./pages/branch/BranchPOPayment";
import BranchPurchaseOrders from "./pages/branch/BranchPurchaseOrders";
import BranchQuickLinks from "./pages/branch/BranchQuickLinks";
import BranchReceipt from "./pages/branch/BranchReceipt";
import BranchRecycling from "./pages/branch/BranchRecycling";
import BranchSalesOrder from "./pages/branch/BranchSalesOrder";
import BranchSalesReports from "./pages/branch/BranchSalesReports";
import BranchSummary from "./pages/branch/BranchSummary";
import BranchSuppliers from "./pages/branch/BranchSuppliers";
import BranchLoginPage from "./pages/BranchLoginPage";
import BranchRegisterPage from "./pages/BranchRegisterPage";
import UserRegistrationPage from "./pages/UserRegistrationPage";
import SuperAdminLoginPage from "./pages/SuperAdminLoginPage";
import SuperAdminBranchManagement from "./pages/SuperAdminBranchManagement";
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

function App() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check if we're on a branch-specific page
  const isBranchRoute = location.pathname.startsWith("/branch/") || location.pathname === "/branch-home";
  const isInsightsRoute = location.pathname.startsWith("/branch/insights");
  
  // Check if we're on a super admin page
  const isSuperAdminRoute = location.pathname.startsWith("/super-admin/");
  
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

  return (
    <BranchProvider>
      <InventoryProvider>
        <>
          <ToastContainer />

          <div className="flex">
            {/* Sidebar - Use branch sidebar if on branch route, super admin if on super admin route, otherwise use regular */}
            {!hideLayout && !isInsightsRoute && (
              <>
                {isSuperAdminRoute ? (
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
                  {isSuperAdminRoute ? (
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
                  <Route path="/branch/recycling" element={<ProtectedRoute element={<BranchRecycling />} />} />
                  <Route path="/branch/debit-note" element={<ProtectedRoute element={<BranchDebitNote />} />} />
                  <Route path="/branch/po-payment" element={<ProtectedRoute element={<BranchPOPayment />} />} />
                  <Route path="/branch/sales-order" element={<ProtectedRoute element={<BranchSalesOrder />} />} />
                  <Route path="/branch/invoiced-order" element={<ProtectedRoute element={<BranchInvoicedOrders />} />} />
                  <Route path="/branch/credit-note" element={<ProtectedRoute element={<BranchCreditNote />} />} />
                  <Route path="/branch/dispatch" element={<ProtectedRoute element={<BranchDispatch />} />} />
                  <Route path="/branch/suppliers" element={<ProtectedRoute element={<BranchSuppliers />} />} />
                  <Route path="/branch/customers" element={<ProtectedRoute element={<BranchCustomers />} />} />
                  <Route path="/branch/journals" element={<ProtectedRoute element={<BranchJournalEntries />} />} />
                  <Route path="/branch/sales-reports" element={<ProtectedRoute element={<BranchSalesReports />} />} />
                  <Route path="/branch/quick-links" element={<ProtectedRoute element={<BranchQuickLinks />} />} />
                  <Route path="/branch/receipt" element={<ProtectedRoute element={<BranchReceipt />} />} />
                  <Route path="/branch/summary" element={<ProtectedRoute element={<BranchSummary />} />} />

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
                </Routes>
            </div>
          </div>
        </div>
      </>
      </InventoryProvider>
    </BranchProvider>
  );
}

export default App;
