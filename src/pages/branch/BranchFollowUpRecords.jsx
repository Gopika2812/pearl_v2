import React, { useState, useEffect } from "react";
import { FaHistory, FaCalendarAlt, FaSearch, FaUser, FaSort, FaSortUp, FaSortDown, FaFilter, FaTag, FaClock } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

const BranchFollowUpRecords = () => {
    const { currentBranch, user } = useBranch();
    
    const isFieldAllowed = (fieldId) => {
        if (!user) return false;
        if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
        const key = `follow-up-records_${fieldId}`;
        return user.fieldPermissions?.[key] !== false;
    };

    const [records, setRecords] = useState([]);
    const [allCustomers, setAllCustomers] = useState([]);
    const [customerGroups, setCustomerGroups] = useState([]);
    const [customerCategories, setCustomerCategories] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [fromDate, setFromDate] = useState(new Date().toISOString().split("T")[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
    const [searchTerm, setSearchTerm] = useState("");
    const [groupFilter, setGroupFilter] = useState("All");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [zoneFilter, setZoneFilter] = useState("All");
    const [resultFilter, setResultFilter] = useState("All");
    const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });

    useEffect(() => {
        if (currentBranch?._id) {
            fetchRecords();
            fetchMeta();
        }
    }, [currentBranch?._id]);

    const fetchMeta = async () => {
        if (!currentBranch?._id) return;
        try {
            const [custRes, groupRes, catRes] = await Promise.all([
                fetchWithAuth(`${API_BASE}/customers?branchId=${currentBranch._id}&mini=true&limit=1000`),
                fetchWithAuth(`${API_BASE}/customer-groups?branchId=${currentBranch._id}`),
                fetchWithAuth(`${API_BASE}/customer-categories?branchId=${currentBranch._id}`)
            ]);
            const custData = await custRes.json();
            const groupData = await groupRes.json();
            const catData = await catRes.json();

            if (custData.success) setAllCustomers(custData.data || []);
            setCustomerGroups(groupData.success ? (groupData.data || []) : []);
            setCustomerCategories(catData.success ? (catData.data || []) : []);
        } catch (err) {
            console.error("Fetch meta error:", err);
        }
    };

    const fetchRecords = async () => {
        if (!currentBranch?._id) return;
        setLoading(true);
        try {
            const url = `${API_BASE}/follow-ups?branchId=${currentBranch._id}&fromDate=${fromDate}&toDate=${toDate}&limit=500`;
            const res = await fetchWithAuth(url);
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
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
        }));
    };

    const getCustomerInfo = (r) => {
        return allCustomers?.find(c => c._id === r.customerId?._id) || r.customerId || {};
    };

    const getFilteredSortedRecords = () => {
        let result = records.filter(r => {
            // Text search
            const search = searchTerm.toLowerCase();
            const matchSearch = !search || (
                (r.customerId?.name?.toLowerCase() || "").includes(search) ||
                (r.result?.toLowerCase() || "").includes(search) ||
                (r.followUpBy?.toLowerCase() || "").includes(search)
            );

            // Group filter
            const cust = getCustomerInfo(r);
            const groupName = cust?.customerGroups?.[0]?.name || cust?.customerGroup?.name || "";
            const matchGroup = groupFilter === "All" || cust?.customerGroups?.[0]?._id === groupFilter || cust?.customerGroup?._id === groupFilter;

            // Category filter
            const catName = cust?.customerCategories?.[0]?.name || cust?.customerCategory?.name || "";
            const matchCategory = categoryFilter === "All" || cust?.customerCategories?.[0]?._id === categoryFilter || cust?.customerCategory?._id === categoryFilter;

            // Zone filter
            const risk = r.riskStatus || "safe_zone";
            const matchZone = zoneFilter === "All" || risk === zoneFilter;

            // Result filter
            const matchResult = resultFilter === "All" || r.result === resultFilter;

            return matchSearch && matchGroup && matchCategory && matchZone && matchResult;
        });

        return [...result].sort((a, b) => {
            let valA, valB;
            const custA = getCustomerInfo(a);
            const custB = getCustomerInfo(b);

            switch (sortConfig.key) {
                case "customer":      valA = custA?.name || ""; valB = custB?.name || ""; break;
                case "group":         valA = custA?.customerGroups?.[0]?.name || ""; valB = custB?.customerGroups?.[0]?.name || ""; break;
                case "category":      valA = custA?.customerCategories?.[0]?.name || ""; valB = custB?.customerCategories?.[0]?.name || ""; break;
                case "zone":          valA = a.riskStatus || ""; valB = b.riskStatus || ""; break;
                case "balance":       valA = a.closingBalance || 0; valB = b.closingBalance || 0; break;
                case "nextFollowUpDate": valA = a.nextFollowUpDate || ""; valB = b.nextFollowUpDate || ""; break;
                default:              valA = a[sortConfig.key] || ""; valB = b[sortConfig.key] || "";
            }

            if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
            if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
    };

    const filteredRecords = getFilteredSortedRecords();

    const RESULT_OPTIONS = ["All", "Paid", "Promised", "Part Payment Promised", "No Response", "Call Later", "Billing Dispute", "Others"];

    const getResultColor = (result) => {
        switch (result) {
            case "Paid":                    return "bg-emerald-100 text-emerald-700";
            case "Promised":                return "bg-blue-100 text-blue-700";
            case "Part Payment Promised":   return "bg-sky-100 text-sky-700";
            case "No Response":             return "bg-gray-100 text-gray-700";
            case "Call Later":              return "bg-amber-100 text-amber-700";
            case "Billing Dispute":         return "bg-rose-100 text-rose-700";
            default:                        return "bg-indigo-50 text-indigo-700";
        }
    };

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <FaSort className="opacity-20 ml-1 inline-block" size={9} />;
        return sortConfig.direction === "asc"
            ? <FaSortUp className="ml-1 inline-block text-indigo-500" size={9} />
            : <FaSortDown className="ml-1 inline-block text-indigo-500" size={9} />;
    };

    const ThSortable = ({ label, column, className = "" }) => (
        <th
            onClick={() => handleSort(column)}
            className={`px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-indigo-600 transition-colors whitespace-nowrap ${className}`}
        >
            {label} <SortIcon column={column} />
        </th>
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] pt-20 md:pt-4 md:pl-20">
            <div className="w-full max-w-full mx-auto px-2 sm:px-4 py-4">

                {/* HEADER */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <FaHistory className="text-white text-xl" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-gray-800 tracking-tight">Follow-Up History</h1>
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-0.5">
                                    Historical records for {currentBranch?.name || "Branch"}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center bg-gray-50 p-2 rounded-xl border border-gray-200">
                                <div className="flex items-center gap-2 px-2">
                                    <FaCalendarAlt className="text-indigo-500 text-xs" />
                                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                                        className="bg-transparent text-[10px] font-black outline-none text-gray-700 uppercase" />
                                </div>
                                <span className="text-gray-300 mx-1">|</span>
                                <div className="flex items-center gap-2 px-2">
                                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                                        className="bg-transparent text-[10px] font-black outline-none text-gray-700 uppercase" />
                                </div>
                            </div>
                            <button onClick={fetchRecords} disabled={loading}
                                className="px-6 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                                {loading ? "Searching..." : "Search"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* FILTERS ROW — same style as Follow-Up Hub */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-3 w-full mb-4">
                    {/* Search */}
                    <div className="flex-1 min-w-[200px] relative">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                        <input
                            type="text"
                            placeholder="Search customer, result, or person..."
                            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg pl-9 pr-3 py-2 text-sm font-semibold text-gray-800 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Group Filter */}
                    <div className="relative min-w-[145px]">
                        <select className="w-full appearance-none bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg pl-3 pr-8 py-2 text-xs font-bold uppercase text-gray-700 outline-none cursor-pointer transition-all"
                            value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                            <option value="All">All Groups</option>
                            {customerGroups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                        </select>
                        <FaFilter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={10} />
                    </div>

                    {/* Category Filter */}
                    <div className="relative min-w-[145px]">
                        <select className="w-full appearance-none bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg pl-3 pr-8 py-2 text-xs font-bold uppercase text-gray-700 outline-none cursor-pointer transition-all"
                            value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                            <option value="All">All Categories</option>
                            {customerCategories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                        </select>
                        <FaTag className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={10} />
                    </div>

                    {/* Zone Filter */}
                    <div className="relative min-w-[130px]">
                        <select className="w-full appearance-none bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg pl-3 pr-8 py-2 text-xs font-bold uppercase text-gray-700 outline-none cursor-pointer transition-all"
                            value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
                            <option value="All">All Zones</option>
                            <option value="safe_zone">Safe Zone</option>
                            <option value="medium_zone">Medium Zone</option>
                            <option value="risk_zone">Risk Zone</option>
                        </select>
                        <FaClock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={10} />
                    </div>

                    {/* Result Filter */}
                    <div className="relative min-w-[150px]">
                        <select className="w-full appearance-none bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg pl-3 pr-8 py-2 text-xs font-bold uppercase text-gray-700 outline-none cursor-pointer transition-all"
                            value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
                            {RESULT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt === "All" ? "All Results" : opt}</option>)}
                        </select>
                        <FaFilter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={10} />
                    </div>

                    {/* Count badge */}
                    <div className="ml-auto text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                        {filteredRecords.length} records
                    </div>
                </div>

                {/* TABLE */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100">
                                    {isFieldAllowed("dateLogged") && <ThSortable label="Date Logged" column="createdAt" />}
                                    {isFieldAllowed("customer") && <ThSortable label="Customer" column="customer" />}
                                    {isFieldAllowed("customer") && <ThSortable label="Group" column="group" />}
                                    {isFieldAllowed("customer") && <ThSortable label="Category" column="category" />}
                                    {isFieldAllowed("customer") && <ThSortable label="Zone" column="zone" />}
                                    {isFieldAllowed("followUpBy") && <ThSortable label="Follow-up By" column="followUpBy" />}
                                    {isFieldAllowed("result") && <ThSortable label="Result" column="result" />}
                                    {isFieldAllowed("balance") && <ThSortable label="Bal (Logged)" column="balance" className="text-right" />}
                                    {isFieldAllowed("nextFollowUp") && <ThSortable label="Next Follow-up" column="nextFollowUpDate" />}
                                    {isFieldAllowed("remarks") && (
                                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Remarks</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan="10" className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">Scanning Archives...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan="10" className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-2 opacity-30">
                                                <FaHistory size={48} className="text-gray-400" />
                                                <p className="text-lg font-bold text-gray-800">No records found</p>
                                                <p className="text-sm text-gray-500 uppercase tracking-widest font-bold">Try adjusting filters or dates</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map((r) => {
                                        const cust = getCustomerInfo(r);
                                        const groupName = cust?.customerGroups?.[0]?.name || cust?.customerGroup?.name || "None";
                                        const catName = cust?.customerCategories?.[0]?.name || cust?.customerCategory?.name || "Unassigned";
                                        const risk = r.riskStatus || "safe_zone";

                                        return (
                                            <tr key={r._id} className="hover:bg-gray-50/80 transition-colors group">
                                                {isFieldAllowed("dateLogged") && (
                                                    <td className="px-4 py-4">
                                                        <p className="text-[10px] font-black text-gray-800 uppercase">
                                                            {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                        </p>
                                                        <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">
                                                            {new Date(r.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                                        </p>
                                                    </td>
                                                )}
                                                {isFieldAllowed("customer") && (
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                                                                <FaUser size={11} />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-gray-800 truncate max-w-[150px] hover:text-indigo-600 cursor-pointer transition-colors"
                                                                    onClick={() => {
                                                                        localStorage.setItem("followup_search", r.customerId?.name || "");
                                                                        window.location.href = "/branch/follow-up";
                                                                    }}>
                                                                    {r.customerId?.name || "Unknown"}
                                                                </p>
                                                                <p className="text-[9px] text-gray-400 font-bold uppercase">{r.customerId?.whatsapp || "N/A"}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                )}
                                                {isFieldAllowed("customer") && (
                                                    <td className="px-4 py-4">
                                                        <span className="text-[10px] font-black text-gray-700 uppercase">{groupName}</span>
                                                    </td>
                                                )}
                                                {isFieldAllowed("customer") && (
                                                    <td className="px-4 py-4">
                                                        <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-100/50 block w-fit whitespace-nowrap">
                                                            {catName}
                                                        </span>
                                                    </td>
                                                )}
                                                {isFieldAllowed("customer") && (
                                                    <td className="px-4 py-4">
                                                        {risk === "risk_zone"
                                                            ? <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase">Risk</span>
                                                            : risk === "medium_zone"
                                                            ? <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase">Medium</span>
                                                            : <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase">Safe</span>
                                                        }
                                                    </td>
                                                )}
                                                {isFieldAllowed("followUpBy") && (
                                                    <td className="px-4 py-4">
                                                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-tight">{r.followUpBy}</p>
                                                    </td>
                                                )}
                                                {isFieldAllowed("result") && (
                                                    <td className="px-4 py-4">
                                                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight ${getResultColor(r.result)}`}>
                                                            {r.result}
                                                        </span>
                                                    </td>
                                                )}
                                                {isFieldAllowed("balance") && (
                                                    <td className="px-4 py-4 text-right font-black text-gray-800 text-xs">
                                                        ₹{r.closingBalance?.toLocaleString() || "0"}
                                                    </td>
                                                )}
                                                {isFieldAllowed("nextFollowUp") && (
                                                    <td className="px-4 py-4">
                                                        {r.nextFollowUpDate ? (
                                                            <div className="flex flex-col text-indigo-600">
                                                                <span className="text-[10px] font-black uppercase">
                                                                    {new Date(r.nextFollowUpDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                                </span>
                                                                <span className="text-[9px] font-bold opacity-60">
                                                                    {new Date(r.nextFollowUpDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                                                </span>
                                                            </div>
                                                        ) : <span className="text-[10px] text-gray-300">-</span>}
                                                    </td>
                                                )}
                                                {isFieldAllowed("remarks") && (
                                                    <td className="px-4 py-4 max-w-xs">
                                                        <p className="text-[10px] font-medium text-gray-600 line-clamp-2 italic leading-relaxed">
                                                            "{r.remarks || "No remarks"}"
                                                        </p>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
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
