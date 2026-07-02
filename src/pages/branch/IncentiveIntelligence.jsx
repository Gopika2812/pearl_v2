import React, { useState, useEffect } from "react";
import axios from "axios";
import { useBranch } from "../../context/BranchContext";
import { toast } from "react-toastify";
import { FaSearch, FaDownload, FaCalendarAlt, FaSort, FaSpinner } from "react-icons/fa";
import * as XLSX from "xlsx"; // Assuming xlsx is installed for export, if not we'll handle basic CSV

const IncentiveIntelligence = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "userName", direction: "asc" });

  // Date range state
  const today = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const { branch } = useBranch();
  const currentBranch = branch;

  useEffect(() => {
    if (currentBranch?._id) {
      fetchData();
    }
  }, [currentBranch, fromDate, toDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/api/incentive/report/${currentBranch._id}?fromDate=${fromDate}&toDate=${toDate}`
      );
      if (res.data.success) {
        setData(res.data.data);
      } else {
        toast.error("Failed to fetch data.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error fetching incentive intelligence.");
    } finally {
      setLoading(false);
    }
  };

  // Sorting
  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortedData = (dataToSort) => {
    if (!sortConfig.key) return dataToSort;
    return [...dataToSort].sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      // Handle specific types like attendanceStr which might contain "hrs" or "Leave"
      if (sortConfig.key === "attendanceStr") {
        valA = parseFloat(valA.replace(/[^\d.-]/g, "")) || 0;
        valB = parseFloat(valB.replace(/[^\d.-]/g, "")) || 0;
      }

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  // Filtering
  const filteredData = getSortedData(data).filter((item) =>
    Object.values(item).some(
      (val) => val !== null && val !== undefined && val.toString().toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Export
  const exportToExcel = () => {
    const exportData = filteredData.map(item => ({
      "User Name": item.userName,
      "Working Hours": item.attendanceStr,
      "Bill Count": item.billCount,
      "Delivery Count": item.deliveryCount,
      "Sales Value": `₹${item.salesValue.toLocaleString()}`,
      "Finance Followup": item.financeFollowupCount,
      "Order Followup": item.orderFollowupCount
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Incentive Intelligence");
    XLSX.writeFile(wb, `Incentive_Intelligence_${fromDate}_to_${toDate}.xlsx`);
  };

  // Columns definition
  const columns = [
    { key: "userName", label: "User Name" },
    { key: "attendanceStr", label: "Working Hours" },
    { key: "billCount", label: "Bill Count (SI)" },
    { key: "deliveryCount", label: "Delivery Count" },
    { key: "salesValue", label: "Sales Value (₹)" },
    { key: "financeFollowupCount", label: "Finance Followups" },
    { key: "orderFollowupCount", label: "Order Followups" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full mx-auto space-y-6">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-secondary/10">
        <div>
          <h1 className="text-2xl font-bold text-secondary flex items-center gap-2">
            <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Incentive Intelligence
            </span>
          </h1>
          <p className="text-sm text-secondary/60 mt-1">Track performance metrics across sales, delivery, and follow-ups.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Date Filters */}
          <div className="flex items-center gap-2 bg-secondary/5 rounded-2xl p-1.5 border border-secondary/10">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl shadow-sm">
              <FaCalendarAlt size={16} className="text-primary" />
              <input 
                type="date" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-sm border-none focus:ring-0 p-0 text-secondary/80 bg-transparent"
              />
            </div>
            <span className="text-secondary/40 text-sm font-medium px-1">to</span>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl shadow-sm">
              <FaCalendarAlt size={16} className="text-primary" />
              <input 
                type="date" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-sm border-none focus:ring-0 p-0 text-secondary/80 bg-transparent"
              />
            </div>
          </div>
          
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <FaDownload size={16} /> Export
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl shadow-sm border border-secondary/10 overflow-hidden flex flex-col">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-secondary/10 bg-secondary/[0.02] flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
            <input 
              type="text" 
              placeholder="Search users or values..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-secondary/20 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-secondary/[0.03] border-b border-secondary/10">
                {columns.map((col) => (
                  <th 
                    key={col.key} 
                    onClick={() => requestSort(col.key)}
                    className="p-4 text-xs font-semibold text-secondary/70 uppercase tracking-wider cursor-pointer hover:bg-secondary/[0.05] transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      {col.label}
                      <FaSort size={14} className={sortConfig.key === col.key ? "text-primary opacity-100" : "opacity-30"} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <FaSpinner className="animate-spin text-primary" size={32} />
                      <span className="text-secondary/60 text-sm font-medium">Crunching the numbers...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-12 text-center">
                    <div className="text-secondary/50 text-sm">No data found for the selected criteria.</div>
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => (
                  <tr 
                    key={row.userId || idx} 
                    className="border-b border-secondary/5 hover:bg-primary/[0.02] transition-colors group"
                  >
                    <td className="p-4">
                      <div className="font-medium text-secondary group-hover:text-primary transition-colors">
                        {row.userName}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${
                        row.attendanceStr.includes("Leave") 
                          ? "bg-red-100 text-red-700"
                          : row.attendanceStr === "-" 
                            ? "bg-gray-100 text-gray-600"
                            : "bg-green-100 text-green-700"
                      }`}>
                        {row.attendanceStr}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-secondary/80 font-medium">{row.billCount}</td>
                    <td className="p-4 text-sm text-secondary/80 font-medium">{row.deliveryCount}</td>
                    <td className="p-4 text-sm font-semibold text-emerald-600">
                      ₹{row.salesValue.toLocaleString()}
                    </td>
                    <td className="p-4 text-sm text-secondary/80 font-medium">
                      <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg">
                        {row.financeFollowupCount}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-secondary/80 font-medium">
                      <span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-lg">
                        {row.orderFollowupCount}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        {!loading && filteredData.length > 0 && (
          <div className="p-4 border-t border-secondary/10 bg-secondary/[0.01] text-xs text-secondary/50 font-medium flex justify-between items-center">
            <span>Showing {filteredData.length} records</span>
            <span>Metrics aggregated from {fromDate} to {toDate}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncentiveIntelligence;
