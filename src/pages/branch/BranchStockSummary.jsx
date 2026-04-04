import React, { useState, useEffect } from "react";
import { 
  FaBookOpen, FaChartBar, FaSearch, FaFilter, FaArrowLeft, 
  FaChevronRight, FaCalendarAlt, FaSync, FaChartLine, FaDownload 
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
  const [ledgerData, setLedgerData] = useState([]); // Level 3
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [isAllItemsExport, setIsAllItemsExport] = useState(false);

  // Fetch Group/Item Summary
  const fetchStockSummary = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      // 1. Fetch all products to know their groups
      const prodRes = await fetchWithAuth(`${API_BASE}/products?branchId=${currentBranch._id}&limit=10000`);
      const prodData = await prodRes.json();
      const productToGroup = {};
      if (prodData.success) {
        prodData.data.forEach(p => {
          productToGroup[p._id] = p.productGroup?._id || p.productGroup || "uncategorized";
        });
      }

      // 2. Fetch stock journal
      const res = await fetchWithAuth(
        `${API_BASE}/products/stock-journal?branchId=${currentBranch._id}&startDate=${fromDate}&endDate=${toDate}`
      );
      const data = await res.json();
      
      if (data.success) {
        // Enrich stock data with group info
        const enriched = (data.data || []).map(item => ({
          ...item,
          groupId: productToGroup[item.productId] || "uncategorized"
        }));
        setStockData(enriched);
      } else {
        toast.error(data.message || "Failed to fetch stock journal");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error fetching stock summary");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Product Ledger
  const fetchProductLedger = async (productId) => {
    setLoading(true);
    try {
      // 1. Fetch Sales (Invoices)
      const salesRes = await fetchWithAuth(
        `${API_BASE}/sales-orders/history?branchId=${currentBranch._id}&productId=${productId}&fromDate=${fromDate}&toDate=${toDate}`
      );
      const sales = await salesRes.json();

      // 2. Fetch Purchases (Received POs)
      const purchaseRes = await fetchWithAuth(
        `${API_BASE}/purchase-orders?branchId=${currentBranch._id}&search=${selectedProduct.name}`
      );
      const purchasesRaw = await purchaseRes.json();
      
      // Filter purchases for this product and date range manually if needed or backend supports
      const filteredPurchases = Array.isArray(purchasesRaw) ? purchasesRaw.filter(po => {
        const poDate = new Date(po.createdAt).toISOString().split("T")[0];
        return poDate >= fromDate && poDate <= toDate && po.status === "INVOICED" &&
               po.items.some(item => String(item.productId) === String(productId));
      }) : [];

      // Combine and interleave
      const unified = [];
      
      // Add Sales
      if (Array.isArray(sales)) {
        sales.forEach(s => unified.push({
          type: "OUTWARD",
          date: new Date(s.date || s.createdAt),
          voucherType: s.voucherType || "Sales",
          invoiceId: s.invoiceId,
          particulars: s.customerName || "Customer",
          qty: s.qty,
          rate: s.sellingPrice,
          value: s.qty * s.sellingPrice
        }));
      }

      // Add Purchases
      filteredPurchases.forEach(p => {
        const item = p.items.find(i => String(i.productId) === String(productId));
        if (item) {
          unified.push({
            type: "INWARD",
            date: new Date(p.createdAt),
            voucherType: p.voucherType || "Purchase",
            invoiceId: p.invoiceId,
            particulars: p.vendor || "Supplier",
            qty: item.qty,
            rate: item.purchasePrice,
            value: item.qty * item.purchasePrice
          });
        }
      });

      // Sort by date
      unified.sort((a, b) => a.date - b.date);

      setLedgerData(unified);
    } catch (err) {
      console.error(err);
      toast.error("Failed to build product ledger");
    } finally {
      setLoading(false);
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
    const aggregates = {};
    
    // Initialize with all groups
    productGroups.forEach(g => {
      aggregates[g._id] = {
        name: g.name,
        inwards: 0,
        outwards: 0,
        closingQty: 0,
        closingValue: 0
      };
    });

    // Aggregate from stockData
    stockData.forEach(item => {
      const gid = item.groupId || "uncategorized";
      if (!aggregates[gid]) {
        aggregates[gid] = { name: "Uncategorized", inwards: 0, outwards: 0, closingQty: 0, closingValue: 0 };
      }
      aggregates[gid].inwards += (item.purchasesInPeriod || 0);
      aggregates[gid].outwards += (item.salesInPeriod || 0);
      aggregates[gid].closingQty += (item.closing?.qty || 0);
      aggregates[gid].closingValue += (item.closing?.amount || 0);
    });

    return Object.entries(aggregates).map(([id, data]) => ({ id, ...data }));
  }, [stockData, productGroups]);

  // Filtered Group Aggregates (Search)
  const filteredGroupAggregates = React.useMemo(() => {
    if (!searchQuery) return groupAggregates;
    return groupAggregates.filter(agg => 
      agg.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [groupAggregates, searchQuery]);

  // Filtered Stock Items (Search)
  const filteredStockItems = React.useMemo(() => {
    const baseItems = stockData.filter(item => item.groupId === selectedGroup?._id);
    if (!searchQuery) return baseItems;
    return baseItems.filter(item => 
      item.productName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [stockData, selectedGroup, searchQuery]);

  // Filtered Ledger Data (Search)
  const filteredLedgerData = React.useMemo(() => {
    if (!searchQuery) return ledgerData;
    return ledgerData.filter(txn => 
      txn.particulars.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.voucherType.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [ledgerData, searchQuery]);

  // Total Summary Stats
  const totalStats = React.useMemo(() => {
    return stockData.reduce((acc, item) => ({
      inwards: acc.inwards + (item.purchasesInPeriod || 0),
      outwards: acc.outwards + (item.salesInPeriod || 0),
      valuation: acc.valuation + (item.closing?.amount || 0)
    }), { inwards: 0, outwards: 0, valuation: 0 });
  }, [stockData]);

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
              onClick={() => setShowExportModal(true)}
              className="bg-white text-secondary border-2 border-secondary px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-secondary/5 transition flex items-center gap-2"
            >
              <FaDownload size={14} /> {viewLevel === "GROUPS" ? "Export Groups" : "Export"}
            </button>

            {viewLevel === "GROUPS" && (
              <button 
                onClick={() => {
                  // Pre-set viewLevel for export and show all data
                  setShowExportModal(true);
                  // We'll use a hack by passing a special prop or just relying on a new state
                  setIsAllItemsExport(true);
                }}
                className="bg-secondary/10 text-secondary border-2 border-secondary/20 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-secondary/20 transition flex items-center gap-2"
              >
                <FaDownload size={14} /> Export All Items
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
        {viewLevel === "GROUPS" && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Items</p>
                <h3 className="text-2xl font-black text-gray-800">{stockData.length}</h3>
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
        )}

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
                           <div className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">ID: {item.productId.slice(-6)}</div>
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
                          {stockData.find(s => s.productId === selectedProduct.id)?.opening.qty || 0}
                        </td>
                     </tr>
                     
                     {filteredLedgerData.map((txn, idx) => {
                        // Calculate running balance logic would go here if needed
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
                               {/* Actual running balance is complex with filtered views, showing row qty for context 
                                   or we can calculate it above. For now showing row impact. */}
                               {txn.type === "INWARD" ? `+${txn.qty}` : `-${txn.qty}`}
                             </td>
                          </tr>
                        );
                     })}

                     {ledgerData.length === 0 && (
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
        onClose={() => { setShowExportModal(false); setIsAllItemsExport(false); }}
        viewLevel={isAllItemsExport ? "ITEMS" : viewLevel}
        data={isAllItemsExport ? stockData : (viewLevel === "GROUPS" ? filteredGroupAggregates : viewLevel === "ITEMS" ? filteredStockItems : filteredLedgerData)}
        title={isAllItemsExport ? "All_Products_Summary" : (viewLevel === "GROUPS" ? "Stock Summary" : viewLevel === "ITEMS" ? `Stock_${selectedGroup?.name || 'Group'}` : `Ledger_${selectedProduct?.name || 'Product'}`)}
      />
    </div>
  );
};

export default BranchStockSummary;
