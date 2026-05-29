import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { 
    FaShoppingCart, FaBoxOpen, FaCheckCircle, 
    FaPlus, FaMinus, FaTrash, FaInfoCircle, FaRocket,
    FaSearch, FaChevronRight, FaStore, FaHeart
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { API_BASE } from '../../api';

const SharedLinkCustomerPage = () => {
    const { token } = useParams();
    const [orderData, setOrderData] = useState(null);
    const [cart, setCart] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isConfirming, setIsConfirming] = useState(false);
    const [error, setError] = useState(null);
    const [confirmedOrderId, setConfirmedOrderId] = useState(null);
    
    // Browsing State
    const [allProducts, setAllProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isBrowsing, setIsBrowsing] = useState(false);
    const [viewMode, setViewMode] = useState("table"); // "grid" or "table"
    const [recommendations, setRecommendations] = useState([]);

    useEffect(() => {
        fetchOrderData();
    }, [token]);

    const fetchOrderData = async () => {
        try {
            const res = await fetch(`${API_BASE}/crm-orders/public/order/${token}`);
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to load order");
            }
            const data = await res.json();
            setOrderData(data);
            setRecommendations(data.recommendations || []);
            setCart([]);
            
            // Also fetch all products for browsing with customerId for locked pricing
            fetchProducts(data.session.branchId, "", data.session.customerId?._id || data.session.customerId);
        } catch (err) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchProducts = async (branchId, search = "", customerId = "") => {
        try {
            const customerParam = customerId ? `&customerId=${customerId}` : "";
            const res = await fetch(`${API_BASE}/crm-orders/public/products?branchId=${branchId}&search=${search}${customerParam}`);
            if (res.ok) {
                const data = await res.json();
                setAllProducts(data);
            }
        } catch (err) {
            console.error("Failed to fetch products", err);
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
                qty: 1,
                image: product.image
            }];
        });
        toast.success(`Added ${product.name} to bag`);
    };

    const updateQty = (productId, delta) => {
        setCart(prev => {
            const updated = prev.map(item => {
                if (item.productId === productId) {
                    const newQty = item.qty + delta;
                    return { ...item, qty: newQty };
                }
                return item;
            });
            // Auto-remove if qty drops to 0
            return updated.filter(item => item.qty > 0);
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.productId !== productId));
        toast.info("Item removed from bag");
    };

    const handleConfirm = async () => {
        if (cart.length === 0) return toast.error("Your bag is empty");
        setIsConfirming(true);
        try {
            const res = await fetch(`${API_BASE}/crm-orders/public/order/${token}/confirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: cart })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Confirmation failed");
            }

            const data = await res.json();
            setConfirmedOrderId(data.orderId);
            toast.success("Order confirmed successfully!");
        } catch (err) {
            toast.error(err.message);
        } finally {
            setIsConfirming(false);
        }
    };

    if (isLoading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Preparing your Storefront...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white p-12 rounded-[3rem] shadow-xl text-center">
                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FaInfoCircle size={40} />
                </div>
                <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Link Unavailable</h1>
                <p className="text-slate-500 font-medium mb-8">{error}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Please contact us for a fresh link.</p>
            </div>
        </div>
    );

    if (confirmedOrderId) return (
        <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white p-12 rounded-[3rem] shadow-2xl shadow-emerald-200/50 text-center border-2 border-emerald-50">
                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                    <FaCheckCircle size={50} />
                </div>
                <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-2">Order Success!</h1>
                <p className="text-slate-500 font-bold mb-8">We've received your order and are processing it right now.</p>
                
                <div className="bg-slate-50 p-6 rounded-3xl mb-8">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Order ID</p>
                    <p className="text-2xl font-black text-indigo-600 tracking-tighter">{confirmedOrderId}</p>
                </div>
                
                <button 
                    onClick={() => window.location.reload()}
                    className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline"
                >
                    View Order Details
                </button>
            </div>
        </div>
    );

    const total = cart.reduce((sum, item) => sum + (item.sellingPrice * item.qty), 0);

    return (
        <div className="min-h-screen bg-[#f8fafc] font-sans selection:bg-indigo-100">
            {/* Nav */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-slate-100 py-4 px-6 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                            <FaStore />
                        </div>
                        <div>
                            <h1 className="font-black text-slate-900 uppercase tracking-tighter text-lg leading-none">Pearls Shopping</h1>
                            <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-1">Personalized Selection</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="hidden md:block text-right">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Shopping for</p>
                            <p className="font-black text-slate-800 text-sm">{orderData.session.customerId?.name}</p>
                        </div>
                        <div className="relative">
                            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-200">
                                <FaShoppingCart />
                            </div>
                            {cart.length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-rose-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-4 border-white">
                                    {cart.length}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Main Content Area */}
                <div className="lg:col-span-8 space-y-8">
                    
                    {/* Admin Message - Featured Banner Style */}
                    {orderData.notes && orderData.notes.length > 0 && (
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-10 rounded-[3rem] shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-700">
                                <FaRocket size={120} />
                            </div>
                            <div className="relative z-10">
                                <span className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100 mb-4 border border-white/10">Special Note</span>
                                <p className="text-2xl font-bold leading-tight max-w-lg italic">"{orderData.notes[0].note}"</p>
                            </div>
                        </div>
                    )}

                    {/* Catalog Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                                Our <span className="text-indigo-600">Picks</span> for You
                            </h2>
                            {/* Grid / Table Toggle */}
                            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                <button 
                                    onClick={() => setViewMode("table")}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === "table" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                                >
                                    Table
                                </button>
                                <button 
                                    onClick={() => setViewMode("grid")}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === "grid" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                                >
                                    Grid
                                </button>
                            </div>
                        </div>
                        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                            <button 
                                onClick={() => setIsBrowsing(false)}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isBrowsing ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Your Selection
                            </button>
                            <button 
                                onClick={() => setIsBrowsing(true)}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isBrowsing ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Browse All
                            </button>
                        </div>
                    </div>

                    {!isBrowsing ? (
                        /* Selected Recommendations (Repeatedly Bought Products) */
                        recommendations.length === 0 ? (
                            <div className="bg-white rounded-[2.5rem] p-12 text-center border border-slate-100 shadow-sm">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                    <FaBoxOpen size={24} />
                                </div>
                                <p className="text-slate-400 text-xs font-black uppercase tracking-widest">No past purchase history available.</p>
                            </div>
                        ) : viewMode === "table" ? (
                            /* Recommendations Table View */
                            <div className="overflow-x-auto rounded-[2.5rem] bg-white border border-slate-100 shadow-sm">
                                <table className="w-full text-left text-xs font-semibold text-slate-700">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-widest text-[9px]">
                                            <th className="py-4 px-6 font-black">Product Details</th>
                                            <th className="py-4 px-6 font-black text-center">Times Bought</th>
                                            <th className="py-4 px-6 font-black text-right">Price</th>
                                            <th className="py-4 px-6 font-black text-center w-40">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {recommendations.map(item => {
                                            const cartItem = cart.find(c => c.productId === (item._id || item.id));
                                            return (
                                                <tr key={item._id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 bg-slate-50 rounded-xl overflow-hidden shrink-0 border border-slate-100 flex items-center justify-center text-slate-200">
                                                                {item.image ? (
                                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <FaBoxOpen size={20} />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-slate-800 uppercase text-xs">{item.name}</p>
                                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{item.units || "Units"}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 text-center font-bold text-slate-600">
                                                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase">
                                                            {item.frequency || 1}x Bought
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-right font-black text-slate-800">
                                                        <div className="flex flex-col items-end justify-center">
                                                            <span className="text-sm font-black flex items-center gap-1">
                                                                {item.isLockedPrice && <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">LOCKED PRICE</span>}
                                                                ₹{item.sellingPrice?.toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        {cartItem ? (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button onClick={() => updateQty(cartItem.productId, -1)} className="w-6 h-6 flex items-center justify-center bg-slate-100 text-slate-600 rounded hover:bg-slate-200"><FaMinus size={8} /></button>
                                                                <span className="text-xs font-black w-4 text-center">{cartItem.qty}</span>
                                                                <button onClick={() => updateQty(cartItem.productId, 1)} className="w-6 h-6 flex items-center justify-center bg-slate-100 text-slate-600 rounded hover:bg-slate-200"><FaPlus size={8} /></button>
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                onClick={() => addToCart(item)}
                                                                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 justify-center mx-auto"
                                                            >
                                                                <FaPlus size={8} /> Add to Bag
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            /* Recommendations Grid View */
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {recommendations.map(item => (
                                    <div key={item._id} className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 transition-all duration-500 group flex flex-col">
                                        <div className="w-full aspect-square bg-slate-50 rounded-[2rem] mb-6 flex items-center justify-center text-slate-200 overflow-hidden border border-slate-100 group-hover:scale-[1.02] transition-transform duration-500">
                                            {item.image ? (
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <FaBoxOpen size={60} />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full">{item.frequency || 1}x BOUGHT</span>
                                                {item.isLockedPrice && <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-full">LOCKED PRICE</span>}
                                            </div>
                                            <h3 className="text-lg font-black text-slate-800 uppercase leading-tight mb-2">{item.name}</h3>
                                            <p className="text-2xl font-black text-slate-900">₹{item.sellingPrice.toLocaleString()}</p>
                                        </div>
                                        <button 
                                            onClick={() => addToCart(item)}
                                            className="mt-6 w-full py-4 bg-slate-50 hover:bg-indigo-600 hover:text-white text-slate-900 rounded-2xl font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2"
                                        >
                                            <FaPlus /> Add to Bag
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        /* Full Product Browser */
                        <div className="space-y-6">
                            <div className="relative">
                                <FaSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text"
                                    placeholder="Looking for something else? Search here..."
                                    className="w-full pl-14 pr-6 py-5 bg-white rounded-[2rem] border border-slate-200 focus:border-indigo-500 transition-all outline-none font-medium text-slate-700 shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        fetchProducts(orderData.session.branchId, e.target.value, orderData.session.customerId?._id || orderData.session.customerId);
                                    }}
                                />
                            </div>
                            
                            {viewMode === "table" ? (
                                /* Browse All Table View */
                                <div className="overflow-x-auto rounded-[2.5rem] bg-white border border-slate-100 shadow-sm">
                                    <table className="w-full text-left text-xs font-semibold text-slate-700">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-widest text-[9px]">
                                                <th className="py-4 px-6 font-black">Product Details</th>
                                                <th className="py-4 px-6 font-black text-right">Price</th>
                                                <th className="py-4 px-6 font-black text-center w-40">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {allProducts.map(item => {
                                                const cartItem = cart.find(c => c.productId === (item._id || item.id));
                                                return (
                                                    <tr key={item._id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-4 px-6">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-12 h-12 bg-slate-50 rounded-xl overflow-hidden shrink-0 border border-slate-100 flex items-center justify-center text-slate-200">
                                                                    {item.image ? (
                                                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <FaBoxOpen size={20} />
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="font-black text-slate-800 uppercase text-xs">{item.name}</p>
                                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{item.units || "Units"}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-6 text-right font-black text-slate-800">
                                                            <div className="flex flex-col items-end justify-center">
                                                                <span className="text-sm font-black flex items-center gap-1">
                                                                    {item.isLockedPrice && <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">LOCKED PRICE</span>}
                                                                    ₹{item.sellingPrice?.toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-6 text-center">
                                                            {cartItem ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <button onClick={() => updateQty(cartItem.productId, -1)} className="w-6 h-6 flex items-center justify-center bg-slate-100 text-slate-600 rounded hover:bg-slate-200"><FaMinus size={8} /></button>
                                                                    <span className="text-xs font-black w-4 text-center">{cartItem.qty}</span>
                                                                    <button onClick={() => updateQty(cartItem.productId, 1)} className="w-6 h-6 flex items-center justify-center bg-slate-100 text-slate-600 rounded hover:bg-slate-200"><FaPlus size={8} /></button>
                                                                </div>
                                                            ) : (
                                                                <button 
                                                                    onClick={() => addToCart(item)}
                                                                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 justify-center mx-auto"
                                                                >
                                                                    <FaPlus size={8} /> Add to Bag
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                /* Browse All Grid View */
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {allProducts.map(p => (
                                        <div key={p._id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg transition-all group">
                                            <div className="w-full aspect-square bg-slate-50 rounded-2xl mb-3 flex items-center justify-center text-slate-200 overflow-hidden">
                                                {p.image ? (
                                                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <FaBoxOpen size={30} />
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between mb-1 h-4">
                                                {p.isLockedPrice && <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-1.5 py-0.5 rounded-full">LOCKED</span>}
                                            </div>
                                            <p className="text-[10px] font-black text-slate-800 uppercase line-clamp-2 leading-tight mb-1 h-8">{p.name}</p>
                                            <p className="text-sm font-black text-indigo-600 mb-3">₹{p.sellingPrice.toLocaleString()}</p>
                                            <button 
                                                onClick={() => addToCart(p)}
                                                className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Side: Shopping Bag */}
                <div className="lg:col-span-4">
                    <div className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-2xl shadow-slate-200/50 sticky top-28">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                <FaShoppingCart className="text-rose-500" /> Your Bag
                            </h2>
                            <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                {cart.length} Items
                            </span>
                        </div>

                        <div className="space-y-6 max-h-[45vh] overflow-y-auto mb-8 pr-2 no-scrollbar">
                            {cart.length === 0 ? (
                                <div className="py-12 text-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 text-slate-200">
                                        <FaShoppingCart size={24} />
                                    </div>
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Bag is empty</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.productId} className="flex items-center gap-4 group relative">
                                        <div className="w-14 h-14 bg-slate-50 rounded-xl shrink-0 overflow-hidden border border-slate-100">
                                            {item.image ? (
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-200"><FaBoxOpen size={20} /></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-slate-800 uppercase truncate">{item.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-xs font-black text-indigo-600">₹{(item.sellingPrice * item.qty).toLocaleString()}</p>
                                                <p className="text-[8px] font-bold text-slate-400">₹{item.sellingPrice.toLocaleString()} / ea</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button 
                                                onClick={() => updateQty(item.productId, -1)} 
                                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                                    item.qty <= 1 
                                                        ? 'bg-rose-50 text-rose-500 hover:bg-rose-100' 
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {item.qty <= 1 ? <FaTrash size={8} /> : <FaMinus size={8} />}
                                            </button>
                                            <span className="text-[10px] font-black w-6 text-center">{item.qty}</span>
                                            <button onClick={() => updateQty(item.productId, 1)} className="w-7 h-7 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-100 hover:text-indigo-600 flex items-center justify-center transition-all"><FaPlus size={8} /></button>
                                        </div>
                                        {/* Swipe-to-delete button (always visible) */}
                                        <button 
                                            onClick={() => removeFromCart(item.productId)} 
                                            className="w-7 h-7 bg-rose-50 text-rose-400 rounded-lg hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 absolute -right-2 -top-2 shadow-sm border border-rose-100"
                                            title="Remove from bag"
                                        >
                                            <FaTrash size={8} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="space-y-6 pt-6 border-t border-slate-100">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Bag Total</span>
                                <span className="text-3xl font-black text-slate-900 tracking-tighter">₹{total.toLocaleString()}</span>
                            </div>

                            <button 
                                onClick={handleConfirm}
                                disabled={isConfirming || cart.length === 0}
                                className="w-full py-5 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest transition-all duration-300 shadow-xl shadow-slate-200 active:scale-95 flex items-center justify-center gap-3"
                            >
                                {isConfirming ? "Processing..." : (
                                    <>
                                        Confirm & Place Order <FaChevronRight size={12} />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </div>
    );
};

export default SharedLinkCustomerPage;
