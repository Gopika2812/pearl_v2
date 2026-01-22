import { useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";

import { useAuth } from "./context/AuthContext";
import { InventoryProvider } from "./context/InventoryContext";

import CRMPage from "./pages/CRMPage";
import DispatchSheetPage from "./pages/DispatchSheetPage";
import EmployeeDashboardPage from "./pages/EmployeeDashboardPage";
import EmployeesBookPage from "./pages/EmployeesBookPage";
import Home from "./pages/Home";
import HRControlPanel from "./pages/HrcontrolPanel";
import HrLogin from "./pages/HrLogin";
import InventoryPurchaseOrder from "./pages/inventory/InventoryPurchaseOrder";
import InventorySalesOrder from "./pages/inventory/InventorySalesOrder";
import PearlsBookPage from "./pages/PearlsBookPage";

function App() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  // hide layout on login page OR if not logged in
  const hideLayout = location.pathname === "/login" || !user;

  return (
    <InventoryProvider>
      <div className="flex">
        {/* Sidebar */}
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
              {/* Public */}
              <Route path="/login" element={<HrLogin />} />

              {/* Protected - Any logged-in user */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/purchase-order"
                element={
                  <ProtectedRoute allowedRoles={["Manager", "Billing"]}>
                    <InventoryPurchaseOrder />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/sales-order"
                element={
                  <ProtectedRoute allowedRoles={["Manager", "Billing", "Sales"]}>
                    <InventorySalesOrder />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/pearls-book"
                element={
                  <ProtectedRoute>
                    <PearlsBookPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/crm"
                element={
                  <ProtectedRoute allowedRoles={["Sales", "Marketing", "Manager"]}>
                    <CRMPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dispatch"
                element={
                  <ProtectedRoute allowedRoles={["Dispatch", "Delivery"]}>
                    <DispatchSheetPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/employees"
                element={
                  <ProtectedRoute allowedRoles={["HR", "Manager"]}>
                    <EmployeesBookPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/employeepage"
                element={
                  <ProtectedRoute>
                    <EmployeeDashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/hr-control"
                element={
                  <ProtectedRoute allowedRoles={["Manager"]}>
                    <HRControlPanel />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </div>
        </div>
      </div>
    </InventoryProvider>
  );
}

export default App;
