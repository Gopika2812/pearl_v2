import React, { useState, useEffect } from "react";
import { 
  FaBook, FaCalendarAlt, FaSearch, FaHistory, 
  FaArrowUp, FaArrowDown, FaFileExport, FaSync,
  FaChevronLeft, FaChevronRight, FaFileExcel, 
  FaFilter, FaPercentage
} from "react-icons/fa";
import * as XLSX from 'xlsx';
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";
import { API_BASE } from "../../api";

const BranchStockJournal = () => {
  const { currentBranch } = useBranch();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    if (currentBranch?._id) {
      fetchStockJournal();
    }
  }, [currentBranch?._id, startDate, endDate]);

  const fetchStockJournal = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/products/stock-journal?branchId=${currentBranch._id}&startDate=${startDate}&endDate=${endDate}`
      );
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        toast.error(result.message || "Failed to fetch stock journal");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error fetching journal");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    try {
      if (!data.length) return toast.info("No data to export");

      const exportData = filteredData.map(item => ({
        "Product Name": item.productName,
        "Opening Qty": item.opening.qty,
        "Opening Rate (P)": item.opening.rate,
        "Opening Amount": item.opening.amount,
        "In Qty": item.purchasesInPeriod,
        "Out Qty": item.salesInPeriod,
        "Closing Qty": item.closing.qty,
        "Closing Rate (S)": item.closing.rate,
        "Closing Amount": item.closing.amount,
        "Net Variance": item.closing.qty - item.opening.qty
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Stock Journal");
      XLSX.writeFile(wb, `Stock_Journal_${startDate}_to_${endDate}.xlsx`);
      toast.success("Excel exported successfully!");
    } catch (err) {
      toast.error("Failed to export Excel");
    }
  };

  const filteredData = data.filter(item => 
    item.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totals = filteredData.reduce((acc, item) => ({
    openingQty: acc.openingQty + item.opening.qty,
    openingAmount: acc.openingAmount + item.opening.amount,
    closingQty: acc.closingQty + item.closing.qty,
    closingAmount: acc.closingAmount + item.closing.amount,
    purchaseQty: acc.purchaseQty + item.purchasesInPeriod,
    salesQty: acc.salesQty + item.salesInPeriod,
  }), { openingQty: 0, openingAmount: 0, closingQty: 0, closingAmount: 0, purchaseQty: 0, salesQty: 0 });

  return (
    <div className="pl-16 pr-6 py-8 bg-[#f8fafc] min-h-screen transition-all animate-in fade-in duration-500">
      
      {/* COMMAND CENTER BAR */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-2 mb-8 flex flex-col xl:flex-row items-stretch xl:items-center gap-4 sticky top-4 z-40 backdrop-blur-md bg-white/90">
        
        {/* Page Identity */}
        <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100">
           <div className="p-3 bg-gradient-to-br from-[#319bab] to-[#248d94] rounded-xl shadow-lg shadow-[#319bab]/20">
              <FaBook className="text-white text-md" />
            </div>
            <div>
               <h1 className="text-lg font-black text-gray-900 tracking-tight uppercase leading-none">Stock Journal</h1>
               <div className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Inventory Ledger</div>
            </div>
        </div>

        {/* Search */}
        <div className="flex-1 relative">
           <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
           <input 
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-transparent rounded-2xl py-2.5 pl-12 pr-4 shadow-inner focus:bg-white focus:ring-2 focus:ring-[#319bab]/20 transition-all outline-none font-bold text-gray-700 placeholder-gray-300 text-sm"
           />
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
            <FaCalendarAlt className="text-[#319bab] text-xs" />
            <div className="flex items-center gap-1">
               <input 
                  type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-[10px] font-black text-gray-600 outline-none uppercase"
               />
               <span className="text-gray-300 font-bold px-1">/</span>
               <input 
                  type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-[10px] font-black text-gray-600 outline-none uppercase"
               />
            </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
           <button 
              onClick={fetchStockJournal}
              className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-white hover:text-[#319bab] transition-all border border-transparent hover:border-[#319bab]/10 shadow-sm"
              title="Sync Data"
           >
              <FaSync className={loading ? "animate-spin" : ""} />
           </button>
           <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-6 py-3 bg-[#1D6F42] text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-[#155a36] transition-all shadow-lg active:scale-95"
           >
              <FaFileExcel className="text-lg" />
              <span>Export</span>
           </button>
        </div>
      </div>

      {/* VALUATION TILES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border-t-8 border-[#319bab] flex justify-between items-center group relative overflow-hidden">
           {/* Decor */}
           <div className="absolute -right-4 -bottom-4 text-gray-50 opacity-10 group-hover:scale-125 transition-transform duration-700">
              <FaHistory size={160} />
           </div>
           
           <div className="relative z-10">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 px-1">Opening Valuation</p>
              <h2 className="text-3xl font-black text-[#319bab] tracking-tight">
                ₹{totals.openingAmount.toLocaleString()}
              </h2>
              <div className="mt-4 flex items-center gap-3">
                 <div className="px-3 py-1 bg-gray-50 rounded-full text-[8px] font-black text-gray-400 border border-gray-100 uppercase italic">
                    {filteredData.length} SKUs TRACKED
                 </div>
              </div>
           </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-2xl border-t-8 border-green-500 flex justify-between items-center group relative overflow-hidden">
           {/* Decor */}
           <div className="absolute -right-4 -bottom-4 text-gray-50 opacity-10 group-hover:scale-125 transition-transform duration-700">
              <FaFileExport size={120} />
           </div>

           <div className="relative z-10">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 px-1 text-right md:text-left">Closing Valuation</p>
              <h2 className="text-3xl font-black text-green-600 tracking-tight text-right md:text-left">
                ₹{totals.closingAmount.toLocaleString()}
              </h2>
              <div className="mt-4 flex items-center gap-3 justify-end md:justify-start">
                 <div className="px-3 py-1 bg-green-50 rounded-full text-[9px] font-black text-green-600 border border-green-100 uppercase tracking-widest animate-pulse">
                    Live Report
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* DUAL PANE FINANCIALS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        
        {/* LEFT PANE: OPENING */}
        <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 p-2 overflow-hidden flex flex-col">
           <div className="px-4 py-4 flex justify-between items-center">
              <h3 className="flex items-center gap-2 font-black text-gray-800 uppercase italic text-xs">
                 <div className="w-1 h-5 bg-[#319bab] rounded-full"></div>
                 Opening <span className="text-[#319bab] opacity-60">Balance</span>
              </h3>
              <div className="text-[7px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-widest border border-gray-100">
                 Pur. Rate Valuation
              </div>
           </div>

           <div className="max-h-[500px] overflow-y-auto custom-scrollbar rounded-xl overflow-hidden">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gray-50/95 backdrop-blur-sm text-[9px] font-black uppercase text-gray-400 tracking-widest">
                    <th className="px-4 py-3 border-b border-gray-100">Product Name</th>
                    <th className="px-2 py-3 border-b border-gray-100 text-center">Qty</th>
                    <th className="px-2 py-3 border-b border-gray-100 text-right">Rate</th>
                    <th className="px-4 py-3 border-b border-gray-100 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredData.map((item, idx) => (
                    <tr key={item.productId} className={`group hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-gray-50/10'}`}>
                      <td className="px-4 py-2.5 font-bold text-gray-700 text-[10px] uppercase group-hover:text-[#319bab] transition-colors">{item.productName}</td>
                      <td className="px-2 py-2.5 text-center text-[10px] font-black text-gray-900 italic opacity-40">{item.opening.qty}</td>
                      <td className="px-2 py-2.5 text-right text-[9px] font-bold text-gray-400 tabular-nums italic">₹{item.opening.rate.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-black text-[#319bab] tabular-nums text-[10px]">₹{item.opening.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-20 bg-gray-900 text-white rounded-b-xl text-[10px]">
                   <tr className="font-black uppercase tracking-widest">
                      <td className="px-4 py-3">Total Opening</td>
                      <td className="px-2 py-3 text-center font-bold text-gray-400">{totals.openingQty}</td>
                      <td className="px-2 py-3 text-right text-[8px] text-gray-500">VALUATION</td>
                      <td className="px-4 py-3 text-right text-sm italic text-white">₹{totals.openingAmount.toLocaleString()}</td>
                   </tr>
                </tfoot>
              </table>
           </div>
        </div>

        {/* RIGHT PANE: CLOSING */}
        <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 p-2 overflow-hidden flex flex-col">
           <div className="px-4 py-4 flex justify-between items-center">
              <h3 className="flex items-center gap-2 font-black text-gray-800 uppercase italic text-xs">
                 <div className="w-1 h-5 bg-green-500 rounded-full"></div>
                 Closing <span className="text-green-500 opacity-60">Balance</span>
              </h3>
              <div className="text-[7px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-widest border border-gray-100 text-right">
                 Sell. Rate Valuation
              </div>
           </div>

           <div className="max-h-[500px] overflow-y-auto custom-scrollbar rounded-xl overflow-hidden">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gray-50/95 backdrop-blur-sm text-[9px] font-black uppercase text-gray-400 tracking-widest">
                    <th className="px-4 py-3 border-b border-gray-100">Product Name</th>
                    <th className="px-2 py-3 border-b border-gray-100 text-center">In/Out</th>
                    <th className="px-2 py-3 border-b border-gray-100 text-center">Qty</th>
                    <th className="px-2 py-3 border-b border-gray-100 text-right">Rate</th>
                    <th className="px-4 py-3 border-b border-gray-100 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredData.map((item, idx) => (
                    <tr key={item.productId} className={`group hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-gray-50/10'}`}>
                      <td className="px-4 py-2.5 font-bold text-gray-700 text-[10px] uppercase group-hover:text-green-600 transition-colors">{item.productName}</td>
                      <td className="px-2 py-2.5 text-center">
                         <div className="flex items-center justify-center gap-0.5">
                            {item.purchasesInPeriod > 0 && <span className="text-[7px] bg-green-50 text-green-600 px-1 py-0.5 rounded font-black">+{item.purchasesInPeriod}</span>}
                            {item.salesInPeriod > 0 && <span className="text-[7px] bg-red-50 text-red-600 px-1 py-0.5 rounded font-black">-{item.salesInPeriod}</span>}
                            {!item.purchasesInPeriod && !item.salesInPeriod && <span className="text-gray-200">-</span>}
                         </div>
                      </td>
                      <td className="px-2 py-2.5 text-center text-[10px] font-black text-gray-900 italic opacity-40">{item.closing.qty}</td>
                      <td className="px-2 py-2.5 text-right text-[9px] font-bold text-gray-400 tabular-nums italic">₹{item.closing.rate.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-black text-green-600 tabular-nums text-[10px]">₹{item.closing.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-20 bg-green-900 text-white rounded-b-xl text-[10px]">
                   <tr className="font-black uppercase tracking-widest">
                      <td className="px-4 py-3">Total Closing</td>
                      <td className="px-2 py-3 text-center">
                         <div className="flex gap-0.5 justify-center text-[8px]">
                            <span className="text-green-300">+{totals.purchaseQty}</span>
                            <span className="text-red-300">-{totals.salesQty}</span>
                         </div>
                      </td>
                      <td className="px-2 py-3 text-center font-bold text-green-400">{totals.closingQty}</td>
                      <td className="px-2 py-3 text-right text-[8px] text-green-600">VALUATION</td>
                      <td className="px-4 py-3 text-right text-sm italic text-white">₹{totals.closingAmount.toLocaleString()}</td>
                   </tr>
                </tfoot>
              </table>
           </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      ` }} />

    </div>
  );
};

export default BranchStockJournal;
