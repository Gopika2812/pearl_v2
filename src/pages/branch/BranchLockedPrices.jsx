import React, { useState, useEffect } from "react";
import { FaLock, FaSync, FaSearch, FaUser, FaBox, FaTrash, FaPlus, FaCheckCircle, FaChevronDown } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";

const BranchLockedPrices = () => {
  const { currentBranch } = useBranch();
  const { products } = useInventory();
  
  const [customers, setCustomers] = useState([]);
  const [lockedPrices, setLockedPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [custSearch, setCustSearch] = useState("");
  const [prodSearch, setProdSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [lockedPrice, setLockedPrice] = useState("");
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    if (currentBranch?._id) {
      fetchCustomers();
      fetchLockedPrices();
    }
  }, [currentBranch?._id]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_BASE}/customers?branchId=${currentBranch._id}`);
      const data = await res.json();
      // customerRoutes.js returns { success: true, data: [...] }
      setCustomers(data.data || []);
    } catch (err) {
      console.error("Fetch Customers Error:", err);
    }
  };

  const fetchLockedPrices = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      console.log("🔍 Fetching Locked Prices for Branch:", currentBranch._id);
      const res = await fetch(`${API_BASE}/customer-locked-prices/branch/${currentBranch._id}`);
      const data = await res.json();
      if (data.success) {
        setLockedPrices(data.data || []);
        console.log(`✅ Fetched ${data.data?.length || 0} locked prices`);
      } else {
        throw new Error(data.message || "Failed to fetch");
      }
    } catch (err) {
      console.error("Fetch Locked Prices Error:", err);
      toast.error("Failed to fetch locked prices");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCustomerId || !selectedProductId || !lockedPrice) {
      return toast.warn("Please select customer, product, and set a price");
    }

    setSaving(true);
    try {
      const resp = await fetch(`${API_BASE}/customer-locked-prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: currentBranch._id,
          customerId: selectedCustomerId,
          productId: selectedProductId,
          lockedPrice: Number(lockedPrice),
        }),
      });

      const data = await resp.json();
      if (data.success) {
        toast.success("Price locked successfully");
        fetchLockedPrices();
        // Reset form
        setSelectedProductId("");
        setLockedPrice("");
        setProdSearch("");
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save locked price");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to remove this locked price?")) return;
    
    try {
      // Assuming a delete route exists or using the POST with lockedPrice: 0 logic if needed
      // But we should ideally have a DELETE route. For now, let's assume we can delete.
      const resp = await fetch(`${API_BASE}/customer-locked-prices/${id}`, { method: "DELETE" });
      if (resp.ok) {
        toast.success("Locked price removed");
        fetchLockedPrices();
      }
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const selectedProduct = products.find(p => p._id === selectedProductId);
  const selectedCustomer = customers.find(c => c._id === selectedCustomerId);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(custSearch.toLowerCase())
  ).slice(0, 50);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(prodSearch.toLowerCase())
  ).slice(0, 50);

  // Auto-calculate margin
  const margin = selectedProduct ? (Number(lockedPrice || selectedProduct.sellingPrice) - selectedProduct.purchasingPrice) : 0;
  const marginPercent = selectedProduct && selectedProduct.purchasingPrice > 0 
    ? (margin / selectedProduct.purchasingPrice) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full px-3 sm:px-6 py-4">
        <ToastContainer />

        {/* HEADER */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-3 rounded-lg">
              <FaLock className="text-orange-600 text-xl" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 uppercase tracking-tight">Locked Price Records</h1>
              <p className="text-xs text-gray-500 font-semibold tracking-wider uppercase">Customer-Specific Pricing Rules</p>
            </div>
          </div>
          <button 
            onClick={fetchLockedPrices}
            className="flex items-center gap-2 text-xs font-black uppercase text-[#319bab] hover:bg-[#319bab]/5 px-4 py-2 rounded-lg transition"
          >
            <FaSync className={loading ? "animate-spin" : ""} /> Refresh List
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* CREATE FORM */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-6">
                <FaPlus className="text-[#319bab]" />
                <h2 className="font-black text-xs uppercase tracking-widest text-gray-700">Create Lock Price</h2>
              </div>

              <div className="space-y-4">
                {/* CUSTOMER SEARCH */}
                <div className="relative">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block underline decoration-[#319bab]/20 offset-2">Select Customer</label>
                  <div className="relative group">
                    <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-[#319bab] group-focus-within:text-blue-500 transition-colors" size={12} />
                    <input 
                      type="text"
                      placeholder="Search customer name..."
                      value={selectedCustomer ? selectedCustomer.name : custSearch}
                      onChange={(e) => {
                        setCustSearch(e.target.value);
                        if(selectedCustomer) setSelectedCustomerId("");
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      className="w-full pl-9 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-[#319bab]/30 transition-all shadow-inner"
                    />
                    <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={10} />
                  </div>
                  {showCustomerDropdown && (custSearch || !selectedCustomerId) && (
                    <div className="absolute z-20 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                      {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                        <div 
                          key={c._id}
                          onClick={() => {
                            setSelectedCustomerId(c._id);
                            setCustSearch("");
                            setShowCustomerDropdown(false);
                          }}
                          className="px-4 py-3 text-xs hover:bg-[#319bab]/5 cursor-pointer border-b border-gray-50 flex items-center justify-between group"
                        >
                          <span className="font-bold text-gray-700 group-hover:text-[#319bab] transition-colors">{c.name}</span>
                          <span className="text-[9px] text-gray-400 font-black">{c.whatsapp || "No Phone"}</span>
                        </div>
                      )) : (
                        <div className="p-4 text-center text-gray-400 text-[10px] font-black uppercase">No customers found</div>
                      )}
                    </div>
                  )}
                </div>

                {/* PRODUCT SEARCH */}
                <div className="relative">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block underline decoration-[#319bab]/20 offset-2">Select Product</label>
                  <div className="relative group">
                    <FaBox className="absolute left-3 top-1/2 -translate-y-1/2 text-[#319bab] group-focus-within:text-blue-500 transition-colors" size={12} />
                    <input 
                      type="text"
                      placeholder="Search product name..."
                      value={selectedProduct ? selectedProduct.name : prodSearch}
                      onChange={(e) => {
                        setProdSearch(e.target.value);
                        if(selectedProduct) setSelectedProductId("");
                      }}
                      onFocus={() => setShowProductDropdown(true)}
                      className="w-full pl-9 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-[#319bab]/30 transition-all shadow-inner"
                    />
                    <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={10} />
                  </div>
                  {showProductDropdown && (prodSearch || !selectedProductId) && (
                    <div className="absolute z-20 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                      {filteredProducts.length > 0 ? filteredProducts.map(p => (
                        <div 
                          key={p._id}
                          onClick={() => {
                            setSelectedProductId(p._id);
                            setProdSearch("");
                            setShowProductDropdown(false);
                            setLockedPrice(""); // Reset price to let them enter new one or see default
                          }}
                          className="px-4 py-3 text-xs hover:bg-[#319bab]/5 cursor-pointer border-b border-gray-50 flex items-center justify-between group"
                        >
                          <span className="font-bold text-gray-700 group-hover:text-[#319bab] transition-colors">{p.name}</span>
                          <div className="text-right">
                            <div className="text-[9px] text-gray-400 font-black">STOCK: {p.totalQty}</div>
                            <div className="text-[9px] text-[#319bab] font-black">₹{p.sellingPrice}</div>
                          </div>
                        </div>
                      )) : (
                        <div className="p-4 text-center text-gray-400 text-[10px] font-black uppercase">No products found</div>
                      )}
                    </div>
                  )}
                </div>

                {/* AUTO FIELDS */}
                <div className="grid grid-cols-3 gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 h-full w-1 bg-[#319bab]/20"></div>
                  <div>
                    <span className="text-[9px] font-black text-gray-400 uppercase block mb-1">Current Cost</span>
                    <span className="font-black text-gray-700 text-sm">₹{selectedProduct?.purchasingPrice?.toFixed(2) || "0.00"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-gray-400 uppercase block mb-1">Standard Selling</span>
                    <span className="font-black text-gray-700 text-sm">₹{selectedProduct?.sellingPrice?.toFixed(2) || "0.00"}</span>
                  </div>
                  <div className="text-right border-l pl-2 border-gray-200">
                    <span className="text-[9px] font-black text-gray-400 uppercase block mb-1">Curr. Margin</span>
                    <span className="font-black text-[#319bab] text-sm">
                      {selectedProduct && selectedProduct.purchasingPrice > 0 
                        ? (((selectedProduct.sellingPrice - selectedProduct.purchasingPrice) / selectedProduct.purchasingPrice) * 100).toFixed(1)
                        : "0.0"}%
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Locked Price (₹)</label>
                  <input 
                    type="number"
                    value={lockedPrice}
                    onChange={(e) => setLockedPrice(e.target.value)}
                    placeholder="Enter special price..."
                    className="w-full px-4 py-2 bg-white border-2 border-[#319bab]/20 rounded-lg text-sm font-black text-[#319bab] outline-none focus:border-[#319bab] transition"
                  />
                </div>

                <div className="flex items-center justify-between p-3 border border-orange-100 bg-orange-50/30 rounded-lg">
                   <div className="flex items-center gap-2">
                     <input 
                      type="checkbox" 
                      checked={isLocked} 
                      onChange={(e) => setIsLocked(e.target.checked)}
                      className="accent-orange-500"
                     />
                     <span className="text-xs font-black text-orange-600 uppercase tracking-tight">Locked Price</span>
                   </div>
                   <div className="text-right">
                     <span className="text-[9px] font-black text-gray-400 uppercase block">Margin</span>
                     <span className={`text-xs font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                       {marginPercent.toFixed(1)}%
                     </span>
                   </div>
                </div>

                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-3 bg-[#319bab] hover:bg-[#257f87] text-white rounded-lg font-black transition flex items-center justify-center gap-2 shadow-md shadow-[#319bab]/20 uppercase tracking-widest text-xs"
                >
                  {saving ? <FaSync className="animate-spin" /> : <FaLock />}
                  {saving ? "Saving..." : "Save Lock Price"}
                </button>
              </div>
            </div>
          </div>

          {/* RECORD LIST */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-full">
              <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Active Locked Prices</span>
                <span className="text-[10px] text-[#319bab] font-bold">Showing {lockedPrices.length} records</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 font-black uppercase text-[9px] tracking-widest border-b border-gray-100">
                      <th className="px-6 py-4">Product Info</th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4 text-right">Cost</th>
                      <th className="px-6 py-4 text-right">Std. Price</th>
                      <th className="px-6 py-4 text-right text-orange-600">Locked ₹</th>
                      <th className="px-6 py-4 text-right">Margin %</th>
                      <th className="px-6 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-20 text-center">
                          <FaSync className="animate-spin text-[#319bab] mx-auto mb-2" size={24} />
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Fetching records...</p>
                        </td>
                      </tr>
                    ) : lockedPrices.length > 0 ? (
                      lockedPrices.map(lp => {
                        const productName = lp.productId?.name || "Unknown Product";
                        const customerName = lp.customerId?.name || "Unknown Customer";
                        const purchasingPrice = lp.productId?.purchasingPrice || 0;
                        const sellingPrice = lp.productId?.sellingPrice || 0;
                        
                        const m = (lp.lockedPrice || 0) - purchasingPrice;
                        const mp = purchasingPrice > 0 ? (m / purchasingPrice) * 100 : 0;
                        return (
                          <tr key={lp._id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-gray-800 text-xs">{productName}</div>
                              <div className="text-[9px] text-gray-400 font-bold italic">Source: Direct/SalesOrder</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-[#319bab] text-xs">{customerName}</div>
                            </td>
                            <td className="px-6 py-4 text-right text-gray-400 text-[10px] font-black italic">
                              ₹{purchasingPrice.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right text-gray-500 text-xs font-bold">
                              ₹{sellingPrice.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="bg-orange-50 text-orange-700 font-black px-2 py-1 rounded border border-orange-100 inline-block text-xs">
                                ₹{lp.lockedPrice?.toFixed(2)}
                              </div>
                            </td>
                            <td className={`px-6 py-4 text-right text-xs font-black ${mp >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {mp.toFixed(1)}%
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button 
                                onClick={() => handleDelete(lp._id)}
                                className="text-red-400 hover:text-red-600 p-2 transition"
                              >
                                <FaTrash size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-6 py-20 text-center">
                          <div className="opacity-20 flex flex-col items-center">
                             <FaLock size={40} className="mb-2" />
                             <p className="text-xs font-black uppercase">No locked prices found</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchLockedPrices;
