import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  FaBookOpen, FaChartBar, FaSearch, FaFilter, FaArrowLeft,
  FaChevronRight, FaCalendarAlt, FaSync, FaChartLine, FaDownload, FaUpload
} from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";
import StockSummaryExportModal from "../../components/branch/StockSummaryExportModal";

const BranchStockSummary = () => {
  const { currentBranch } = useBranch();
  const { productGroups } = useInventory();

  // View States: 'GROUPS' | 'ITEMS' | 'LEDGER'
  const [viewLevel, setViewLevel] = useState("GROUPS");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Date Filter
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First of the month
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Data
  const [stockData, setStockData] = useState([]); // Level 1 & 2
  const [ledgerData, setLedgerData] = useState({ transactions: [], openingBalance: 0 }); // Level 3
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [isAllItemsExport, setIsAllItemsExport] = useState(false);
  const [exportItemsData, setExportItemsData] = useState([]);
  const [isExportLoading, setIsExportLoading] = useState(false);

  // Fetch Group/Item Summary
  const fetchStockSummary = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      if (viewLevel === "GROUPS") {
        // 1. Fetch High-Speed Group Summary
        const res = await fetchWithAuth(
          `${API_BASE}/products/stock-group-summary?branchId=${currentBranch._id}&startDate=${fromDate}&endDate=${toDate}`
        );
        const data = await res.json();

        if (data.success) {
          setStockData(data.data || {});
        } else {
          toast.error(data.message || "Failed to fetch group summary");
        }
      } else if (viewLevel === "ITEMS") {
        // 2. Fetch Detailed Items for SELECTED GROUP ONLY
        const groupId = selectedGroup?._id || "all";
        const res = await fetchWithAuth(
          `${API_BASE}/products/stock-journal?branchId=${currentBranch._id}&startDate=${fromDate}&endDate=${toDate}&productGroupId=${groupId}`
        );
        const data = await res.json();

        if (data.success) {
          setStockData(data.data || []);
        } else {
          toast.error(data.message || "Failed to fetch item data");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error fetching stock summary");
    } finally {
      setLoading(false);
    }
  };

  // Optimized Unified Product Ledger (Lean Mode)
  const fetchProductLedger = async (productId) => {
    setLoading(true);
    try {
      const url = `${API_BASE}/products/${productId}/ledger?branchId=${currentBranch?._id}&fromDate=${fromDate}&toDate=${toDate}`;
      const response = await fetchWithAuth(url);
      const result = await response.json();

      if (result.success) {
        setLedgerData({
          transactions: result.data.map(txn => ({ ...txn, date: new Date(txn.date) })),
          openingBalance: result.openingBalance || 0
        });
      } else {
        throw new Error(result.message || "Failed to fetch ledger");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to build product ledger");
    } finally {
      setLoading(false);
    }
  };

  const handleExportSnapshot = async () => {
    try {
      setLoading(true);
      const url = `${API_BASE}/products/export/snapshot-mar31?branchId=${currentBranch?._id}`;
      const response = await fetchWithAuth(url);
      const result = await response.json();

      if (!result.success) throw new Error(result.message || "Export failed");

      const worksheet = XLSX.utils.json_to_sheet(result.data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Stock_March_31");

      // Auto-width adjustment
      const wscols = [
        { wch: 35 }, // Name
        { wch: 15 }, // HSN
        { wch: 10 }, // Unit
        { wch: 20 }  // Qty
      ];
      worksheet['!cols'] = wscols;

      XLSX.writeFile(workbook, `Stock_Snapshot_31Mar2026.xlsx`);
      toast.success("Inventory snapshot exported successfully!");
    } catch (error) {
      console.error("Snapshot error:", error);
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportSnapshot = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("branchId", currentBranch._id);
    formData.append("skipExisting", "false");

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/products/bulk-upload`, {
        method: "POST",
        headers: {
          // Note: fetch with FormData should not have Content-Type header set manually
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`Updated ${result.updatedCount} products for 31st March snapshot!`);
        fetchStockSummary(); // Refresh the list
      } else {
        throw new Error(result.message || "Upload failed");
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setLoading(false);
      // Reset file input
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (viewLevel === "LEDGER" && selectedProduct) {
      fetchProductLedger(selectedProduct.id);
    } else {
      fetchStockSummary();
    }
  }, [currentBranch?._id, fromDate, toDate, viewLevel, selectedProduct]);

  // Handle View Change (Reset Search)
  const changeView = (newLevel, group = null, product = null) => {
    setViewLevel(newLevel);
    setSelectedGroup(group);
    setSelectedProduct(product);
    setSearchQuery(""); // Reset search on drill-down/up
    setIsAllItemsExport(false); // Reset export mode
  };

  // Calculations for Level 1 (Groups)
  const groupAggregates = React.useMemo(() => {
    if (viewLevel !== "GROUPS" || Array.isArray(stockData)) return [];

    const aggregates = [];
    productGroups.forEach(g => {
      const stats = stockData[g._id] || { inwards: 0, outwards: 0, closingQty: 0, closingValue: 0 };
      aggregates.push({
        id: g._id,
        name: g.name,
        ...stats
      });
    });

    // Handle Uncategorized
    if (stockData["uncategorized"]) {
      aggregates.push({
        id: "uncategorized",
        name: "Uncategorized",
        ...stockData["uncategorized"]
      });
    }

    return aggregates;
  }, [stockData, productGroups, viewLevel]);

  // Filtered Group Aggregates (Search)
  const filteredGroupAggregates = React.useMemo(() => {
    if (!searchQuery) return groupAggregates;
    return groupAggregates.filter(agg =>
      agg.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [groupAggregates, searchQuery]);

  // Filtered Stock Items (Search)
  const filteredStockItems = React.useMemo(() => {
    if (!Array.isArray(stockData)) return [];
    if (!searchQuery) return stockData;
    return stockData.filter(item =>
      item.productName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [stockData, searchQuery]);

  // Filtered Ledger Data (Search)
  const filteredLedgerData = React.useMemo(() => {
    const txns = ledgerData?.transactions || [];
    if (!searchQuery) return txns;
    return txns.filter(txn =>
      txn.particulars.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.voucherType.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [ledgerData, searchQuery]);

  // Total Summary Stats
  const totalStats = React.useMemo(() => {
    if (viewLevel === "GROUPS" && !Array.isArray(stockData)) {
      return Object.values(stockData).reduce((acc, stats) => ({
        inwards: acc.inwards + (stats.inwards || 0),
        outwards: acc.outwards + (stats.outwards || 0),
        valuation: acc.valuation + (stats.closingValue || 0)
      }), { inwards: 0, outwards: 0, valuation: 0 });
    }

    const items = Array.isArray(stockData) ? stockData : [];
    return items.reduce((acc, item) => ({
      inwards: acc.inwards + (item.purchasesInPeriod || 0),
      outwards: acc.outwards + (item.salesInPeriod || 0),
      valuation: acc.valuation + (item.closing?.amount || 0)
    }), { inwards: 0, outwards: 0, valuation: 0 });
  }, [stockData, viewLevel]);

  let runningBalance = 0;

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-6 md:pl-24 px-4 md:px-8 pb-12 font-sans">
      <ToastContainer position="top-right" autoClose={2000} theme="colored" />

      {/* HEADER SECTION */}
      <div className="w-full px-4 md:px-6 py-6 space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-secondary/10 p-4 rounded-2xl shadow-inner">
              <FaBookOpen className="text-secondary text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-3">
                Stock Summary
                {viewLevel !== "GROUPS" && (
                  <>
                    <FaChevronRight className="text-gray-300 text-sm" />
                    <span className="text-secondary">{selectedGroup?.name}</span>
                  </>
                )}
                {viewLevel === "LEDGER" && (
                  <>
                    <FaChevronRight className="text-gray-300 text-sm" />
                    <span className="text-orange-500">{selectedProduct?.name}</span>
                  </>
                )}
              </h1>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                Inventory Movement & Valuation
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* BREADCRUMBS / NAVIGATION */}
            {viewLevel !== "GROUPS" && (
              <button
                onClick={() => setViewLevel(viewLevel === "ITEMS" ? "GROUPS" : "ITEMS")}
                className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition"
              >
                <FaArrowLeft /> Back
              </button>
            )}

            <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
              <div className="flex items-center px-3 border-r border-gray-200">
                <FaCalendarAlt className="text-gray-400 text-sm mr-2" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-gray-600 outline-none"
                />
              </div>
              <div className="flex items-center px-3">
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-gray-600 outline-none"
                />
              </div>
            </div>

            <button
              onClick={viewLevel === "LEDGER" ? () => fetchProductLedger(selectedProduct.id) : fetchStockSummary}
              className="bg-secondary text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-secondary/20 hover:scale-[1.02] transition active:scale-95 flex items-center gap-2"
            >
              <FaSync className={loading ? "animate-spin" : ""} /> Refresh
            </button>

            <button
              onClick={async () => {
                if (!window.confirm("CRITICAL: This will force ALL 'Available Qty' to match your 31st March Anchor + April Trades. Proceed?")) return;
                setLoading(true);
                try {
                  const res = await fetchWithAuth(`${API_BASE}/products/reconcile-stock`, {
                    method: "POST",
                    body: JSON.stringify({ branchId: currentBranch._id })
                  });
                  const result = await res.json();
                  if (result.success) {
                    toast.success(result.message);
                    fetchStockSummary();
                  } else {
                    throw new Error(result.message);
                  }
                } catch (err) {
                  toast.error(err.message || "Sync failed");
                } finally {
                  setLoading(false);
                }
              }}
              className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-200 hover:bg-orange-600 transition flex items-center gap-2"
            >
              <FaSync className={loading ? "animate-spin" : ""} /> Sync Live Stock
            </button>

            <button
              onClick={handleExportSnapshot}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <FaDownload size={14} /> 31st Mar Snapshot
            </button>

            {/* Hidden File Input for Import */}
            <input
              type="file"
              id="snapshot-import-input"
              className="hidden"
              accept=".xlsx, .xls"
              onChange={handleImportSnapshot}
            />
            <button
              onClick={() => document.getElementById('snapshot-import-input').click()}
              className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition flex items-center gap-2"
            >
              <FaUpload size={14} /> Import 31st Mar Stock
            </button>

            <button
              onClick={() => setShowExportModal(true)}
              className="bg-white text-secondary border-2 border-secondary px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-secondary/5 transition flex items-center gap-2"
            >
              <FaDownload size={14} /> {viewLevel === "GROUPS" ? "Export Groups" : "Export"}
            </button>

            {viewLevel === "GROUPS" && (
              <button
                disabled={isExportLoading}
                onClick={async () => {
                  try {
                    setIsExportLoading(true);
                    const res = await fetchWithAuth(
                      `${API_BASE}/products/stock-journal?branchId=${currentBranch._id}&startDate=${fromDate}&endDate=${toDate}&productGroupId=all`
                    );
                    const result = await res.json();
                    if (result.success) {
                      setExportItemsData(result.data || []);
                      setIsAllItemsExport(true);
                      setShowExportModal(true);
                    } else {
                      toast.error("Failed to fetch all items for export");
                    }
                  } catch (err) {
                    console.error(err);
                    toast.error("Error preparing export data");
                  } finally {
                    setIsExportLoading(false);
                  }
                }}
                className="bg-secondary/10 text-secondary border-2 border-secondary/20 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-secondary/20 transition flex items-center gap-2"
              >
                {isExportLoading ? <FaSync className="animate-spin" /> : <FaDownload size={14} />} 
                Export All Items
              </button>
            )}
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <FaSearch className="group-focus-within:text-secondary transition-colors" />
            </div>
            <input
              type="text"
              placeholder={`Search for ${viewLevel === "GROUPS" ? "Stock Group" : viewLevel === "ITEMS" ? "Product Name" : "Voucher/Particulars"}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
            />
          </div>

          {/* Add dynamic count in search if useful */}
          {searchQuery && (
            <span className="text-[10px] font-black text-gray-400 uppercase bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
              Found {viewLevel === "GROUPS" ? filteredGroupAggregates.length : viewLevel === "ITEMS" ? filteredStockItems.length : filteredLedgerData.length} Results
            </span>
          )}
        </div>

        {/* SUMMARY CARDS (Top Level Only) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{viewLevel === "GROUPS" ? "Active Groups" : "Items in Group"}</p>
            <h3 className="text-2xl font-black text-gray-800">
              {viewLevel === "GROUPS" ? filteredGroupAggregates.length : filteredStockItems.length}
            </h3>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Inwards (Period)</p>
            <h3 className="text-2xl font-black text-green-600">{totalStats.inwards}</h3>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Outwards (Period)</p>
            <h3 className="text-2xl font-black text-red-500">{totalStats.outwards}</h3>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200 bg-secondary/5">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 text-secondary">Total Valuation</p>
            <h3 className="text-2xl font-black text-secondary">₹{totalStats.valuation.toLocaleString()}</h3>
          </div>
        </div>

        {/* MAIN DATA SECTION */}
        <div className="space-y-4">

          {loading && (
            <div className="bg-white p-20 rounded-3xl shadow-sm border border-gray-100 text-center">
              <FaSync className="animate-spin text-4xl text-secondary mx-auto mb-4 opacity-50" />
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Processing Inventory Data...</p>
            </div>
          )}

          {!loading && viewLevel === "GROUPS" && filteredGroupAggregates.length === 0 && (
            <div className="bg-white p-20 rounded-3xl shadow-sm border border-gray-100 text-center">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No matching groups found.</p>
            </div>
          )}

          {!loading && viewLevel === "GROUPS" && filteredGroupAggregates.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-black tracking-widest border-b">
                      <th className="px-6 py-4">Stock Group Name</th>
                      <th className="px-6 py-4 text-center">Opening</th>
                      <th className="px-6 py-4 text-center">Inwards</th>
                      <th className="px-6 py-4 text-center">Outwards</th>
                      <th className="px-6 py-4 text-right">Closing Qty</th>
                      <th className="px-6 py-4 text-right">Closing Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredGroupAggregates.map(agg => (
                      <tr
                        key={agg.id}
                        onClick={() => changeView("ITEMS", { _id: agg.id, name: agg.name })}
                        className="hover:bg-blue-50/50 cursor-pointer transition group"
                      >
                        <td className="px-6 py-4 font-bold text-gray-700 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-white transition">
                            <FaChevronRight size={10} />
                          </div>
                          {agg.name}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-gray-400">{Math.round(agg.openingQty || 0)}</td>
                        <td className="px-6 py-4 text-center font-bold text-green-600">{agg.inwards || 0}</td>
                        <td className="px-6 py-4 text-center font-bold text-red-500">{agg.outwards || 0}</td>
                        <td className="px-6 py-4 text-right font-black text-gray-600">{agg.closingQty}</td>
                        <td className="px-6 py-4 text-right font-black text-secondary">₹{agg.closingValue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && viewLevel === "ITEMS" && filteredStockItems.length === 0 && (
            <div className="bg-white p-20 rounded-3xl shadow-sm border border-gray-100 text-center">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No matching products found in this group.</p>
            </div>
          )}

          {!loading && viewLevel === "ITEMS" && filteredStockItems.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-black tracking-widest border-b">
                      <th className="px-6 py-4">Product Name</th>
                      <th className="px-6 py-4 text-center">Opening</th>
                      <th className="px-6 py-4 text-center">Inwards</th>
                      <th className="px-6 py-4 text-center">Outwards</th>
                      <th className="px-6 py-4 text-right">Closing</th>
                      <th className="px-6 py-4 text-right font-black">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredStockItems.map(item => (
                      <tr
                        key={item.productId}
                        onClick={() => changeView("LEDGER", selectedGroup, { id: item.productId, name: item.productName })}
                        className="hover:bg-blue-50/50 cursor-pointer transition group"
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-700">{item.productName}</div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">ID: {item.productId.slice(-6)}</span>
                            {item.branchId && (
                              <span className="text-[8px] font-bold text-blue-400 uppercase tracking-tighter">Branch: {String(item.branchId).slice(-6)}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-gray-400">{item.opening.qty}</td>
                        <td className="px-6 py-4 text-center font-bold text-green-600">{item.purchasesInPeriod || 0}</td>
                        <td className="px-6 py-4 text-center font-bold text-red-500">{item.salesInPeriod || 0}</td>
                        <td className="px-6 py-4 text-right font-black text-gray-600">{item.closing.qty}</td>
                        <td className="px-6 py-4 text-right font-black text-secondary">₹{item.closing.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && viewLevel === "LEDGER" && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#319bab] text-white uppercase text-[9px] font-black tracking-widest border-b">
                      <th className="px-6 py-4">Date / Voucher</th>
                      <th className="px-6 py-4">Particulars</th>
                      <th className="px-6 py-4 text-center">Inwards (Qty)</th>
                      <th className="px-6 py-4 text-center">Outwards (Qty)</th>
                      <th className="px-6 py-4 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {/* Opening Balance Row */}
                    <tr className="bg-gray-50/30">
                      <td className="px-6 py-3 font-bold text-gray-500 text-xs">Opening Balance</td>
                      <td className="px-6 py-3"></td>
                      <td className="px-6 py-3"></td>
                      <td className="px-6 py-3"></td>
                      <td className="px-6 py-3 text-right font-black text-gray-700">
                        {ledgerData.openingBalance.toLocaleString()}
                      </td>
                    </tr>

                    {filteredLedgerData.map((txn, idx) => {
                      if (idx === 0) runningBalance = ledgerData.openingBalance;
                      if (txn.type === "INWARD") runningBalance += txn.qty;
                      else runningBalance -= txn.qty;

                      return (
                        <tr key={idx} className="hover:bg-gray-50 transition border-l-4 border-transparent hover:border-secondary">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-700">{txn.date.toLocaleDateString()}</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase">{txn.voucherType} | {txn.invoiceId}</div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-gray-600">{txn.particulars}</td>
                          <td className="px-6 py-4 text-center font-black text-green-600">
                            {txn.type === "INWARD" ? txn.qty : ""}
                          </td>
                          <td className="px-6 py-4 text-center font-black text-red-500">
                            {txn.type === "OUTWARD" ? txn.qty : ""}
                          </td>
                          <td className="px-6 py-4 text-right font-black text-gray-800 underline decoration-secondary/30 decoration-2">
                            {runningBalance.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}

                    {(ledgerData.transactions || []).length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-6 py-20 text-center text-gray-400 flex flex-col items-center">
                          <FaChartLine size={40} className="mb-2 opacity-20" />
                          <p className="text-xs font-black uppercase tracking-widest">No transactions found for this product in period</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      <StockSummaryExportModal
        isOpen={showExportModal}
        onClose={() => { setShowExportModal(false); setIsAllItemsExport(false); setExportItemsData([]); }}
        viewLevel={isAllItemsExport ? "ITEMS" : viewLevel}
        data={isAllItemsExport ? exportItemsData : (viewLevel === "GROUPS" ? filteredGroupAggregates : viewLevel === "ITEMS" ? filteredStockItems : filteredLedgerData)}
        title={isAllItemsExport ? "All_Products_Summary" : (viewLevel === "GROUPS" ? "Stock Summary" : viewLevel === "ITEMS" ? `Stock_${selectedGroup?.name || 'Group'}` : `Ledger_${selectedProduct?.name || 'Product'}`)}
      />
    </div>
  );
};

export default BranchStockSummary;
