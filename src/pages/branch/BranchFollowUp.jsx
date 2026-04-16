import React, { useState, useEffect, useMemo } from "react";
import { 
    FaUser, FaPhone, FaMoneyBillWave, FaClock, FaHistory, 
    FaSearch, FaFilter, FaSort, FaSortUp, FaSortDown,
    FaArrowRight, FaBook, FaCalendarAlt
} from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";
import CustomerLedgerModal from "../../components/branch/CustomerLedgerModal";
import FollowUpFormModal from "../../components/branch/FollowUpFormModal";

const BranchFollowUp = () => {
    const { currentBranch, user } = useBranch();
    const [customers, setCustomers] = useState([]);
    const [customerGroups, setCustomerGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [groupFilter, setGroupFilter] = useState("All");

    // Modal states
    const [isLedgerOpen, setIsLedgerOpen] = useState(false);
    const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

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
            const [custRes, groupRes] = await Promise.all([
                fetch(`${API_BASE}/customers?branchId=${currentBranch._id}&limit=1000`),
                fetch(`${API_BASE}/customer-groups?branchId=${currentBranch._id}`)
            ]);
            const custData = await custRes.json();
            const groupData = await groupRes.json();

            if (custData.success) setCustomers(custData.data || []);
            if (groupData.success) setCustomerGroups(groupData.data || []);
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
                c.customerGroups === groupFilter
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
                    valA = (a.customerGroups?.[0]?.name || "Unassigned").toLowerCase();
                    valB = (b.customerGroups?.[0]?.name || "Unassigned").toLowerCase();
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
    }, [customers, searchTerm, groupFilter, sortConfig]);

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

    return (
        <div className="min-h-screen bg-[#f8fafc] pt-20 md:pt-4 md:pl-20 pb-10">
            <ToastContainer />
            <div className="w-full max-w-full mx-auto px-4 sm:px-8 py-6">
                
                {/* HEADER */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
                            <FaPhone className="text-white text-2xl" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-800 tracking-tight">Customer Follow-Up</h1>
                            <p className="text-xs text-gray-400 uppercase font-black tracking-[0.2em] mt-1">
                                Recovery Dashboard & Communication Logs
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-50 px-6 py-3 rounded-2xl border border-indigo-100">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Total Outstanding</p>
                            <p className="text-xl font-black text-indigo-700 leading-none">
                                ₹{customers.reduce((sum, c) => sum + Math.max(0, getBalance(c)), 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>

                {/* FILTERS & SEARCH */}
                <div className="bg-white/70 backdrop-blur-md p-3 rounded-[2.5rem] border border-white shadow-sm mb-8 flex flex-col lg:flex-row items-center gap-3">
                    <div className="flex-1 w-full relative group">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                            <FaSearch size={16} />
                        </div>
                        <input
                            type="text"
                            placeholder="Quick search by customer name or WhatsApp..."
                            className="w-full bg-gray-50/50 border-none rounded-3xl px-14 py-5 focus:ring-4 focus:ring-indigo-500/5 outline-none text-sm font-bold text-gray-700 transition-all placeholder:text-gray-400 shadow-inner"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-3 w-full lg:w-auto p-1">
                        <div className="relative min-w-[240px]">
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <FaFilter size={14} />
                            </div>
                            <select
                                className="w-full appearance-none bg-gray-50/50 border-none rounded-3xl pl-12 pr-12 py-5 text-[12px] font-black uppercase text-gray-600 focus:ring-4 focus:ring-indigo-500/5 outline-none cursor-pointer transition-all shadow-inner"
                                value={groupFilter}
                                onChange={(e) => setGroupFilter(e.target.value)}
                            >
                                <option value="All">All Customer Groups</option>
                                {customerGroups.map(g => (
                                    <option key={g._id} value={g._id}>{g.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* MAIN TABLE */}
                <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/60 border border-white overflow-hidden p-3 min-h-[600px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-[500px] opacity-40">
                            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Synchronizing Debtor Data...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-separate border-spacing-0">
                                <thead>
                                    <tr className="bg-gray-900 text-gray-400 uppercase text-[10px] font-black tracking-[0.2em]">
                                        <th onClick={() => handleSort("name")} className="px-8 py-7 text-left rounded-tl-[2rem] cursor-pointer hover:text-white transition-colors">
                                            <div className="flex items-center">Customer Name <SortIcon column="name" /></div>
                                        </th>
                                        <th onClick={() => handleSort("group")} className="px-6 py-7 text-left cursor-pointer hover:text-white transition-colors">
                                            <div className="flex items-center">Customer Group <SortIcon column="group" /></div>
                                        </th>
                                        <th onClick={() => handleSort("balance")} className="px-6 py-7 text-right cursor-pointer hover:text-white transition-colors">
                                            <div className="flex items-center justify-end">Closing Balance <SortIcon column="balance" /></div>
                                        </th>
                                        <th onClick={() => handleSort("creditLimit")} className="px-6 py-7 text-right cursor-pointer hover:text-white transition-colors">
                                            <div className="flex items-center justify-end">Credit Limit <SortIcon column="creditLimit" /></div>
                                        </th>
                                        <th onClick={() => handleSort("creditDays")} className="px-6 py-7 text-right cursor-pointer hover:text-white transition-colors">
                                            <div className="flex items-center justify-end">Credit Days <SortIcon column="creditDays" /></div>
                                        </th>
                                        <th className="px-8 py-7 text-center rounded-tr-[2rem]">Actions Panel</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 font-bold">
                                    {filteredAndSortedCustomers.map((customer) => {
                                        const balance = getBalance(customer);
                                        return (
                                            <tr key={customer._id} className="group hover:bg-indigo-50/50 transition-all duration-300">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100 group-hover:bg-white group-hover:shadow-md transition-all">
                                                            <FaUser size={14} />
                                                        </div>
                                                        <div>
                                                            <div className="text-gray-900 text-sm font-black tracking-tight">{customer.name}</div>
                                                            <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">{customer.whatsapp || "No Contact"}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6">
                                                    <span className="bg-gray-100 text-gray-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-gray-200/50">
                                                        {customer.customerGroups?.[0]?.name || "Unassigned"}
                                                    </span>
                                                </td>
                                                <td className={`px-6 py-6 text-right font-black text-base tracking-tight ${balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                                    <span className="text-[10px] opacity-40 mr-1">{balance > 0 ? "DR" : "CR"}</span>
                                                    ₹{Math.abs(balance).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-6 text-right text-gray-600 text-[13px] font-black">
                                                    ₹{(customer.creditLimit || 200000).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-6 text-right text-gray-500 text-[13px] font-black">
                                                    {customer.creditLimitDays || 0} <span className="text-[10px] opacity-50 uppercase ml-0.5 tracking-widest">Days</span>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button 
                                                            onClick={() => openFollowUp(customer)}
                                                            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20 active:scale-95"
                                                        >
                                                            <FaHistory /> Follow Up
                                                        </button>
                                                        <button 
                                                            onClick={() => openLedger(customer)}
                                                            className="flex items-center gap-2 bg-white text-indigo-600 border border-indigo-100 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition shadow-sm active:scale-95"
                                                        >
                                                            <FaBook /> Ledger
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {filteredAndSortedCustomers.length === 0 && (
                                <div className="p-24 text-center">
                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                        <FaSearch className="text-gray-300 text-2xl" />
                                    </div>
                                    <h3 className="text-gray-800 font-black uppercase text-sm tracking-widest mt-4">No Customers Found</h3>
                                    <p className="text-gray-400 text-xs mt-2 font-bold italic">Try adjusting your search or group filter</p>
                                </div>
                            )}
                        </div>
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
        </div>
    );
};

export default BranchFollowUp;
