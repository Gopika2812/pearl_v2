import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  FaCalendarAlt, FaSearch, FaFilter, FaSync, FaDownload, FaTags, FaBoxOpen, FaCalculator, FaTimes, FaEdit
} from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";

const BranchInventoryAging = () => {
  const { currentBranch } = useBranch();
  const { productGroups, productCategories } = useInventory();

  // Filters State
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [dateFilterType, setDateFilterType] = useState("none"); // "none" | "expiry" | "purchase"
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Data State
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Edit State
  const [editingRowKey, setEditingRowKey] = useState(null);
  const [editForm, setEditForm] = useState({ mrp: "", manufacturingDate: "", expiryDate: "" });

  const handleEditClick = (row) => {
    setEditForm({
      mrp: row.mrp || "",
      manufacturingDate: row.manufacturingDate ? new Date(row.manufacturingDate).toISOString().split("T")[0] : "",
      expiryDate: row.expiryDate ? new Date(row.expiryDate).toISOString().split("T")[0] : ""
    });
    setEditingRowKey(`${row.productId}_${row.batchNo}`);
  };

  const handleCancelEdit = () => {
    setEditingRowKey(null);
  };

  const handleSaveBatchEdit = async (row) => {
    try {
      const url = `${API_BASE}/products/${row.productId}/batches/${row.batchNo}`;
      const payload = {
        mrp: editForm.mrp,
        manufacturingDate: editForm.manufacturingDate || null,
        expiryDate: editForm.expiryDate || null
      };
      
      const res = await fetchWithAuth(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success(data.message || "Batch updated successfully");
        setEditingRowKey(null);
        fetchBatchInventory();
      } else {
        toast.error(data.message || "Failed to update batch");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating batch details");
    }
  };

  // Sorting State
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    } else if (sortConfig.key === key && sortConfig.direction === "desc") {
      key = null;
    }
    setSortConfig({ key, direction });
  };

  const renderSortIndicator = (key) => {
    if (sortConfig.key !== key) {
      return <span className="text-slate-300 ml-1 text-[8px] inline-block select-none">↕</span>;
    }
    return sortConfig.direction === "asc" ? (
      <span className="text-[#319bab] ml-1 text-[8px] inline-block select-none">▲</span>
    ) : (
      <span className="text-[#319bab] ml-1 text-[8px] inline-block select-none">▼</span>
    );
  };

  const getValueForSort = (row, key) => {
    if (key === "age") {
      return row.age === null || row.age === undefined ? Infinity : row.age;
    }
    if (key === "batchNo") {
      const num = parseInt(row.batchNo, 10);
      return isNaN(num) ? row.batchNo : num;
    }
    return row[key];
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return rows;

    return [...rows].sort((a, b) => {
      let valA = getValueForSort(a, sortConfig.key);
      let valB = getValueForSort(b, sortConfig.key);

      // Handle strings comparison case-insensitively
      if (typeof valA === "string" && typeof valB === "string") {
        return sortConfig.direction === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      if (valA === undefined || valA === null) valA = "";
      if (valB === undefined || valB === null) valB = "";

      if (valA < valB) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (valA > valB) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [rows, sortConfig]);

  // Fetch data from backend
  const fetchBatchInventory = async (page = 1) => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      let url = `${API_BASE}/products/batch-inventory?branchId=${currentBranch._id}&page=${page}&limit=100`;
      
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      if (selectedGroup) url += `&productGroupId=${selectedGroup}`;
      if (selectedCategory) url += `&productCategoryId=${selectedCategory}`;
      if (dateFilterType !== "none") {
        url += `&dateFilterType=${dateFilterType}`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
      }

      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (data.success) {
        setRows(data.data || []);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages);
          setTotalRecords(data.pagination.totalRecords);
        }
      } else {
        toast.error(data.message || "Failed to fetch inventory report");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error fetching batch inventory data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatchInventory(currentPage);
  }, [currentBranch?._id, selectedGroup, selectedCategory, dateFilterType, startDate, endDate, currentPage]);

  // Handle Search Input Enter or Manual Trigger
  const handleSearchKeyPress = (e) => {
    if (e.key === "Enter") {
      setCurrentPage(1);
      fetchBatchInventory(1);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearch("");
    setSelectedGroup("");
    setSelectedCategory("");
    setDateFilterType("none");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalQty = 0;
    let totalValuation = 0;
    
    rows.forEach(r => {
      totalQty += (r.closingQty || 0);
      totalValuation += (r.valuationPrice || 0);
    });

    return {
      totalBatches: rows.length,
      totalQty,
      totalValuation
    };
  }, [rows]);

  // Aging Badge Stylist
  const getAgeBadge = (age) => {
    if (age === null || age === undefined) {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold bg-slate-100 text-slate-500 rounded-full">
          No Expiry
        </span>
      );
    }
    if (age <= 0) {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100 rounded-full">
          Expired ({Math.abs(age)} days ago)
        </span>
      );
    }
    if (age <= 30) {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100 rounded-full animate-pulse">
          {age} days left (Urgent Alert)
        </span>
      );
    }
    if (age <= 60) {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100 rounded-full">
          {age} days left (Expiring soon)
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full">
        {age} days left (Fresh)
      </span>
    );
  };

  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // Helper to construct Excel sheet data row
  const formatRowForExcel = (r, index) => ({
    "S.No": index + 1,
    "Product Name": r.productName,
    "Product Group": r.productGroup,
    "Batch No": r.batchNo,
    "Mfg Date": r.batchNo === "0" ? "-" : (r.manufacturingDate ? new Date(r.manufacturingDate).toLocaleDateString("en-IN") : "-"),
    "Expiry Date": r.batchNo === "0" ? "-" : (r.expiryDate ? new Date(r.expiryDate).toLocaleDateString("en-IN") : "-"),
    "MRP (₹)": r.batchNo === "0" ? "-" : r.mrp,
    "Purchasing Rate (₹)": r.purchasingPrice,
    "Purchased Qty": r.batchNo === "0" ? "-" : r.purchasingQty,
    "Closing Qty": r.closingQty,
    "Stock Value (₹)": r.valuationPrice,
    "Age (Days Left)": r.batchNo === "0" ? "-" : (r.age !== null ? r.age : "No Expiry")
  });

  const fetchAllBatchInventory = async () => {
    if (!currentBranch?._id) return [];
    try {
      const url = `${API_BASE}/products/batch-inventory?branchId=${currentBranch._id}`;
      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (data.success) {
        return data.data || [];
      } else {
        toast.error(data.message || "Failed to fetch entire inventory");
        return [];
      }
    } catch (err) {
      console.error(err);
      toast.error("Error fetching entire inventory data");
      return [];
    }
  };

  // Export Filtered/Current View to Excel
  const handleExportCurrent = () => {
    if (rows.length === 0) {
      toast.warn("No data to export");
      return;
    }

    const exportData = rows.map((r, index) => formatRowForExcel(r, index));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Filtered_Inventory");

    worksheet["!cols"] = [
      { wch: 6 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }
    ];

    XLSX.writeFile(workbook, `Filtered_Inventory_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Filtered inventory exported successfully!");
  };

  // Export Entire Inventory to Excel
  const handleExportEntire = async () => {
    setLoading(true);
    const allRows = await fetchAllBatchInventory();
    setLoading(false);
    if (allRows.length === 0) {
      toast.warn("No data to export");
      return;
    }

    const exportData = allRows.map((r, index) => formatRowForExcel(r, index));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Entire_Inventory");

    worksheet["!cols"] = [
      { wch: 6 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }
    ];

    XLSX.writeFile(workbook, `Entire_Inventory_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Entire inventory exported successfully!");
  };

  // Export Group-Wise Inventory to Excel with separate tabs
  const handleExportGroupWise = async () => {
    setLoading(true);
    const allRows = await fetchAllBatchInventory();
    setLoading(false);
    if (allRows.length === 0) {
      toast.warn("No data to export");
      return;
    }

    // Group rows by productGroup
    const groupsMap = {};
    allRows.forEach(r => {
      const groupName = r.productGroup || "Uncategorized";
      if (!groupsMap[groupName]) {
        groupsMap[groupName] = [];
      }
      groupsMap[groupName].push(r);
    });

    const workbook = XLSX.utils.book_new();
    const usedNames = new Set();

    Object.keys(groupsMap).forEach(groupName => {
      const groupRows = groupsMap[groupName];
      const exportData = groupRows.map((r, index) => formatRowForExcel(r, index));
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Sanitize sheet name: max 31 chars, no special characters like \ / ? * [ ]
      let baseName = groupName.replace(/[\\\/\?\*\[\]]/g, "").substring(0, 25);
      if (!baseName.trim()) baseName = "Group";
      let sheetName = baseName;
      let counter = 1;
      while (usedNames.has(sheetName.toLowerCase())) {
        sheetName = `${baseName}_${counter}`;
        counter++;
      }
      usedNames.add(sheetName.toLowerCase());

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      worksheet["!cols"] = [
        { wch: 6 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }
      ];
    });

    XLSX.writeFile(workbook, `Group_Wise_Inventory_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Group-wise inventory exported successfully!");
  };

  // Shared CSS
  const labelClass = "text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block";
  const selectClass = "w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#319bab]/20 focus:border-[#319bab] transition-all";
  const inputClass = "w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#319bab]/20 focus:border-[#319bab] transition-all";

  return (
    <div className="min-h-screen bg-slate-50/50 pt-20 md:pt-6 md:pl-24 px-4 md:px-8 pb-12 font-sans">
      <div className="w-full px-4 md:px-6 py-6 space-y-6">
        
        {/* HEADER CARD */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-[#319bab]/10 p-4 rounded-2xl shadow-inner">
              <FaBoxOpen className="text-[#319bab] text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                Batch Stock Aging
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                Dynamic Batch Stock Tracking, MRP Valuation, and Expiry Aging Control
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => fetchBatchInventory(currentPage)}
              className="bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-50 active:scale-95 transition"
            >
              <FaSync className={loading ? "animate-spin text-[#319bab]" : ""} /> Refresh
            </button>

            <div className="relative">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="bg-[#319bab] text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-[#319bab]/20 hover:scale-[1.02] hover:bg-[#257d8a] active:scale-95 transition flex items-center gap-2"
              >
                <FaDownload size={12} /> Export Excel
              </button>

              {showExportDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowExportDropdown(false)}
                  ></div>

                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-20 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-slate-50">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Export Option</p>
                    </div>

                    <button
                      onClick={() => {
                        setShowExportDropdown(false);
                        handleExportCurrent();
                      }}
                      className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition"
                    >
                      <div className="bg-blue-50 text-blue-500 p-2 rounded-lg">
                        <FaFilter size={12} />
                      </div>
                      <div>
                        <p className="font-bold">Export Current View</p>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">Exports filtered table records</p>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowExportDropdown(false);
                        handleExportEntire();
                      }}
                      className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition"
                    >
                      <div className="bg-emerald-50 text-emerald-500 p-2 rounded-lg">
                        <FaBoxOpen size={12} />
                      </div>
                      <div>
                        <p className="font-bold">Export Entire Inventory</p>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">All products & batches (All time)</p>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowExportDropdown(false);
                        handleExportGroupWise();
                      }}
                      className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition"
                    >
                      <div className="bg-[#319bab]/10 text-[#319bab] p-2 rounded-lg">
                        <FaTags size={12} />
                      </div>
                      <div>
                        <p className="font-bold">Export Group-Wise Inventory</p>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">Separate tab/sheet per product group</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* FILTERS PANEL */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <FaFilter className="text-[#319bab]" /> Filter Inventory Records
            </h3>
            <button
              onClick={handleResetFilters}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase flex items-center gap-1"
            >
              <FaTimes /> Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search filter */}
            <div>
              <label className={labelClass}>Search Product</label>
              <div className="relative group">
                <FaSearch className="absolute left-3 top-3 text-slate-400 group-focus-within:text-[#319bab] transition-colors" size={12} />
                <input
                  type="text"
                  placeholder="Type product name and enter..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  className={`${inputClass} pl-9`}
                />
              </div>
            </div>

            {/* Product Group filter */}
            <div>
              <label className={labelClass}>Product Group</label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className={selectClass}
              >
                <option value="">All Groups</option>
                {productGroups.map(g => (
                  <option key={g._id} value={g._id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Product Category filter */}
            <div>
              <label className={labelClass}>Product Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={selectClass}
              >
                <option value="">All Categories</option>
                {productCategories.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Date filter Type */}
            <div>
              <label className={labelClass}>Date Filter Mode</label>
              <select
                value={dateFilterType}
                onChange={(e) => setDateFilterType(e.target.value)}
                className={selectClass}
              >
                <option value="none">No Date Filtration</option>
                <option value="expiry">Filter by Expiry Date</option>
                <option value="purchase">Filter by Purchase Date</option>
              </select>
            </div>
          </div>

          {/* Optional Date Range Sub-Panel */}
          {dateFilterType !== "none" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl animate-in slide-in-from-top-2 duration-200">
              <div>
                <label className={labelClass}>Start Date</label>
                <div className="relative">
                  <FaCalendarAlt className="absolute left-3 top-3 text-slate-400" size={12} />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>End Date</label>
                <div className="relative">
                  <FaCalendarAlt className="absolute left-3 top-3 text-slate-400" size={12} />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Batches Listed</p>
              <h3 className="text-2xl font-black text-slate-800">{metrics.totalBatches}</h3>
            </div>
            <div className="bg-blue-50 text-blue-500 p-3.5 rounded-2xl">
              <FaTags size={18} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Closing Stock</p>
              <h3 className="text-2xl font-black text-slate-800">{metrics.totalQty.toLocaleString()} Units</h3>
            </div>
            <div className="bg-emerald-50 text-emerald-500 p-3.5 rounded-2xl">
              <FaBoxOpen size={18} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between bg-gradient-to-br from-[#319bab]/5 to-transparent">
            <div>
              <p className="text-[10px] font-black text-[#319bab] uppercase tracking-widest mb-1">Stock Valuation (Purchasing Rate)</p>
              <h3 className="text-2xl font-black text-[#319bab]">₹{metrics.totalValuation.toLocaleString()}</h3>
            </div>
            <div className="bg-[#319bab]/10 text-[#319bab] p-3.5 rounded-2xl">
              <FaCalculator size={18} />
            </div>
          </div>
        </div>

        {/* MAIN DATA TABLE */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-20 text-center">
              <FaSync className="animate-spin text-4xl text-[#319bab] mx-auto mb-4 opacity-50" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Batch Stock Status...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-20 text-center text-slate-400">
              <p className="text-xs font-black uppercase tracking-widest">No stock batches found matching filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 uppercase text-[9px] font-black tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4 cursor-pointer select-none hover:bg-slate-100 transition duration-150" onClick={() => handleSort("productName")}>
                      Product Details {renderSortIndicator("productName")}
                    </th>
                    <th className="px-4 py-4 text-center cursor-pointer select-none hover:bg-slate-100 transition duration-150" onClick={() => handleSort("batchNo")}>
                      Batch No {renderSortIndicator("batchNo")}
                    </th>
                    <th className="px-4 py-4 text-center cursor-pointer select-none hover:bg-slate-100 transition duration-150" onClick={() => handleSort("manufacturingDate")}>
                      Mfg Date {renderSortIndicator("manufacturingDate")}
                    </th>
                    <th className="px-4 py-4 text-center cursor-pointer select-none hover:bg-slate-100 transition duration-150" onClick={() => handleSort("expiryDate")}>
                      Expiry Date {renderSortIndicator("expiryDate")}
                    </th>
                    <th className="px-4 py-4 text-right cursor-pointer select-none hover:bg-slate-100 transition duration-150" onClick={() => handleSort("mrp")}>
                      MRP (₹) {renderSortIndicator("mrp")}
                    </th>
                    <th className="px-4 py-4 text-center cursor-pointer select-none hover:bg-slate-100 transition duration-150" onClick={() => handleSort("purchasingQty")}>
                      Purchased Qty {renderSortIndicator("purchasingQty")}
                    </th>
                    <th className="px-4 py-4 text-center cursor-pointer select-none hover:bg-slate-100 transition duration-150" onClick={() => handleSort("closingQty")}>
                      Closing Qty {renderSortIndicator("closingQty")}
                    </th>
                    <th className="px-4 py-4 text-right cursor-pointer select-none hover:bg-slate-100 transition duration-150" onClick={() => handleSort("valuationPrice")}>
                      Valuation Value (₹) {renderSortIndicator("valuationPrice")}
                    </th>
                    <th className="px-6 py-4 text-center cursor-pointer select-none hover:bg-slate-100 transition duration-150" onClick={() => handleSort("age")}>
                      Batch Aging Status {renderSortIndicator("age")}
                    </th>
                    <th className="px-4 py-4 text-center select-none">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedRows.map((row, index) => {
                    const rowKey = `${row.productId}_${row.batchNo}`;
                    const isEditing = editingRowKey === rowKey;
                    return (
                    <tr key={index} className="hover:bg-slate-50/50 transition">
                      {/* Product details */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 text-sm">{row.productName}</div>
                        <div className="text-[9px] font-bold text-[#319bab] uppercase bg-[#319bab]/5 px-2 py-0.5 rounded inline-block mt-1">
                          Group: {row.productGroup}
                        </div>
                      </td>

                      {/* Batch number */}
                      <td className="px-4 py-4 text-center">
                        <span className="font-black bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-lg">
                          Batch {row.batchNo}
                        </span>
                      </td>

                      {/* Mfg Date */}
                      <td className="px-4 py-4 text-center font-bold text-slate-600">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editForm.manufacturingDate}
                            onChange={(e) => setEditForm({ ...editForm, manufacturingDate: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-[#319bab] transition-all"
                          />
                        ) : (
                          row.manufacturingDate 
                            ? new Date(row.manufacturingDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })
                            : "-"
                        )}
                      </td>

                      {/* Expiry Date */}
                      <td className="px-4 py-4 text-center font-bold text-slate-600">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editForm.expiryDate}
                            onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-[#319bab] transition-all"
                          />
                        ) : (
                          row.expiryDate 
                            ? new Date(row.expiryDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })
                            : "No Expiry"
                        )}
                      </td>

                      {/* MRP */}
                      <td className="px-4 py-4 text-right font-bold text-slate-700">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.mrp}
                            onChange={(e) => setEditForm({ ...editForm, mrp: e.target.value })}
                            className="w-20 bg-white border border-slate-200 rounded-lg py-1.5 px-2 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-[#319bab] transition-all text-right ml-auto"
                          />
                        ) : (
                          row.mrp ? `₹${Number(row.mrp).toFixed(2)}` : "-"
                        )}
                      </td>

                      {/* Purchased qty */}
                      <td className="px-4 py-4 text-center font-bold text-slate-500">
                        {row.batchNo === "0" ? "-" : row.purchasingQty.toLocaleString()}
                      </td>

                      {/* Closing qty */}
                      <td className="px-4 py-4 text-center font-black text-slate-800 text-sm">
                        {row.closingQty.toLocaleString()}
                      </td>

                      {/* Valuation Price */}
                      <td className="px-4 py-4 text-right font-black text-[#319bab]">
                        ₹{Number(row.valuationPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Expiry age status */}
                      <td className="px-6 py-4 text-center">
                        {getAgeBadge(row.age)}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-4 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSaveBatchEdit(row)}
                              className="bg-emerald-100 hover:bg-emerald-500 text-emerald-600 hover:text-white p-1.5 rounded-lg transition-colors shadow-sm"
                              title="Save"
                            >
                              <FaSync size={12} className={loading ? "animate-spin" : ""} />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="bg-rose-100 hover:bg-rose-500 text-rose-600 hover:text-white p-1.5 rounded-lg transition-colors shadow-sm"
                              title="Cancel"
                            >
                              <FaTimes size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditClick(row)}
                            className="bg-slate-100 hover:bg-[#319bab] text-slate-500 hover:text-white p-2 rounded-lg transition-colors shadow-sm"
                            title="Edit Batch"
                          >
                            <FaEdit size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PAGINATION UI */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mt-4">
            <span className="text-xs font-bold text-slate-500">
              Showing page <span className="text-[#319bab]">{currentPage}</span> of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#319bab] text-white hover:bg-[#257d8a] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default BranchInventoryAging;
