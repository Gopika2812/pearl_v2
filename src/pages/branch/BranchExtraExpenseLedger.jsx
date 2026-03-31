import React, { useState, useEffect } from "react";
import { useBranch } from "../../context/BranchContext";
import { API_BASE } from "../../api";
import { FaFilter, FaFileInvoice, FaTag, FaInfoCircle, FaSearch } from "react-icons/fa";
import { toast } from "react-toastify";

const BranchExtraExpenseLedger = () => {
  const { currentBranch } = useBranch();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [nameFilter, setNameFilter] = useState("All");
  const [uniqueNames, setUniqueNames] = useState([]);

  useEffect(() => {
    if (currentBranch?._id || currentBranch?.id) {
      fetchLedger();
    }
  }, [currentBranch]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const branchId = currentBranch?._id || currentBranch?.id;
      const response = await fetch(`${API_BASE}/extra-expense-ledger/${branchId}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setFilteredData(result.data);
        
        // Extract unique names for filtering
        const names = [...new Set(result.data.map(item => item.expenseName))].sort();
        setUniqueNames(names);
      } else {
        toast.error(result.message || "Failed to fetch ledger");
      }
    } catch (err) {
      console.error("Error fetching ledger:", err);
      toast.error("Error fetching extra expense ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...data];

    if (typeFilter !== "All") {
      filtered = filtered.filter(item => item.type === typeFilter);
    }

    if (nameFilter !== "All") {
      filtered = filtered.filter(item => item.expenseName === nameFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.invoiceId.toLowerCase().includes(term) ||
        item.partyName.toLowerCase().includes(term) ||
        item.expenseName.toLowerCase().includes(term)
      );
    }

    setFilteredData(filtered);
  }, [searchTerm, typeFilter, nameFilter, data]);

  // Statistics
  const totalPurchase = data.filter(i => i.type === "Purchase").reduce((sum, i) => sum + i.totalPrice, 0);
  const totalSales = data.filter(i => i.type === "Sales").reduce((sum, i) => sum + i.totalPrice, 0);

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#319bab] outline-none text-sm transition-all";
  const labelClass = "block text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-wider";

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#319bab] tracking-tight uppercase">
            Extra Expense Ledger
          </h1>
          <p className="text-gray-500 text-sm font-medium">Comparative analysis of additional charges across Purchase & Sales</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 min-w-[200px]">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <FaFileInvoice />
            </div>
            <div>
              <p className={labelClass}>Total Purchase Extra</p>
              <p className="text-lg font-black text-gray-800">₹{totalPurchase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 min-w-[200px]">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
              <FaTag />
            </div>
            <div>
              <p className={labelClass}>Total Sales Extra</p>
              <p className="text-lg font-black text-gray-800">₹{totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* FILTERS CARD */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div className="md:col-span-1">
            <label className={labelClass}>
              <FaSearch className="inline mr-1" /> Search Invoice / Party
            </label>
            <input
              type="text"
              placeholder="Search..."
              className={inputClass}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>
              <FaFilter className="inline mr-1" /> Transaction Type
            </label>
            <select
              className={inputClass}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="Purchase">Purchase Orders</option>
              <option value="Sales">Sales Orders</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>
              <FaTag className="inline mr-1" /> Filter by Expense Name
            </label>
            <select
              className={inputClass}
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            >
              <option value="All">All Expense Names</option>
              {uniqueNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <button 
              onClick={fetchLedger}
              className="w-full bg-[#319bab] hover:bg-[#257f87] text-white font-bold py-2 rounded-lg transition-all text-sm uppercase tracking-widest shadow-lg shadow-[#319bab]/20"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-20 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#319bab] mx-auto"></div>
            <p className="mt-4 text-gray-500 font-bold uppercase text-xs tracking-widest">Loading Ledger Data...</p>
          </div>
        ) : filteredData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#319bab] text-white uppercase text-[11px] font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4 text-left">Date</th>
                  <th className="px-6 py-4 text-left">Type</th>
                  <th className="px-6 py-4 text-left">Invoice ID</th>
                  <th className="px-6 py-4 text-left">Party Name</th>
                  <th className="px-6 py-4 text-left">Expense Name</th>
                  <th className="px-6 py-4 text-right">Base Amount</th>
                  <th className="px-6 py-4 text-right">GST %</th>
                  <th className="px-6 py-4 text-right">GST Amount</th>
                  <th className="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 text-gray-600 font-semibold">
                      {new Date(item.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                        item.type === "Purchase" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                      }`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-800">{item.invoiceId}</td>
                    <td className="px-6 py-4 text-gray-500 truncate max-w-[200px]">{item.partyName}</td>
                    <td className="px-6 py-4">
                       <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded font-bold text-[11px] uppercase border border-gray-200">
                        {item.expenseName}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-700">₹{item.basePrice.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-gray-400 font-bold">{item.gstPercent}%</td>
                    <td className="px-6 py-4 text-right text-red-400 font-semibold">₹{item.gstAmount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-black text-[#319bab] text-base group-hover:scale-105 transition-transform">
                        ₹{item.totalPrice.toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-[#319bab]/10">
                <tr className="font-black text-gray-800 uppercase text-xs">
                  <td colSpan={8} className="px-6 py-4 text-right">Grand Total:</td>
                  <td className="px-6 py-4 text-right text-[#319bab] text-lg">
                    ₹{filteredData.reduce((sum, i) => sum + i.totalPrice, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-20 text-center">
            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaInfoCircle className="text-gray-300 text-4xl" />
            </div>
            <h3 className="text-gray-400 font-black uppercase text-sm tracking-widest">No extra expenses matched your criteria</h3>
            <p className="text-gray-400 text-xs mt-2">Try adjusting your filters or search terms</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BranchExtraExpenseLedger;
