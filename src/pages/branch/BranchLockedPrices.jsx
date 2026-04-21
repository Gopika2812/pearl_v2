import React, { useState, useEffect, useRef } from "react";
import { FaLock, FaSync, FaSearch, FaUser, FaBox, FaTrash, FaPlus, FaCheckCircle, FaChevronDown, FaUpload } from "react-icons/fa";
import { toast } from "react-toastify";
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
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [custSearch, setCustSearch] = useState("");
  const [prodSearch, setProdSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [lockedPrice, setLockedPrice] = useState("");
  const [isLocked, setIsLocked] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [searchingCust, setSearchingCust] = useState(false);
  const [searchingProd, setSearchingProd] = useState(false);
  const [prodResults, setProdResults] = useState([]);
  const fileInputRef = useRef(null);

  // Filtration & Pagination State
  const [filters, setFilters] = useState({
    product: "",
    customer: "",
  });
  const [sortField, setSortField] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState(-1);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    if (currentBranch?._id) {
      fetchCustomers();
    }
  }, [currentBranch?._id]);

  useEffect(() => {
    fetchLockedPrices();
  }, [currentBranch?._id, page, sortField, sortOrder, filters.product, filters.customer]);

  // 🔒 AUTO-LOOKUP EXISTING PRICE
  useEffect(() => {
    const fetchExistingPrice = async () => {
      if (!selectedCustomer?._id || !selectedProduct?._id || !currentBranch?._id) return;
      
      try {
        const res = await fetch(`${API_BASE}/customer-locked-prices/${selectedCustomer._id}/${selectedProduct._id}?branchId=${currentBranch._id}`);
        const data = await res.json();
        
        if (data.success && data.data?.lockedPrice) {
          setLockedPrice(data.data.lockedPrice.toString());
          console.log(`🔒 Auto-filled Existing Locked Price: ${data.data.lockedPrice}`);
        } else {
          setLockedPrice(""); // No existing price, let them set a new one
        }
      } catch (err) {
        console.warn("Existing price lookup failed (likely no record yet)");
        setLockedPrice("");
      }
    };

    fetchExistingPrice();
  }, [selectedCustomer?._id, selectedProduct?._id, currentBranch?._id]);

  // 🔍 DEBOUNCED CUSTOMER SEARCH
  useEffect(() => {
    const searchCustomers = async () => {
      if (!custSearch.trim() || selectedCustomer) {
        if (!custSearch.trim() && !selectedCustomer) fetchCustomers(); // Reset to default list if search is empty and nothing selected
        return;
      }
      
      setSearchingCust(true);
      try {
        const res = await fetch(`${API_BASE}/customers?branchId=${currentBranch._id}&search=${custSearch}&limit=20`);
        const data = await res.json();
        setCustomers(data.data || []);
      } catch (err) {
        console.error("Search Customers Error:", err);
      } finally {
        setSearchingCust(false);
      }
    };

    const timer = setTimeout(searchCustomers, 500);
    return () => clearTimeout(timer);
  }, [custSearch, currentBranch?._id]);

  // 🔍 DEBOUNCED PRODUCT SEARCH
  useEffect(() => {
    const searchProducts = async () => {
      if (!prodSearch.trim() || selectedProduct) {
        // setProdResults([]); // Clear results if not searching
        return;
      }
      
      setSearchingProd(true);
      try {
        const res = await fetch(`${API_BASE}/products?branchId=${currentBranch._id}&search=${prodSearch}&limit=20`);
        const data = await res.json();
        setProdResults(data.data || []);
      } catch (err) {
        console.error("Search Products Error:", err);
      } finally {
        setSearchingProd(false);
      }
    };

    const timer = setTimeout(searchProducts, 500);
    return () => clearTimeout(timer);
  }, [prodSearch, currentBranch?._id]);

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
      let url = `${API_BASE}/customer-locked-prices/branch/${currentBranch._id}?page=${page}&limit=50&sortField=${sortField}&sortOrder=${sortOrder}`;
      if (filters.product) url += `&productName=${encodeURIComponent(filters.product)}`;
      if (filters.customer) url += `&customerName=${encodeURIComponent(filters.customer)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      if (data.success) {
        setLockedPrices(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalRecords(data.pagination?.totalRecords || 0);
      } else {
        throw new Error(data.message || "Failed to fetch");
      }
    } catch (err) {
      console.error("Fetch Locked Prices Error:", err);
      toast.error("Failed to fetch locked prices");
    } finally {
      setLoading(false);
      setSelectedIds([]); // Clear selection on new fetch
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === lockedPrices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(lockedPrices.map(lp => lp._id));
    }
  };

  const toggleSelectRow = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(i => i !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to remove ${selectedIds.length} locked prices?`)) return;

    setBulkDeleting(true);
    try {
      const resp = await fetch(`${API_BASE}/customer-locked-prices/bulk-delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds })
      });
      const data = await resp.json();
      if (data.success) {
        toast.success(data.message);
        setSelectedIds([]);
        fetchLockedPrices();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      toast.error(err.message || "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 1 ? -1 : 1);
    } else {
      setSortField(field);
      setSortOrder(1);
    }
    setPage(1); // Reset to first page on sort
  };

  const handleSave = async () => {
    if (!selectedCustomer?._id || !selectedProduct?._id || !lockedPrice) {
      return toast.warn("Please select customer, product, and set a price");
    }

    setSaving(true);
    try {
      const resp = await fetch(`${API_BASE}/customer-locked-prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: currentBranch._id,
          customerId: selectedCustomer._id,
          productId: selectedProduct._id,
          lockedPrice: Number(lockedPrice),
        }),
      });

      const data = await resp.json();
      if (data.success) {
        toast.success("Price locked successfully");
        fetchLockedPrices();
        // Reset form (keep customer for multiple products if wanted, or clear)
        setSelectedProduct(null);
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

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("branchId", currentBranch._id);

    setBulkLoading(true);
    try {
      const res = await fetch(`${API_BASE}/customer-locked-prices/bulk-upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchLockedPrices();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      console.error("Bulk Upload Error:", err);
      toast.error(err.message || "Bulk upload failed");
    } finally {
      setBulkLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Dropdown options: If searching, use searching state results. Otherwise use initial fetch results.
  const displayCustomers = customers.slice(0, 50);
  const displayProducts = prodSearch.trim() && prodResults.length > 0 ? prodResults : products.slice(0, 50);

  // Auto-calculate margin
  const margin = selectedProduct ? (Number(lockedPrice || selectedProduct.sellingPrice) - selectedProduct.purchasingPrice) : 0;
  const marginPercent = selectedProduct && selectedProduct.purchasingPrice > 0 
    ? (margin / selectedProduct.purchasingPrice) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full px-3 sm:px-6 py-4">


        {/* HEADER */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-3 rounded-lg">
              <FaLock className="text-orange-600 text-xl" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 uppercase tracking-tight">Locked Price Records</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500 font-semibold tracking-wider uppercase">Customer-Specific Pricing Rules</p>
                <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-200 uppercase animate-pulse">Dynamic Sync Active</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleBulkUpload} 
              accept=".xlsx, .xls" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={bulkLoading}
              className="flex items-center gap-2 text-xs font-black uppercase bg-[#319bab] text-white hover:bg-[#257f87] px-4 py-2 rounded-lg transition shadow-sm"
            >
              <FaUpload className={bulkLoading ? "animate-spin" : ""} />
              {bulkLoading ? "Processing..." : "Bulk Upload"}
            </button>
            <button 
              onClick={fetchLockedPrices}
              className="flex items-center gap-2 text-xs font-black uppercase text-[#319bab] hover:bg-[#319bab]/5 px-4 py-2 rounded-lg transition"
            >
              <FaSync className={loading ? "animate-spin" : ""} /> Refresh List
            </button>
          </div>
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
                        if(selectedCustomer) setSelectedCustomer(null);
                      }}
                      onFocus={() => {
                        setShowCustomerDropdown(true);
                        if (!custSearch.trim()) fetchCustomers(); // Refresh on focus
                      }}
                      className="w-full pl-9 pr-10 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-[#319bab]/30 transition-all shadow-inner"
                    />
                    {selectedCustomer && (
                      <button 
                        onClick={() => { setSelectedCustomer(null); setCustSearch(""); }}
                        className="absolute right-8 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 p-1"
                      >
                        <FaTrash size={10} />
                      </button>
                    )}
                    <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={10} />
                  </div>
                  {showCustomerDropdown && (
                    <div 
                      className="absolute z-20 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200"
                      onMouseLeave={() => setShowCustomerDropdown(false)}
                    >
                      {searchingCust ? (
                        <div className="p-4 text-center text-gray-400 text-[10px] font-black uppercase flex items-center justify-center gap-2">
                          <FaSync className="animate-spin text-[#319bab]" /> Searching Database...
                        </div>
                      ) : displayCustomers.length > 0 ? displayCustomers.map(c => (
                        <div 
                          key={c._id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustSearch("");
                            setShowCustomerDropdown(false);
                          }}
                          className="px-4 py-3 text-xs hover:bg-[#319bab]/5 cursor-pointer border-b border-gray-50 flex items-center justify-between group"
                        >
                          <span className="font-bold text-gray-700 group-hover:text-[#319bab] transition-colors">{c.name}</span>
                          <span className="text-[9px] text-gray-400 font-black">{c.whatsapp || "No Phone"}</span>
                        </div>
                      )) : (
                        <div className="p-4 text-center text-gray-400 text-[10px] font-black uppercase">
                          No customers found
                        </div>
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
                        if(selectedProduct) setSelectedProduct(null);
                      }}
                      onFocus={() => setShowProductDropdown(true)}
                      className="w-full pl-9 pr-10 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-[#319bab]/30 transition-all shadow-inner"
                    />
                    {selectedProduct && (
                      <button 
                        onClick={() => { setSelectedProduct(null); setProdSearch(""); }}
                        className="absolute right-8 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 p-1"
                      >
                        <FaTrash size={10} />
                      </button>
                    )}
                    <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={10} />
                  </div>
                  {showProductDropdown && (
                    <div 
                      className="absolute z-20 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200"
                      onMouseLeave={() => setShowProductDropdown(false)}
                    >
                      {searchingProd ? (
                        <div className="p-4 text-center text-gray-400 text-[10px] font-black uppercase flex items-center justify-center gap-2">
                          <FaSync className="animate-spin text-[#319bab]" /> Searching Database...
                        </div>
                      ) : displayProducts.length > 0 ? displayProducts.map(p => (
                        <div 
                          key={p._id}
                          onClick={() => {
                            setSelectedProduct(p);
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
                        <div className="p-4 text-center text-gray-400 text-[10px] font-black uppercase">
                          No products found
                        </div>
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
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Active Locked Prices</span>
                  {selectedIds.length > 0 && (
                    <button 
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      className="flex items-center gap-2 text-[10px] font-black uppercase bg-red-500 text-white hover:bg-red-600 px-3 py-1.5 rounded-lg transition shadow-sm animate-in fade-in slide-in-from-left-2"
                    >
                      {bulkDeleting ? <FaSync className="animate-spin" /> : <FaTrash />}
                      Delete Selected ({selectedIds.length})
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-[#319bab] font-bold">Showing {lockedPrices.length} records</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
                      <th className="px-6 py-5 text-center">
                        <input 
                          type="checkbox"
                          checked={lockedPrices.length > 0 && selectedIds.length === lockedPrices.length}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 accent-[#319bab] cursor-pointer"
                        />
                      </th>
                      <th 
                        className="px-6 py-5 cursor-pointer hover:bg-slate-100 transition-colors group"
                        onClick={() => handleSort("productName")}
                      >
                        <div className="flex items-center gap-2">
                           Product Info
                           {sortField === "productName" && (sortOrder === 1 ? <FaChevronDown className="rotate-180" /> : <FaChevronDown />)}
                           {!sortField === "productName" && <FaChevronDown className="opacity-0 group-hover:opacity-30" />}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-5 cursor-pointer hover:bg-slate-100 transition-colors group"
                        onClick={() => handleSort("customerName")}
                      >
                        <div className="flex items-center gap-2">
                           Customer
                           {sortField === "customerName" && (sortOrder === 1 ? <FaChevronDown className="rotate-180" /> : <FaChevronDown />)}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-5 text-right cursor-pointer hover:bg-slate-100 transition-colors group"
                        onClick={() => handleSort("purchasingPrice")}
                      >
                         <div className="flex items-center justify-end gap-2">
                            Cost
                            {sortField === "purchasingPrice" && (sortOrder === 1 ? <FaChevronDown className="rotate-180" /> : <FaChevronDown />)}
                         </div>
                      </th>
                      <th 
                        className="px-6 py-5 text-right cursor-pointer hover:bg-slate-100 transition-colors group"
                        onClick={() => handleSort("sellingPrice")}
                      >
                        <div className="flex items-center justify-end gap-2">
                           Std. Price
                           {sortField === "sellingPrice" && (sortOrder === 1 ? <FaChevronDown className="rotate-180" /> : <FaChevronDown />)}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-5 text-right text-orange-600 cursor-pointer hover:bg-slate-100 transition-colors group"
                        onClick={() => handleSort("lockedPrice")}
                      >
                        <div className="flex items-center justify-end gap-2">
                           Locked ₹
                           {sortField === "lockedPrice" && (sortOrder === 1 ? <FaChevronDown className="rotate-180" /> : <FaChevronDown />)}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-5 text-right cursor-pointer hover:bg-slate-100 transition-colors group"
                        onClick={() => handleSort("marginPercent")}
                      >
                        <div className="flex items-center justify-end gap-2">
                           Margin %
                           {sortField === "marginPercent" && (sortOrder === 1 ? <FaChevronDown className="rotate-180" /> : <FaChevronDown />)}
                        </div>
                      </th>
                      <th className="px-6 py-5 text-center">Action</th>
                    </tr>
                    <tr className="bg-white border-b border-slate-50">
                      <th className="px-4 py-3 bg-slate-50/10"></th>
                      <th className="px-4 py-3">
                        <div className="relative">
                          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                          <input 
                            type="text"
                            placeholder="Find Product..."
                            value={filters.product}
                            onChange={(e) => setFilters({ ...filters, product: e.target.value })}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none focus:bg-white focus:border-[#319bab]/40 transition-all"
                          />
                        </div>
                      </th>
                      <th className="px-4 py-3">
                        <div className="relative">
                          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                          <input 
                            type="text"
                            placeholder="Find Customer..."
                            value={filters.customer}
                            onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none focus:bg-white focus:border-[#319bab]/40 transition-all"
                          />
                        </div>
                      </th>
                      <th colSpan="5"></th>
                    </tr>
                  </thead>
                   <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-20 text-center">
                          <FaSync className="animate-spin text-[#319bab] mx-auto mb-2" size={32} />
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Optimizing Data Stream...</p>
                        </td>
                      </tr>
                    ) : lockedPrices.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-20 text-center">
                          <div className="opacity-20 flex flex-col items-center">
                             <FaSearch size={48} className="mb-3 text-slate-300" />
                             <p className="text-sm font-black uppercase text-slate-400 tracking-tighter">No Locked Records Found</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      lockedPrices.map(lp => {
                        const productName = lp.productId?.name || "Unknown Product";
                        const customerName = lp.customerId?.name || "Unknown Customer";
                        const purchasingPrice = lp.productId?.purchasingPrice || 0;
                        const sellingPrice = lp.productId?.sellingPrice || 0;
                        const mp = lp.marginPercent || 0;

                        return (
                          <tr key={lp._id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.includes(lp._id) ? 'bg-indigo-50/50' : ''}`}>
                            <td className="px-6 py-5 text-center">
                               <input 
                                 type="checkbox" 
                                 checked={selectedIds.includes(lp._id)}
                                 onChange={() => toggleSelectRow(lp._id)}
                                 className="w-4 h-4 accent-[#319bab] cursor-pointer"
                               />
                            </td>
                            <td className="px-6 py-5">
                              <div className="font-black text-slate-800 text-sm leading-tight">{productName}</div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">Ref: {lp._id.substring(18).toUpperCase()}</div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="font-black text-[#319bab] text-sm">{customerName}</div>
                            </td>
                            <td className="px-6 py-5 text-right font-bold text-slate-400 text-xs">
                              ₹{purchasingPrice.toFixed(2)}
                            </td>
                            <td className="px-6 py-5 text-right font-black text-slate-700 text-sm">
                              ₹{sellingPrice.toFixed(2)}
                            </td>
                             <td className="px-6 py-5 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <div className="bg-orange-50 text-orange-700 font-black px-3 py-1.5 rounded-lg border border-orange-100 inline-block text-sm shadow-sm">
                                  ₹{lp.lockedPrice?.toFixed(2)}
                                </div>
                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-1.5 rounded">Linked to Cost</span>
                              </div>
                            </td>
                            <td className={`px-6 py-5 text-right text-sm font-black ${mp >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {mp.toFixed(1)}%
                            </td>
                            <td className="px-6 py-5 text-center">
                              <button 
                                onClick={() => handleDelete(lp._id)}
                                className="text-slate-300 hover:text-red-500 p-2 transition-all hover:bg-red-50 rounded-lg"
                              >
                                <FaTrash size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION FOOTER */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                    Total Records: {totalRecords}
                 </div>
                 <div className="flex items-center gap-3">
                    <button 
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 disabled:opacity-50 transition shadow-sm"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-black text-slate-600">PAGE {page} OF {totalPages}</span>
                    <button 
                      disabled={page === totalPages}
                      onClick={() => setPage(page + 1)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 disabled:opacity-50 transition shadow-sm"
                    >
                      Next
                    </button>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchLockedPrices;
