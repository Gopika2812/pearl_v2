import React, { useEffect, useState } from "react";
import { FaHistory, FaSearch, FaSync, FaReceipt, FaUser, FaWallet, FaHandHoldingUsd, FaPlus, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import FilterableSelect from "../../components/FilterableSelect";

const BranchDeliveryReceipt = () => {
  const { currentBranch, user } = useBranch();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [filterFromDate, setFilterFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [filterToDate, setFilterToDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterDeliveryPerson, setFilterDeliveryPerson] = useState("");
  const [branchUsers, setBranchUsers] = useState([]);

  const fetchBranchUsers = async () => {
    if (!currentBranch?._id) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/branch-users/branch/${currentBranch._id}`);
      const data = await res.json();
      if (data.success) {
        setBranchUsers(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch branch users", err);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    deliveryPerson: user?.username || "",
    customerId: "",
    collectedAmount: "",
    expenseAmount: "",
    expenseNote: "",
  });
  const [recordType, setRecordType] = useState("COLLECTED"); // COLLECTED or EXPENSE
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomers = async () => {
    if (!currentBranch?._id) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/customers?branchId=${currentBranch._id}&limit=1000`);
      const data = await res.json();
      if (data.success) {
        setCustomers(data.data.map(c => ({ _id: c._id, name: c.name })));
      }
    } catch (err) {
      console.error("Failed to fetch customers");
    }
  };

  const fetchReceipts = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      let url = `${API_BASE}/delivery-receipts?branchId=${currentBranch._id}`;
      if (filterFromDate) url += `&fromDate=${filterFromDate}`;
      if (filterToDate) url += `&toDate=${filterToDate}`;
      if (filterDeliveryPerson) url += `&deliveryPerson=${encodeURIComponent(filterDeliveryPerson)}`;

      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (data.success) {
        setReceipts(data.data || []);
      }
    } catch (err) {
      toast.error("Failed to fetch receipts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchReceipts();
    fetchBranchUsers();
  }, [currentBranch?._id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customerId || !formData.deliveryPerson) {
      toast.error("Please fill in required fields");
      return;
    }

    setSubmitting(true);
    try {
      const customer = customers.find(c => c._id === formData.customerId);
      const res = await fetchWithAuth(`${API_BASE}/delivery-receipts`, {
        method: "POST",
        body: JSON.stringify({
          branchId: currentBranch._id,
          date: formData.date,
          deliveryPerson: formData.deliveryPerson,
          customer: { customerId: formData.customerId, name: customer?.name || "N/A" },
          collectedAmount: formData.collectedAmount,
          expenseAmount: formData.expenseAmount,
          expenseNote: formData.expenseNote,
          createdBy: user?.username || "System",
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Receipt saved successfully");
        setFormData({
          ...formData,
          customerId: "",
          collectedAmount: "",
          expenseAmount: "",
          expenseNote: "",
        });
        setRecordType("COLLECTED");
        fetchReceipts();
      } else {
        toast.error(data.message || "Failed to save receipt");
      }
    } catch (err) {
      toast.error("Error saving receipt");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/delivery-receipts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Record deleted");
        setReceipts(prev => prev.filter(r => r._id !== id));
      }
    } catch (err) {
      toast.error("Failed to delete record");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full mx-auto px-4 sm:px-8 py-4">
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
              <FaReceipt className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                Delivery <span className="text-emerald-600">Receipts</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Log collections and expenses from delivery trips
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* FORM */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-24">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <FaPlus className="text-emerald-500" /> New Record
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1 tracking-widest">Date</label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-emerald-500 transition-all outline-none"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1 tracking-widest">Delivery Person</label>
                  <div className="relative group">
                    <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <select
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 py-3 text-sm font-bold focus:bg-white focus:border-emerald-500 transition-all outline-none appearance-none cursor-pointer"
                      value={formData.deliveryPerson}
                      onChange={(e) => setFormData({ ...formData, deliveryPerson: e.target.value })}
                    >
                      <option value="">Select User</option>
                      {branchUsers.map(u => (
                        <option key={u._id} value={u.name}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1 tracking-widest">Customer</label>
                  <FilterableSelect
                    options={customers}
                    value={formData.customerId}
                    onChange={(val) => setFormData({ ...formData, customerId: val })}
                    placeholder="Select Customer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1 tracking-widest">Entry Type</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-emerald-500 transition-all outline-none cursor-pointer"
                    value={recordType}
                    onChange={(e) => {
                      setRecordType(e.target.value);
                      // Clear the other type's values
                      if (e.target.value === "COLLECTED") {
                        setFormData({ ...formData, expenseAmount: "", expenseNote: "" });
                      } else {
                        setFormData({ ...formData, collectedAmount: "" });
                      }
                    }}
                  >
                    <option value="COLLECTED">COLLECTED AMOUNT</option>
                    <option value="EXPENSE">EXPENSE RECORD</option>
                  </select>
                </div>

                {recordType === "COLLECTED" ? (
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1 tracking-widest">Collected Amount</label>
                    <div className="relative group">
                      <FaWallet className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" />
                      <input
                        type="number"
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 py-3 text-sm font-black text-emerald-600 focus:bg-white focus:border-emerald-500 transition-all outline-none"
                        value={formData.collectedAmount}
                        onChange={(e) => setFormData({ ...formData, collectedAmount: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1 tracking-widest">Expense Amount</label>
                      <div className="relative group">
                        <FaHandHoldingUsd className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-400" />
                        <input
                          type="number"
                          placeholder="0.00"
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 py-3 text-sm font-black text-rose-600 focus:bg-white focus:border-rose-500 transition-all outline-none"
                          value={formData.expenseAmount}
                          onChange={(e) => setFormData({ ...formData, expenseAmount: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1 tracking-widest">Expense Note</label>
                      <textarea
                        placeholder="e.g., Fuel, Toll, Parking..."
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-emerald-500 transition-all outline-none resize-none h-20"
                        value={formData.expenseNote}
                        onChange={(e) => setFormData({ ...formData, expenseNote: e.target.value })}
                      />
                    </div>
                  </>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-emerald-700 transition shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <FaSync className="animate-spin" /> : <FaPlus />}
                  Save Record
                </button>
              </form>
            </div>
          </div>

          {/* LIST */}
          <div className="lg:col-span-2 space-y-6">
            {/* LIST FILTERS */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">From</label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-black focus:bg-white focus:border-emerald-500 transition-all outline-none"
                    value={filterFromDate}
                    onChange={(e) => setFilterFromDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">To</label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-black focus:bg-white focus:border-emerald-500 transition-all outline-none"
                    value={filterToDate}
                    onChange={(e) => setFilterToDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Filter Person</label>
                  <div className="relative group">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      type="text"
                      placeholder="Person Name..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 py-2.5 text-sm font-bold focus:bg-white focus:border-emerald-500 transition-all outline-none"
                      value={filterDeliveryPerson}
                      onChange={(e) => setFilterDeliveryPerson(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <button 
                onClick={fetchReceipts}
                className="mt-4 w-full py-2.5 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition flex items-center justify-center gap-2"
              >
                <FaSync className={loading ? "animate-spin" : ""} /> Apply Filters
              </button>
            </div>

            {/* LIST TABLE */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / Person</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Collected</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Expense</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Net</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                          <FaSync className="animate-spin inline-block mr-2" /> Loading Receipts...
                        </td>
                      </tr>
                    ) : receipts.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                          No records found for this period.
                        </td>
                      </tr>
                    ) : (
                      receipts.map((r) => (
                        <tr key={r._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-800">{new Date(r.date).toLocaleDateString('en-IN')}</span>
                              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">{r.deliveryPerson}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-700">{r.customer?.name}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-xs font-black text-emerald-600">₹{r.collectedAmount.toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-black text-rose-600">₹{r.expenseAmount.toLocaleString()}</span>
                              {r.expenseNote && <span className="text-[9px] font-medium text-slate-400 italic">"{r.expenseNote}"</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`text-xs font-black px-2 py-1 rounded-lg ${r.netAmount >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              ₹{r.netAmount.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={() => handleDelete(r._id)}
                              className="text-slate-300 hover:text-rose-500 transition-colors p-2"
                            >
                              <FaTrash size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchDeliveryReceipt;
