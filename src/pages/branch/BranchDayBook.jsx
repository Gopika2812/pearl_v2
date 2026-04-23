import { useEffect, useState } from "react";
import { FaBookOpen, FaCalendarAlt, FaFileAlt, FaFileExcel, FaFilePdf, FaFilter, FaSearch, FaSync, FaUser, FaCheckCircle } from "react-icons/fa";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";
const BranchDayBook = () => {
    const { currentBranch, user } = useBranch();
    const [dayBook, setDayBook] = useState([]);
    const [loading, setLoading] = useState(false);

    // Permission helper
    const isFieldAllowed = (fieldId) => {
        if (!user) return false;
        if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
        const key = `day-book_${fieldId}`;
        return user.fieldPermissions?.[key] !== false;
    };

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedVoucherTypes, setSelectedVoucherTypes] = useState([]); // Array for multi-select
    const [selectedSiSeries, setSelectedSiSeries] = useState("ALL"); // ALL, Z-1, Z-2, CS, LS
    const [filterInvoiceId, setFilterInvoiceId] = useState("");
    const [fromDate, setFromDate] = useState(new Date().toISOString().split("T")[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
    const [selectedIds, setSelectedIds] = useState([]);

    const VOUCHER_OPTIONS = [
        { label: "SO", value: "SO", color: "bg-blue-50 text-blue-600 border-blue-200" },
        { label: "PO", value: "PO", color: "bg-orange-50 text-orange-600 border-orange-200" },
        { label: "SI (Sales)", value: "SI", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
        { label: "PI (Purch)", value: "PI", color: "bg-amber-50 text-amber-600 border-amber-200" },
        { label: "REC", value: "REC", color: "bg-purple-50 text-purple-600 border-purple-200" },
        { label: "PAYMENT", value: "PAY", color: "bg-rose-50 text-rose-600 border-rose-200" },
        { label: "Credit Note", value: "CN", color: "bg-cyan-50 text-cyan-600 border-cyan-200" },
        { label: "Debit Note", value: "DN", color: "bg-red-50 text-red-600 border-red-200" }
    ];

    const SI_SERIES_OPTIONS = ["ALL", "CS", "LS", "Z-1", "Z-2"];

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
        setSelectedIds([]); // Clear selection on fetch/date change
    }, [currentBranch?._id, fromDate, toDate]);

    // Filtering logic
    const filteredEntries = dayBook.filter(entry => {
        const matchesSearch = 
            entry.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            entry.invoiceId.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Match Voucher Types (Multiple selection)
        const matchesVoucher = selectedVoucherTypes.length === 0 || selectedVoucherTypes.includes(entry.voucherType);
        
        // Match SI Series if SI is selected or if we are filtering globally by prefix
        let matchesSeries = true;
        if (selectedSiSeries !== "ALL") {
            const id = entry.invoiceId || "";
            // Special case: if filtering for a specific series, and it's SI, it must match.
            // If it's another type, we might want to hide it or keep it? 
            // The user said "SI - Z-1 , Z-2, CS, LS" so we apply it strictly when SI is in focus.
            if (entry.voucherType === "SI") {
                matchesSeries = id.startsWith(selectedSiSeries);
            } else {
                // If filtering by series but the entry isn't an SI, hide it
                matchesSeries = false;
            }
        }

        const matchesInvoice = !filterInvoiceId || entry.invoiceId.toLowerCase().includes(filterInvoiceId.toLowerCase());
        
        return matchesSearch && matchesVoucher && matchesInvoice && matchesSeries;
    });

    const totalDebit = filteredEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = filteredEntries.reduce((sum, e) => sum + (e.credit || 0), 0);

    const handleExportExcel = () => {
        const dataToExport = selectedIds.length > 0 
            ? filteredEntries.filter(e => selectedIds.includes(e._id))
            : filteredEntries;

        if (dataToExport.length === 0) {
            toast.warn("No transactions to export");
            return;
        }

        const exportData = dataToExport.map((entry) => ({
            "Date": new Date(entry.date).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }),
            "Time": new Date(entry.date).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true
            }),
            "Voucher Type": entry.voucherType || "-",
            "Invoice ID": entry.invoiceId || "-",
            "Account Name": entry.name || "-",
            "Debit (Sales)": entry.debit || 0,
            "Credit (Purchase)": entry.credit || 0
        }));

        // Totals for export
        const expDebit = dataToExport.reduce((sum, e) => sum + (e.debit || 0), 0);
        const expCredit = dataToExport.reduce((sum, e) => sum + (e.credit || 0), 0);

        exportData.push({
            "Date": "TOTAL",
            "Time": "",
            "Voucher Type": "",
            "Invoice ID": "",
            "Account Name": "",
            "Debit (Sales)": expDebit,
            "Credit (Purchase)": expCredit
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Daybook Report");

        const wscols = [
            { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }
        ];
        worksheet["!cols"] = wscols;

        XLSX.writeFile(workbook, `Daybook_${fromDate}_to_${toDate}.xlsx`);
        toast.success("Excel report exported successfully");
    };

    const handleExportPDF = () => {
        const dataToExport = selectedIds.length > 0 
            ? filteredEntries.filter(e => selectedIds.includes(e._id))
            : filteredEntries;

        if (dataToExport.length === 0) {
            toast.warn("No transactions to export");
            return;
        }

        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(20);
        doc.text("DAY BOOK REPORT", 105, 15, { align: "center" });
        doc.setFontSize(10);
        doc.text(`Branch: ${currentBranch?.name || "Global"}`, 14, 25);
        doc.text(`Period: ${fromDate} to ${toDate}`, 14, 30);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);

        const tableColumn = ["Date", "Voucher", "Invoice ID", "Account Name", "Debit", "Credit"];
        const tableRows = [];

        dataToExport.forEach(entry => {
            tableRows.push([
                new Date(entry.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }),
                entry.voucherType,
                entry.invoiceId,
                entry.name,
                entry.debit > 0 ? entry.debit.toLocaleString() : "-",
                entry.credit > 0 ? entry.credit.toLocaleString() : "-"
            ]);
        });

        // Totals
        const expDebit = dataToExport.reduce((sum, e) => sum + (e.debit || 0), 0);
        const expCredit = dataToExport.reduce((sum, e) => sum + (e.credit || 0), 0);
        tableRows.push([
            { content: "GRAND TOTAL", colSpan: 4, styles: { fontStyle: "bold", halign: "right" } },
            { content: expDebit.toLocaleString(), styles: { fontStyle: "bold" } },
            { content: expCredit.toLocaleString(), styles: { fontStyle: "bold" } }
        ]);

        autoTable(doc, {
            startY: 45,
            head: [tableColumn],
            body: tableRows,
            theme: "grid",
            headStyles: { fillColor: [49, 155, 171], fontSize: 9, fontStyle: "bold" },
            bodyStyles: { fontSize: 8 },
            alternateRowStyles: { fillColor: [245, 245, 245] }
        });

        doc.save(`Daybook_${fromDate}_to_${toDate}.pdf`);
        toast.success("PDF report exported successfully");
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] pt-20 md:pt-4 md:pl-20">

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
                            <button
                                onClick={handleExportExcel}
                                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20 text-xs font-bold"
                                title="Export to Excel"
                            >
                                <FaFileExcel />
                                <span className="hidden sm:inline">EXCEL</span>
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="flex items-center gap-2 px-5 py-3 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition shadow-lg shadow-rose-600/20 text-xs font-bold"
                                title="Export to PDF"
                            >
                                <FaFilePdf />
                                <span className="hidden sm:inline">PDF</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* FILTERS SECTION */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6 space-y-6">
                    {/* Search & ID Filter */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search Name or Invoice ID..."
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-transparent focus:bg-white focus:border-[#319bab]/30 rounded-2xl focus:ring-4 focus:ring-[#319bab]/5 outline-none text-sm font-medium transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <FaFilter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Advanced Invoice ID Filter..."
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-transparent focus:bg-white focus:border-[#319bab]/30 rounded-2xl focus:ring-4 focus:ring-[#319bab]/5 outline-none text-sm font-medium transition-all"
                                value={filterInvoiceId}
                                onChange={(e) => setFilterInvoiceId(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Voucher Type Tags */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-[2px] text-gray-400">Transaction Type</label>
                            <button 
                                onClick={() => setSelectedVoucherTypes([])}
                                className="text-[10px] font-black text-[#319bab] hover:underline"
                            >
                                RESET ALL
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {VOUCHER_OPTIONS.map((opt) => {
                                const isActive = selectedVoucherTypes.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => {
                                            setSelectedVoucherTypes(prev => 
                                                prev.includes(opt.value) 
                                                    ? prev.filter(v => v !== opt.value)
                                                    : [...prev, opt.value]
                                            );
                                        }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                                            isActive 
                                                ? `${opt.color} shadow-sm scale-105` 
                                                : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
                                        }`}
                                    >
                                        {isActive && <FaCheckCircle className="text-[10px]" />}
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* SI Series Selection (Conditional) */}
                    {(selectedVoucherTypes.length === 0 || selectedVoucherTypes.includes("SI")) && (
                        <div className="space-y-3 pt-4 border-t border-gray-50 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-[10px] font-black uppercase tracking-[2px] text-gray-400">Sales Invoice Series</label>
                            <div className="flex flex-wrap gap-2">
                                {SI_SERIES_OPTIONS.map((series) => (
                                    <button
                                        key={series}
                                        onClick={() => setSelectedSiSeries(series)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                                            selectedSiSeries === series
                                                ? "bg-[#319bab] text-white border-[#319bab] shadow-md shadow-[#319bab]/20 scale-105"
                                                : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
                                        }`}
                                    >
                                        {series === "ALL" ? "ALL SERIES" : series}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* MAIN TABLE SECTION */}
                <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-5 text-center">
                                        <input 
                                            type="checkbox"
                                            className="w-4 h-4 rounded text-[#319bab] focus:ring-[#319bab]"
                                            checked={filteredEntries.length > 0 && selectedIds.length === filteredEntries.length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedIds(filteredEntries.map(e => e._id));
                                                } else {
                                                    setSelectedIds([]);
                                                }
                                            }}
                                        />
                                    </th>
                                    {isFieldAllowed("date") && <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400">Date</th>}
                                    {isFieldAllowed("voucherType") && <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400">Voucher Type</th>}
                                    {isFieldAllowed("invoiceId") && <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400">Invoice ID</th>}
                                    {isFieldAllowed("accountName") && <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400">Account Name</th>}
                                    {isFieldAllowed("debit") && <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400 text-right">Debit (Sales)</th>}
                                    {isFieldAllowed("credit") && <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-gray-400 text-right">Credit (Purchase)</th>}
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
                                        <tr key={entry._id} className={`hover:bg-gray-50/80 transition-colors group ${selectedIds.includes(entry._id) ? "bg-blue-50/50" : ""}`}>
                                            <td className="px-6 py-5 text-center">
                                                <input 
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded text-[#319bab] focus:ring-[#319bab]"
                                                    checked={selectedIds.includes(entry._id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedIds(prev => [...prev, entry._id]);
                                                        } else {
                                                            setSelectedIds(prev => prev.filter(id => id !== entry._id));
                                                        }
                                                    }}
                                                />
                                            </td>
                                            {isFieldAllowed("date") && (
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
                                            )}
                                            {isFieldAllowed("voucherType") && (
                                                <td className="px-6 py-5">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-tight uppercase ${entry.type === "SALE"
                                                            ? "bg-emerald-100 text-emerald-700"
                                                            : "bg-amber-100 text-amber-700"
                                                        }`}>
                                                        {entry.voucherType}
                                                    </span>
                                                </td>
                                            )}
                                            {isFieldAllowed("invoiceId") && (
                                                <td className="px-6 py-5 font-bold text-[#319bab] text-sm tracking-tight">
                                                    {entry.invoiceId}
                                                </td>
                                            )}
                                            {isFieldAllowed("accountName") && (
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
                                            )}
                                            {isFieldAllowed("debit") && (
                                                <td className="px-6 py-5 text-right font-black text-emerald-600 text-sm">
                                                    {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : "-"}
                                                </td>
                                            )}
                                            {isFieldAllowed("credit") && (
                                                <td className="px-6 py-5 text-right font-black text-amber-600 text-sm">
                                                    {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : "-"}
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>

                            {/* TABLE FOOTER / TOTALS */}
                            {!loading && filteredEntries.length > 0 && (
                                <tfoot className="bg-gray-50/80 border-t-2 border-gray-100">
                                    <tr>
                                        <td colSpan={isFieldAllowed("date") ? 1 : 0} className="px-6 py-5 text-center"></td>
                                        <td colSpan={
                                            (isFieldAllowed("voucherType") ? 1 : 0) + 
                                            (isFieldAllowed("invoiceId") ? 1 : 0) + 
                                            (isFieldAllowed("accountName") ? 1 : 0)
                                        } className="px-6 py-5 text-right">
                                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest mr-4">Period Totals</span>
                                        </td>
                                        {isFieldAllowed("debit") && (
                                            <td className="px-6 py-5 text-right font-black text-emerald-600 text-lg">
                                                ₹{totalDebit.toLocaleString()}
                                            </td>
                                        )}
                                        {isFieldAllowed("credit") && (
                                            <td className="px-6 py-5 text-right font-black text-amber-600 text-lg">
                                                ₹{totalCredit.toLocaleString()}
                                            </td>
                                        )}
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* SELECTED COUNT BAR */}
                {selectedIds.length > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900/90 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-8 border border-white/10 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Selection Active</span>
                            <span className="text-xl font-black">{selectedIds.length} <span className="text-sm font-medium text-gray-400 ml-1">Transactions Selected</span></span>
                        </div>
                        <div className="h-10 w-[1px] bg-white/10 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setSelectedIds([])}
                                className="px-4 py-2 text-xs font-black uppercase hover:bg-white/10 rounded-lg transition"
                            >
                                Clear
                            </button>
                            <button 
                                onClick={handleExportExcel}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded-lg transition shadow-lg shadow-emerald-600/40"
                            >
                                Excel
                            </button>
                            <button 
                                onClick={handleExportPDF}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase rounded-lg transition shadow-lg shadow-rose-600/40"
                            >
                                PDF
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BranchDayBook;
