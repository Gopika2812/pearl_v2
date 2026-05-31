import React, { useEffect, useState } from "react";
import { FaSync, FaFilter, FaSearch, FaHistory, FaFileExport, FaSort, FaSortAmountDown, FaSortAmountUp, FaColumns, FaCheck, FaTimes } from "react-icons/fa";
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
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(500);

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

  // Column Selection for Export
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState([
    "date", "time", "invoiceNo", "voucher", "customer", "product", "group", 
    "purchasePrice", "sellingPrice", "qty", "gst", "discount", "margin", "profit"
  ]);

  const columnsConfig = [
    { id: "date", label: "Date", getValue: r => new Date(r.date).toLocaleDateString() },
    { id: "time", label: "Time", getValue: r => r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { id: "invoiceNo", label: "Invoice No", getValue: r => r.invoiceNumber },
    { id: "voucher", label: "Voucher", getValue: r => r.voucherType, permission: "voucher" },
    { id: "customer", label: "Customer", getValue: r => r.customerName || "Walk-in" },
    { id: "product", label: "Product", getValue: r => r.productName },
    { id: "group", label: "Group", getValue: r => r.productGroupName || "No Group" },
    { id: "purchasePrice", label: "Purchase Price", getValue: r => r.purchasingPrice?.toFixed(2), permission: "purchasePrice" },
    { id: "sellingPrice", label: "Selling Price", getValue: r => r.sellingPrice?.toFixed(2), permission: "sellingPrice" },
    { id: "qty", label: "Qty", getValue: r => r.qty, permission: "qty" },
    { id: "gst", label: "GST %", getValue: r => r.gst, permission: "gst" },
    { id: "discount", label: "Discount/Unit", getValue: r => r.discountPerUnit?.toFixed(2), permission: "discount" },
    { id: "margin", label: "Profit %", getValue: r => r.profitPercent?.toFixed(1) + "%", permission: "margin" },
    { id: "profit", label: "Gross Profit", getValue: r => (r.grossProfit * r.qty).toFixed(2), permission: "profit" }
  ];

  // Initialize selected columns based on permissions
  useEffect(() => {
    const allowed = columnsConfig
      .filter(col => !col.permission || isFieldAllowed(col.permission))
      .map(col => col.id);
    setSelectedExportColumns(allowed);
  }, [user]);

  const fetchHistory = async () => {
    if (!currentBranch?._id) return;

    setLoading(true);
    try {
      let url = `${API_BASE}/invoices/history?branchId=${currentBranch._id}&page=${currentPage}&limit=${limit}&sortKey=${sortConfig.key}&sortDirection=${sortConfig.direction}`;
      if (fromDate) url += `&fromDate=${fromDate}`;
      if (toDate) url += `&toDate=${toDate}`;
      if (selectedProductGroupId) url += `&productGroupId=${selectedProductGroupId}`;
      if (selectedProductId) url += `&productId=${selectedProductId}`;
      if (selectedCustomerId) url += `&customerId=${selectedCustomerId}`;

      const res = await fetchWithAuth(url);
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to fetch history");

      setRecords(data.history || []);
      setTotalRecords(data.total || 0);
    } catch (err) {
      console.error("Error fetching history:", err);
      toast.error(err.message || "Failed to fetch sales history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [currentBranch?._id, selectedProductId, selectedCustomerId, fromDate, toDate, selectedProductGroupId, currentPage, sortConfig]);

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setSelectedProductGroupId("");
    setSelectedProductId("");
    setSelectedCustomerId("");
    setCurrentPage(1);
  };

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const sortedRecords = records; // Server-side sorted now

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort className="inline ml-1 text-gray-300" />;
    return sortConfig.direction === 'asc' 
      ? <FaSortAmountUp className="inline ml-1 text-[#319bab]" /> 
      : <FaSortAmountDown className="inline ml-1 text-[#319bab]" />;
  };

  // Calculate total profit for the current view
  const totalProfit = records.reduce((sum, r) => sum + (r.grossProfit * r.qty), 0);
  const totalQty = records.reduce((sum, r) => sum + (r.qty || 0), 0);

  const handleExportExcel = async () => {
    try {
      if (totalRecords === 0) {
        toast.info("No records to export.");
        return;
      }

      setLoading(true);
      toast.info("Preparing complete export data...");

      // Fetch ALL records for the current filter (no limit)
      let url = `${API_BASE}/invoices/history?branchId=${currentBranch._id}&page=1&limit=${totalRecords}&sortKey=${sortConfig.key}&sortDirection=${sortConfig.direction}`;
      if (fromDate) url += `&fromDate=${fromDate}`;
      if (toDate) url += `&toDate=${toDate}`;
      if (selectedProductGroupId) url += `&productGroupId=${selectedProductGroupId}`;
      if (selectedProductId) url += `&productId=${selectedProductId}`;
      if (selectedCustomerId) url += `&customerId=${selectedCustomerId}`;

      const res = await fetchWithAuth(url);
      const data = await res.json();
      
      if (!res.ok) throw new Error("Failed to fetch all records for export");
      
      const allRecords = data.history || [];

      // Create detailed export data
      const exportData = allRecords.map(r => {
        const row = {};
        columnsConfig.forEach(col => {
          if (selectedExportColumns.includes(col.id)) {
            row[col.label] = col.getValue(r);
          }
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Product Transaction Records");

      // Auto-width adjustment
      const wscols = [
        { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, 
        { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 8 }, 
        { wch: 8 }, { wch: 15 }, { wch: 10 }, { wch: 15 }
      ];
      worksheet['!cols'] = wscols;

      const groupName = selectedProductGroupId 
        ? productGroups.find(g => g._id === selectedProductGroupId)?.name 
        : "AllGroups";

      const fileName = `ProductAnalysis_${groupName}_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      toast.success("Full analysis exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export Excel");
    } finally {
      setLoading(false);
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowColumnSelector(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 text-sm shadow-sm"
                  title="Select Columns for Export"
                >
                  <FaColumns /> Columns
                </button>
                <button 
                  onClick={handleExportExcel}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 text-sm shadow-sm"
                >
                  <FaFileExport /> Export Excel
                </button>
              </div>
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
                    <span className="text-xl font-black text-[#319bab]">{totalRecords}</span>
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
                      {selectedProductId ? "Item Detailed Record" : "Global Branch Records"}
                    </span>
                    <span className="text-[10px] text-[#319bab] font-bold">Showing {records.length} of {totalRecords} Entries</span>
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
                                      {r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="text-[9px] text-gray-400 font-bold">{r.invoiceNumber} | {new Date(r.date).toLocaleDateString()}</div>
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
                  
                  {/* PAGINATION CONTROLS */}
                  {totalRecords > limit && (
                    <div className="flex items-center justify-between px-6 py-4 bg-gray-50/30 border-t border-gray-100">
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Page {currentPage} of {Math.ceil(totalRecords / limit)}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1 || loading}
                          className="px-4 py-2 rounded-lg bg-white border border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, Math.ceil(totalRecords / limit)) }, (_, i) => {
                            const totalPages = Math.ceil(totalRecords / limit);
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else {
                              if (currentPage <= 3) pageNum = i + 1;
                              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                              else pageNum = currentPage - 2 + i;
                            }
                            
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${
                                  currentPage === pageNum 
                                  ? 'bg-[#319bab] text-white shadow-md' 
                                  : 'bg-white text-gray-400 border border-gray-50 hover:bg-gray-50'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalRecords / limit), prev + 1))}
                          disabled={currentPage === Math.ceil(totalRecords / limit) || loading}
                          className="px-4 py-2 rounded-lg bg-white border border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            </div>
          </div>
        </div>
      </div>
      {/* Column Selection Modal */}
      {showColumnSelector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                  <FaColumns className="text-[#319bab]" /> Select Export Columns
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Choose fields for Excel analysis</p>
              </div>
              <button 
                onClick={() => setShowColumnSelector(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const allAllowed = columnsConfig
                        .filter(col => !col.permission || isFieldAllowed(col.permission))
                        .map(col => col.id);
                      setSelectedExportColumns(allAllowed);
                    }}
                    className="px-3 py-1.5 bg-[#319bab]/10 text-[#319bab] text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[#319bab]/20 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedExportColumns([])}
                    className="px-3 py-1.5 bg-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {selectedExportColumns.length} Fields Selected
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {columnsConfig.map(col => {
                  const isAllowed = !col.permission || isFieldAllowed(col.permission);
                  if (!isAllowed) return null;
                  
                  return (
                    <label 
                      key={col.id} 
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer group ${
                        selectedExportColumns.includes(col.id) 
                          ? 'border-[#319bab]/50 bg-[#319bab]/5 text-[#319bab] shadow-sm' 
                          : 'border-gray-50 bg-gray-50 text-gray-500 hover:border-gray-200'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        selectedExportColumns.includes(col.id)
                          ? 'bg-[#319bab] border-[#319bab]'
                          : 'bg-white border-gray-300 group-hover:border-[#319bab]/30'
                      }`}>
                        {selectedExportColumns.includes(col.id) && <FaCheck className="text-white text-[10px]" />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={selectedExportColumns.includes(col.id)}
                        onChange={() => {
                          if (selectedExportColumns.includes(col.id)) {
                            setSelectedExportColumns(prev => prev.filter(f => f !== col.id));
                          } else {
                            setSelectedExportColumns(prev => [...prev, col.id]);
                          }
                        }}
                      />
                      <span className="text-xs font-bold">
                        {col.label}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setShowColumnSelector(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-all font-black uppercase tracking-widest text-[11px]"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowColumnSelector(false);
                    handleExportExcel();
                  }}
                  disabled={selectedExportColumns.length === 0}
                  className="flex-1 px-6 py-3 bg-[#319bab] hover:bg-[#257f87] disabled:bg-gray-300 text-white rounded-xl transition-all font-black uppercase tracking-widest text-[11px] shadow-lg shadow-[#319bab]/20"
                >
                  Export Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchProductRecords;
