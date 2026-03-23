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
  }, [currentBranch?._id]);

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

        {/* FILTERS */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end text-xs font-bold text-gray-500 uppercase">
            <div className="space-y-2">
              <label>From Date</label>
              <input 
                type="date" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none focus:border-[#319bab] transition"
              />
            </div>
            
            <div className="space-y-2">
              <label>To Date</label>
              <input 
                type="date" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none focus:border-[#319bab] transition"
              />
            </div>

            <div className="space-y-2">
              <label>Product Group</label>
              <select 
                value={selectedProductGroupId}
                onChange={(e) => setSelectedProductGroupId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none focus:border-[#319bab] transition cursor-pointer"
              >
                <option value="">All Groups</option>
                {productGroups.map(g => (
                  <option key={g._id} value={g._id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label>Product</label>
              <select 
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none focus:border-[#319bab] transition cursor-pointer"
              >
                <option value="">All Products</option>
                {products.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={fetchHistory}
                className="flex-1 bg-gray-800 hover:bg-black text-white py-2 rounded-lg transition flex items-center justify-center gap-2"
              >
                <FaFilter size={12} /> Apply
              </button>
              <button 
                onClick={handleReset}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 rounded-lg transition"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Sales Count</span>
            <span className="text-2xl font-black text-[#319bab]">{records.length}</span>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Quantity Sold</span>
            <span className="text-2xl font-black text-gray-800">{totalQty}</span>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estimated Gross Profit</span>
            <span className={`text-2xl font-black ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              ₹{totalProfit.toFixed(2)}
            </span>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-black uppercase text-[10px] tracking-widest border-b border-gray-100">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Invoice / Type</th>
                  <th className="px-6 py-4">Product / Group</th>
                  <th className="px-6 py-4 text-center">Qty</th>
                  <th className="px-6 py-4 text-right">Cost (Excl.)</th>
                  <th className="px-6 py-4 text-right">Sold Price</th>
                  <th className="px-6 py-4 text-right">Discount</th>
                  <th className="px-6 py-4 text-right">GST %</th>
                  <th className="px-6 py-4 text-right bg-green-50/30 text-green-700">Profit/Unit</th>
                  <th className="px-6 py-4 text-right bg-green-50/50 text-green-800 font-black">Total Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.length > 0 ? (
                  records.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(r.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-800">{r.invoiceId}</div>
                        <div className="text-[10px] text-gray-400 uppercase font-black">{r.voucherType}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-[#319bab]">{r.productName}</div>
                        <div className="text-[10px] text-gray-400 uppercase font-black">{r.productGroupName || "No Group"}</div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-gray-700">
                        {r.qty}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-500 uppercase tracking-tighter">
                        ₹{r.purchasingPrice?.toFixed(2) || "0.00"}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-gray-800">
                        ₹{r.sellingPrice?.toFixed(2) || "0.00"}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-red-500">
                        -₹{r.discountPerUnit?.toFixed(2) || "0.00"}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500">
                        {r.gst}%
                      </td>
                      <td className={`px-6 py-4 text-right font-bold bg-green-50/20 ${r.grossProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        ₹{r.grossProfit?.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 text-right font-black bg-green-50/50 ${r.grossProfit * r.qty >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        ₹{(r.grossProfit * r.qty).toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="10" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <FaHistory size={40} className="mb-2 opacity-20" />
                        <p className="font-bold uppercase tracking-widest text-xs">No selling records found</p>
                        <p className="text-[10px]">Try adjusting your filters or date range</p>
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
  );
};

export default BranchProductRecords;
