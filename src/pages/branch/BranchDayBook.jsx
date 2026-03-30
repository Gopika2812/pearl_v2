import React, { useEffect, useState } from "react";
import { FaBookOpen, FaCalendarAlt, FaFileAlt, FaSearch, FaSync, FaUser, FaFilter } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

const BranchDayBook = () => {
    const { currentBranch } = useBranch();
    const [dayBook, setDayBook] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [filterVoucherType, setFilterVoucherType] = useState("");
    const [filterInvoiceId, setFilterInvoiceId] = useState("");
    const [fromDate, setFromDate] = useState(new Date().toISOString().split("T")[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);

    const fetchDayBook = async () => {
        if (!currentBranch?._id) return;
        setLoading(true);
        try {
            const url = `${API_BASE}/financial-reports/day-book?branchId=${currentBranch._id}&fromDate=${fromDate}&toDate=${toDate}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setDayBook(data.data || []);
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            console.error("Fetch Day Book Error:", err);
            toast.error(err.message || "Failed to load Day Book");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDayBook();
    }, [currentBranch?._id, fromDate, toDate]);

    // Filtering logic
    const filteredEntries = dayBook.filter(entry => {
        const matchesSearch = entry.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesVoucher = !filterVoucherType || entry.voucherType.toLowerCase().includes(filterVoucherType.toLowerCase());
        const matchesInvoice = !filterInvoiceId || entry.invoiceId.toLowerCase().includes(filterInvoiceId.toLowerCase());
        return matchesSearch && matchesVoucher && matchesInvoice;
    });

    const totalDebit = filteredEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = filteredEntries.reduce((sum, e) => sum + (e.credit || 0), 0);

    return (
        <div className="min-h-screen bg-[#f8fafc] pt-20 md:pt-4 md:pl-20">
            <ToastContainer />
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
                
                {/* HEADER SECTION */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-[#319bab] to-[#257f87] rounded-2xl flex items-center justify-center shadow-lg shadow-[#319bab]/20">
                                <FaBookOpen className="text-white text-2xl" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-gray-800 tracking-tight">Day Book</h1>
                                <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mt-0.5">
                                    All Transactions • {currentBranch?.name || "Global"}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                             <div className="flex items-center bg-gray-50 p-2 rounded-xl border border-gray-200">
                                <div className="flex items-center gap-2 px-2">
                                    <FaCalendarAlt className="text-[#319bab] text-sm" />
                                    <input 
                                        type="date" 
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        className="bg-transparent text-xs font-bold outline-none text-gray-700" 
                                    />
                                </div>
                                <span className="text-gray-300 mx-1">|</span>
                                <div className="flex items-center gap-2 px-2">
                                    <input 
                                        type="date" 
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        className="bg-transparent text-xs font-bold outline-none text-gray-700" 
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={fetchDayBook}
                                className="p-3 bg-white text-[#319bab] border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-sm"
                                title="Refresh"
                            >
                                <FaSync className={loading ? "animate-spin" : ""} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* FILTERS SECTION */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search Customer/Supplier..." 
                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#319bab] outline-none text-sm font-medium transition"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <FaFilter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Filter Voucher Type (SI, PI...)" 
                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#319bab] outline-none text-sm font-medium transition"
                            value={filterVoucherType}
                            onChange={(e) => setFilterVoucherType(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <FaFileAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Filter Invoice ID..." 
                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#319bab] outline-none text-sm font-medium transition"
                            value={filterInvoiceId}
                            onChange={(e) => setFilterInvoiceId(e.target.value)}
                        />
                    </div>
                </div>

                {/* MAIN TABLE SECTION */}
                <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400">Date</th>
                                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400">Voucher Type</th>
                                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400">Invoice ID</th>
                                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400">Account Name</th>
                                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400 text-right">Debit (Sales)</th>
                                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400 text-right">Credit (Purchase)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-10 h-10 border-4 border-[#319bab]/20 border-t-[#319bab] rounded-full animate-spin"></div>
                                                <p className="text-sm font-bold text-gray-500 animate-pulse uppercase tracking-widest">Compiling Entries...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredEntries.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-2 opacity-30">
                                                <FaBookOpen size={48} className="text-gray-400" />
                                                <p className="text-lg font-bold text-gray-800">No transactions found</p>
                                                <p className="text-sm text-gray-500">Try adjusting your filters or date range</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEntries.map((entry) => (
                                        <tr key={entry._id} className="hover:bg-gray-50/80 transition-colors group">
                                            <td className="px-6 py-5">
                                                <p className="text-xs font-black text-gray-700">
                                                    {new Date(entry.date).toLocaleDateString("en-IN", {
                                                        day: "2-digit",
                                                        month: "short",
                                                        year: "numeric"
                                                    })}
                                                </p>
                                                <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                                                    {new Date(entry.date).toLocaleTimeString("en-IN", {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                        hour12: true
                                                    })}
                                                </p>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-tight uppercase ${
                                                    entry.type === "SALE" 
                                                    ? "bg-emerald-100 text-emerald-700" 
                                                    : "bg-amber-100 text-amber-700"
                                                }`}>
                                                    {entry.voucherType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 font-bold text-[#319bab] text-sm tracking-tight">
                                                #{entry.invoiceId}
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-[#319bab]/10 group-hover:text-[#319bab] transition">
                                                        <FaUser size={12} />
                                                    </div>
                                                    <p className="text-sm font-bold text-gray-800 truncate max-w-[200px]">
                                                        {entry.name}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right font-black text-emerald-600 text-sm">
                                                {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : "-"}
                                            </td>
                                            <td className="px-6 py-5 text-right font-black text-amber-600 text-sm">
                                                {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : "-"}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            
                            {/* TABLE FOOTER / TOTALS */}
                            {!loading && filteredEntries.length > 0 && (
                                <tfoot className="bg-gray-50/80 border-t-2 border-gray-100">
                                    <tr>
                                        <td colSpan="4" className="px-6 py-5 text-right">
                                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest mr-4">Period Totals</span>
                                        </td>
                                        <td className="px-6 py-5 text-right font-black text-emerald-600 text-lg">
                                            ₹{totalDebit.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-5 text-right font-black text-amber-600 text-lg">
                                            ₹{totalCredit.toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                <div className="mt-8 flex justify-between items-center bg-white p-4 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-xs text-gray-400 font-bold italic">
                        * The Day Book only includes finalized and invoiced transactions.
                    </p>
                    <div className="flex items-center gap-4">
                         <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Net Total</span>
                            <span className={`text-xl font-black ${totalDebit - totalCredit >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                                ₹{(totalDebit - totalCredit).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BranchDayBook;
