import React, { useState, useEffect, useMemo } from "react";
import { 
    FaUser, FaPhone, FaMoneyBillWave, FaClock, FaHistory, 
    FaSearch, FaFilter, FaSort, FaSortUp, FaSortDown,
    FaArrowRight, FaBook, FaCalendarAlt, FaCog, FaTag,
    FaEdit, FaChevronLeft, FaChevronRight, FaListOl
} from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE, fetchWithAuth, apiWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import CustomerLedgerModal from "../../components/branch/CustomerLedgerModal";
import FollowUpFormModal from "../../components/branch/FollowUpFormModal";
import CategoryManagementModal from "../../components/branch/CategoryManagementModal";
import InventoryAddCustomerModal from "../../components/inventory/InventoryAddCustomerModal";

const BranchFollowUp = () => {
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

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);

    // Modal states
    const [isLedgerOpen, setIsLedgerOpen] = useState(false);
    const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
    const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
    const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
    
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [editingCustomer, setEditingCustomer] = useState(null);

    // Sorting state
    const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });

    useEffect(() => {
        if (currentBranch?._id) {
            fetchData();
        }
    }, [currentBranch?._id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [custRes, groupRes, categoryRes, salesOwnerRes] = await Promise.all([
                fetchWithAuth(`${API_BASE}/customers?branchId=${currentBranch._id}&limit=10000`),
                fetchWithAuth(`${API_BASE}/customer-groups?branchId=${currentBranch._id}`),
                fetchWithAuth(`${API_BASE}/customer-categories?branchId=${currentBranch._id}`),
                fetchWithAuth(`${API_BASE}/sales-owners?branchId=${currentBranch._id}`)
            ]);
            
            const custData = await custRes.json();
            const groupData = await groupRes.json();
            const categoryData = await categoryRes.json();
            const ownerData = await salesOwnerRes.json();

            if (custData.success) {
                setCustomers(custData.data || []);
            } else if (Array.isArray(custData)) {
                setCustomers(custData);
            }

            if (groupData.success) {
                setCustomerGroups(groupData.data || []);
            } else if (Array.isArray(groupData)) {
                setCustomerGroups(groupData);
            }

            if (categoryData.success) {
                setCustomerCategories(categoryData.data || []);
            } else if (Array.isArray(categoryData)) {
                setCustomerCategories(categoryData);
            }

            if (ownerData.success) {
                setSalesOwners(ownerData.data || []);
            } else if (Array.isArray(ownerData)) {
                setSalesOwners(ownerData);
            }
        } catch (err) {
            console.error("Error fetching data:", err);
            toast.error("Failed to load customer data");
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

    const getBalance = (c) => (c.debit || 0) - (c.credit || 0);

    const filteredAndSortedCustomers = useMemo(() => {
        let result = [...customers];

        // Filter by Group
        if (groupFilter !== "All") {
            result = result.filter(c => 
                c.customerGroups?.some(g => g._id === groupFilter) || 
                c.customerGroups === groupFilter ||
                (typeof c.customerGroups === "object" && c.customerGroups?._id === groupFilter)
            );
        }

        // Filter by Category
        if (categoryFilter !== "All") {
            result = result.filter(c => 
                c.customerCategories?.some(cat => cat._id === categoryFilter) || 
                c.customerCategories === categoryFilter ||
                c.customerCategory === categoryFilter ||
                (typeof c.customerCategory === "object" && c.customerCategory?._id === categoryFilter)
            );
        }

        // Filter by Search
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(c => 
                c.name.toLowerCase().includes(lowerSearch) ||
                (c.whatsapp && c.whatsapp.includes(lowerSearch))
            );
        }

        // Sort
        result.sort((a, b) => {
            let valA, valB;

            switch (sortConfig.key) {
                case "name":
                    valA = a.name.toLowerCase();
                    valB = b.name.toLowerCase();
                    break;
                case "group":
                    valA = (a.customerGroups?.[0]?.name || a.customerGroup?.name || "Unassigned").toLowerCase();
                    valB = (b.customerGroups?.[0]?.name || b.customerGroup?.name || "Unassigned").toLowerCase();
                    break;
                case "category":
                    valA = (a.customerCategories?.[0]?.name || a.customerCategory?.name || "Unassigned").toLowerCase();
                    valB = (b.customerCategories?.[0]?.name || b.customerCategory?.name || "Unassigned").toLowerCase();
                    break;
                case "balance":
                    valA = getBalance(a);
                    valB = getBalance(b);
                    break;
                case "creditLimit":
                    valA = a.creditLimit || 0;
                    valB = b.creditLimit || 0;
                    break;
                case "creditDays":
                    valA = a.creditLimitDays || 0;
                    valB = b.creditLimitDays || 0;
                    break;
                default:
                    return 0;
            }

            if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
            if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });

        return result;
    }, [customers, searchTerm, groupFilter, categoryFilter, sortConfig]);

    // PAGINATION LOGIC
    const totalPages = Math.ceil(filteredAndSortedCustomers.length / rowsPerPage);
    const paginatedCustomers = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredAndSortedCustomers.slice(start, start + rowsPerPage);
    }, [filteredAndSortedCustomers, currentPage, rowsPerPage]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, groupFilter, categoryFilter, rowsPerPage]);

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <FaSort className="opacity-20 ml-1" />;
        return sortConfig.direction === "asc" ? <FaSortUp className="ml-1 text-indigo-500" /> : <FaSortDown className="ml-1 text-indigo-500" />;
    };

    const openFollowUp = (customer) => {
        setSelectedCustomer(customer);
        setIsFollowUpOpen(true);
    };

    const openLedger = (customer) => {
        setSelectedCustomer(customer);
        setIsLedgerOpen(true);
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

    return (
        <div className="min-h-screen bg-[#f8fafc] pt-20 md:pt-4 md:pl-20 pb-10">
            <ToastContainer />
            <div className="w-full max-w-full mx-auto px-4 sm:px-8 py-6">
                
                {/* HEADER */}
                <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-2xl hover:shadow-indigo-500/10">
                    <div className="flex items-center gap-8">
                        <div className="w-24 h-24 bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-[2.5rem] flex items-center justify-center shadow-[0_20px_40px_-15px_rgba(67,56,202,0.4)] transform hover:scale-105 transition-transform duration-500">
                            <FaPhone className="text-white text-4xl" />
                        </div>
                        <div>
                            <h1 className="text-5xl font-black text-gray-900 tracking-tighter leading-tight">Follow-Up Hub</h1>
                            <p className="text-[12px] text-indigo-600/60 uppercase font-black tracking-[0.4em] mt-2 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                Precision Recovery Dashboard
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-50/50 px-10 py-6 rounded-[2.5rem] border border-indigo-100 shadow-inner">
                            <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-2">Total Outstanding</p>
                            <p className="text-4xl font-black text-indigo-900 tracking-tighter">
                                ₹{customers.reduce((sum, c) => sum + Math.max(0, getBalance(c)), 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>

                {/* FILTERS & SEARCH */}
                <div className="bg-white/80 backdrop-blur-2xl p-6 rounded-[3.5rem] border border-white shadow-2xl shadow-gray-200/50 mb-10 flex flex-col xl:flex-row items-center gap-6">
                    <div className="flex-1 w-full relative group">
                        <div className="absolute left-8 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors">
                            <FaSearch size={22} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, mobile, or ID..."
                            className="w-full bg-gray-50/100 border-2 border-transparent focus:border-indigo-100 rounded-[2.5rem] px-20 py-7 focus:ring-12 focus:ring-indigo-500/5 outline-none text-lg font-black text-gray-800 transition-all placeholder:text-gray-400 shadow-inner"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                        {/* Group Filter */}
                        <div className="relative flex-1 xl:flex-none min-w-[240px]">
                            <select
                                className="w-full appearance-none bg-gray-50 border-2 border-transparent focus:border-indigo-100 rounded-[2.5rem] pl-10 pr-14 py-7 text-xs font-black uppercase tracking-[0.2em] text-gray-700 outline-none cursor-pointer transition-all shadow-inner"
                                value={groupFilter}
                                onChange={(e) => setGroupFilter(e.target.value)}
                            >
                                <option value="All">All Groups</option>
                                {customerGroups.map(g => (
                                    <option key={g._id} value={g._id}>{g.name}</option>
                                ))}
                            </select>
                            <FaFilter className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={14} />
                        </div>

                        {/* Category Filter */}
                        <div className="relative flex-1 xl:flex-none min-w-[240px]">
                            <select
                                className="w-full appearance-none bg-gray-50 border-2 border-transparent focus:border-indigo-100 rounded-[2.5rem] pl-10 pr-14 py-7 text-xs font-black uppercase tracking-[0.2em] text-gray-700 outline-none cursor-pointer transition-all shadow-inner"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            >
                                <option value="All">All Categories</option>
                                {customerCategories.map(cat => (
                                    <option key={cat._id} value={cat._id}>{cat.name}</option>
                                ))}
                            </select>
                            <FaTag className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={14} />
                        </div>

                        {/* Manage Button (Super Admin) */}
                        {user?.role === "SUPER_ADMIN" && (
                            <button 
                                onClick={() => setIsManageCategoriesOpen(true)}
                                className="h-[84px] w-[84px] bg-white border-2 border-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-500 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm active:scale-95 group"
                                title="Manage Master Data"
                            >
                                <FaCog size={26} className="group-hover:rotate-90 transition-transform duration-700" />
                            </button>
                        )}
                    </div>
                </div>

                {/* MAIN TABLE */}
                <div className="bg-white rounded-[4.5rem] shadow-[0_64px_128px_-32px_rgba(0,0,0,0.08)] border border-white overflow-hidden p-6 min-h-[800px] flex flex-col">
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
                                <table className="w-full border-separate border-spacing-0">
                                    <thead>
                                        <tr className="bg-gray-950 text-gray-400 uppercase text-sm font-black tracking-widest sticky top-0 z-10">
                                            <th onClick={() => handleSort("name")} className="px-12 py-10 text-left rounded-tl-[4rem] cursor-pointer hover:bg-white/5 hover:text-white transition-all">
                                                <div className="flex items-center">Name <SortIcon column="name" /></div>
                                            </th>
                                            <th onClick={() => handleSort("group")} className="px-6 py-10 text-left cursor-pointer hover:bg-white/5 hover:text-white transition-all">
                                                <div className="flex items-center">Group <SortIcon column="group" /></div>
                                            </th>
                                            <th onClick={() => handleSort("category")} className="px-6 py-10 text-left cursor-pointer hover:bg-white/5 hover:text-white transition-all">
                                                <div className="flex items-center">Category <SortIcon column="category" /></div>
                                            </th>
                                            <th onClick={() => handleSort("balance")} className="px-6 py-10 text-right cursor-pointer hover:bg-white/5 hover:text-white transition-all">
                                                <div className="flex items-center justify-end">Balance <SortIcon column="balance" /></div>
                                            </th>
                                            <th onClick={() => handleSort("creditLimit")} className="px-6 py-10 text-right cursor-pointer hover:bg-white/5 hover:text-white transition-all">
                                                <div className="flex items-center justify-end">Limit <SortIcon column="creditLimit" /></div>
                                            </th>
                                            <th onClick={() => handleSort("creditDays")} className="px-6 py-10 text-right cursor-pointer hover:bg-white/5 hover:text-white transition-all">
                                                <div className="flex items-center justify-end">Days <SortIcon column="creditDays" /></div>
                                            </th>
                                            <th className="px-12 py-10 text-center rounded-tr-[4rem]">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {paginatedCustomers.map((customer) => {
                                            const balance = getBalance(customer);
                                            const primaryGroup = customer.customerGroups?.[0]?.name || customer.customerGroup?.name || "None";
                                            const primaryCategory = customer.customerCategories?.[0]?.name || customer.customerCategory?.name || "Unassigned";

                                            return (
                                                <tr key={customer._id} className="group hover:bg-indigo-50/50 transition-all duration-500">
                                                    <td className="px-12 py-8">
                                                        <div className="flex items-center gap-6">
                                                            <div className="w-16 h-16 bg-white border-2 border-gray-100 text-indigo-700 rounded-[1.8rem] flex items-center justify-center shrink-0 shadow-sm group-hover:shadow-indigo-500/10 transition-all group-hover:-rotate-3">
                                                                <FaUser size={20} />
                                                            </div>
                                                            <div>
                                                                <div className="text-gray-950 text-xl font-black tracking-tight leading-none mb-1.5">{customer.name}</div>
                                                                <div className="text-[12px] text-gray-400 font-black uppercase tracking-widest">{customer.whatsapp || "Inactive Contact"}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-8">
                                                        <span className="bg-indigo-50 text-indigo-700 px-6 py-3 rounded-[1.2rem] text-[12px] font-black uppercase tracking-[0.1em] border border-indigo-100/50 block w-fit whitespace-nowrap shadow-sm">
                                                            {primaryGroup}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-8">
                                                        <span className="bg-amber-50 text-amber-700 px-6 py-3 rounded-[1.2rem] text-[12px] font-black uppercase tracking-[0.1em] border border-amber-100/50 block w-fit whitespace-nowrap shadow-sm">
                                                            {primaryCategory}
                                                        </span>
                                                    </td>
                                                    <td className={`px-6 py-8 text-right font-black text-2xl tracking-tighter ${balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                                        <span className="text-[12px] font-black opacity-30 mr-2 align-middle">{balance > 0 ? "DR" : "CR"}</span>
                                                        ₹{Math.abs(balance).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-8 text-right text-gray-900 text-lg font-black tracking-tight">
                                                        ₹{(customer.creditLimit || 200000).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-8 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-gray-900 text-lg font-black leading-none">{customer.creditLimitDays || 0}</span>
                                                            <span className="text-[11px] text-gray-400 font-black uppercase tracking-widest mt-1.5">Days</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-12 py-8 text-center">
                                                        <div className="flex items-center justify-center gap-3">
                                                            <button 
                                                                onClick={() => openFollowUp(customer)}
                                                                className="flex items-center gap-3 bg-indigo-600 text-white px-7 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95 whitespace-nowrap"
                                                                title="Follow up logs"
                                                            >
                                                                <FaHistory size={14} /> Log
                                                            </button>
                                                            <button 
                                                                onClick={() => openLedger(customer)}
                                                                className="flex items-center gap-3 bg-white text-indigo-600 border-2 border-indigo-50 px-7 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                                                                title="View Full Ledger"
                                                            >
                                                                <FaBook size={14} /> Ledger
                                                            </button>
                                                            <button 
                                                                onClick={() => openEditCustomer(customer)}
                                                                className="w-[56px] h-[56px] flex items-center justify-center bg-gray-50 text-gray-400 border-2 border-gray-100 rounded-2xl hover:bg-amber-50 hover:text-amber-600 hover:border-amber-100 transition-all active:scale-95"
                                                                title="Edit Profile"
                                                            >
                                                                <FaEdit size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
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

                            {filteredAndSortedCustomers.length === 0 && (
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

            <CustomerLedgerModal 
                isOpen={isLedgerOpen}
                onClose={() => setIsLedgerOpen(false)}
                customer={selectedCustomer}
                branch={currentBranch}
                onBalanceUpdate={fetchData}
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
            />
        </div>
    );
};

export default BranchFollowUp;
