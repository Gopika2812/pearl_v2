import React, { useEffect, useState } from "react";
import { 
    FaCheckCircle, FaUndo, FaSearch, FaChevronDown, 
    FaChevronUp, FaCalendarAlt, FaSpinner, FaShoppingCart, 
    FaTimes, FaUser, FaPhoneAlt, FaMapMarkerAlt, FaFileInvoice
} from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

const OnlineOrdersPage = () => {
    const { currentBranch } = useBranch();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("pending"); // "pending" or "approved"
    
    // Filters
    const [filterFromDate, setFilterFromDate] = useState("");
    const [filterToDate, setFilterToDate] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [expandedOrders, setExpandedOrders] = useState({});

    // Sorting
    const [sortBy, setSortBy] = useState("date"); // "date", "amount", "customer"
    const [sortOrder, setSortOrder] = useState("desc"); // "asc", "desc"

    // Debounce search
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery.trim());
        }, 400);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Fetch orders based on active tab & filters
    const fetchOrders = async () => {
        if (!currentBranch?._id) return;
        setLoading(true);
        try {
            // If activeTab is pending, fetch status=ONLINE_PENDING.
            // If approved, fetch all sales orders that are isOnlineOrder=true.
            // Note: Since GET /sales-orders by default excludes ONLINE_PENDING, we can fetch approved online orders by passing isOnlineOrder=true.
            // Wait, does the backend GET / route handle isOnlineOrder parameter?
            // Let's check: the backend route doesn't filter isOnlineOrder explicitly unless we added it. But since GET / excludes ONLINE_PENDING by default,
            // we can filter approved ones on the frontend, or pass status=PLACED (or other active statuses) and isOnlineOrder=true if backend filters it.
            // Let's fetch all orders and filter on the frontend for simplicity and brand/customer specificity, or query backend.
            // Actually, we can fetch all orders by sending status=ONLINE_PENDING for pending tab, and fetch all orders normally (which returns PLACED, INVOICED, etc.)
            // and filter for isOnlineOrder === true on the frontend! That is extremely robust and does not require complex backend changes.
            
            const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : "";
            const statusParam = activeTab === "pending" ? "&status=ONLINE_PENDING" : "";
            const dateParams = (filterFromDate && filterToDate) ? `&fromDate=${filterFromDate}&toDate=${filterToDate}` : "";
            
            const res = await fetch(
                `${API_BASE}/sales-orders?branchId=${currentBranch._id}&isOnlineOrder=true${statusParam}${dateParams}${searchParam}`,
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to fetch orders");

            if (activeTab === "pending") {
                setOrders(data || []);
            } else {
                // Filter approved online orders (isOnlineOrder === true)
                const approvedOnline = (data || []).filter(o => o.isOnlineOrder === true);
                setOrders(approvedOnline);
            }
        } catch (err) {
            console.error("Error fetching online orders:", err);
            toast.error(err.message || "Failed to fetch orders");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [currentBranch?._id, activeTab, debouncedSearch, filterFromDate, filterToDate]);

    const handleApprove = async (orderId) => {
        if (!window.confirm("Approve this online order? This will convert it into a standard Sales Order (SO) and make it visible in the main Sales Order List.")) {
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/sales-orders/${orderId}/approve-online`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            });
            const data = await res.json();
            if (data.success) {
                toast.success("🎉 Order approved and converted to Sales Order (SO) successfully!");
                fetchOrders();
            } else {
                toast.error(data.message || "Failed to approve order");
            }
        } catch (err) {
            toast.error("Error approving order");
        }
    };

    const handleRevert = async (orderId) => {
        if (!window.confirm("Revert this approved order back to pending online approval?")) {
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/sales-orders/${orderId}/revert-online`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            });
            const data = await res.json();
            if (data.success) {
                toast.success("🔄 Order reverted back to Online Pending successfully!");
                fetchOrders();
            } else {
                toast.error(data.message || "Failed to revert order");
            }
        } catch (err) {
            toast.error("Error reverting order");
        }
    };

    const toggleExpand = (orderId) => {
        setExpandedOrders(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    const resetFilters = () => {
        setFilterFromDate("");
        setFilterToDate("");
        setSearchQuery("");
    };

    return (
        <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
            <div className="w-full mx-auto px-4 sm:px-8 py-4">
                
                {/* Header */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/10">
                            <FaShoppingCart className="text-white text-xl" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-800">Online Store Orders</h1>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">
                                Manage and approve orders placed by customers online
                            </p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl self-start md:self-auto">
                        <button
                            onClick={() => {
                                setActiveTab("pending");
                                setOrders([]);
                            }}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                                activeTab === "pending"
                                ? "bg-white text-indigo-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            Pending Approval
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab("approved");
                                setOrders([]);
                            }}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                                activeTab === "approved"
                                ? "bg-white text-indigo-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            Approved Directory
                        </button>
                    </div>
                </div>

                {/* Filter Panel */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div className="md:col-span-2 relative">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Search Order</label>
                            <div className="relative">
                                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by customer name, order ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none transition-all font-semibold text-slate-700 text-xs"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">From Date</label>
                            <div className="relative">
                                <FaCalendarAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="date"
                                    value={filterFromDate}
                                    onChange={(e) => setFilterFromDate(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none transition-all font-semibold text-slate-700 text-xs"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">To Date</label>
                            <div className="relative">
                                <FaCalendarAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="date"
                                    value={filterToDate}
                                    onChange={(e) => setFilterToDate(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none transition-all font-semibold text-slate-700 text-xs"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Sort By</label>
                            <div className="flex gap-2">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="w-full px-3 py-3 bg-slate-50 border border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none transition-all font-semibold text-slate-700 text-xs cursor-pointer"
                                >
                                    <option value="date">Order Date</option>
                                    <option value="amount">Order Amount</option>
                                    <option value="customer">Customer Name</option>
                                </select>
                                <button
                                    onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all font-black text-xs shrink-0 flex items-center justify-center border border-transparent hover:border-slate-200"
                                    title={`Toggle Sort Order: ${sortOrder === "asc" ? "Ascending" : "Descending"}`}
                                >
                                    {sortOrder === "asc" ? "▲" : "▼"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {(filterFromDate || filterToDate || searchQuery) && (
                        <div className="flex justify-end">
                            <button
                                onClick={resetFilters}
                                className="text-xs font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest flex items-center gap-1.5"
                            >
                                <FaTimes /> Clear All Filters
                            </button>
                        </div>
                    )}
                </div>

                {/* Orders Content */}
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <FaSpinner className="animate-spin text-indigo-600 text-4xl" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Online Orders...</p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest bg-white rounded-2xl border border-dashed border-slate-200">
                        No online orders found matching current criteria
                    </div>
                ) : (
                    <div className="space-y-4">
                        {[...orders].sort((a, b) => {
                            let valA, valB;
                            if (sortBy === "customer") {
                                valA = a.customer?.name?.toLowerCase() || "";
                                valB = b.customer?.name?.toLowerCase() || "";
                            } else if (sortBy === "amount") {
                                valA = a.grandTotal || 0;
                                valB = b.grandTotal || 0;
                            } else {
                                valA = new Date(a.orderDate || a.createdAt).getTime();
                                valB = new Date(b.orderDate || b.createdAt).getTime();
                            }
                            if (valA < valB) return sortOrder === "asc" ? -1 : 1;
                            if (valA > valB) return sortOrder === "asc" ? 1 : -1;
                            return 0;
                        }).map((order) => {
                            const isExpanded = !!expandedOrders[order._id];
                            return (
                                <div key={order._id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden hover:border-indigo-100 transition-colors">
                                    
                                    {/* Main Row Summary */}
                                    <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 cursor-pointer" onClick={() => toggleExpand(order._id)}>
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                                            
                                            {/* ID & Date */}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FaFileInvoice size={14} /></span>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-800 uppercase tracking-wider">{order.invoiceId}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                                            {new Date(order.orderDate || order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Customer Details */}
                                            <div className="md:col-span-2">
                                                <div className="flex items-start gap-3">
                                                    <span className="p-2 bg-slate-50 text-slate-500 rounded-lg shrink-0 mt-0.5"><FaUser size={14} /></span>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800 uppercase">{order.customer?.name}</p>
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] font-semibold text-slate-400">
                                                            <span className="flex items-center gap-1"><FaPhoneAlt size={9} /> {order.customer?.whatsapp || "No Contact"}</span>
                                                            <span className="flex items-center gap-1"><FaMapMarkerAlt size={9} /> {order.customer?.district ? `${order.customer.district}, ` : ""}{order.customer?.state || "N/A"}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Grand Total */}
                                            <div className="text-left md:text-right">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Order Total</p>
                                                <p className="text-lg font-black text-slate-800 mt-0.5">₹{(order.grandTotal || 0).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {/* Status & Actions Column */}
                                        <div className="flex items-center gap-4 self-end lg:self-auto border-t lg:border-t-0 pt-4 lg:pt-0" onClick={e => e.stopPropagation()}>
                                            {activeTab === "pending" ? (
                                                <button
                                                    onClick={() => handleApprove(order._id)}
                                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95"
                                                >
                                                    <FaCheckCircle /> Approve as SO
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <span className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                                        Approved as SO
                                                    </span>
                                                    {!order.invoiceGenerated && order.status !== "INVOICED" && (
                                                        <button
                                                            onClick={() => handleRevert(order._id)}
                                                            className="p-2.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition-all"
                                                            title="Revert back to pending online approval"
                                                        >
                                                            <FaUndo size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            <button 
                                                onClick={() => toggleExpand(order._id)}
                                                className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                {isExpanded ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Collapsible Items Details */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 bg-slate-50/50 p-6 space-y-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Order Items Details</h4>
                                            <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                                                <table className="w-full text-left text-xs font-semibold text-slate-700">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-widest text-[9px]">
                                                            <th className="py-3 px-4 font-black">Product Name</th>
                                                            <th className="py-3 px-4 font-black text-center">Quantity</th>
                                                            <th className="py-3 px-4 font-black text-right">Selling Price</th>
                                                            <th className="py-3 px-4 font-black text-center">GST (%)</th>
                                                            <th className="py-3 px-4 font-black text-right">Total Price</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {order.items.map((item, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                                                <td className="py-3 px-4 font-black text-slate-800 uppercase">{item.name}</td>
                                                                <td className="py-3 px-4 text-center font-bold text-slate-600">{item.qty} {item.unit || "units"}</td>
                                                                <td className="py-3 px-4 text-right">₹{item.sellingPrice?.toLocaleString() || 0}</td>
                                                                <td className="py-3 px-4 text-center font-bold text-slate-500">{item.gst || 0}%</td>
                                                                <td className="py-3 px-4 text-right font-black text-slate-800">₹{item.total?.toLocaleString() || 0}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            );
                        })}
                    </div>
                )}

            </div>
        </div>
    );
};

export default OnlineOrdersPage;
