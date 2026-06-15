import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../api";
import { useBranch } from "../context/BranchContext";
import { useNavigate, useLocation } from "react-router-dom";

const RestockingAlertModal = () => {
  const [showFullPageAlert, setShowFullPageAlert] = useState(false);
  const [alertProducts, setAlertProducts] = useState([]);
  const { currentBranch, user } = useBranch();
  const navigate = useNavigate();
  const location = useLocation();

  const ALERT_DISMISS_KEY = "lowStockAlertDismissedAt";
  const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

  const isAlertDismissed = () => {
    try {
      const storedAt = localStorage.getItem(ALERT_DISMISS_KEY);
      if (!storedAt) return false;
      const elapsed = Date.now() - parseInt(storedAt, 10);
      return elapsed < ALERT_COOLDOWN_MS;
    } catch {
      return false;
    }
  };

  const dismissAlert = () => {
    try {
      localStorage.setItem(ALERT_DISMISS_KEY, String(Date.now()));
    } catch {}
    setShowFullPageAlert(false);
  };

  const getReorderParams = (product) => {
    const config = product.restockingConfig;
    const reorderMode = config?.reorderMode || "HIGH";
    const thresholdMode = config?.thresholdMode || reorderMode;
    
    // Auto values
    const autoThreshold = (config?.sellingQtyInPeriod !== undefined && config?.sellingQtyInPeriod !== null)
      ? config.sellingQtyInPeriod
      : (product.reorderLevel || 10);
    
    // Manual values
    const manualThreshold = config?.threshold !== undefined && config?.threshold !== null
      ? config.threshold
      : (product.reorderLevel || 10);

    let resolvedThreshold;
    if (thresholdMode === "LOW") {
      resolvedThreshold = Math.min(autoThreshold, manualThreshold);
    } else {
      resolvedThreshold = Math.max(autoThreshold, manualThreshold);
    }

    // If calculated sales in period is 0, set resolved levels to manual overrides if available, otherwise 0
    if ((config?.sellingQtyInPeriod ?? 0) === 0) {
      resolvedThreshold = manualThreshold || 0;
    }

    return {
      reorderLevel: resolvedThreshold,
    };
  };

  const getGroupNameOfProduct = (product) => {
    if (!product || !product.productGroup) return "Uncategorized";
    if (typeof product.productGroup === 'object') {
      return product.productGroup.name || "Uncategorized";
    }
    return String(product.productGroup);
  };

  useEffect(() => {
    const branchId = currentBranch?._id;
    if (!branchId || isAlertDismissed()) return;
    
    // If we are already on the recycling/restocking page, let that page handle its own alert
    if (location.pathname.includes('/branch/recycling')) return;

    const fetchLowStock = async () => {
      try {
        const url = `${API_BASE}/products?branchId=${branchId}&limit=10000&includeRestocking=true&mini=true`;
        const res = await fetchWithAuth(url);
        const data = await res.json();
        
        let sourceProducts = [];
        if (data?.data && Array.isArray(data.data)) {
          sourceProducts = data.data;
        } else if (Array.isArray(data)) {
          sourceProducts = data;
        } else if (data?.products && Array.isArray(data.products)) {
          sourceProducts = data.products;
        }

        if (sourceProducts.length > 0) {
          const criticalProducts = sourceProducts.filter((p) => {
            const { reorderLevel } = getReorderParams(p);
            const isAlertMarked = p.restockingConfig?.showAlert || false;
            // ONLY alert if user marked this product for alerts AND stock hits/falls below threshold AND threshold > 0
            return isAlertMarked && p.totalQty <= reorderLevel && reorderLevel > 0;
          });

          if (criticalProducts.length > 0 && !isAlertDismissed()) {
            setAlertProducts(criticalProducts);
            setShowFullPageAlert(true);
          }
        }
      } catch (err) {
        console.error("Failed to fetch low stock products for alert:", err);
      }
    };

    fetchLowStock();
  }, [currentBranch, location.pathname]);

  if (!showFullPageAlert || alertProducts.length === 0) return null;

  const groupedAlerts = alertProducts.reduce((acc, p) => {
    const groupName = getGroupNameOfProduct(p);
    if (!acc[groupName]) {
      acc[groupName] = { products: [], count: 0 };
    }
    acc[groupName].products.push(p);
    acc[groupName].count += 1;
    return acc;
  }, {});
  
  const alertGroups = Object.keys(groupedAlerts).sort();

  return (
    <div className="fixed inset-0 bg-red-950/90 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col border-4 border-red-500 transform scale-100 transition-all duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-red-700 to-rose-600 text-white p-8 text-center relative overflow-hidden">
          {/* Pulsing light behind icon */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15),transparent)] animate-pulse" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="p-4 bg-white/20 rounded-full text-5xl mb-3 animate-bounce">
              🚨
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight uppercase">
              CRITICAL STOCK REORDER LEVEL REACHED!
            </h2>
            <p className="text-red-100 text-sm md:text-base mt-2 max-w-2xl font-medium">
              The following product groups contain items that have reached or dropped below their safety threshold.
            </p>
          </div>
        </div>

        {/* List of critical product groups */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4">
          <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-2 px-2">
            <span>Product Group</span>
            <span className="w-48 text-right">Low Stock Items</span>
          </div>

          {alertGroups.map((groupName) => {
            const groupData = groupedAlerts[groupName];
            return (
              <div key={groupName} className="flex justify-between items-center py-4 border-b border-gray-100 hover:bg-red-50/30 px-4 rounded-xl transition-colors">
                <div className="flex items-center gap-4">
                  <div className="text-3xl p-2 bg-red-50 text-red-500 rounded-lg shadow-sm border border-red-100">📦</div>
                  <div>
                    <h4 className="font-extrabold text-gray-800 text-lg md:text-xl">{groupName}</h4>
                    <p className="text-sm text-red-500 font-bold mt-0.5">{groupData.count} product{groupData.count > 1 ? 's' : ''} reached critical stock</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      dismissAlert();
                      navigate("/branch/recycling");
                    }}
                    className="px-5 py-2.5 bg-red-100 text-red-700 font-extrabold rounded-xl hover:bg-red-200 transition-colors shadow-sm transform hover:scale-105 active:scale-95 duration-150"
                  >
                    View Group
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="bg-gray-50 px-6 py-6 md:px-8 border-t border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <button
            onClick={() => {
              dismissAlert();
            }}
            className="w-full md:w-auto px-6 py-3 border-2 border-gray-300 text-gray-600 font-bold hover:bg-gray-100 transition rounded-xl flex items-center justify-center gap-2"
          >
            <span>🔓</span> Dismiss and View All
          </button>
          
          <button
            onClick={() => {
              dismissAlert();
              navigate("/branch/recycling");
            }}
            className="w-full md:w-auto px-8 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-extrabold hover:from-red-700 hover:to-rose-700 transition rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/35 transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>🛒</span> Go to Restocking Page
          </button>
        </div>

      </div>
    </div>
  );
};

export default RestockingAlertModal;
