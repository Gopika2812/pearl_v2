import React, { useState, useEffect } from 'react';
import { 
    FaUserPlus, FaBoxOpen, FaShoppingCart, FaLink, 
    FaHistory, FaChartLine, FaSearch, FaTimes, 
    FaCheckCircle, FaChevronRight, FaPlus, FaMinus, FaTrash, FaArrowLeft,
    FaWhatsapp, FaUsers, FaGlobe, FaSpinner, FaFileInvoiceDollar
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiWithAuth } from '../../api';
import { useBranch } from '../../context/BranchContext';
import { useInventory } from '../../context/InventoryContext';
import CustomerSelectionModal from './CustomerSelectionModal';

const SmartOrdersDashboard = () => {
    const { currentBranch } = useBranch();
    const navigate = useNavigate();
    const { products } = useInventory();
    
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [cart, setCart] = useState([]);
    const [notes, setNotes] = useState("");
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [recommendations, setRecommendations] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [generatedLink, setGeneratedLink] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // New states for Customer Table Mode
    const [activeTab, setActiveTab] = useState("customers"); // "draft" or "customers"
    const [customersList, setCustomersList] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(false);
    const [customerSearchQuery, setCustomerSearchQuery] = useState("");
 
    // Sorting states for Customers Directory
    const [sortBy, setSortBy] = useState("bills"); // "name", "balance", "bills"
    const [sortOrder, setSortOrder] = useState("desc"); // "asc", "desc"
 
    const toggleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortBy(field);
            setSortOrder("desc");
        }
    };

    // Fetch recommendations when customer is selected
    useEffect(() => {
        if (selectedCustomer) {
            fetchRecommendations(selectedCustomer._id || selectedCustomer.id);
        } else {
            setRecommendations([]);
        }
    }, [selectedCustomer]);

    const fetchRecommendations = async (customerId) => {
        try {
            const res = await apiWithAuth.get(`/crm-orders/products/recommend/${customerId}`);
            setRecommendations(res.data);
        } catch (error) {
            console.error("Failed to fetch recommendations:", error);
        }
    };

    const fetchCustomersList = async () => {
        if (!currentBranch) return;
        setCustomersLoading(true);
        try {
            const res = await apiWithAuth.get(`/crm-orders/customers/suggest?branchId=${currentBranch._id}&all=true`);
            setCustomersList(res.data || []);
        } catch (error) {
            console.error("Failed to fetch customer list:", error);
            toast.error("Failed to load customer statistics");
        } finally {
            setCustomersLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === "customers") {
            fetchCustomersList();
        }
    }, [activeTab, currentBranch]);

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.productId === (product._id || product.id));
            if (existing) {
                return prev.map(item => 
                    item.productId === (product._id || product.id) 
                        ? { ...item, qty: item.qty + 1 } 
                        : item
                );
            }
            return [...prev, {
                productId: product._id || product.id,
                name: product.name,
                sellingPrice: product.sellingPrice || 0,
                gst: product.gst || 0,
                qty: 1
            }];
        });
        toast.success(`Added ${product.name} to list`);
    };

    const updateQty = (productId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.productId === productId) {
                const newQty = Math.max(1, item.qty + delta);
                return { ...item, qty: newQty };
            }
            return item;
        }));
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.productId !== productId));
    };

    const handleGenerateLink = async () => {
        if (!selectedCustomer) return toast.error("Please select a customer first");
        if (cart.length === 0) return toast.error("Please add at least one product");

        setIsLoading(true);
        try {
            // 1. Create Session
            const sessionRes = await apiWithAuth.post('/crm-orders/sessions', {
                branchId: currentBranch?._id,
                customerId: selectedCustomer?._id || selectedCustomer?.id,
                items: cart,
                notes
            });

            // 2. Generate Link
            const linkRes = await apiWithAuth.post('/crm-orders/links', {
                sessionId: sessionRes.data._id,
                expiryDays: 7,
                baseUrl: "https://pearlsfrontend.web.app"
            });

            setGeneratedLink(linkRes.data.link);
            toast.success("Shareable link generated!");
        } catch (error) {
            toast.error("Failed to generate link");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleWhatsappShare = () => {
        if (!selectedCustomer) return;
        const message = `Hello ${selectedCustomer.name},\n\nWe have prepared a special product selection for you. You can view it and place your order directly here:\n\n${generatedLink}\n\nLooking forward to your order!`;
        const encodedMessage = encodeURIComponent(message);
        const phone = selectedCustomer.whatsapp || selectedCustomer.phone || "";
        const whatsappUrl = `https://wa.me/91${phone.replace(/\D/g, "")}?text=${encodedMessage}`;
        window.open(whatsappUrl, "_blank");
    };

    const handleAutoWhatsappShare = async (customer) => {
        setIsLoading(true);
        try {
            // 1. Fetch recommendations
            const recRes = await apiWithAuth.get(`/crm-orders/products/recommend/${customer._id}`);
            const recs = recRes.data;
            if (!recs || recs.length === 0) {
                toast.error("No past purchase recommendations found for this customer. Please select products manually in Draft Mode.");
                setIsLoading(false);
                return;
            }

            // 2. Create Session
            const cartItems = recs.map(p => ({
                productId: p._id || p.id,
                name: p.name,
                sellingPrice: p.sellingPrice || 0,
                gst: p.gst || 0,
                qty: 1
            }));

            const sessionRes = await apiWithAuth.post('/crm-orders/sessions', {
                branchId: currentBranch?._id,
                customerId: customer?._id,
                items: cartItems,
                notes: "Automated product list based on past purchases."
            });

            // 3. Generate Link
            const linkRes = await apiWithAuth.post('/crm-orders/links', {
                sessionId: sessionRes.data._id,
                expiryDays: 7,
                baseUrl: "https://pearlsfrontend.web.app"
            });

            const link = linkRes.data.link;
            
            // 4. Send to WhatsApp
            const message = `Hello ${customer.name},\n\nWe have prepared a special selection of products based on your past orders. You can view details and order here:\n\n${link}\n\nLooking forward to your order!`;
            const encodedMessage = encodeURIComponent(message);
            const phone = customer.whatsapp || "";
            if (!phone) {
                toast.warn("Customer has no phone number. Link copied to clipboard instead!");
                navigator.clipboard.writeText(link);
                setIsLoading(false);
                return;
            }
            const whatsappUrl = `https://wa.me/91${phone.replace(/\D/g, "")}?text=${encodedMessage}`;
            window.open(whatsappUrl, "_blank");
            toast.success("WhatsApp link generated and shared!");
        } catch (error) {
            toast.error("Failed to generate and share link");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAutoCopyLink = async (customer) => {
        setIsLoading(true);
        try {
            // 1. Fetch recommendations
            const recRes = await apiWithAuth.get(`/crm-orders/products/recommend/${customer._id}`);
            const recs = recRes.data;
            if (!recs || recs.length === 0) {
                toast.error("No past purchase recommendations found for this customer. Please select products manually in Draft Mode.");
                setIsLoading(false);
                return;
            }

            // 2. Create Session
            const cartItems = recs.map(p => ({
                productId: p._id || p.id,
                name: p.name,
                sellingPrice: p.sellingPrice || 0,
                gst: p.gst || 0,
                qty: 1
            }));

            const sessionRes = await apiWithAuth.post('/crm-orders/sessions', {
                branchId: currentBranch?._id,
                customerId: customer?._id,
                items: cartItems,
                notes: "Automated product list based on past purchases."
            });

            // 3. Generate Link
            const linkRes = await apiWithAuth.post('/crm-orders/links', {
                sessionId: sessionRes.data._id,
                expiryDays: 7,
                baseUrl: "https://pearlsfrontend.web.app"
            });

            const link = linkRes.data.link;
            
            // 4. Copy to Clipboard
            await navigator.clipboard.writeText(link);
            toast.success("📋 Shareable link copied to clipboard!");
        } catch (error) {
            toast.error("Failed to generate and copy link");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };


    const filteredProducts = (products || []).filter(p => 
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.hsnCode?.includes(searchTerm)
    ).slice(0, 20);

    const filteredCustomersList = customersList.filter(c => 
        c.name?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
        c.whatsapp?.includes(customerSearchQuery) ||
        c.district?.toLowerCase().includes(customerSearchQuery.toLowerCase())
    );
 
    const sortedCustomersList = [...filteredCustomersList].sort((a, b) => {
        let valA, valB;
        if (sortBy === "name") {
            valA = a.name?.toLowerCase() || "";
            valB = b.name?.toLowerCase() || "";
        } else if (sortBy === "balance") {
            valA = a.closingBalance || 0;
            valB = b.closingBalance || 0;
        } else {
            // Default "bills" (orderCount)
            valA = a.orderCount || 0;
            valB = b.orderCount || 0;
        }
 
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
    });
 
    const cartTotal = cart.reduce((sum, item) => sum + (item.sellingPrice * item.qty), 0);

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
            <div className="max-w-7xl mx-auto mb-8 space-y-4">
                <button 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-all font-black text-[10px] uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm"
                >
                    <FaArrowLeft /> Back
                </button>
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                                <FaChartLine />
                            </span>
                            Smart Orders(CRM) <span className="text-indigo-500 font-medium text-sm bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">CRM Assisted</span>
                        </h1>
                        <p className="text-slate-500 mt-1 font-medium">Create and share personalized product selections with your customers.</p>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl self-start lg:self-auto">
                        <button
                            onClick={() => setActiveTab("customers")}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                activeTab === "customers"
                                ? "bg-white text-indigo-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            <FaUsers /> Customers Directory
                        </button>
                        <button
                            onClick={() => setActiveTab("draft")}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                activeTab === "draft"
                                ? "bg-white text-indigo-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            <FaShoppingCart /> Draft Mode
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === "draft" ? (
                <div className="max-w-7xl mx-auto flex flex-col lg:grid lg:grid-cols-12 gap-8">
                    {/* Left Side: Product Selection */}
                    <div className="lg:col-span-8 space-y-8 order-2 lg:order-1">
                        
                        {/* Selected Customer Header Banner */}
                        <div className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                    <FaUserPlus className="text-lg" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Customer</p>
                                    <p className="text-base font-black text-slate-800">
                                        {selectedCustomer ? selectedCustomer.name : "No customer selected"}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsCustomerModalOpen(true)}
                                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                            >
                                {selectedCustomer ? "Change Customer" : "Select Customer"}
                            </button>
                        </div>

                        {/* Recommendations Section */}
                        {selectedCustomer && recommendations.length > 0 && (
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <FaHistory className="text-indigo-500" /> Smart Recommendations
                                    </h2>
                                    <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">Based on past orders</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {recommendations.map(p => (
                                        <button 
                                            key={p._id}
                                            onClick={() => addToCart(p)}
                                            className="group p-4 bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-indigo-100/50 border border-transparent hover:border-indigo-100 rounded-3xl transition-all duration-500 text-left"
                                        >
                                            <div className="w-full aspect-square bg-white rounded-2xl mb-3 flex items-center justify-center text-slate-300 group-hover:scale-105 transition-transform duration-500 overflow-hidden border border-slate-100">
                                                {p.image ? (
                                                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <FaBoxOpen size={40} />
                                                )}
                                            </div>
                                            <p className="text-xs font-black text-slate-800 line-clamp-2 uppercase leading-tight mb-1">{p.name}</p>
                                            <p className="text-xs font-bold text-indigo-600">₹{p.sellingPrice?.toLocaleString()}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Search & All Products */}
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                            <div className="relative mb-8">
                                <FaSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text"
                                    placeholder="Search products by name or HSN..."
                                    className="w-full pl-14 pr-6 py-5 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all duration-300 outline-none font-medium text-slate-700"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {filteredProducts.map(p => (
                                    <div key={p._id} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50 transition-all group">
                                        <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 shrink-0 overflow-hidden border border-slate-100">
                                            {p.image ? (
                                                <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <FaBoxOpen size={24} />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-black text-slate-800 uppercase line-clamp-1">{p.name}</p>
                                            <p className="text-xs font-bold text-slate-400 mt-0.5">₹{p.sellingPrice?.toLocaleString()}</p>
                                        </div>
                                        <button 
                                            onClick={() => addToCart(p)}
                                            className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all duration-300"
                                        >
                                            <FaPlus />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Cart & Actions */}
                    <div className="lg:col-span-4 space-y-6 order-1 lg:order-2">
                        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-900/20 sticky top-24">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-xl font-black flex items-center gap-3">
                                    <FaShoppingCart className="text-indigo-400" /> Order List
                                </h2>
                                <span className="bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/30">
                                    {cart.length} Items
                                </span>
                            </div>

                            <div className="space-y-4 max-h-[40vh] overflow-y-auto mb-8 pr-2 custom-scrollbar">
                                {cart.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                                            <FaBoxOpen className="text-white/20" />
                                        </div>
                                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No items selected</p>
                                    </div>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.productId} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 group">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black uppercase truncate">{item.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-1">₹{item.sellingPrice?.toLocaleString()} / unit</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => updateQty(item.productId, -1)} className="w-6 h-6 flex items-center justify-center bg-white/10 rounded-lg hover:bg-white/20"><FaMinus size={10} /></button>
                                                <span className="text-xs font-black w-4 text-center">{item.qty}</span>
                                                <button onClick={() => updateQty(item.productId, 1)} className="w-6 h-6 flex items-center justify-center bg-white/10 rounded-lg hover:bg-white/20"><FaPlus size={10} /></button>
                                                <button onClick={() => removeFromCart(item.productId)} className="text-rose-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"><FaTrash size={12} /></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="space-y-6 pt-6 border-t border-white/10">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">Estimated Total</span>
                                    <span className="text-2xl font-black">₹{cartTotal.toLocaleString()}</span>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Admin Notes (Shown to customer)</label>
                                    <textarea 
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500 transition-all"
                                        placeholder="Add any special instructions or offer details..."
                                        rows="3"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                    />
                                </div>

                                {!generatedLink ? (
                                    <button 
                                        onClick={handleGenerateLink}
                                        disabled={isLoading || cart.length === 0}
                                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-2xl font-black uppercase tracking-widest transition-all duration-300 shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-3"
                                    >
                                        {isLoading ? "Generating..." : (
                                            <>
                                                <FaLink /> Generate Shareable Link
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <FaCheckCircle /> Link Ready
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    readOnly 
                                                    value={generatedLink}
                                                    className="bg-black/20 border border-white/5 rounded-xl px-3 py-2 text-[10px] flex-1 outline-none text-emerald-200"
                                                />
                                                <button 
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(generatedLink);
                                                        toast.info("Copied to clipboard!");
                                                    }}
                                                    className="px-4 py-2 bg-white/10 rounded-xl text-[10px] font-bold hover:bg-white/20 transition"
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button 
                                                onClick={handleWhatsappShare}
                                                className="py-4 bg-[#25D366] hover:bg-[#20bd5c] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                                            >
                                                <FaWhatsapp size={14} /> WhatsApp
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    setGeneratedLink(null);
                                                    setCart([]);
                                                    setSelectedCustomer(null);
                                                    setNotes("");
                                                }}
                                                className="py-4 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Customer Directory Table Layout */
                <div className="max-w-7xl mx-auto space-y-8">
                    {/* Metrics/Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl">
                                <FaUsers size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Clients</p>
                                <p className="text-2xl font-black text-slate-800">{customersList.length}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl">
                                <FaCheckCircle size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Transacting Clients</p>
                                <p className="text-2xl font-black text-slate-800">
                                    {customersList.filter(c => c.orderCount > 0).length}
                                </p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="p-4 bg-amber-50 text-amber-600 rounded-xl">
                                <FaFileInvoiceDollar size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Bills Placed</p>
                                <p className="text-2xl font-black text-slate-800">
                                    {customersList.reduce((sum, c) => sum + c.orderCount, 0)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Table Control Panel */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="relative flex-1">
                                <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text"
                                    placeholder="Search directory by client name, whatsapp, or district..."
                                    className="w-full pl-12 pr-6 py-3.5 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none transition-all font-semibold text-slate-700 text-sm"
                                    value={customerSearchQuery}
                                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={fetchCustomersList}
                                className="px-5 py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-slate-100"
                            >
                                Refresh Data
                            </button>
                        </div>

                        {customersLoading ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-3">
                                <FaSpinner className="animate-spin text-indigo-600 text-4xl" />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Customer Directory...</p>
                            </div>
                        ) : filteredCustomersList.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest border border-dashed border-slate-200 rounded-2xl">
                                No clients found matching "{customerSearchQuery}"
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-2xl border border-slate-50">
                                <table className="w-full text-left text-xs font-semibold text-slate-700">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                                            <th 
                                                className="py-4 px-6 font-black cursor-pointer select-none hover:bg-slate-100/50 rounded-tl-xl transition-all"
                                                onClick={() => toggleSort("name")}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span>Client Details</span>
                                                    {sortBy === "name" && (
                                                        <span className="text-[9px] font-black text-indigo-600">
                                                            {sortOrder === "asc" ? "▲" : "▼"}
                                                        </span>
                                                    )}
                                                </div>
                                            </th>
                                            <th className="py-4 px-6 font-black">WhatsApp / Phone</th>
                                            <th className="py-4 px-6 font-black">Location</th>
                                            <th 
                                                className="py-4 px-6 font-black text-right cursor-pointer select-none hover:bg-slate-100/50 transition-all"
                                                onClick={() => toggleSort("balance")}
                                            >
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <span>Closing Balance</span>
                                                    {sortBy === "balance" && (
                                                        <span className="text-[9px] font-black text-indigo-600">
                                                            {sortOrder === "asc" ? "▲" : "▼"}
                                                        </span>
                                                    )}
                                                </div>
                                            </th>
                                            <th 
                                                className="py-4 px-6 font-black text-center cursor-pointer select-none hover:bg-slate-100/50 transition-all"
                                                onClick={() => toggleSort("bills")}
                                            >
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span>Bills Bought</span>
                                                    {sortBy === "bills" && (
                                                        <span className="text-[9px] font-black text-indigo-600">
                                                            {sortOrder === "asc" ? "▲" : "▼"}
                                                        </span>
                                                    )}
                                                </div>
                                            </th>
                                            <th className="py-4 px-6 font-black text-center w-52">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {sortedCustomersList.map((customer) => {
                                            const balance = customer.closingBalance || 0;
                                            return (
                                                <tr key={customer._id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 bg-indigo-50 text-indigo-600 font-black rounded-lg flex items-center justify-center uppercase text-sm">
                                                                {customer.name?.substring(0, 2)}
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-slate-800 text-sm uppercase">{customer.name}</p>
                                                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{customer.email || "No email"}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 font-bold text-slate-600">
                                                        {customer.whatsapp || "N/A"}
                                                    </td>
                                                    <td className="py-4 px-6 text-slate-500">
                                                        <div className="flex items-center gap-1.5">
                                                            <FaGlobe className="text-slate-300" />
                                                            <span>
                                                                {customer.district ? `${customer.district}, ` : ""}
                                                                {customer.state || "N/A"}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 text-right font-black">
                                                        <span className={balance > 0 ? "text-rose-600" : balance < 0 ? "text-emerald-600" : "text-slate-400"}>
                                                            ₹{balance.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 font-black text-xs rounded-full">
                                                            {customer.orderCount}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        <div className="flex items-center justify-center gap-2.5">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedCustomer(customer);
                                                                    setActiveTab("draft");
                                                                    toast.success(`Draft active for: ${customer.name}`);
                                                                }}
                                                                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1"
                                                                title="Select this customer to build custom order draft"
                                                            >
                                                                <span>Plan Order</span>
                                                                <FaChevronRight size={10} />
                                                            </button>
                                                            <button
                                                                disabled={isLoading}
                                                                onClick={() => handleAutoWhatsappShare(customer)}
                                                                className="px-3.5 py-2 bg-[#25D366] hover:bg-[#1ebd56] text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95 disabled:opacity-50"
                                                                title="Auto-build link from recommendations and open WhatsApp"
                                                            >
                                                                <FaWhatsapp size={13} />
                                                                <span>Auto Link</span>
                                                            </button>
                                                            <button
                                                                disabled={isLoading}
                                                                onClick={() => handleAutoCopyLink(customer)}
                                                                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50"
                                                                title="Auto-build link from recommendations and copy to clipboard"
                                                            >
                                                                <FaLink size={11} />
                                                                <span>Copy Link</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <CustomerSelectionModal 
                isOpen={isCustomerModalOpen}
                onClose={() => setIsCustomerModalOpen(false)}
                onSelect={(customer) => {
                    setSelectedCustomer(customer);
                    setIsCustomerModalOpen(false);
                }}
            />

            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 10px;
                }
            `}} />
        </div>
    );
};

export default SmartOrdersDashboard;
