import React, { useState, useEffect } from 'react';
import { 
    FaUserPlus, FaBoxOpen, FaShoppingCart, FaLink, 
    FaHistory, FaChartLine, FaSearch, FaTimes, 
    FaCheckCircle, FaChevronRight, FaPlus, FaMinus, FaTrash, FaArrowLeft
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
                expiryDays: 7
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

    const filteredProducts = (products || []).filter(p => 
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.hsnCode?.includes(searchTerm)
    ).slice(0, 20);

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                                <FaChartLine />
                            </span>
                            Smart Orders(CRM) <span className="text-indigo-500 font-medium text-sm bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">CRM Assisted</span>
                        </h1>
                        <p className="text-slate-500 mt-1 font-medium">Create and share personalized product selections with your customers.</p>
                    </div>
                    
                    <button 
                        onClick={() => setIsCustomerModalOpen(true)}
                        className={`flex items-center gap-3 px-6 py-4 rounded-2xl transition-all duration-300 font-bold ${
                            selectedCustomer 
                            ? "bg-emerald-50 text-emerald-700 border-2 border-emerald-100" 
                            : "bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95"
                        }`}
                    >
                        {selectedCustomer ? (
                            <>
                                <div className="text-left">
                                    <p className="text-[10px] uppercase tracking-widest opacity-70">Selected Customer</p>
                                    <p className="text-sm">{selectedCustomer.name}</p>
                                </div>
                                <FaCheckCircle className="text-xl" />
                            </>
                        ) : (
                            <>
                                <FaUserPlus className="text-lg" />
                                <span>Select Customer</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Side: Product Selection */}
                <div className="lg:col-span-8 space-y-8">
                    
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
                <div className="lg:col-span-4 space-y-6">
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
                                    <button 
                                        onClick={() => {
                                            setGeneratedLink(null);
                                            setCart([]);
                                            setSelectedCustomer(null);
                                            setNotes("");
                                        }}
                                        className="w-full py-4 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/5 transition"
                                    >
                                        Create New Order
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

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
