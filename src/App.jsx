import { useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
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

  // pages where sidebar/topbar should NOT appear
  const hideLayout = location.pathname === "/login";

  return (
    <InventoryProvider>
      <div className="flex">
        {/* Sidebar - Visible if not on login page */}
        {!hideLayout && (
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}

        {/* Main Content Area */}
        <div className="flex-1 min-h-screen flex flex-col">
          {!hideLayout && <Topbar onMenuClick={() => setSidebarOpen(true)} />}

          <div className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<HrLogin />} />
              <Route path="/purchase-order" element={<InventoryPurchaseOrder />} />
              <Route path="/sales-order" element={<InventorySalesOrder />} /> 
              <Route path="/pearls-book" element={<PearlsBookPage />} />
              <Route path="/crm" element={<CRMPage />} />
              <Route path="/dispatch" element={<DispatchSheetPage />} />
              <Route path="/employees" element={<EmployeesBookPage />} />
              <Route path="/employeepage" element={<EmployeeDashboardPage />} /> 
              <Route path="/hr-control" element={<HRControlPanel />} /> 
            </Routes>
          </div>
        </div>
      </div>
    </InventoryProvider>
  );
}

export default App;
