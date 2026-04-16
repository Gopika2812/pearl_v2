import React, { useState, useEffect } from "react";
import { FaUser, FaPhone, FaMoneyBillWave, FaClock, FaCalendarAlt, FaHistory, FaCheckCircle, FaSave, FaExclamationTriangle } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

const BranchFollowUp = () => {
    const { currentBranch, user } = useBranch();
    const [customerGroups, setCustomerGroups] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState("");
    const [selectedCustomerId, setSelectedCustomerId] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form Stats
    const [result, setResult] = useState("Promised");
    const [remarks, setRemarks] = useState("");
    const [nextFollowUpDate, setNextFollowUpDate] = useState("");
    const [nextFollowUpTime, setNextFollowUpTime] = useState("10:00");

    const RESULT_OPTIONS = [
        "Paid", "Promised", "Part Payment Promised", "Already Paid – Entry Pending",
        "No Response", "Call Later", "Document Needed", "Billing Dispute",
        "Approval Pending", "Long Pending", "Not Committed", "others"
    ];

    useEffect(() => {
        if (currentBranch?._id) {
            fetchGroups();
            fetchCustomers();
        }
    }, [currentBranch?._id]);

    const fetchGroups = async () => {
        try {
            const res = await fetch(`${API_BASE}/customer-groups?branchId=${currentBranch._id}`);
            const data = await res.json();
            if (data.success) setCustomerGroups(data.data || []);
        } catch (err) {
            console.error("Error fetching groups:", err);
        }
    };

    const fetchCustomers = async (groupId = "") => {
        try {
            let url = `${API_BASE}/customers?branchId=${currentBranch._id}&limit=500`;
            if (groupId) url += `&customerGroupId=${groupId}`;
            const res = await fetch(url);
            const data = await res.json();
            if (res.ok) setCustomers(data || []);
        } catch (err) {
            console.error("Error fetching customers:", err);
        }
    };

    const handleGroupChange = (e) => {
        const gid = e.target.value;
        setSelectedGroupId(gid);
        setSelectedCustomerId("");
        setSelectedCustomer(null);
        fetchCustomers(gid);
    };

    const handleCustomerChange = (e) => {
        const cid = e.target.value;
        setSelectedCustomerId(cid);
        const cust = customers.find(c => c._id === cid);
        setSelectedCustomer(cust);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedCustomer) {
            toast.error("Please select a customer first");
            return;
        }

        setSubmitting(true);
        try {
            // Combine date and time
            let combinedDate = null;
            if (nextFollowUpDate) {
                combinedDate = new Date(`${nextFollowUpDate}T${nextFollowUpTime}`);
            }

            const payload = {
                branchId: currentBranch._id,
                customerId: selectedCustomer._id,
                followUpBy: user?.name || user?.username || "Staff",
                closingBalance: selectedCustomer.closingBalance || 0,
                creditLimit: selectedCustomer.creditLimit || 200000,
                creditLimitDays: selectedCustomer.creditLimitDays || 0,
                result,
                remarks,
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
                // Clear form
                setResult("Promised");
                setRemarks("");
                setNextFollowUpDate("");
                setSelectedCustomerId("");
                setSelectedCustomer(null);
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
        <div className="min-h-screen bg-[#f8fafc] pt-20 md:pt-4 md:pl-20">
            <ToastContainer />
            <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6">
                
                {/* HEADER */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <FaPhone className="text-white text-2xl" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-800 tracking-tight">Customer Follow-Up</h1>
                            <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mt-0.5">
                                Log communication & payment promises
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* SELECTION PANEL */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Select Customer</h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 mb-1 block">CUSTOMER GROUP</label>
                                    <select 
                                        className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                        value={selectedGroupId}
                                        onChange={handleGroupChange}
                                    >
                                        <option value="">All Groups</option>
                                        {customerGroups.map(g => (
                                            <option key={g._id} value={g._id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 mb-1 block">CUSTOMER NAME</label>
                                    <select 
                                        className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                        value={selectedCustomerId}
                                        onChange={handleCustomerChange}
                                    >
                                        <option value="">Select Customer...</option>
                                        {customers.map(c => (
                                            <option key={c._id} value={c._id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pt-4 border-t border-gray-50">
                                    <div className="flex items-center justify-between text-xs py-2">
                                        <span className="text-gray-400 font-bold uppercase tracking-tight">Follow-Up By</span>
                                        <span className="text-indigo-600 font-black">{user?.name || user?.username || "Staff Member"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {selectedCustomer && (
                            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 rounded-3xl shadow-xl shadow-indigo-600/20 text-white animate-in zoom-in-95 duration-300">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                                        <FaUser className="text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-sm truncate w-40">{selectedCustomer.name}</h4>
                                        <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest">{selectedCustomer.whatsapp || "No Phone"}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <span className="text-[10px] font-bold uppercase opacity-60">Closing Balance</span>
                                        <span className="text-lg font-black tracking-tight">₹{selectedCustomer.closingBalance?.toLocaleString() || "0"}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <span className="text-[10px] font-bold uppercase opacity-60">Credit Limit</span>
                                        <span className="text-sm font-black">₹{selectedCustomer.creditLimit?.toLocaleString() || "2,00,000"}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-[10px] font-bold uppercase opacity-60">Credit Days</span>
                                        <span className="text-sm font-black">{selectedCustomer.creditLimitDays || "0"} Days</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* FOLLOW UP FORM */}
                    <div className="lg:col-span-2">
                        {selectedCustomer ? (
                            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                        <FaHistory size={18} />
                                    </div>
                                    <h3 className="text-lg font-black text-gray-800 tracking-tight">Record Follow-Up Result</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                    <div className="space-y-6">
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-3 block">Follow-Up Result</label>
                                            <div className="grid grid-cols-1 gap-2">
                                                {RESULT_OPTIONS.map(opt => (
                                                    <button
                                                        key={opt}
                                                        type="button"
                                                        onClick={() => setResult(opt)}
                                                        className={`text-left px-4 py-3 rounded-xl text-xs font-bold border transition-all ${
                                                            result === opt 
                                                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20 scale-102" 
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
                                            <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                                                <FaClock /> Scheduled reminder will appear on dashboard at this time.
                                            </p>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-3 block text-indigo-600">Follow-Up Remarks / Discussion Details</label>
                                            <textarea 
                                                rows="8"
                                                className="w-full p-4 bg-gray-50 border-none rounded-2xl text-sm font-medium outline-none border border-transparent focus:bg-white focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                                                placeholder={`Enter details about why it's "${result}"...`}
                                                value={remarks}
                                                onChange={(e) => setRemarks(e.target.value)}
                                                required
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-auto pt-8 border-t border-gray-100 flex items-center justify-between">
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
                        ) : (
                            <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center opacity-30 h-[600px]">
                                <FaHistory size={64} className="mb-4 text-gray-300" />
                                <h3 className="text-xl font-black text-gray-800">Select a Customer</h3>
                                <p className="text-sm text-gray-500 max-w-[250px] mt-2">Pick a customer from the left panel to begin recording your follow-up discussion.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BranchFollowUp;
