import React, { useState, useEffect, useMemo } from "react";
import { 
    FaTimes, FaTicketAlt, FaPlus, FaCheckCircle, 
    FaHistory, FaUser, FaBox, FaClock, FaSpinner 
} from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";

const TokenManagerModal = ({ isOpen, onClose, customer, branch, user }) => {
    const [tokens, setTokens] = useState([]);
    const [branchUsers, setBranchUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    
    // Create Form State
    const [tokenMessage, setTokenMessage] = useState("");
    const [assignedPerson, setAssignedPerson] = useState({ id: "", name: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && branch?._id) {
            fetchTokens();
            fetchBranchUsers();
        }
    }, [isOpen, branch?._id, customer?._id]);

    const fetchTokens = async () => {
        if (!branch?._id) return;
        setLoading(true);
        try {
            // Fetch ALL tokens for the branch and then filter by customer in frontend 
            // (since backend doesn't yet support customer filter on this endpoint)
            const res = await fetchWithAuth(`${API_BASE}/tokens/branch/${branch._id}?status=ALL`);
            const data = await res.json();
            if (data.success) {
                // Filter by customer name or ID if available
                const customerTokens = data.data.filter(t => 
                    t.customer?.id === customer?._id || 
                    t.customer?.name === customer?.name
                );
                setTokens(customerTokens);
            }
        } catch (err) {
            console.error("Fetch tokens error:", err);
            toast.error("Failed to load tokens");
        } finally {
            setLoading(false);
        }
    };

    const fetchBranchUsers = async () => {
        if (!branch?._id) return;
        try {
            const res = await fetchWithAuth(`${API_BASE}/branch-users/branch/${branch._id}`);
            const data = await res.json();
            if (data.success) {
                setBranchUsers(data.data);
            }
        } catch (err) {
            console.error("Failed to fetch branch users:", err);
        }
    };

    const handleCreateToken = async () => {
        if (!tokenMessage.trim()) {
            toast.warning("Please enter a message for the token");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                branchId: branch._id,
                assignedTo: assignedPerson.id ? assignedPerson : { id: null, name: "Unassigned" },
                customer: { id: customer._id, name: customer.name },
                message: tokenMessage
            };

            const res = await fetchWithAuth(`${API_BASE}/tokens`, {
                method: "POST",
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                toast.success(`Token created successfully!`);
                setTokenMessage("");
                setAssignedPerson({ id: "", name: "" });
                setShowCreateForm(false);
                fetchTokens();
            } else {
                toast.error(data.message || "Failed to create token");
            }
        } catch (err) {
            toast.error("Something went wrong");
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateTokenStatus = async (tokenId, status) => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/tokens/${tokenId}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status, takenBy: user?.id })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Status updated to ${status}`);
                fetchTokens();
            }
        } catch (err) {
            toast.error("Status update failed");
        }
    };

    const formatTime = (date) => {
        if (!date) return "--/--";
        return new Date(date).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 p-8 flex justify-between items-center text-white shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10">
                            <FaTicketAlt size={28} />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black tracking-tight uppercase">Token Manager</h2>
                            <p className="text-indigo-200 text-xs font-bold uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                {customer?.name}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-2xl transition-all group">
                        <FaTimes size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-8 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Active Records</h3>
                    <button 
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            showCreateForm ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                        }`}
                    >
                        {showCreateForm ? <><FaTimes /> Cancel</> : <><FaPlus /> Create Token</>}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
                    {/* Create Form */}
                    {showCreateForm && (
                        <div className="bg-white p-6 rounded-3xl border-2 border-indigo-100 shadow-sm mb-8 animate-in slide-in-from-top-4 duration-300">
                            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-6">New Token Details</h4>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-2">Assign To (Optional)</label>
                                    <select 
                                        value={assignedPerson.id}
                                        onChange={(e) => {
                                            const u = branchUsers.find(abu => abu._id === e.target.value);
                                            if (u) setAssignedPerson({ id: u._id, name: u.fullName || u.username });
                                            else setAssignedPerson({ id: "", name: "" });
                                        }}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold text-gray-700 outline-none focus:border-indigo-500 transition-all"
                                    >
                                        <option value="">No Assignment (Staff Pickup)</option>
                                        {branchUsers.map(u => <option key={u._id} value={u._id}>{u.fullName || u.username}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-2">Message / Instruction</label>
                                    <textarea 
                                        value={tokenMessage}
                                        onChange={(e) => setTokenMessage(e.target.value)}
                                        placeholder="What needs to be done for this customer?"
                                        rows="3"
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold text-gray-700 outline-none focus:border-indigo-500 transition-all resize-none"
                                    />
                                </div>
                                <button 
                                    onClick={handleCreateToken}
                                    disabled={isSubmitting}
                                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl shadow-indigo-600/20 text-[10px] disabled:opacity-50"
                                >
                                    {isSubmitting ? "PROCESSING..." : "REGISTER TOKEN"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Token List */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <FaSpinner className="text-3xl text-indigo-500 animate-spin mb-4" />
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Scanning Tokens...</p>
                        </div>
                    ) : tokens.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-30">
                            <FaTicketAlt size={48} className="text-gray-300 mb-4" />
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No active tokens for this customer</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {tokens.map(token => {
                                const isFinished = token.status === "COMPLETED";
                                const isAssignedToMe = (token.assignedTo?.id?._id || token.assignedTo?.id)?.toString() === (user?.id || user?._id)?.toString();
                                
                                return (
                                    <div key={token._id} className={`bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm ${isFinished ? 'opacity-60 grayscale' : ''}`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[8px] font-black tracking-widest uppercase">
                                                    {token.tokenId}
                                                </span>
                                                <h5 className={`text-[10px] font-black uppercase tracking-widest mt-2 ${
                                                    token.status === "OPEN" ? "text-amber-500" :
                                                    token.status === "COMPLETED" ? "text-emerald-500" : "text-blue-500"
                                                }`}>
                                                    {token.status?.replace("_", " ")}
                                                </h5>
                                            </div>
                                            <p className="text-[8px] font-bold text-gray-400">{formatTime(token.createdAt)}</p>
                                        </div>
                                        
                                        <div className="bg-gray-50 p-3 rounded-xl mb-4 border border-gray-50">
                                            <div className="flex items-center gap-2 text-[9px] font-black text-gray-500 mb-1 uppercase">
                                                <FaBox size={10} /> Instruction
                                            </div>
                                            <p className="text-[10px] font-bold text-gray-700 line-clamp-2">{token.message || "No specific instructions"}</p>
                                        </div>

                                        <div className="flex items-center gap-4 mb-4">
                                            <div>
                                                <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Assigned To</p>
                                                <p className="text-[10px] font-black text-gray-600">{token.assignedTo?.name || "Unassigned"}</p>
                                            </div>
                                        </div>

                                        {!isFinished && (
                                            <div className="flex gap-2">
                                                {isAssignedToMe ? (
                                                    <>
                                                        {token.status === "OPEN" && (
                                                            <button 
                                                                onClick={() => updateTokenStatus(token._id, "TAKEN")}
                                                                className="flex-1 bg-indigo-600 text-white h-9 rounded-xl font-black text-[9px] uppercase tracking-widest"
                                                            >
                                                                Take
                                                            </button>
                                                        )}
                                                        {(token.status === "TAKEN" || token.status === "IN_PROGRESS") && (
                                                            <button 
                                                                onClick={() => updateTokenStatus(token._id, "COMPLETED")}
                                                                className="flex-1 bg-emerald-600 text-white h-9 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5"
                                                            >
                                                                <FaCheckCircle /> Finish
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="flex-1 text-center py-2 bg-gray-50 rounded-xl text-[8px] font-black text-gray-400 uppercase">
                                                        Wait for Staff
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-gray-100 flex justify-end bg-white">
                    <button 
                        onClick={onClose}
                        className="px-10 py-4 bg-gray-950 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-900/20"
                    >
                        Close Portal
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TokenManagerModal;
