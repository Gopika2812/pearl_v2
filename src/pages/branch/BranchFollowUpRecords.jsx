import React, { useState, useEffect } from "react";
import { FaHistory, FaCalendarAlt, FaSearch, FaUser, FaPhone, FaCheckCircle, FaExclamationCircle, FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

const BranchFollowUpRecords = () => {
    const { currentBranch } = useBranch();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [fromDate, setFromDate] = useState(new Date().toISOString().split("T")[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });

    useEffect(() => {
        if (currentBranch?._id) fetchRecords();
    }, [currentBranch?._id]);

    const fetchRecords = async () => {
        if (!currentBranch?._id) return;
        setLoading(true);
        try {
            const url = `${API_BASE}/follow-ups?branchId=${currentBranch._id}&fromDate=${fromDate}&toDate=${toDate}&limit=100`;
            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            const data = await res.json();
            if (data.success) {
                setRecords(data.data || []);
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            console.error("Fetch records error:", err);
            toast.error(err.message || "Failed to load follow-up records");
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key) => {
        let direction = "asc";
        if (sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    const getSortedRecords = (records) => {
        return [...records].sort((a, b) => {
            let valA, valB;
            
            if (sortConfig.key === "customer") {
                valA = a.customerId?.name || "";
                valB = b.customerId?.name || "";
            } else if (sortConfig.key === "balance") {
                valA = a.closingBalance || 0;
                valB = b.closingBalance || 0;
            } else {
                valA = a[sortConfig.key] || "";
                valB = b[sortConfig.key] || "";
            }

            if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
            if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
    };

    const filteredRecords = getSortedRecords(records.filter(r => {
        const search = searchTerm.toLowerCase();
        return (
            (r.customerId?.name?.toLowerCase() || "").includes(search) ||
            (r.result?.toLowerCase() || "").includes(search) ||
            (r.followUpBy?.toLowerCase() || "").includes(search)
        );
    }));

    const getResultColor = (result) => {
        switch(result) {
            case "Paid": return "bg-emerald-100 text-emerald-700";
            case "Promised": return "bg-blue-100 text-blue-700";
            case "Part Payment Promised": return "bg-sky-100 text-sky-700";
            case "No Response": return "bg-gray-100 text-gray-700";
            case "Call Later": return "bg-amber-100 text-amber-700";
            case "Billing Dispute": return "bg-rose-100 text-rose-700";
            default: return "bg-indigo-50 text-indigo-700";
        }
    };

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <FaSort className="opacity-20 ml-1 inline-block" size={10} />;
        return sortConfig.direction === "asc" ? <FaSortUp className="ml-1 inline-block text-indigo-500" size={10} /> : <FaSortDown className="ml-1 inline-block text-indigo-500" size={10} />;
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] pt-20 md:pt-4 md:pl-20">

            <div className="w-full max-w-full mx-auto px-4 sm:px-8 py-6">
                
                {/* HEADER */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <FaHistory className="text-white text-2xl" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-gray-800 tracking-tight">Follow-Up History</h1>
                                <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mt-0.5">
                                    Historical records for {currentBranch?.name || "Branch"}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center bg-gray-50 p-2 rounded-xl border border-gray-200">
                                <div className="flex items-center gap-2 px-2">
                                    <FaCalendarAlt className="text-indigo-500 text-xs" />
                                    <input
                                        type="date"
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        className="bg-transparent text-[10px] font-black outline-none text-gray-700 uppercase"
                                    />
                                </div>
                                <span className="text-gray-300 mx-1">|</span>
                                <div className="flex items-center gap-2 px-2">
                                    <input
                                        type="date"
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        className="bg-transparent text-[10px] font-black outline-none text-gray-700 uppercase"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={fetchRecords}
                                disabled={loading}
                                className="px-6 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                            >
                                {loading ? "Searching..." : "Search"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* FILTERS & SEARCH */}
                <div className="relative mb-6">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search Customer, Result, or Follow-up Person..."
                        className="w-full pl-11 pr-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-500/5 outline-none text-sm font-medium transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* TABLE */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th onClick={() => handleSort("createdAt")} className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-indigo-600 transition-colors">
                                        Date Logged <SortIcon column="createdAt" />
                                    </th>
                                    <th onClick={() => handleSort("customer")} className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-indigo-600 transition-colors">
                                        Customer <SortIcon column="customer" />
                                    </th>
                                    <th onClick={() => handleSort("followUpBy")} className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-indigo-600 transition-colors">
                                        Follow-up By <SortIcon column="followUpBy" />
                                    </th>
                                    <th onClick={() => handleSort("result")} className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-indigo-600 transition-colors">
                                        Result <SortIcon column="result" />
                                    </th>
                                    <th onClick={() => handleSort("balance")} className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right cursor-pointer hover:text-indigo-600 transition-colors">
                                        Bal (Logged) <SortIcon column="balance" />
                                    </th>
                                    <th onClick={() => handleSort("nextFollowUpDate")} className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-indigo-600 transition-colors">
                                        Next Follow-up <SortIcon column="nextFollowUpDate" />
                                    </th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">Scanning Archives...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-2 opacity-30">
                                                <FaHistory size={48} className="text-gray-400" />
                                                <p className="text-lg font-bold text-gray-800">No records found</p>
                                                <p className="text-sm text-gray-500 uppercase tracking-widest font-bold">Try adjusting dates</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map((r) => (
                                        <tr key={r._id} className="hover:bg-gray-50/80 transition-colors group">
                                            <td className="px-6 py-5">
                                                <p className="text-[10px] font-black text-gray-800 uppercase">
                                                    {new Date(r.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </p>
                                                <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">
                                                    {new Date(r.createdAt).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </p>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                        <FaUser size={12} />
                                                    </div>
                                                    <div>
                                                        <p 
                                                            className="text-xs font-black text-gray-800 truncate w-40 hover:text-indigo-600 cursor-pointer transition-colors"
                                                            onClick={() => {
                                                                localStorage.setItem("followup_search", r.customerId?.name || "");
                                                                window.location.href = "/branch/follow-up";
                                                            }}
                                                        >
                                                            {r.customerId?.name || "Unknown"}
                                                        </p>
                                                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">{r.customerId?.whatsapp || "N/A"}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-tight">{r.followUpBy}</p>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight ${getResultColor(r.result)}`}>
                                                    {r.result}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-right font-black text-gray-800 text-xs">
                                                ₹{r.closingBalance?.toLocaleString() || "0"}
                                            </td>
                                            <td className="px-6 py-5">
                                                {r.nextFollowUpDate ? (
                                                    <div className="flex items-center gap-2 text-indigo-600">
                                                        <span className="text-[10px] font-black uppercase">
                                                            {new Date(r.nextFollowUpDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })}
                                                        </span>
                                                        <span className="text-[9px] font-bold opacity-60">
                                                            {new Date(r.nextFollowUpDate).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                        </span>
                                                    </div>
                                                ) : <span className="text-[10px] text-gray-300">-</span>}
                                            </td>
                                            <td className="px-6 py-5 max-w-xs">
                                                <p className="text-[10px] font-medium text-gray-600 line-clamp-2 italic leading-relaxed">
                                                    "{r.remarks || "No remarks"}"
                                                </p>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BranchFollowUpRecords;
