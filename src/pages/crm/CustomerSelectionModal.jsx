import React, { useState, useEffect } from 'react';
import { FaSearch, FaTimes, FaUser, FaStar, FaHistory, FaChevronRight } from 'react-icons/fa';
import { apiWithAuth } from '../../api';
import { useInventory } from '../../context/InventoryContext';
import { useBranch } from '../../context/BranchContext';

const CustomerSelectionModal = ({ isOpen, onClose, onSelect }) => {
    const { customers } = useInventory();
    const { currentBranch } = useBranch();
    const [searchTerm, setSearchTerm] = useState("");
    const [suggested, setSuggested] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && currentBranch) {
            fetchSuggestions();
        }
    }, [isOpen, currentBranch]);

    const fetchSuggestions = async () => {
        setIsLoading(true);
        try {
            const res = await apiWithAuth.get(`/crm-orders/customers/suggest?branchId=${currentBranch._id}`);
            setSuggested(res.data);
        } catch (error) {
            console.error("Failed to fetch suggested customers:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const filtered = customers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.whatsapp?.includes(searchTerm)
    ).slice(0, 50);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="p-8 bg-indigo-600 text-white flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Select Customer</h2>
                        <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">Identify the recipient for this order</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-colors">
                        <FaTimes />
                    </button>
                </div>

                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Suggested Customers */}
                    {!searchTerm && suggested.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-4 text-amber-500">
                                <FaStar size={14} />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Frequent Customers</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {suggested.map(c => (
                                    <button 
                                        key={c._id}
                                        onClick={() => onSelect(c)}
                                        className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl hover:bg-amber-100 transition-all text-left group"
                                    >
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500 shadow-sm">
                                            <FaUser />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-slate-800 uppercase truncate">{c.name}</p>
                                            <p className="text-[10px] font-bold text-amber-600 mt-0.5">{c.orderCount} Past Orders</p>
                                        </div>
                                        <FaChevronRight className="text-amber-300 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Search Section */}
                    <div>
                        <div className="relative mb-6">
                            <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Search all customers by name or phone..."
                                className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-medium text-slate-700"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 mb-3 text-slate-400">
                                <FaHistory size={14} />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">All Customers</h3>
                            </div>
                            {filtered.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                                    No customers found matching "{searchTerm}"
                                </div>
                            ) : (
                                filtered.map(c => (
                                    <button 
                                        key={c._id}
                                        onClick={() => onSelect(c)}
                                        className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all text-left group"
                                    >
                                        <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                            <FaUser />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-slate-800 uppercase truncate">{c.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{c.whatsapp || "No phone"}</p>
                                        </div>
                                        <FaChevronRight className="text-slate-200 group-hover:translate-x-1 transition-transform group-hover:text-indigo-300" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select a customer to view personalized product recommendations</p>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f8fafc;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
            `}} />
        </div>
    );
};

export default CustomerSelectionModal;
