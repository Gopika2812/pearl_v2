import React, { useState, useEffect } from "react";
import { FaTimes, FaHistory, FaClock, FaSave, FaExclamationTriangle } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";

const FollowUpFormModal = ({ isOpen, onClose, customer, user, branch, onSave }) => {
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState("Promised");
    const [remarks, setRemarks] = useState("");
    const [riskStatus, setRiskStatus] = useState(customer?.riskStatus || "safe_zone");
    const [nextFollowUpDate, setNextFollowUpDate] = useState("");
    const [nextFollowUpTime, setNextFollowUpTime] = useState("10:00");

    useEffect(() => {
        if (isOpen && customer) {
            setResult("Promised");
            setRemarks("");
            setRiskStatus(customer?.riskStatus || "safe_zone");
            setNextFollowUpDate("");
            setNextFollowUpTime("10:00");
        }
    }, [customer?._id, isOpen]);

    const RESULT_OPTIONS = [
        "Paid", "Promised", "Part Payment Promised", "Already Paid – Entry Pending",
        "No Response", "Call Later", "Document Needed", "Billing Dispute",
        "Approval Pending", "Long Pending", "Not Committed", "others"
    ];

    const RISK_OPTIONS = [
        { id: "safe_zone", label: "Safe Zone", color: "bg-emerald-500", active: "bg-emerald-600 ring-4 ring-emerald-500/20" },
        { id: "medium_zone", label: "Medium Zone", color: "bg-amber-500", active: "bg-amber-600 ring-4 ring-amber-500/20" },
        { id: "risk_zone", label: "Risk Zone", color: "bg-rose-500", active: "bg-rose-600 ring-4 ring-rose-500/20" }
    ];

    if (!isOpen || !customer) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            let combinedDate = null;
            if (nextFollowUpDate) {
                combinedDate = new Date(`${nextFollowUpDate}T${nextFollowUpTime}`);
            }

            const payload = {
                branchId: branch._id,
                customerId: customer._id,
                followUpBy: user?.name || user?.username || "Staff",
                closingBalance: (customer.debit || 0) - (customer.credit || 0),
                creditLimit: customer.creditLimit || 200000,
                creditLimitDays: customer.creditLimitDays || 0,
                result,
                remarks,
                riskStatus,
                nextFollowUpDate: combinedDate
            };

            const res = await fetch(`${API_BASE}/follow-ups`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                toast.success("Follow-up recorded successfully!");
                onSave();
                onClose();
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            toast.error(err.message || "Failed to record follow-up");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 flex justify-between items-center text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                            <FaHistory size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight uppercase">Record Follow-Up Result</h2>
                            <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest opacity-80">{customer.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <FaTimes size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* RISK ZONE SELECTION */}
                        <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-4 block">Assessment Status</label>
                            <div className="grid grid-cols-3 gap-4">
                                {RISK_OPTIONS.map(opt => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setRiskStatus(opt.id)}
                                        className={`flex items-center justify-center gap-3 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                            riskStatus === opt.id 
                                                ? `${opt.active} text-white shadow-lg` 
                                                : "bg-white text-gray-400 border border-gray-100 hover:border-gray-200"
                                        }`}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${riskStatus === opt.id ? 'bg-white' : opt.color}`}></span>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-3 block">Follow-Up Result</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {RESULT_OPTIONS.map(opt => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setResult(opt)}
                                                className={`text-left px-4 py-3 rounded-xl text-xs font-bold border transition-all ${
                                                    result === opt 
                                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20" 
                                                        : "bg-gray-50 text-gray-500 border-transparent hover:border-indigo-200"
                                                }`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-3 block">Next Follow-Up Date & Time</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="date"
                                            className="flex-1 p-3.5 bg-gray-50 border-none rounded-2xl text-xs font-bold outline-none ring-2 ring-transparent focus:ring-indigo-500/10 transition"
                                            value={nextFollowUpDate}
                                            onChange={(e) => setNextFollowUpDate(e.target.value)}
                                        />
                                        <input 
                                            type="time"
                                            className="w-32 p-3.5 bg-gray-50 border-none rounded-2xl text-xs font-bold outline-none ring-2 ring-transparent focus:ring-indigo-500/10 transition"
                                            value={nextFollowUpTime}
                                            onChange={(e) => setNextFollowUpTime(e.target.value)}
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1 font-bold">
                                        <FaClock /> Scheduled reminder will appear on dashboard at this time.
                                    </p>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-3 block text-indigo-600">Follow-Up Remarks / Discussion Details</label>
                                    <textarea 
                                        rows="6"
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl text-sm font-medium outline-none border border-transparent focus:bg-white focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                                        placeholder={`Enter details about why it's "${result}"...`}
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                        required
                                    ></textarea>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-rose-500">
                                <FaExclamationTriangle size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Commitment is logged permanently</span>
                            </div>
                            <button 
                                type="submit"
                                disabled={submitting}
                                className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition shadow-xl shadow-indigo-600/30 text-sm font-black disabled:opacity-50"
                            >
                                {submitting ? "RECORDING..." : (
                                    <>
                                        <FaSave /> SAVE FOLLOW-UP
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default FollowUpFormModal;
