import React, { useEffect, useState } from "react";
import { FaSync, FaFilter, FaSearch, FaHistory } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";

const BranchProductRecords = () => {
  const { currentBranch } = useBranch();
  const { productGroups, products } = useInventory();
  
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedProductGroupId, setSelectedProductGroupId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const fetchHistory = async () => {
    if (!currentBranch?._id) return;

    setLoading(true);
    try {
      let url = `${API_BASE}/sales-orders/history?branchId=${currentBranch._id}`;
      if (fromDate) url += `&fromDate=${fromDate}`;
      if (toDate) url += `&toDate=${toDate}`;
      if (selectedProductGroupId) url += `&productGroupId=${selectedProductGroupId}`;
      if (selectedProductId) url += `&productId=${selectedProductId}`;

      const res = await fetch(url);
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
  }, [currentBranch?._id, selectedProductId, fromDate, toDate, selectedProductGroupId]);

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setSelectedProductGroupId("");
    setSelectedProductId("");
    // We'll need to call fetchHistory manually after states clear or use another useEffect
  };

  // Calculate total profit for the current view
  const totalProfit = records.reduce((sum, r) => sum + (r.grossProfit * r.qty), 0);
  const totalQty = records.reduce((sum, r) => sum + (r.qty || 0), 0);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
    (!selectedProductGroupId || String(p.productGroup?._id || p.productGroup) === String(selectedProductGroupId))
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full px-3 sm:px-6 py-4">
        <ToastContainer />
        
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
              <div className="mb-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Quick Search</label>
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                  <input 
                    type="text"
                    placeholder="Search product..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none focus:border-[#319bab] transition"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Group Filter</label>
                <select 
                  value={selectedProductGroupId}
                  onChange={(e) => setSelectedProductGroupId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#319bab] transition cursor-pointer"
                >
                  <option value="">All Groups</option>
                  {productGroups.map(g => (
                    <option key={g._id} value={g._id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {filteredProducts.map(p => (
                  <div 
                    key={p._id}
                    onClick={() => setSelectedProductId(p._id)}
                    className={`p-3 rounded-lg cursor-pointer transition-all border ${
                      selectedProductId === p._id 
                        ? 'bg-[#319bab] border-[#319bab] text-white shadow-md' 
                        : 'bg-white border-gray-50 hover:border-[#319bab]/30 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="font-bold text-xs truncate">{p.name}</div>
                    <div className={`text-[9px] uppercase font-black ${selectedProductId === p._id ? 'text-[#319bab]-100' : 'text-gray-400'}`}>
                      {p.productGroup?.name || "No Group"}
                    </div>
                  </div>
                ))}
              </div>
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

            {selectedProductId ? (
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
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gross Profit</span>
                    <span className={`text-xl font-black ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      ₹{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avg. Profit %</span>
                    <span className="text-xl font-black text-[#319bab]">
                      {records.length > 0 
                        ? (records.reduce((s, r) => s + ((r.grossProfit / (r.purchasingPrice || 1)) * 100), 0) / records.length).toFixed(1)
                        : "0.0"}%
                    </span>
                  </div>
                </div>

                {/* DATA TABLE */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Generated Invoice Record</span>
                    <span className="text-[10px] text-[#319bab] font-bold">Showing {records.length} Entries</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50/50 text-gray-500 font-black uppercase text-[9px] tracking-widest border-b border-gray-100">
                          <th className="px-4 py-3">Voucher / Time</th>
                          <th className="px-4 py-3">Customer</th>
                          <th className="px-4 py-3 text-right">Purchase ₹</th>
                          <th className="px-4 py-3 text-right">Selling ₹</th>
                          <th className="px-4 py-3 text-right">Margin (%)</th>
                          <th className="px-4 py-3 text-center">Qty</th>
                          <th className="px-4 py-3 text-center">GST %</th>
                          <th className="px-4 py-3 text-right">Discount</th>
                          <th className="px-4 py-3 text-right font-black">Profit (%)</th>
                          <th className="px-4 py-3 text-right font-black">Profit (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {loading ? (
                          <tr>
                            <td colSpan="9" className="px-6 py-20 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <FaSync className="animate-spin text-[#319bab]" size={24} />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fetching Transaction Data...</span>
                              </div>
                            </td>
                          </tr>
                        ) : records.length > 0 ? (
                          records.map((r, i) => {
                            const margin = (r.sellingPrice || 0) - (r.purchasingPrice || 0);
                            const profitPercent = r.purchasingPrice > 0 ? (r.grossProfit / r.purchasingPrice) * 100 : 0;
                            return (
                              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-bold text-gray-700 text-xs">{r.voucherType}</div>
                                  <div className="text-[9px] text-gray-500 font-bold">
                                    {new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                  <div className="text-[9px] text-gray-400 font-bold">{r.invoiceId} | {new Date(r.date).toLocaleDateString()}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-gray-700 text-xs">{r.customerName || "Walk-in"}</div>
                                </td>
                                <td className="px-4 py-3 text-right text-gray-500 text-xs">
                                  ₹{r.purchasingPrice?.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-800 text-xs">
                                  ₹{r.sellingPrice?.toFixed(2)}
                                </td>
                                <td className={`px-4 py-3 text-right text-xs font-black ${profitPercent >= 0 ? 'text-[#319bab]' : 'text-red-500'}`}>
                                  {profitPercent.toFixed(1)}%
                                </td>
                                <td className="px-4 py-3 text-center font-black text-gray-700 text-xs">
                                  {r.qty}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-500 text-xs">
                                  {r.gst}%
                                </td>
                                <td className="px-4 py-3 text-right text-red-500 font-bold text-xs">
                                  -₹{r.discountPerUnit?.toFixed(2)}
                                </td>
                                <td className={`px-4 py-3 text-right text-xs font-black ${profitPercent >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {profitPercent.toFixed(1)}%
                                </td>
                                <td className={`px-4 py-3 text-right font-black text-xs ${r.grossProfit * r.qty >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                  ₹{(r.grossProfit * r.qty).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="9" className="px-6 py-20 text-center text-gray-400">
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
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-20 text-center flex flex-col items-center justify-center gap-4">
                <div className="bg-[#319bab]/5 p-6 rounded-full border border-[#319bab]/10">
                  <FaSearch size={40} className="text-[#319bab] opacity-40" />
                </div>
                <div>
                  <h3 className="text-gray-800 font-black uppercase tracking-tight text-lg">Select a Product</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Please choose a product from the sidebar to view detailed invoice records</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchProductRecords;
