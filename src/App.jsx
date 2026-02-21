import { useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { InventoryProvider } from "./context/InventoryContext";
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
import VendorSummary from "./pages/VendorSummary";

function App() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);


  const hideLayout = location.pathname === "/login" || location.pathname === "/customer-login" || location.pathname === "/pearls-shopping";

  return (
    <InventoryProvider>
      <>
        <ToastContainer />

        <div className="flex">
          {/* Sidebar - Visible if not on login page */}
          {!hideLayout && (
            <Sidebar
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />
          )}

          {/* Main Content Area */}
          <div className="flex-1 min-h-screen flex flex-col">
            {!hideLayout && (
              <Topbar onMenuClick={() => setSidebarOpen(true)} />
            )}

            <div className="flex-1 p-6">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<HrLogin />} />
                <Route path="/customer-login" element={<CustomerLogin />} />
                <Route path="/pearls-shopping" element={<PearlsShopping />} />
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
              </Routes>
            </div>
          </div>
        </div>
      </>
    </InventoryProvider>
  );
}

export default App;
