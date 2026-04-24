import React, { useEffect, useState } from "react";
import { FaSync, FaFilter, FaSearch, FaHistory, FaFileExport, FaSort, FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";
import * as XLSX from 'xlsx';
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";

const BranchProductRecords = () => {
  const { currentBranch, user } = useBranch();
  const { productGroups, products, customers } = useInventory();
  const [analysisMode, setAnalysisMode] = useState("product"); // 'product' or 'customer'

  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
    const key = `product-records_${fieldId}`;
    return user.fieldPermissions?.[key] !== false;
  };
  
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedProductGroupId, setSelectedProductGroupId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  const fetchHistory = async () => {
    if (!currentBranch?._id) return;

    setLoading(true);
    try {
      let url = `${API_BASE}/sales-orders/history?branchId=${currentBranch._id}`;
      if (fromDate) url += `&fromDate=${fromDate}`;
      if (toDate) url += `&toDate=${toDate}`;
      if (selectedProductGroupId) url += `&productGroupId=${selectedProductGroupId}`;
      if (selectedProductId) url += `&productId=${selectedProductId}`;
      if (selectedCustomerId) url += `&customerId=${selectedCustomerId}`;

      const res = await fetchWithAuth(url);
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to fetch history");

      setRecords(data || []);
    } catch (err) {
      console.error("Error fetching history:", err);
      toast.error(err.message || "Failed to fetch sales history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [currentBranch?._id, selectedProductId, selectedCustomerId, fromDate, toDate, selectedProductGroupId]);

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setSelectedProductGroupId("");
    setSelectedProductId("");
    setSelectedCustomerId("");
  };

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedRecords = [...records].sort((a, b) => {
    let aVal, bVal;

    switch (sortConfig.key) {
      case 'date': aVal = new Date(a.date); bVal = new Date(b.date); break;
      case 'customer': aVal = a.customerName || ""; bVal = b.customerName || ""; break;
      case 'product': aVal = a.productName || ""; bVal = b.productName || ""; break;
      case 'purchase': aVal = a.purchasingPrice || 0; bVal = b.purchasingPrice || 0; break;
      case 'selling': aVal = a.sellingPrice || 0; bVal = b.sellingPrice || 0; break;
      case 'qty': aVal = a.qty || 0; bVal = b.qty || 0; break;
      case 'gst': aVal = a.gst || 0; bVal = b.gst || 0; break;
      case 'discount': aVal = a.discount || 0; bVal = b.discount || 0; break;
      case 'profitPercent': 
        aVal = a.purchasingPrice > 0 ? (a.grossProfit / a.purchasingPrice) : 0;
        bVal = b.purchasingPrice > 0 ? (b.grossProfit / b.purchasingPrice) : 0;
        break;
      case 'profitCash': aVal = a.grossProfit || 0; bVal = b.grossProfit || 0; break;
      default: return 0;
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort className="inline ml-1 text-gray-300" />;
    return sortConfig.direction === 'asc' 
      ? <FaSortAmountUp className="inline ml-1 text-[#319bab]" /> 
      : <FaSortAmountDown className="inline ml-1 text-[#319bab]" />;
  };

  // Calculate total profit for the current view
  const totalProfit = records.reduce((sum, r) => sum + (r.grossProfit * r.qty), 0);
  const totalQty = records.reduce((sum, r) => sum + (r.qty || 0), 0);

  const handleExportExcel = () => {
    try {
      if (records.length === 0) {
        toast.info("No records to export. Please adjust filters or select a product.");
        return;
      }

      // Group records by product name and sum their quantities
      const productSummary = records.reduce((acc, record) => {
        const name = record.productName || "Unknown Product";
        if (!acc[name]) {
          acc[name] = { "Name": name, "Total Qty": 0 };
        }
        acc[name]["Total Qty"] += (record.qty || 0);
        return acc;
      }, {});

      const exportData = Object.values(productSummary);

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Product Records");

      // Auto-width adjustment
      const wscols = [
        { wch: 40 }, // Name
        { wch: 15 }  // Total Qty
      ];
      worksheet['!cols'] = wscols;

      const fileName = selectedProductId 
        ? `ProductRecord_${records[0]?.productName || 'Export'}_${new Date().toLocaleDateString()}.xlsx`
        : `All_ProductRecords_${new Date().toLocaleDateString()}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      toast.success("Excel exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export Excel");
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
    (!selectedProductGroupId || String(p.productGroup?._id || p.productGroup) === String(selectedProductGroupId))
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full px-3 sm:px-6 py-4">

        
        {/* HEADER */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#319bab]/10 p-3 rounded-lg">
              <FaHistory className="text-[#319bab] text-xl" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 uppercase tracking-tight">Product Records</h1>
              <p className="text-xs text-gray-500 font-semibold tracking-wider uppercase">Selling History & Profit Analysis</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 p-1 rounded-xl mr-2">
              <button
                onClick={() => {
                  setAnalysisMode("product");
                  handleReset();
                }}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${analysisMode === "product" ? "bg-white text-[#319bab] shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
              >
                Product Wise
              </button>
              <button
                onClick={() => {
                  setAnalysisMode("customer");
                  handleReset();
                }}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${analysisMode === "customer" ? "bg-white text-[#319bab] shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
              >
                Customer Wise
              </button>
            </div>
            {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.actionPermissions?.export !== false) && (
              <button 
                onClick={handleExportExcel}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 text-sm shadow-sm"
              >
                <FaFileExport /> Export Excel
              </button>
            )}
            <button 
              onClick={fetchHistory}
              disabled={loading}
              className="bg-[#319bab] hover:bg-[#257f87] text-white px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 text-sm shadow-sm"
            >
              <FaSync className={loading ? "animate-spin" : ""} />
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT SIDE: PRODUCT LIST */}
          <div className="lg:w-1/4 space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-fit">
              
              {analysisMode === "product" ? (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Product Groups</label>
                      <span className="text-[9px] bg-teal-50 px-2 py-0.5 rounded-full font-bold text-[#319bab]">{productGroups.length} Groups</span>
                    </div>
                    <div className="relative mb-2">
                      <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={10} />
                      <input 
                        type="text"
                        placeholder="Search groups..."
                        value={groupSearch}
                        onChange={(e) => setGroupSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none focus:border-[#319bab] transition"
                      />
                    </div>
                    <div className="space-y-1 max-h-[25vh] overflow-y-auto pr-1 custom-scrollbar">
                      <div 
                        onClick={() => setSelectedProductGroupId("")}
                        className={`p-2 rounded-lg cursor-pointer transition-all border text-center text-[10px] font-black uppercase tracking-widest ${
                          selectedProductGroupId === "" 
                            ? 'bg-[#319bab] border-[#319bab] text-white shadow-sm' 
                            : 'bg-gray-50 border-gray-50 text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        All Groups
                      </div>
                      {productGroups.filter(g => g.name.toLowerCase().includes(groupSearch.toLowerCase())).map(g => (
                        <div 
                          key={g._id}
                          onClick={() => setSelectedProductGroupId(g._id === selectedProductGroupId ? "" : g._id)}
                          className={`p-2 rounded-lg cursor-pointer transition-all border ${
                            selectedProductGroupId === g._id 
                              ? 'bg-[#319bab] border-[#319bab] text-white shadow-md' 
                              : 'bg-white border-gray-50 hover:border-[#319bab]/30 hover:bg-gray-50 text-gray-700 font-bold text-xs'
                          }`}
                        >
                          {g.name}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Search Product</label>
                      <span className="text-[9px] font-black text-[#319bab]">
                        {selectedProductGroupId 
                          ? `${products.filter(p => p.productGroup?._id === selectedProductGroupId).length} in Group`
                          : `${products.length} Total`
                        }
                      </span>
                    </div>
                    <div className="relative mb-3">
                      <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                      <input 
                        type="text"
                        placeholder={selectedProductGroupId ? "Search in this group..." : "Search all products..."}
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none focus:border-[#319bab] transition"
                      />
                    </div>

                    <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                      {filteredProducts.map(p => (
                        <div 
                          key={p._id}
                          onClick={() => setSelectedProductId(p._id === selectedProductId ? "" : p._id)}
                          className={`p-3 rounded-lg cursor-pointer transition-all border ${
                            selectedProductId === p._id 
                              ? 'bg-[#319bab] border-[#319bab] text-white shadow-md' 
                              : 'bg-white border-gray-50 hover:border-[#319bab]/30 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div className="font-bold text-xs truncate">{p.name}</div>
                          <div className={`text-[9px] uppercase font-black ${selectedProductId === p._id ? 'text-indigo-100' : 'text-gray-400'}`}>
                            {p.productGroup?.name || "No Group"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Search Customer</label>
                      <span className="text-[9px] bg-indigo-50 px-2 py-0.5 rounded-full font-bold text-indigo-600">{customers.length} Total</span>
                    </div>
                    <div className="relative mb-3">
                      <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                      <input 
                        type="text"
                        placeholder="Filter customers..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none focus:border-indigo-600 transition shadow-sm"
                      />
                    </div>
                    
                    <div className="space-y-1 max-h-[35vh] overflow-y-auto pr-1 custom-scrollbar">
                      {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (
                        <div 
                          key={c._id}
                          onClick={() => setSelectedCustomerId(c._id === selectedCustomerId ? "" : c._id)}
                          className={`p-3 rounded-lg cursor-pointer transition-all border ${
                            selectedCustomerId === c._id 
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                              : 'bg-white border-gray-50 hover:border-indigo-100 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div className="font-bold text-xs truncate">{c.name}</div>
                          <div className={`text-[9px] uppercase font-black ${selectedCustomerId === c._id ? 'text-indigo-100' : 'text-gray-400'}`}>
                            {c.whatsapp || "No Contact"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Search Product (Optional)</label>
                      <span className="text-[9px] font-black text-indigo-600">{products.length} Items</span>
                    </div>
                    <div className="relative mb-3">
                      <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                      <input 
                        type="text"
                        placeholder="Filter products..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none focus:border-indigo-600 transition"
                      />
                    </div>
                    
                    <div className="space-y-1 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                      <div 
                        onClick={() => setSelectedProductId("")}
                        className={`p-2 rounded-lg cursor-pointer transition-all border text-center text-[10px] font-black uppercase tracking-widest ${
                          selectedProductId === "" 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                            : 'bg-gray-50 border-gray-50 text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        All Products
                      </div>
                      {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                        <div 
                          key={p._id}
                          onClick={() => setSelectedProductId(p._id === selectedProductId ? "" : p._id)}
                          className={`p-2 rounded-lg cursor-pointer transition-all border ${
                            selectedProductId === p._id 
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                              : 'bg-white border-gray-50 hover:border-indigo-100 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div className="font-bold text-[11px] truncate">{p.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT SIDE: TRANSACTION RECORD */}
          <div className="lg:w-3/4 space-y-6">
            {/* DATE FILTERS */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <div className="space-y-1">
                  <label>Start Period</label>
                  <input 
                    type="date" 
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-gray-700 outline-none focus:border-[#319bab] transition text-xs"
                  />
                </div>
                
                <div className="space-y-1">
                  <label>End Period</label>
                  <input 
                    type="date" 
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-gray-700 outline-none focus:border-[#319bab] transition text-xs"
                  />
                </div>

                <div className="flex gap-2 h-[34px]">
                  <button 
                    onClick={handleReset}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-black transition text-[10px] uppercase tracking-widest"
                  >
                    Reset Filter
                  </button>
                </div>
              </div>
            </div>

            {/* SUMMARY CARDS & DATA TABLE */}
            <div className="space-y-6">
              <>
                {/* SUMMARY CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Transactions</span>
                    <span className="text-xl font-black text-[#319bab]">{records.length}</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Qty</span>
                    <span className="text-xl font-black text-gray-800">{totalQty}</span>
                  </div>
                  {isFieldAllowed("profit") && (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gross Profit</span>
                      <span className={`text-xl font-black ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        ₹{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {isFieldAllowed("margin") && (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avg. Profit %</span>
                      <span className="text-xl font-black text-[#319bab]">
                        {records.length > 0 
                          ? (records.reduce((s, r) => s + ((r.grossProfit / (r.purchasingPrice || 1)) * 100), 0) / records.length).toFixed(1)
                          : "0.0"}%
                      </span>
                    </div>
                  )}
                </div>

                {/* DATA TABLE */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
                      {selectedProductId ? "Item Detailed Record" : "Global Branch Records (Last 500)"}
                    </span>
                    <span className="text-[10px] text-[#319bab] font-bold">Showing {records.length} Entries</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50/50 text-gray-500 font-black uppercase text-[9px] tracking-widest border-b border-gray-100">
                          {isFieldAllowed("voucher") && (
                            <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('date')}>
                              Voucher / Time {getSortIcon('date')}
                            </th>
                          )}
                          <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('customer')}>
                            Customer {getSortIcon('customer')}
                          </th>
                          <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('product')}>
                            Product Name {getSortIcon('product')}
                          </th>
                          {isFieldAllowed("purchasePrice") && (
                            <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('purchase')}>
                              Purchase ₹ {getSortIcon('purchase')}
                            </th>
                          )}
                          {isFieldAllowed("sellingPrice") && (
                            <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('selling')}>
                              Selling ₹ {getSortIcon('selling')}
                            </th>
                          )}
                          {isFieldAllowed("qty") && (
                            <th className="px-4 py-3 text-center cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('qty')}>
                              Qty {getSortIcon('qty')}
                            </th>
                          )}
                          {isFieldAllowed("gst") && (
                            <th className="px-4 py-3 text-center cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('gst')}>
                              GST % {getSortIcon('gst')}
                            </th>
                          )}
                          {isFieldAllowed("discount") && (
                            <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('discount')}>
                              Discount {getSortIcon('discount')}
                            </th>
                          )}
                          {isFieldAllowed("margin") && (
                            <th className="px-4 py-3 text-right font-black cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('profitPercent')}>
                              Profit (%) {getSortIcon('profitPercent')}
                            </th>
                          )}
                          {isFieldAllowed("profit") && (
                            <th className="px-4 py-3 text-right font-black cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('profitCash')}>
                              Profit (₹) {getSortIcon('profitCash')}
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {loading ? (
                          <tr>
                            <td colSpan="11" className="px-6 py-20 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <FaSync className="animate-spin text-[#319bab]" size={24} />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fetching Transaction Data...</span>
                              </div>
                            </td>
                          </tr>
                        ) : sortedRecords.length > 0 ? (
                          sortedRecords.map((r, i) => {
                            const margin = (r.sellingPrice || 0) - (r.purchasingPrice || 0);
                            const profitPercent = r.purchasingPrice > 0 ? (r.grossProfit / r.purchasingPrice) * 100 : 0;
                            return (
                              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                {isFieldAllowed("voucher") && (
                                  <td className="px-4 py-3">
                                    <div className="font-bold text-gray-700 text-xs">{r.voucherType}</div>
                                    <div className="text-[9px] text-gray-500 font-bold">
                                      {new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="text-[9px] text-gray-400 font-bold">{r.invoiceId} | {new Date(r.date).toLocaleDateString()}</div>
                                  </td>
                                )}
                                <td className="px-4 py-3">
                                  <div className="font-bold text-gray-700 text-[11px] truncate w-32" title={r.customerName || "Walk-in"}>
                                    {r.customerName || "Walk-in"}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-gray-700 text-[11px] truncate w-40" title={r.productName}>
                                    {r.productName}
                                  </div>
                                </td>
                                {isFieldAllowed("purchasePrice") && (
                                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                                    ₹{r.purchasingPrice?.toFixed(2)}
                                  </td>
                                )}
                                {isFieldAllowed("sellingPrice") && (
                                  <td className="px-4 py-3 text-right font-bold text-gray-800 text-xs">
                                    ₹{r.sellingPrice?.toFixed(2)}
                                  </td>
                                )}
                                {isFieldAllowed("qty") && (
                                  <td className="px-4 py-3 text-center font-black text-gray-700 text-xs">
                                    {r.qty}
                                  </td>
                                )}
                                {isFieldAllowed("gst") && (
                                  <td className="px-4 py-3 text-center text-gray-500 text-xs">
                                    {r.gst}%
                                  </td>
                                )}
                                {isFieldAllowed("discount") && (
                                  <td className="px-4 py-3 text-right text-red-500 font-bold text-xs">
                                    -₹{r.discountPerUnit?.toFixed(2)}
                                  </td>
                                )}
                                {isFieldAllowed("margin") && (
                                  <td className={`px-4 py-3 text-right text-xs font-black ${profitPercent >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {profitPercent.toFixed(1)}%
                                  </td>
                                )}
                                {isFieldAllowed("profit") && (
                                  <td className={`px-4 py-3 text-right font-black text-xs ${r.grossProfit * r.qty >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                    ₹{(r.grossProfit * r.qty).toFixed(2)}
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="11" className="px-6 py-20 text-center text-gray-400">
                              <FaHistory size={32} className="mx-auto mb-2 opacity-20" />
                              <p className="text-[10px] font-black uppercase tracking-widest">No transactions found for selected period</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchProductRecords;
