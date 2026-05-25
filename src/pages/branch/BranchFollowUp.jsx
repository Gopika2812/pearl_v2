import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { 
    FaUser, FaPhone, FaMoneyBillWave, FaClock, FaHistory, 
    FaSearch, FaFilter, FaSort, FaSortUp, FaSortDown,
    FaArrowRight, FaBook, FaCalendarAlt, FaCog, FaTag,
    FaEdit, FaChevronLeft, FaChevronRight, FaChevronUp, FaChevronDown, FaListOl, FaTicketAlt,
    FaCloudUploadAlt, FaSpinner, FaFileInvoice
} from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth, apiWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

import FollowUpFormModal from "../../components/branch/FollowUpFormModal";
import CustomerFollowUpHistoryModal from "../../components/branch/CustomerFollowUpHistoryModal";
import TokenManagerModal from "../../components/branch/TokenManagerModal";
import CategoryManagementModal from "../../components/branch/CategoryManagementModal";
import InventoryAddCustomerModal from "../../components/inventory/InventoryAddCustomerModal";

const BranchFollowUp = () => {
    const navigate = useNavigate();
    const { currentBranch, user } = useBranch();

    const [customers, setCustomers] = useState([]);
    const [customerGroups, setCustomerGroups] = useState([]);
    const [customerCategories, setCustomerCategories] = useState([]);
    const [salesOwners, setSalesOwners] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [groupFilter, setGroupFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [zoneFilter, setZoneFilter] = useState("");

    // Date Range Filters (Indian FY Presets)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const fyStartYear = currentMonth < 3 ? currentYear - 1 : currentYear;
    const defaultStartDate = `${fyStartYear}-04-01`;
    const defaultEndDate = now.toISOString().split("T")[0];

    const [startDate, setStartDate] = useState(defaultStartDate);
    const [endDate, setEndDate] = useState(defaultEndDate);
    const [datePreset, setDatePreset] = useState("Cur FY");
    const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

    const getPresetDates = (preset) => {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        switch (preset) {
            case "Today":
                break;
            case "Yesterday":
                start.setDate(today.getDate() - 1);
                end.setDate(today.getDate() - 1);
                break;
            case "This Week": {
                const day = today.getDay();
                const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                break;
            }
            case "Last Week": {
                const lastWeekDay = today.getDay();
                const lastWeekDiff = today.getDate() - lastWeekDay + (lastWeekDay === 0 ? -6 : 1) - 7;
                start.setDate(lastWeekDiff);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
                break;
            }
            case "This Month":
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case "Last Month":
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case "This Quarter": {
                const currentMonth = today.getMonth();
                const fyStartYear = currentMonth < 3 ? today.getFullYear() - 1 : today.getFullYear();
                let qStartMonth, qEndMonth, qYear;
                if (currentMonth >= 3 && currentMonth <= 5) {
                    qStartMonth = 3; qEndMonth = 5; qYear = fyStartYear;
                } else if (currentMonth >= 6 && currentMonth <= 8) {
                    qStartMonth = 6; qEndMonth = 8; qYear = fyStartYear;
                } else if (currentMonth >= 9 && currentMonth <= 11) {
                    qStartMonth = 9; qEndMonth = 11; qYear = fyStartYear;
                } else {
                    qStartMonth = 0; qEndMonth = 2; qYear = fyStartYear + 1;
                }
                start = new Date(qYear, qStartMonth, 1);
                end = new Date(qYear, qEndMonth + 1, 0);
                break;
            }
            case "Last Quarter": {
                const currentMonth = today.getMonth();
                const fyStartYear = currentMonth < 3 ? today.getFullYear() - 1 : today.getFullYear();
                let qStartMonth, qEndMonth, qYear;
                if (currentMonth >= 3 && currentMonth <= 5) {
                    qStartMonth = 0; qEndMonth = 2; qYear = fyStartYear;
                } else if (currentMonth >= 6 && currentMonth <= 8) {
                    qStartMonth = 3; qEndMonth = 5; qYear = fyStartYear;
                } else if (currentMonth >= 9 && currentMonth <= 11) {
                    qStartMonth = 6; qEndMonth = 8; qYear = fyStartYear;
                } else {
                    qStartMonth = 9; qEndMonth = 11; qYear = fyStartYear;
                }
                start = new Date(qYear, qStartMonth, 1);
                end = new Date(qYear, qEndMonth + 1, 0);
                break;
            }
            case "Cur FY": {
                const currentMonth = today.getMonth();
                const fyStartYear = currentMonth < 3 ? today.getFullYear() - 1 : today.getFullYear();
                start = new Date(fyStartYear, 3, 1);
                end = new Date(fyStartYear + 1, 3, 0);
                break;
            }
            case "Pre FY": {
                const currentMonth = today.getMonth();
                const fyStartYear = currentMonth < 3 ? today.getFullYear() - 1 : today.getFullYear();
                start = new Date(fyStartYear - 1, 3, 1);
                end = new Date(fyStartYear, 3, 0);
                break;
            }
            default:
                return null;
        }

        return {
            start: start.toISOString().split("T")[0],
            end: end.toISOString().split("T")[0]
        };
    };
    
    // Permission helper
    const isFieldAllowed = (fieldId) => {
      if (!user) return false;
      if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
      const key = `follow-up-form_${fieldId}`;
      return user.fieldPermissions?.[key] !== false;
    };

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [totalPages, setTotalPages] = useState(1);

    // Modal states
    const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isTokenOpen, setIsTokenOpen] = useState(false);
    const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
    
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState(null);
    const [selectedCustomerForToken, setSelectedCustomerForToken] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [bulkUpdating, setBulkUpdating] = useState(false);
    const fileInputRef = React.useRef(null);

    // Sorting state - default to Balance High to Low
    const [sortConfig, setSortConfig] = useState({ key: "balance", direction: "desc" });

    useEffect(() => {
        if (currentBranch?._id) {
            const savedSearch = localStorage.getItem("followup_search");
            if (savedSearch) {
                setSearchTerm(savedSearch);
                localStorage.removeItem("followup_search");
            }
            fetchData();
        }
    }, [currentBranch?._id]);

    const fetchData = async () => {
        if (!currentBranch?._id) return;
        setLoading(true);
        try {
            // STAGE 1: Fetch light customer data (No expensive balance calculations)
            // We also fetch groups/categories/owners as usual
            const [custRes, groupRes, categoryRes, salesOwnerRes] = await Promise.all([
                fetchWithAuth(`${API_BASE}/customers?branchId=${currentBranch._id}&mini=true&limit=${rowsPerPage}&page=${currentPage}&search=${searchTerm}&customerGroupId=${groupFilter}&customerCategoryId=${categoryFilter}&riskStatus=${zoneFilter}&sortBy=${sortConfig.key}&sortOrder=${sortConfig.direction}&fromDate=${startDate}&toDate=${endDate}`),
                fetchWithAuth(`${API_BASE}/customer-groups?branchId=${currentBranch._id}`),
                fetchWithAuth(`${API_BASE}/customer-categories?branchId=${currentBranch._id}`),
                fetchWithAuth(`${API_BASE}/sales-owners?branchId=${currentBranch._id}`)
            ]);
            
            const custData = await custRes.json();
            const groupData = await groupRes.json();
            const categoryData = await categoryRes.json();
            const ownerData = await salesOwnerRes.json();

            let fetchedCustomers = [];
            if (custData.success) {
                fetchedCustomers = custData.data || [];
                setTotalPages(custData.pagination?.pages || 1);
            } else if (Array.isArray(custData)) {
                fetchedCustomers = custData;
            }

            setCustomers(fetchedCustomers);
            
            // Resilience: Handle both {success, data} and plain array formats
            const groups = groupData.success ? (groupData.data || []) : (Array.isArray(groupData) ? groupData : []);
            const categories = categoryData.success ? (categoryData.data || []) : (Array.isArray(categoryData) ? categoryData : []);
            
            setCustomerGroups(groups);
            setCustomerCategories(categories);
            if (ownerData.success) setSalesOwners(ownerData.data || []);

            setLoading(false); // UI is now fast and interactive with basic info

            // STAGE 2: Background fetch balances for ONLY the visible customers on THIS page
            if (fetchedCustomers.length > 0) {
                const customerIds = fetchedCustomers.map(c => c._id);
                const balRes = await fetchWithAuth(`${API_BASE}/customers/balances`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ customerIds, branchId: currentBranch._id, fromDate: startDate, toDate: endDate })
                });
                const balData = await balRes.json();
                
                if (balData.success) {
                    const balMap = new Map(balData.data.map(b => [b._id, b]));
                    setCustomers(prev => prev.map(c => {
                        if (balMap.has(c._id)) {
                            return { ...c, ...balMap.get(c._id) };
                        }
                        return c;
                    }));
                }

            }
        } catch (err) {
            console.error("Error fetching data:", err);
            toast.error("Failed to load customer data");
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

    const getBalance = (c) => (c.debit || 0) - (c.credit || 0);

    const paginatedCustomers = customers;

    // Reset and trigger fetch when filters or pagination change
    useEffect(() => {
        fetchData();
    }, [searchTerm, groupFilter, categoryFilter, zoneFilter, rowsPerPage, currentPage, sortConfig, startDate, endDate]);

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <FaSort className="opacity-20 ml-1" />;
        return sortConfig.direction === "asc" ? <FaSortUp className="ml-1 text-indigo-500" /> : <FaSortDown className="ml-1 text-indigo-500" />;
    };

    const openFollowUp = (customer) => {
        setSelectedCustomer(customer);
        setIsFollowUpOpen(true);
    };

    const openLedger = (customer) => {
        window.open(`/branch/customer-ledger/${customer._id}`, '_blank');
    };


    const openHistory = (customer) => {
        setSelectedCustomerForHistory(customer);
        setIsHistoryOpen(true);
    };

    const openToken = (customer) => {
        setSelectedCustomerForToken(customer);
        setIsTokenOpen(true);
    };

    const openEditCustomer = (customer) => {
        setEditingId(customer._id);
        setEditForm({
            ...customer,
            customerGroups: Array.isArray(customer.customerGroups) 
                ? customer.customerGroups.map(g => typeof g === 'object' ? g._id : g) 
                : (customer.customerGroup ? [typeof customer.customerGroup === 'object' ? customer.customerGroup._id : customer.customerGroup] : []),
            customerCategories: Array.isArray(customer.customerCategories) 
                ? customer.customerCategories.map(c => typeof c === 'object' ? c._id : c) 
                : (customer.customerCategory ? [typeof customer.customerCategory === 'object' ? customer.customerCategory._id : customer.customerCategory] : []),
            salesOwner: typeof customer.salesOwner === 'object' ? customer.salesOwner._id : (customer.salesOwner || "")
        });
    };

    const handleInlineSave = async () => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/customers/${editingId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editForm)
            });
            if (res.ok) {
                toast.success("Customer updated successfully");
                setEditingId(null);
                fetchData();
            } else {
                const data = await res.json();
                toast.error(data.message || "Update failed");
            }
        } catch (err) {
            console.error("Save error:", err);
            toast.error("An error occurred while saving");
        }
    };

    const handleSaveCustomer = async (customerData) => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/customers/${customerData._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(customerData)
            });
            if (res.ok) {
                toast.success("Customer updated successfully");
                fetchData();
                setIsEditCustomerOpen(false);
            } else {
                const data = await res.json();
                toast.error(data.message || "Update failed");
            }
        } catch (err) {
            console.error("Save error:", err);
            toast.error("An error occurred while saving");
        }
    };

    const handleBulkCreditUpdate = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!window.confirm("Are you sure you want to bulk update credit limits? This will replace existing limits with values from your Excel sheet (including 0s).")) {
            e.target.value = null;
            return;
        }

        setBulkUpdating(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("branchId", currentBranch._id);

        try {
            const res = await fetchWithAuth(`${API_BASE}/customers/bulk-update-credit`, {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchData();
            } else {
                toast.error(data.message || "Bulk update failed");
            }
        } catch (err) {
            console.error("Bulk update error:", err);
            toast.error("Failed to upload file");
        } finally {
            setBulkUpdating(false);
            e.target.value = null;
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] pt-20 md:pt-4 px-4 sm:px-6 pb-10">
            <div className="w-full max-w-full mx-auto py-2">
                
                {/* HEADER & FILTERS */}
                <div className="flex flex-col gap-4 mb-4">
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                                <FaPhone className="text-white text-lg" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-gray-900 leading-none">Follow-Up Hub</h1>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Recovery Dashboard</p>
                            </div>
                        </div>
                    </div>

                    {/* Filters Row */}
                    <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center gap-3 w-full">
                        {/* Search Bar */}
                        <div className="flex-1 relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <FaSearch size={14} />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by name, mobile..."
                                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg pl-9 pr-3 py-2.5 text-sm font-semibold text-gray-800 outline-none transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Filter Selects Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex gap-2 lg:gap-3">
                            <div className="relative min-w-[140px]">
                                <select
                                    className="w-full appearance-none bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg pl-3 pr-8 py-2.5 text-xs font-bold uppercase text-gray-700 outline-none cursor-pointer transition-all"
                                    value={groupFilter}
                                    onChange={(e) => setGroupFilter(e.target.value)}
                                >
                                    <option value="">All Groups</option>
                                    {customerGroups.map(g => (
                                        <option key={g._id} value={g._id}>{g.name}</option>
                                    ))}
                                </select>
                                <FaFilter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={10} />
                            </div>

                            <div className="relative min-w-[140px]">
                                <select
                                    className="w-full appearance-none bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg pl-3 pr-8 py-2.5 text-xs font-bold uppercase text-gray-700 outline-none cursor-pointer transition-all"
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                >
                                    <option value="">All Categories</option>
                                    {customerCategories.map(cat => (
                                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                                    ))}
                                </select>
                                <FaTag className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={10} />
                            </div>

                            <div className="relative min-w-[140px]">
                                <select
                                    className="w-full appearance-none bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg pl-3 pr-8 py-2.5 text-xs font-bold uppercase text-gray-700 outline-none cursor-pointer transition-all"
                                    value={zoneFilter}
                                    onChange={(e) => setZoneFilter(e.target.value)}
                                >
                                    <option value="">All Zones</option>
                                    <option value="safe_zone">Safe Zone</option>
                                    <option value="medium_zone">Medium Zone</option>
                                    <option value="risk_zone">Risk Zone</option>
                                </select>
                                <FaClock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={10} />
                            </div>

                            {/* Date Range Selector */}
                            <div className="relative min-w-[200px]">
                                <button
                                    onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                                    className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg px-3 py-2.5 text-xs font-bold uppercase text-gray-700 outline-none cursor-pointer transition-all shadow-sm hover:bg-gray-100"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <FaCalendarAlt className="text-indigo-500" size={12} />
                                        <span className="normal-case font-bold tracking-tight">
                                            {new Date(startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })} - {new Date(endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                        </span>
                                    </div>
                                    <FaChevronDown size={10} className="text-gray-400 ml-1.5" />
                                </button>

                                {isDateDropdownOpen && (
                                    <div className="absolute right-0 lg:left-0 mt-2 w-[340px] bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-4 flex gap-3 animate-fade-in">
                                        {/* Presets Column */}
                                        <div className="flex flex-col gap-1 border-r border-gray-100 pr-3 w-[120px] shrink-0">
                                            {["Today", "Yesterday", "This Week", "Last Week", "This Month", "Last Month", "This Quarter", "Last Quarter", "Cur FY", "Pre FY"].map(preset => (
                                                <button
                                                    key={preset}
                                                    onClick={() => {
                                                        setDatePreset(preset);
                                                        const dates = getPresetDates(preset);
                                                        if (dates) {
                                                            setStartDate(dates.start);
                                                            setEndDate(dates.end);
                                                        }
                                                    }}
                                                    className={`text-left px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                                        datePreset === preset 
                                                            ? "bg-indigo-50 text-indigo-700 font-extrabold" 
                                                            : "text-gray-500 hover:bg-gray-50"
                                                    }`}
                                                >
                                                    {preset}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Custom Picker Column */}
                                        <div className="flex-1 flex flex-col gap-3.5 justify-between">
                                            <div className="flex flex-col gap-2.5">
                                                <div>
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Start Date</label>
                                                    <input
                                                        type="date"
                                                        value={startDate}
                                                        onChange={(e) => {
                                                            setDatePreset("Custom");
                                                            setStartDate(e.target.value);
                                                        }}
                                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">End Date</label>
                                                    <input
                                                        type="date"
                                                        value={endDate}
                                                        onChange={(e) => {
                                                            setDatePreset("Custom");
                                                            setEndDate(e.target.value);
                                                        }}
                                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setIsDateDropdownOpen(false)}
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-widest py-2 rounded-lg transition-colors shadow-md shadow-indigo-100 mt-2"
                                            >
                                                Apply Filter
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {user?.role === "SUPER_ADMIN" && (
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleBulkCreditUpdate} 
                                        className="hidden" 
                                        accept=".xlsx, .xls"
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current.click()}
                                        disabled={bulkUpdating}
                                        className="flex-1 lg:w-10 h-10 bg-indigo-600 border border-indigo-700 rounded-lg flex items-center justify-center text-white hover:bg-indigo-700 transition-all shadow-sm shrink-0 disabled:opacity-50"
                                        title="Bulk Update Credit Limits"
                                    >
                                        {bulkUpdating ? <FaSpinner className="animate-spin" /> : <FaCloudUploadAlt size={16} />}
                                    </button>
                                    <button 
                                        onClick={() => setIsManageCategoriesOpen(true)}
                                        className="flex-1 lg:w-10 h-10 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shrink-0"
                                        title="Manage Master Data"
                                    >
                                        <FaCog size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* MAIN TABLE */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[800px] flex flex-col">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-[600px]">
                            <div className="relative w-28 h-28 mb-8">
                                <div className="absolute inset-0 border-[6px] border-indigo-50 rounded-full"></div>
                                <div className="absolute inset-0 border-[6px] border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                            </div>
                            <p className="text-xs font-black text-indigo-400 uppercase tracking-[0.5em] animate-pulse">Syncing Ledger Cloud...</p>
                        </div>
                    ) : (
                        <>
                            {/* MOBILE SORTING CONTROLS */}
                            <div className="md:hidden bg-gray-50/50 p-4 border-b border-gray-200 flex items-center justify-between">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sort Records By</p>
                                <div className="flex gap-2">
                                    <select 
                                        className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-[10px] font-bold uppercase outline-none"
                                        value={sortConfig.key || "createdAt"}
                                        onChange={(e) => handleSort(e.target.value)}
                                    >
                                        <option value="name">Name</option>
                                        <option value="balance">Balance</option>
                                        <option value="invoiceAge">Invoice Age</option>
                                        <option value="receiptAge">Receipt Age</option>
                                        {(user?.role === "SUPER_ADMIN" || user?.role === "SUPERADMIN") && <option value="margin">Margin</option>}
                                        <option value="limit">Credit Limit</option>
                                        <option value="createdAt">Date Created</option>
                                    </select>
                                    <button 
                                        onClick={() => handleSort(sortConfig.key)}
                                        className="bg-white border border-gray-200 p-2 rounded-lg text-gray-600 active:scale-95 transition"
                                    >
                                        {sortConfig.direction === "asc" ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                                    </button>
                                </div>
                            </div>

                            {/* MOBILE CARD VIEW */}
                            <div className="md:hidden flex-1 overflow-y-auto bg-gray-50/30">
                                <div className="p-4 space-y-4">
                                    {paginatedCustomers.map((customer) => {
                                        const isEditing = editingId === customer._id;
                                        const balance = getBalance(customer);
                                        const days = customer.lastInvoiceDate ? Math.floor((new Date() - new Date(customer.lastInvoiceDate)) / (1000 * 60 * 60 * 24)) : null;
                                        const primaryGroup = customer.customerGroups?.[0]?.name || customer.customerGroup?.name || "None";
                                        
                                        if (isEditing) {
                                            return (
                                                <div key={customer._id} className="bg-indigo-50/50 rounded-2xl shadow-xl border-2 border-indigo-500 overflow-hidden p-5 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest">Edit Customer Mode</h3>
                                                        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><FaSearch size={14} /></button>
                                                    </div>
                                                    
                                                    <div className="space-y-4">
                                                        {/* Primary Info */}
                                                        <div>
                                                            <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Customer Name</label>
                                                            <input type="text" className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-bold" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Group</label>
                                                                <select className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-bold" value={editForm.customerGroups?.[0] || ""} onChange={(e) => setEditForm({ ...editForm, customerGroups: [e.target.value] })}>
                                                                    <option value="">No Group</option>
                                                                    {customerGroups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Category</label>
                                                                <select className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-bold" value={editForm.customerCategories?.[0] || ""} onChange={(e) => setEditForm({ ...editForm, customerCategories: [e.target.value] })}>
                                                                    <option value="">No Category</option>
                                                                    {customerCategories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {/* Contact & Risk */}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">WhatsApp</label>
                                                                <input type="text" className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-bold" value={editForm.whatsapp} onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })} />
                                                            </div>
                                                            <div>
                                                                <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Zone</label>
                                                                <select className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-bold" value={editForm.riskStatus || "safe_zone"} onChange={(e) => setEditForm({ ...editForm, riskStatus: e.target.value })}>
                                                                    <option value="safe_zone">Safe</option>
                                                                    <option value="medium_zone">Medium</option>
                                                                    <option value="risk_zone">Risk</option>
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Email</label>
                                                            <input type="text" className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-bold" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                                                        </div>

                                                        {/* Financials */}
                                                        {user?.role === "SUPER_ADMIN" ? (
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Limit (₹)</label>
                                                                    <input type="number" className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-bold" value={editForm.creditLimit} onChange={(e) => setEditForm({ ...editForm, creditLimit: e.target.value })} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">CR Days</label>
                                                                    <input type="number" className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-bold" value={editForm.creditLimitDays} onChange={(e) => setEditForm({ ...editForm, creditLimitDays: e.target.value })} />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <span className="text-[9px] font-black uppercase text-gray-400 block mb-1">Limit (₹)</span>
                                                                    <span className="text-sm font-bold text-gray-500 py-2 block">₹{(editForm.creditLimit ?? 0).toLocaleString()}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] font-black uppercase text-gray-400 block mb-1">CR Days</span>
                                                                    <span className="text-sm font-bold text-gray-500 py-2 block">{editForm.creditLimitDays || 0} Days</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {(user?.role === "SUPER_ADMIN" || user?.role === "SUPERADMIN") ? (
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Margin (%)</label>
                                                                    <input type="number" step="0.01" className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-bold" value={editForm.margin} onChange={(e) => setEditForm({ ...editForm, margin: e.target.value })} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Sales Manager</label>
                                                                    <select className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-[10px] font-bold" value={editForm.salesOwner || ""} onChange={(e) => setEditForm({ ...editForm, salesOwner: e.target.value })}>
                                                                        <option value="">Select Owner</option>
                                                                        {salesOwners.map(owner => <option key={owner._id} value={owner._id}>{owner.name}</option>)}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Sales Manager</label>
                                                                <select className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-bold" value={editForm.salesOwner || ""} onChange={(e) => setEditForm({ ...editForm, salesOwner: e.target.value })}>
                                                                    <option value="">Select Owner</option>
                                                                    {salesOwners.map(owner => <option key={owner._id} value={owner._id}>{owner.name}</option>)}
                                                                </select>
                                                            </div>
                                                        )}

                                                        {/* Address Info */}
                                                        <div>
                                                            <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Address</label>
                                                            <input type="text" className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-bold" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">District</label>
                                                                <input type="text" className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-bold" value={editForm.district} onChange={(e) => setEditForm({ ...editForm, district: e.target.value })} />
                                                            </div>
                                                            <div>
                                                                <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">State Code</label>
                                                                <input type="text" className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm font-bold" value={editForm.stateCode} onChange={(e) => setEditForm({ ...editForm, stateCode: e.target.value })} />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2 pt-4">
                                                        <button 
                                                            onClick={() => setEditingId(null)}
                                                            className="flex-1 bg-white border border-gray-200 text-gray-500 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button 
                                                            onClick={handleInlineSave}
                                                            className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200"
                                                        >
                                                            Save Changes
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={customer._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                                <div className="p-5">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex-1">
                                                            <h3 className="text-sm font-black text-gray-900 leading-tight mb-1">{customer.name}</h3>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded uppercase tracking-wider">{primaryGroup}</span>
                                                                <span className="text-[10px] font-bold text-gray-400">{customer.whatsapp || "No Contact"}</span>
                                                            </div>
                                                        </div>
                                                        {customer.riskStatus === "risk_zone" ? (
                                                            <span className="bg-rose-500 text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md shadow-rose-200">Risk</span>
                                                        ) : customer.riskStatus === "medium_zone" ? (
                                                            <span className="bg-amber-500 text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md shadow-amber-200">Medium</span>
                                                        ) : (
                                                            <span className="bg-emerald-500 text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md shadow-emerald-200">Safe</span>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-50 mb-4">
                                                        <div>
                                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">Live Balance</p>
                                                            <p className={`text-sm font-black ${balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                                                ₹{Math.abs(balance).toLocaleString()} {balance > 0 ? "DR" : "CR"}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">Receipt Age / Days</p>
                                                            {days !== null ? (
                                                                <span className={`text-[10px] font-black px-2 py-1 rounded uppercase tracking-tighter shadow-sm border ${
                                                                    days > 30 ? "bg-rose-50 text-rose-600 border-rose-100" : 
                                                                    days > 7 ? "bg-amber-50 text-amber-600 border-amber-100" : 
                                                                    "bg-indigo-50 text-indigo-600 border-indigo-100"
                                                                }`}>
                                                                    {days === 0 ? "Today" : `${days} Days`}
                                                                </span>
                                                            ) : <span className="text-[10px] text-gray-300 italic">—</span>}
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">Sales Invoice</p>
                                                            <p className="text-[11px] font-bold text-gray-700">₹{Math.round(customer.totalSalesInvoice || 0).toLocaleString()}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">Receipt Value</p>
                                                            <p className="text-[11px] font-bold text-gray-700">₹{Math.round(customer.totalReceiptValue || 0).toLocaleString()}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">Credit Limit</p>
                                                            <p className="text-[11px] font-bold text-gray-700">₹{(customer.creditLimit ?? 0).toLocaleString()} / {customer.creditLimitDays || 0}D</p>
                                                        </div>
                                                        {(user?.role === "SUPER_ADMIN" || user?.role === "SUPERADMIN") && (
                                                            <div className="text-right">
                                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">Margin (%)</p>
                                                                <p className="text-[11px] font-bold text-gray-700">{customer.margin || 0}%</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {isFieldAllowed("action_followup") && (
                                                            <button 
                                                                onClick={() => openFollowUp(customer)}
                                                                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition"
                                                            >
                                                                Follow Up
                                                            </button>
                                                        )}
                                                        <div className="flex gap-2">
                                                            {isFieldAllowed("action_ledger") && (
                                                                <button 
                                                                    onClick={() => openLedger(customer)}
                                                                    className="w-10 h-10 bg-gray-50 text-gray-600 rounded-xl flex items-center justify-center border border-gray-100 hover:bg-indigo-50 hover:text-indigo-600 transition"
                                                                    title="Ledger"
                                                                >
                                                                    <FaHistory size={14} />
                                                                </button>
                                                            )}
                                                            {isFieldAllowed("action_edit") && (
                                                                <button 
                                                                    onClick={() => openEditCustomer(customer)}
                                                                    className="w-10 h-10 bg-gray-50 text-gray-600 rounded-xl flex items-center justify-center border border-gray-100 hover:bg-indigo-50 hover:text-indigo-600 transition"
                                                                    title="Edit Profile"
                                                                >
                                                                    <FaEdit size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* DESKTOP TABLE VIEW */}
                            <div className="overflow-x-auto flex-1 hidden md:block">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100 text-gray-600 uppercase text-xs font-bold tracking-wider sticky top-0 z-10">
                                            {isFieldAllowed("name") && (
                                                <th onClick={() => handleSort("name")} className="px-4 py-3 text-left border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-all">
                                                    <div className="flex items-center">Name <SortIcon column="name" /></div>
                                                </th>
                                            )}
                                            {isFieldAllowed("group") && (
                                                <th onClick={() => handleSort("group")} className="px-4 py-3 text-left border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-all">
                                                    <div className="flex items-center">Group <SortIcon column="group" /></div>
                                                </th>
                                            )}
                                            {isFieldAllowed("category") && (
                                                <th onClick={() => handleSort("category")} className="px-4 py-3 text-left border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-all">
                                                    <div className="flex items-center">Category <SortIcon column="category" /></div>
                                                </th>
                                            )}
                                            {isFieldAllowed("zone") && (
                                                <th onClick={() => handleSort("riskStatus")} className="px-2 py-3 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-all w-[60px] min-w-[60px] max-w-[60px]">
                                                    <div className="flex items-center justify-center">Zone <SortIcon column="riskStatus" /></div>
                                                </th>
                                            )}
                                            {isFieldAllowed("balance") && (
                                                <th onClick={() => handleSort("balance")} className="px-4 py-3 text-right border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-all">
                                                    <div className="flex items-center justify-end">Balance <SortIcon column="balance" /></div>
                                                </th>
                                            )}
                                            {isFieldAllowed("balance") && (
                                                <th onClick={() => handleSort("debit")} className="px-4 py-3 text-right border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-all">
                                                    <div className="flex items-center justify-end">Sales Invoice <SortIcon column="debit" /></div>
                                                </th>
                                            )}
                                            {isFieldAllowed("balance") && (
                                                <th onClick={() => handleSort("credit")} className="px-4 py-3 text-right border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-all">
                                                    <div className="flex items-center justify-end">Receipt <SortIcon column="credit" /></div>
                                                </th>
                                            )}
                                            {isFieldAllowed("limit") && (
                                                <th onClick={() => handleSort("limit")} className="px-4 py-3 text-right border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-all">
                                                    <div className="flex items-center justify-end">Limit <SortIcon column="limit" /></div>
                                                </th>
                                            )}
                                            {isFieldAllowed("days") && (
                                                <th onClick={() => handleSort("days")} className="px-2 py-3 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-all w-[55px] min-w-[55px] max-w-[55px]">
                                                    <div className="flex items-center justify-center">CR DAYS <SortIcon column="days" /></div>
                                                </th>
                                            )}
                                            {isFieldAllowed("token") && (
                                                <th className="px-4 py-3 text-center border-b border-gray-200">
                                                    <div className="flex items-center justify-center">Token</div>
                                                </th>
                                            )}
                                            <th onClick={() => handleSort("invoiceAge")} className="px-2 py-3 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-all w-[75px] min-w-[75px] max-w-[75px]">
                                                <div className="flex items-center justify-center gap-1"><FaFileInvoice size={10} /> Inv Age <SortIcon column="invoiceAge" /></div>
                                            </th>
                                            <th onClick={() => handleSort("receiptAge")} className="px-2 py-3 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-all w-[75px] min-w-[75px] max-w-[75px]">
                                                <div className="flex items-center justify-center"><FaClock size={10} className="mr-1" /> Rec Age <SortIcon column="receiptAge" /></div>
                                            </th>
                                            {(user?.role === "SUPER_ADMIN" || user?.role === "SUPERADMIN") && (
                                                <th onClick={() => handleSort("margin")} className="px-2 py-3 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-all w-[55px] min-w-[55px] max-w-[55px]">
                                                    <div className="flex items-center justify-center">Margin <SortIcon column="margin" /></div>
                                                </th>
                                            )}
                                            {(isFieldAllowed("action_followup") || isFieldAllowed("action_log") || isFieldAllowed("action_ledger") || isFieldAllowed("action_edit")) && (
                                                <th className="px-4 py-3 text-center border-b border-gray-200">Actions</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginatedCustomers.map((customer) => {
                                            const isEditing = editingId === customer._id;
                                            const balance = getBalance(customer);
                                            const primaryGroup = customer.customerGroups?.[0]?.name || customer.customerGroup?.name || "None";
                                            const primaryCategory = customer.customerCategories?.[0]?.name || customer.customerCategory?.name || "Unassigned";

                                            if (isEditing) {
                                                return (
                                                    <React.Fragment key={customer._id}>
                                                        <tr className="bg-indigo-50/50 border-x-4 border-indigo-500 transition-all">
                                                            <td className="px-4 py-4">
                                                                <input 
                                                                    type="text" 
                                                                    className="w-full bg-white border border-indigo-200 rounded px-2 py-1.5 text-sm font-bold outline-none focus:border-indigo-500"
                                                                    value={editForm.name}
                                                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                                    placeholder="Customer Name"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-4">
                                                                <select 
                                                                    className="w-full bg-white border border-indigo-200 rounded px-2 py-1.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                                                                    value={editForm.customerGroups?.[0] || ""}
                                                                    onChange={(e) => setEditForm({ ...editForm, customerGroups: [e.target.value] })}
                                                                >
                                                                    <option value="">No Group</option>
                                                                    {customerGroups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                                                                </select>
                                                            </td>
                                                            <td className="px-4 py-4">
                                                                <select 
                                                                    className="w-full bg-white border border-indigo-200 rounded px-2 py-1.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                                                                    value={editForm.customerCategories?.[0] || ""}
                                                                    onChange={(e) => setEditForm({ ...editForm, customerCategories: [e.target.value] })}
                                                                >
                                                                    <option value="">No Category</option>
                                                                    {customerCategories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                                                                </select>
                                                            </td>
                                                            <td colSpan={8} className="px-4 py-4">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="flex-1">
                                                                        <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">WhatsApp</label>
                                                                        <input 
                                                                            type="text" 
                                                                            className="w-full bg-white border border-indigo-200 rounded px-2 py-1.5 text-sm font-bold outline-none"
                                                                            value={editForm.whatsapp}
                                                                            onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Email</label>
                                                                        <input 
                                                                            type="text" 
                                                                            className="w-full bg-white border border-indigo-200 rounded px-2 py-1.5 text-sm font-bold outline-none"
                                                                            value={editForm.email}
                                                                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td colSpan={3} className="px-4 py-4">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button 
                                                                        onClick={() => setEditingId(null)}
                                                                        className="px-4 py-2 bg-white border border-gray-200 text-gray-500 rounded-lg text-[10px] font-black uppercase hover:bg-gray-50"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button 
                                                                        onClick={handleInlineSave}
                                                                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase shadow-lg shadow-indigo-200 hover:bg-indigo-700"
                                                                    >
                                                                        Save Changes
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        <tr className="bg-indigo-50/30 border-x-4 border-indigo-500 border-b-2 border-indigo-100">
                                                            <td colSpan={7} className="px-4 py-3">
                                                                <div className="flex items-center gap-6">
                                                                    <div className="w-1/3">
                                                                        <label className="text-[9px] font-black uppercase text-indigo-400 block mb-1">Full Address</label>
                                                                        <input 
                                                                            type="text" 
                                                                            className="w-full bg-white border border-indigo-100 rounded px-2 py-1 text-[11px] font-bold"
                                                                            value={editForm.address}
                                                                            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[9px] font-black uppercase text-indigo-400 block mb-1">District</label>
                                                                        <input type="text" className="bg-white border border-indigo-100 rounded px-2 py-1 text-[11px] font-bold w-28" value={editForm.district} onChange={(e) => setEditForm({ ...editForm, district: e.target.value })} />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[9px] font-black uppercase text-indigo-400 block mb-1">State Code</label>
                                                                        <input type="text" className="bg-white border border-indigo-100 rounded px-2 py-1 text-[11px] font-bold w-16" value={editForm.stateCode} onChange={(e) => setEditForm({ ...editForm, stateCode: e.target.value })} />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                {user?.role === "SUPER_ADMIN" ? (
                                                                    <>
                                                                        <label className="text-[9px] font-black uppercase text-indigo-400 block mb-1 text-right">Limit (₹)</label>
                                                                        <input 
                                                                            type="number" 
                                                                            className="w-24 bg-white border border-indigo-100 rounded px-2 py-1 text-right text-[11px] font-bold"
                                                                            value={editForm.creditLimit}
                                                                            onChange={(e) => setEditForm({ ...editForm, creditLimit: e.target.value })}
                                                                        />
                                                                    </>
                                                                ) : (
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="text-[9px] font-black uppercase text-gray-400 block mb-1 text-right">Limit (₹)</span>
                                                                        <span className="text-[11px] font-bold text-gray-500 py-1">₹{(editForm.creditLimit ?? 0).toLocaleString()}</span>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                {user?.role === "SUPER_ADMIN" ? (
                                                                    <>
                                                                        <label className="text-[9px] font-black uppercase text-indigo-400 block mb-1 text-right">CR Days</label>
                                                                        <input 
                                                                            type="number" 
                                                                            className="w-16 bg-white border border-indigo-100 rounded px-2 py-1 text-right text-[11px] font-bold"
                                                                            value={editForm.creditLimitDays}
                                                                            onChange={(e) => setEditForm({ ...editForm, creditLimitDays: e.target.value })}
                                                                        />
                                                                    </>
                                                                ) : (
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="text-[9px] font-black uppercase text-gray-400 block mb-1 text-right">CR Days</span>
                                                                        <span className="text-[11px] font-bold text-gray-500 py-1">{editForm.creditLimitDays || 0}</span>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td colSpan={5} className="px-4 py-3">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="flex-1">
                                                                        <label className="text-[9px] font-black uppercase text-indigo-400 block mb-1">Zone</label>
                                                                        <select 
                                                                            className="w-full bg-white border border-indigo-100 rounded px-2 py-1 text-[10px] font-bold outline-none focus:border-indigo-500 transition-all"
                                                                            value={editForm.riskStatus || "safe_zone"}
                                                                            onChange={(e) => setEditForm({ ...editForm, riskStatus: e.target.value })}
                                                                        >
                                                                            <option value="safe_zone">Safe Zone</option>
                                                                            <option value="medium_zone">Medium Zone</option>
                                                                            <option value="risk_zone">Risk Zone</option>
                                                                        </select>
                                                                    </div>
                                                                    {(user?.role === "SUPER_ADMIN" || user?.role === "SUPERADMIN") && (
                                                                        <div className="w-20">
                                                                            <label className="text-[9px] font-black uppercase text-indigo-400 block mb-1">Margin (%)</label>
                                                                            <input 
                                                                                type="number" 
                                                                                step="0.01"
                                                                                className="w-full bg-white border border-indigo-100 rounded px-2 py-1 text-right text-[11px] font-bold outline-none focus:border-indigo-500 transition-all"
                                                                                value={editForm.margin || 0}
                                                                                onChange={(e) => setEditForm({ ...editForm, margin: e.target.value })}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                    <div className="flex-1">
                                                                        <label className="text-[9px] font-black uppercase text-indigo-400 block mb-1 text-center">Sales Manager</label>
                                                                        <select 
                                                                            className="w-full bg-white border border-indigo-100 rounded px-2 py-1 text-[10px] font-bold outline-none focus:border-indigo-500 transition-all"
                                                                            value={editForm.salesOwner || ""}
                                                                            onChange={(e) => setEditForm({ ...editForm, salesOwner: e.target.value })}
                                                                        >
                                                                            <option value="">Select Owner</option>
                                                                            {salesOwners.map(owner => <option key={owner._id} value={owner._id}>{owner.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </React.Fragment>
                                                );
                                            }

                                            return (
                                                <tr key={customer._id} className="hover:bg-gray-50 transition-colors">
                                                    {isFieldAllowed("name") && (
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col">
                                                                <div className="text-gray-900 text-sm font-semibold">{customer.name}</div>
                                                                <div className="text-[11px] text-gray-500">{customer.whatsapp || "Inactive Contact"}</div>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {isFieldAllowed("group") && (
                                                        <td className="px-4 py-3 text-sm text-gray-700">
                                                            {primaryGroup}
                                                        </td>
                                                    )}
                                                    {isFieldAllowed("category") && (
                                                        <td className="px-4 py-3 text-sm text-gray-700">
                                                            {primaryCategory}
                                                        </td>
                                                    )}
                                                    {isFieldAllowed("zone") && (
                                                        <td className="px-2 py-3 text-center w-[60px] min-w-[60px] max-w-[60px]">
                                                            {customer.riskStatus === "risk_zone" ? (
                                                                <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Risk</span>
                                                            ) : customer.riskStatus === "medium_zone" ? (
                                                                <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Medium</span>
                                                            ) : (
                                                                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Safe</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    {isFieldAllowed("balance") && (
                                                        <td className={`px-4 py-3 text-right font-bold text-sm ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
                                                            {customer.debit !== undefined ? (
                                                                <>
                                                                    <span className="text-[10px] mr-1">{balance > 0 ? "DR" : "CR"}</span>
                                                                    <span className="font-sans text-xs mr-0.5 font-medium opacity-85">₹</span>{Math.abs(balance).toLocaleString()}
                                                                </>
                                                            ) : (
                                                                <span className="text-xs text-gray-400 italic">Calculating...</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    {isFieldAllowed("balance") && (
                                                        <td className="px-4 py-3 text-right text-sm text-gray-600 font-semibold">
                                                            {customer.totalSalesInvoice !== undefined ? (
                                                                <>
                                                                    <span className="font-sans text-xs mr-0.5 font-medium text-gray-400">₹</span>
                                                                    {Math.round(customer.totalSalesInvoice).toLocaleString()}
                                                                </>
                                                            ) : (
                                                                <span className="text-xs text-gray-400 italic">Calculating...</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    {isFieldAllowed("balance") && (
                                                        <td className="px-4 py-3 text-right text-sm text-gray-600 font-semibold">
                                                            {customer.totalReceiptValue !== undefined ? (
                                                                <>
                                                                    <span className="font-sans text-xs mr-0.5 font-medium text-gray-400">₹</span>
                                                                    {Math.round(customer.totalReceiptValue).toLocaleString()}
                                                                </>
                                                            ) : (
                                                                <span className="text-xs text-gray-400 italic">Calculating...</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    {isFieldAllowed("limit") && (
                                                        <td className="px-4 py-3 text-right text-gray-700 text-sm">
                                                            <span className="font-sans text-xs mr-0.5 font-medium text-gray-400">₹</span>{(customer.creditLimit ?? 0).toLocaleString()}
                                                        </td>
                                                    )}
                                                    {isFieldAllowed("days") && (
                                                        <td className="px-2 py-3 text-center text-sm text-gray-700 w-[55px] min-w-[55px] max-w-[55px]">
                                                            {customer.creditLimitDays || 0}
                                                        </td>
                                                    )}
                                                    {isFieldAllowed("token") && (
                                                        <td className="px-4 py-3 text-center">
                                                            <button 
                                                                onClick={() => openToken(customer)}
                                                                className="text-indigo-600 hover:text-indigo-800 transition-colors mx-auto"
                                                                title="Token Manager"
                                                            >
                                                                <FaTicketAlt size={16} />
                                                            </button>
                                                        </td>
                                                    )}
                                                     {/* Last Bill Column */}
                                                     <td className="px-2 py-3 text-center w-[75px] min-w-[75px] max-w-[75px]">
                                                         {customer.lastInvoiceDate ? (
                                                             (() => {
                                                                 const days = Math.floor((new Date() - new Date(customer.lastInvoiceDate)) / (1000 * 60 * 60 * 24));
                                                                 return (
                                                                     <div className="flex flex-col items-center">
                                                                         <span className={`text-[11px] font-black ${
                                                                             days > 30 ? "text-rose-600" : 
                                                                             days > 7 ? "text-amber-600" : 
                                                                             "text-indigo-600"
                                                                         }`}>
                                                                             {days === 0 ? "Today" : `${days} Days`}
                                                                         </span>
                                                                         <span className="text-[9px] font-bold text-gray-400">
                                                                             {new Date(customer.lastInvoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                                         </span>
                                                                     </div>
                                                                 );
                                                             })()
                                                         ) : (
                                                             <span className="text-[10px] text-gray-300 italic">—</span>
                                                         )}
                                                     </td>
                                                     {/* Last Receipt Column */}
                                                     <td className="px-2 py-3 text-center w-[75px] min-w-[75px] max-w-[75px]">
                                                         {customer.lastReceiptDate ? (
                                                             (() => {
                                                                 const days = Math.floor((new Date() - new Date(customer.lastReceiptDate)) / (1000 * 60 * 60 * 24));
                                                                 return (
                                                                     <div className="flex flex-col items-center">
                                                                         <span className={`text-[11px] font-black ${
                                                                             days > 30 ? "text-rose-600" : 
                                                                             days > 7 ? "text-amber-600" : 
                                                                             "text-emerald-600"
                                                                         }`}>
                                                                             {days === 0 ? "Today" : `${days} Days`}
                                                                         </span>
                                                                         <span className="text-[9px] font-bold text-gray-400">
                                                                             {new Date(customer.lastReceiptDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                                         </span>
                                                                     </div>
                                                                 );
                                                             })()
                                                         ) : (
                                                             <span className="text-[10px] text-gray-300 italic">—</span>
                                                         )}
                                                     </td>
                                                     {/* Margin Column */}
                                                     {(user?.role === "SUPER_ADMIN" || user?.role === "SUPERADMIN") && (
                                                         <td className="px-2 py-3 text-center text-sm font-semibold text-gray-700 w-[55px] min-w-[55px] max-w-[55px]">
                                                             {customer.margin || 0}%
                                                         </td>
                                                     )}
                                                     {(isFieldAllowed("action_followup") || isFieldAllowed("action_log") || isFieldAllowed("action_ledger") || isFieldAllowed("action_edit")) && (
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                {isFieldAllowed("action_followup") && (
                                                                    <button 
                                                                        onClick={() => openFollowUp(customer)}
                                                                        className="bg-indigo-600 text-white px-3 py-1.5 rounded text-[11px] font-bold hover:bg-indigo-700 transition-colors"
                                                                        title="Record New Follow-Up"
                                                                    >
                                                                        Follow Up
                                                                    </button>
                                                                )}
                                                                {isFieldAllowed("action_log") && (
                                                                    <button 
                                                                        onClick={() => openHistory(customer)}
                                                                        className="bg-gray-800 text-white px-3 py-1.5 rounded text-[11px] font-bold hover:bg-black transition-colors"
                                                                        title="View History Logs"
                                                                    >
                                                                        Log
                                                                    </button>
                                                                )}
                                                                {isFieldAllowed("action_ledger") && (
                                                                    <button 
                                                                        onClick={() => openLedger(customer)}
                                                                        className="bg-white text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded text-[11px] font-bold hover:bg-indigo-50 transition-colors"
                                                                        title="View Full Ledger"
                                                                    >
                                                                        Ledger
                                                                    </button>
                                                                )}
                                                                {isFieldAllowed("action_edit") && (
                                                                    <button 
                                                                        onClick={() => openEditCustomer(customer)}
                                                                        className="text-gray-500 hover:text-indigo-600 transition-colors p-1"
                                                                        title="Edit Profile"
                                                                    >
                                                                        <FaEdit size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* PAGINATION CONTROLS */}
                            <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 p-8 flex flex-col sm:flex-row items-center justify-between gap-6 mt-4">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-100 shadow-inner">
                                        {[50, 100, 200, 500].map(val => (
                                            <button 
                                                key={val}
                                                onClick={() => setRowsPerPage(val)}
                                                className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${rowsPerPage === val ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                {val}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[12px] text-gray-400 font-black uppercase tracking-widest hidden lg:block">Rows Per Page</p>
                                </div>

                                <div className="flex items-center gap-4">
                                    <p className="text-[12px] text-gray-500 font-black uppercase tracking-[0.2em] mr-4">
                                        Page <span className="text-indigo-600">{currentPage}</span> of <span className="text-gray-900">{totalPages || 1}</span>
                                    </p>
                                    <div className="flex gap-2">
                                        <button 
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            className="w-14 h-14 bg-white border-2 border-gray-100 rounded-2xl flex items-center justify-center text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm"
                                        >
                                            <FaChevronLeft />
                                        </button>
                                        
                                        {/* Dynamic Page Markers */}
                                        <div className="hidden md:flex gap-2">
                                            {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                                let pNum = i + 1;
                                                if (totalPages > 5 && currentPage > 3) pNum = currentPage - 2 + i;
                                                if (pNum > totalPages) return null;
                                                
                                                return (
                                                    <button 
                                                        key={pNum}
                                                        onClick={() => setCurrentPage(pNum)}
                                                        className={`w-14 h-14 rounded-2xl text-xs font-black transition-all ${currentPage === pNum ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-200' : 'bg-gray-50 text-gray-400 border-2 border-transparent hover:bg-gray-100'}`}
                                                    >
                                                        {pNum}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <button 
                                            disabled={currentPage === totalPages || totalPages === 0}
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            className="w-14 h-14 bg-white border-2 border-gray-100 rounded-2xl flex items-center justify-center text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm"
                                        >
                                            <FaChevronRight />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {customers.length === 0 && (
                                <div className="py-40 text-center">
                                    <div className="w-36 h-36 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-10 border border-gray-100 animate-pulse">
                                        <FaSearch className="text-gray-200 text-5xl" />
                                    </div>
                                    <h3 className="text-gray-950 font-black uppercase text-xl tracking-[0.4em] mt-8">System Zero Result</h3>
                                    <p className="text-gray-400 text-sm mt-4 font-bold tracking-widest max-w-sm mx-auto leading-relaxed uppercase opacity-60">Try clearing deep filters or searching for alternate mobile/ID combinations.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* MODALS */}
            <FollowUpFormModal 
                isOpen={isFollowUpOpen}
                onClose={() => setIsFollowUpOpen(false)}
                customer={selectedCustomer}
                user={user}
                branch={currentBranch}
                onSave={fetchData}
            />

            <CustomerFollowUpHistoryModal 
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                customer={selectedCustomerForHistory}
                branch={currentBranch}
            />

            <TokenManagerModal 
                isOpen={isTokenOpen}
                onClose={() => setIsTokenOpen(false)}
                customer={selectedCustomerForToken}
                branch={currentBranch}
                user={user}
            />

            <CategoryManagementModal 
                isOpen={isManageCategoriesOpen}
                onClose={() => setIsManageCategoriesOpen(false)}
                branchId={currentBranch?._id}
                onUpdate={fetchData}
            />

        </div>
    );
};

export default BranchFollowUp;
