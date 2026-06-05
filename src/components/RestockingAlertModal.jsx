import React, { useEffect, useState } from "react";
import { FaExclamationTriangle, FaTimes, FaBoxOpen } from "react-icons/fa";
import { API_BASE, fetchWithAuth } from "../api";
import { useBranch } from "../context/BranchContext";
import { useNavigate } from "react-router-dom";

const RestockingAlertModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const { currentBranch, superAdminViewBranch, user } = useBranch();
  const navigate = useNavigate();

  useEffect(() => {
    // Only check once per session per branch
    const branchId = superAdminViewBranch?._id || currentBranch?._id || currentBranch?.id;
    if (!branchId) return;

    const sessionKey = `restockingAlertShown_${branchId}`;
    if (sessionStorage.getItem(sessionKey)) return;

    const fetchLowStock = async () => {
      try {
        // Fetch products with their restocking config and current stock
        const url = `${API_BASE}/products?branchId=${branchId}&limit=1000&includeRestocking=true&mini=true`;
        const res = await fetchWithAuth(url);
        const data = await res.json();
        
        if (data.success && Array.isArray(data.data)) {
          // Calculate which products actually need restocking
          const needsRestock = data.data.filter(product => {
            const currentStock = product.availableQty ?? product.totalQty ?? 0;
            const threshold = product.restockingConfig?.threshold !== undefined && product.restockingConfig?.threshold !== null 
              ? product.restockingConfig.threshold 
              : (product.reorderLevel || 10);
            
            return currentStock < threshold;
          });

          if (needsRestock.length > 0) {
            setLowStockProducts(needsRestock);
            setIsOpen(true);
            sessionStorage.setItem(sessionKey, "true");
          }
        }
      } catch (err) {
        console.error("Failed to fetch low stock products:", err);
      }
    };

    fetchLowStock();
  }, [currentBranch, superAdminViewBranch, user]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 scale-150">
            <FaBoxOpen size={80} />
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <FaExclamationTriangle className="text-white text-2xl" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Low Stock Alert</h2>
              <p className="text-white/80 font-bold uppercase tracking-widest text-[10px] mt-1">
                {lowStockProducts.length} Items need restocking
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all z-10"
          >
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm font-medium text-gray-500 mb-4">
            The following items have dropped below their minimum threshold and require immediate restocking:
          </p>

          <div className="max-h-[40vh] overflow-y-auto no-scrollbar rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {lowStockProducts.map(product => {
              const currentStock = product.availableQty ?? product.totalQty ?? 0;
              const threshold = product.restockingConfig?.threshold !== undefined && product.restockingConfig?.threshold !== null 
                ? product.restockingConfig.threshold 
                : (product.reorderLevel || 10);
                
              return (
                <div key={product._id} className="p-4 flex items-center justify-between hover:bg-orange-50/30 transition-colors">
                  <div>
                    <h4 className="font-black text-gray-900">{product.name}</h4>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                      {product.productGroup?.name || "Uncategorized"}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Stock</p>
                      <p className="font-black text-rose-500">{currentStock} <span className="text-[10px]">{product.units}</span></p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Min</p>
                      <p className="font-black text-gray-600">{threshold}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 flex gap-4 border-t border-gray-100">
          <button
            onClick={() => setIsOpen(false)}
            className="flex-1 py-3 text-sm font-black text-gray-500 hover:text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-2xl transition-all uppercase tracking-widest"
          >
            Close
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              navigate("/branch/recycling"); // Or wherever restocking is
            }}
            className="flex-1 py-3 text-sm font-black text-white bg-orange-500 hover:bg-orange-600 rounded-2xl shadow-xl shadow-orange-500/20 transition-all uppercase tracking-widest hover:-translate-y-1"
          >
            Go to Restocking
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestockingAlertModal;
