import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { 
    FaUser, FaPhone, FaMoneyBillWave, FaClock, FaHistory, 
    FaSearch, FaFilter, FaSort, FaSortUp, FaSortDown,
    FaArrowRight, FaBook, FaCalendarAlt, FaCog, FaTag,
    FaEdit, FaChevronLeft, FaChevronRight, FaListOl, FaTicketAlt,
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
    const [groupFilter, setGroupFilter] = useState("All");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [zoneFilter, setZoneFilter] = useState("All");
    
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
    const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
    
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState(null);
    const [selectedCustomerForToken, setSelectedCustomerForToken] = useState(null);
    const [editingCustomer, setEditingCustomer] = useState(null);
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
                fetchWithAuth(`${API_BASE}/customers?branchId=${currentBranch._id}&mini=true&limit=${rowsPerPage}&page=${currentPage}&search=${searchTerm}&customerGroupId=${groupFilter}&customerCategoryId=${categoryFilter}&riskStatus=${zoneFilter}&sortBy=${sortConfig.key}&sortOrder=${sortConfig.direction}`),
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
                    body: JSON.stringify({ customerIds, branchId: currentBranch._id })
                });
                const balData = await balRes.json();
                
                if (balData.success) {
                    const balMap = new Map(balData.data.map(b => [b._id, { debit: b.debit, credit: b.credit }]));
                    setCustomers(prev => prev.map(c => {
                        if (balMap.has(c._id)) {
                            return { ...c, ...balMap.get(c._id) };
                        }
                        return c;
                    }));
                }

                // STAGE 3: Background fetch last invoice for each visible customer
                const invRes = await fetchWithAuth(`${API_BASE}/invoices/last-by-customers`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ customerIds, branchId: currentBranch._id })
                });
                const invData = await invRes.json();
                if (invData.success) {
                    const invMap = new Map(invData.data.map(i => [i._id.toString(), { lastInvoiceNumber: i.lastInvoiceNumber, lastInvoiceDate: i.lastInvoiceDate }]));
                    setCustomers(prev => prev.map(c => {
                        if (invMap.has(c._id.toString())) {
                            return { ...c, ...invMap.get(c._id.toString()) };
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
    }, [searchTerm, groupFilter, categoryFilter, zoneFilter, rowsPerPage, currentPage, sortConfig]);

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
        setEditingCustomer(customer);
        setIsEditCustomerOpen(true);
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
        <div className="min-h-screen bg-[#f8fafc] pt-20 md:pt-4 md:pl-20 pb-10">
            <div className="w-full max-w-full mx-auto px-2 sm:px-4 py-4">
                
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
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 w-full">
                        <div className="flex-1 relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <FaSearch size={14} />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by name, mobile, or ID..."
                                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg pl-9 pr-3 py-2 text-sm font-semibold text-gray-800 outline-none transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="relative min-w-[150px]">
                            <select
                                className="w-full appearance-none bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg pl-3 pr-8 py-2 text-xs font-bold uppercase text-gray-700 outline-none cursor-pointer transition-all"
                                value={groupFilter}
                                onChange={(e) => setGroupFilter(e.target.value)}
                            >
                                <option value="All">All Groups</option>
                                {customerGroups.map(g => (
                                    <option key={g._id} value={g._id}>{g.name}</option>
                                ))}
                            </select>
                            <FaFilter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={10} />
                        </div>

                        <div className="relative min-w-[150px]">
                            <select
                                className="w-full appearance-none bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg pl-3 pr-8 py-2 text-xs font-bold uppercase text-gray-700 outline-none cursor-pointer transition-all"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            >
                                <option value="All">All Categories</option>
                                {customerCategories.map(cat => (
                                    <option key={cat._id} value={cat._id}>{cat.name}</option>
                                ))}
                            </select>
                            <FaTag className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={10} />
                        </div>

                        <div className="relative min-w-[150px]">
                            <select
                                className="w-full appearance-none bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg pl-3 pr-8 py-2 text-xs font-bold uppercase text-gray-700 outline-none cursor-pointer transition-all"
                                value={zoneFilter}
                                onChange={(e) => setZoneFilter(e.target.value)}
                            >
                                <option value="All">All Zones</option>
                                <option value="safe_zone">Safe Zone</option>
                                <option value="medium_zone">Medium Zone</option>
                                <option value="risk_zone">Risk Zone</option>
                            </select>
                            <FaClock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={10} />
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
                                    className="w-9 h-9 bg-indigo-600 border border-indigo-700 rounded-lg flex items-center justify-center text-white hover:bg-indigo-700 transition-all shadow-sm shrink-0 disabled:opacity-50"
                                    title="Bulk Update Credit Limits"
                                >
                                    {bulkUpdating ? <FaSpinner className="animate-spin" /> : <FaCloudUploadAlt size={16} />}
                                </button>
                                <button 
                                    onClick={() => setIsManageCategoriesOpen(true)}
                                    className="w-9 h-9 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shrink-0"
                                    title="Manage Master Data"
                                >
                                    <FaCog size={16} />
                                </button>
                            </div>
                        )}
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
                            <div className="overflow-x-auto flex-1">
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
                                                <th className="px-4 py-3 text-left border-b border-gray-200">
                                                    <div className="flex items-center">Zone</div>
                                                </th>
                                            )}
                                            {isFieldAllowed("balance") && (
                                                <th onClick={() => handleSort("balance")} className="px-4 py-3 text-right border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-all">
                                                    <div className="flex items-center justify-end">Balance <SortIcon column="balance" /></div>
                                                </th>
                                            )}
                                            {isFieldAllowed("limit") && (
                                                <th onClick={() => handleSort("limit")} className="px-4 py-3 text-right border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-all">
                                                    <div className="flex items-center justify-end">Limit <SortIcon column="limit" /></div>
                                                </th>
                                            )}
                                            {isFieldAllowed("days") && (
                                                <th onClick={() => handleSort("days")} className="px-4 py-3 text-right border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-all">
                                                    <div className="flex items-center justify-end">Days <SortIcon column="days" /></div>
                                                </th>
                                            )}
                                            {isFieldAllowed("token") && (
                                                <th className="px-4 py-3 text-center border-b border-gray-200">
                                                    <div className="flex items-center justify-center">Token</div>
                                                </th>
                                            )}
                                            <th className="px-4 py-3 text-left border-b border-gray-200">
                                                <div className="flex items-center gap-1"><FaFileInvoice size={10} /> Last Invoice</div>
                                            </th>
                                            {(isFieldAllowed("action_followup") || isFieldAllowed("action_log") || isFieldAllowed("action_ledger") || isFieldAllowed("action_edit")) && (
                                                <th className="px-4 py-3 text-center border-b border-gray-200">Actions</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginatedCustomers.map((customer) => {
                                            const balance = getBalance(customer);
                                            const primaryGroup = customer.customerGroups?.[0]?.name || customer.customerGroup?.name || "None";
                                            const primaryCategory = customer.customerCategories?.[0]?.name || customer.customerCategory?.name || "Unassigned";

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
                                                        <td className="px-4 py-3">
                                                            {customer.riskStatus === "risk_zone" ? (
                                                                <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold">Risk</span>
                                                            ) : customer.riskStatus === "medium_zone" ? (
                                                                <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-[10px] font-bold">Medium</span>
                                                            ) : (
                                                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold">Safe</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    {isFieldAllowed("balance") && (
                                                        <td className={`px-4 py-3 text-right font-bold text-sm ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
                                                            {customer.debit !== undefined ? (
                                                                <>
                                                                    <span className="text-[10px] mr-1">{balance > 0 ? "DR" : "CR"}</span>
                                                                    ₹{Math.abs(balance).toLocaleString()}
                                                                </>
                                                            ) : (
                                                                <span className="text-xs text-gray-400 italic">Calculating...</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    {isFieldAllowed("limit") && (
                                                        <td className="px-4 py-3 text-right text-gray-700 text-sm">
                                                            ₹{(customer.creditLimit ?? 0).toLocaleString()}
                                                        </td>
                                                    )}
                                                    {isFieldAllowed("days") && (
                                                        <td className="px-4 py-3 text-right text-sm text-gray-700">
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
                                                    {/* Last Invoice Column */}
                                                    <td className="px-4 py-3">
                                                        {customer.lastInvoiceNumber ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] font-black text-indigo-700">{customer.lastInvoiceNumber}</span>
                                                                <span className="text-[10px] text-gray-400">
                                                                    {new Date(customer.lastInvoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-gray-300 italic">—</span>
                                                        )}
                                                    </td>
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

            <InventoryAddCustomerModal 
                isOpen={isEditCustomerOpen}
                onClose={() => setIsEditCustomerOpen(false)}
                editingItem={editingCustomer}
                onSave={handleSaveCustomer}
                branchId={currentBranch?._id}
                customerCategories={customerCategories}
                customerGroups={customerGroups}
                salesOwners={salesOwners}
                user={user}
            />
        </div>
    );
};

export default BranchFollowUp;
