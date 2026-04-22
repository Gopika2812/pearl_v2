import React, { useState, useEffect } from "react";
import { FaTimes, FaHistory, FaUser, FaPhone, FaCalendarAlt, FaClock } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";

const CustomerFollowUpHistoryModal = ({ isOpen, onClose, customer, branch }) => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && customer?._id && branch?._id) {
            fetchHistory();
        }
    }, [isOpen, customer?._id, branch?._id]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const url = `${API_BASE}/follow-ups?branchId=${branch._id}&customerId=${customer._id}`;
            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            const data = await res.json();
            if (data.success) {
                setRecords(data.data || []);
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            console.error("Fetch customer follow-up history error:", err);
            toast.error(err.message || "Failed to load follow-up history");
        } finally {
            setLoading(false);
        }
    };

    const getResultColor = (result) => {
        switch(result) {
            case "Paid": return "bg-emerald-100 text-emerald-700";
            case "Promised": return "bg-blue-100 text-blue-700";
            case "Part Payment Promised": return "bg-sky-100 text-sky-700";
            case "No Response": return "bg-gray-100 text-gray-700";
            case "Call Later": return "bg-amber-100 text-amber-700";
            case "Billing Dispute": return "bg-rose-100 text-rose-700";
            default: return "bg-indigo-50 text-indigo-700";
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-8 flex justify-between items-center text-white shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10">
                            <FaHistory size={28} />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black tracking-tight uppercase">Follow-Up History</h2>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                {customer?.name}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-2xl transition-all group">
                        <FaTimes size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-40">
                            <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">Retrieving historical data...</p>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-40 opacity-30">
                            <FaHistory size={64} className="text-gray-300 mb-6" />
                            <h3 className="text-2xl font-black text-gray-900 uppercase">No History Found</h3>
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-2">Zero follow-up records logged for this customer</p>
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/80 border-b border-gray-100">
                                            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Date Logged</th>
                                            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Follow-up By</th>
                                            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Result</th>
                                            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Bal (Logged)</th>
                                            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Next Follow-up</th>
                                            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {records.map((r) => (
                                            <tr key={r._id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="px-6 py-5">
                                                    <p className="text-[10px] font-black text-gray-800 uppercase">
                                                        {new Date(r.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">
                                                        {new Date(r.createdAt).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-tight">{r.followUpBy}</p>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight ${getResultColor(r.result)}`}>
                                                        {r.result}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-right font-black text-gray-800 text-xs">
                                                    ₹{r.closingBalance?.toLocaleString() || "0"}
                                                </td>
                                                <td className="px-6 py-5">
                                                    {r.nextFollowUpDate ? (
                                                        <div className="flex items-center gap-2 text-indigo-600">
                                                            <span className="text-[10px] font-black uppercase">
                                                                {new Date(r.nextFollowUpDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })}
                                                            </span>
                                                            <span className="text-[9px] font-bold opacity-60">
                                                                {new Date(r.nextFollowUpDate).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                            </span>
                                                        </div>
                                                    ) : <span className="text-[10px] text-gray-300">-</span>}
                                                </td>
                                                <td className="px-6 py-5 max-w-xs">
                                                    <p className="text-[10px] font-medium text-gray-600 italic leading-relaxed">
                                                        "{r.remarks || "No remarks"}"
                                                    </p>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-gray-100 flex justify-end bg-gray-50/50">
                    <button 
                        onClick={onClose}
                        className="px-10 py-4 bg-white border border-gray-200 text-gray-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-gray-900 transition-all shadow-sm"
                    >
                        Close Logs
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomerFollowUpHistoryModal;
