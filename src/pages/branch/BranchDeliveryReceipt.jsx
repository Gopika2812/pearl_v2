import React, { useEffect, useState } from "react";
import { 
  FaHistory, FaSearch, FaSync, FaReceipt, FaUser, FaWallet, 
  FaHandHoldingUsd, FaPlus, FaTrash, FaPlusCircle, FaMinusCircle, 
  FaCoins, FaCalculator, FaFileInvoiceDollar, FaCheckCircle, FaCalendarAlt, FaMapMarkerAlt
} from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import FilterableSelect from "../../components/FilterableSelect";
import ScrollToggleButton from "../../components/ScrollToggleButton";

const BranchDeliveryReceipt = () => {
  const { currentBranch, user } = useBranch();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [filterFromDate, setFilterFromDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterToDate, setFilterToDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterDeliveryPerson, setFilterDeliveryPerson] = useState("");
  const [filterReceiptId, setFilterReceiptId] = useState("");

  // Batch Form State
  const [collections, setCollections] = useState([
    { customerId: "", name: "", amount: "", paymentMode: "CASH" }
  ]);
  const [expenses, setExpenses] = useState([
    { amount: "", note: "" }
  ]);
  const [deliveryPerson, setDeliveryPerson] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);

  // Auto-set delivery person from user login
  useEffect(() => {
    if (user) {
      setDeliveryPerson(user.name || user.username || "");
    }
  }, [user]);

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
      if (filterReceiptId) url += `&receiptId=${encodeURIComponent(filterReceiptId)}`;

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
  }, [currentBranch?._id]);

  // Dynamic Handlers
  const addCollection = () => setCollections([...collections, { customerId: "", name: "", amount: "", paymentMode: "CASH" }]);
  const removeCollection = (index) => setCollections(collections.filter((_, i) => i !== index));
  const updateCollection = (index, field, value) => {
    const newCollections = [...collections];
    if (field === 'customerId') {
      const cust = customers.find(c => c._id === value);
      newCollections[index].customerId = value;
      newCollections[index].name = cust?.name || "";
    } else {
      newCollections[index][field] = value;
    }
    setCollections(newCollections);
  };

  const addExpense = () => setExpenses([...expenses, { amount: "", note: "" }]);
  const removeExpense = (index) => setExpenses(expenses.filter((_, i) => i !== index));
  const updateExpense = (index, field, value) => {
    const newExpenses = [...expenses];
    newExpenses[index][field] = value;
    setExpenses(newExpenses);
  };

  // Calculations
  const totalCollected = collections.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalExpense = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netAmount = totalCollected - totalExpense;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validCollections = collections.filter(c => c.customerId && c.amount > 0);
    const validExpenses = expenses.filter(e => e.amount > 0);
    if (validCollections.length === 0 && validExpenses.length === 0) {
      toast.error("Please add at least one collection or expense");
      return;
    }
    setSubmitting(true);
    try {
      const finalBranchId = currentBranch?._id || user?.branchId;
      const res = await fetchWithAuth(`${API_BASE}/delivery-receipts`, {
        method: "POST",
        body: JSON.stringify({
          branchId: finalBranchId,
          date,
          deliveryPerson: user?.name || user?.username || deliveryPerson,
          collections: validCollections.map(c => ({
            customer: { customerId: c.customerId, name: c.name },
            amount: Number(c.amount),
            paymentMode: c.paymentMode
          })),
          expenses: validExpenses.map(e => ({
            amount: Number(e.amount),
            note: e.note
          })),
          createdBy: user?.username || "System",
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Receipt ${data.data.receiptId} saved!`);
        setCollections([{ customerId: "", name: "", amount: "", paymentMode: "CASH" }]);
        setExpenses([{ amount: "", note: "" }]);
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
    if (!window.confirm("Are you sure you want to delete this full receipt?")) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/delivery-receipts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Receipt deleted");
        setReceipts(prev => prev.filter(r => r._id !== id));
      }
    } catch (err) {
      toast.error("Failed to delete record");
    }
  };

  return (
    <div className="relative min-h-screen bg-[#f8fafc] pt-20 md:pt-8 md:pl-24 pr-4 pb-12 font-poppins">
      <ScrollToggleButton />
      <div className="max-w-[1400px] mx-auto">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-emerald-200">
              <FaReceipt className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight uppercase">
                Delivery <span className="text-emerald-500">Receipts</span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Batch Manager</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full lg:w-auto">
             <div className="bg-white px-6 py-4 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center gap-4 w-full">
                <div className="flex flex-col items-center sm:items-start w-full sm:w-auto">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logged User</span>
                  <span className="text-sm font-black text-slate-700">{deliveryPerson}</span>
                </div>
                <div className="hidden sm:block w-px h-8 bg-slate-100"></div>
                <div className="flex flex-col items-center sm:items-start w-full sm:w-auto border-t sm:border-t-0 border-slate-50 pt-2 sm:pt-0">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Entry Date</span>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="text-sm font-black text-emerald-600 outline-none bg-transparent"
                  />
                </div>
             </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* COLLECTIONS CARD */}
          <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-slate-200/50 border border-slate-100 relative z-[20]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-[5rem] -mr-10 -mt-10 opacity-50"></div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <FaWallet className="text-emerald-600" />
                </div>
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Collections</h2>
              </div>
              <button 
                onClick={addCollection}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
              >
                <FaPlusCircle /> Add Customer
              </button>
            </div>

            <div className="space-y-4">
              {collections.map((col, index) => (
                <div key={index} className="flex flex-col md:grid md:grid-cols-12 gap-4 items-end bg-slate-50/50 p-5 rounded-3xl border border-slate-50 group hover:border-emerald-100 hover:bg-white transition-all duration-300">
                  <div className="w-full md:col-span-5">
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Select Customer</label>
                    <FilterableSelect
                      options={customers}
                      value={col.customerId}
                      onChange={(val) => updateCollection(index, 'customerId', val)}
                      placeholder="Search customer..."
                    />
                  </div>
                  <div className="w-full md:col-span-3">
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Amount (₹)</label>
                    <input 
                      type="number"
                      value={col.amount}
                      onChange={(e) => updateCollection(index, 'amount', e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-black text-emerald-600 outline-none"
                    />
                  </div>
                  <div className="w-full md:col-span-3">
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Mode</label>
                    <select 
                      value={col.paymentMode}
                      onChange={(e) => updateCollection(index, 'paymentMode', e.target.value)}
                      className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-black text-slate-600 outline-none"
                    >
                      <option value="CASH">CASH</option>
                      <option value="UPI">UPI</option>
                    </select>
                  </div>
                  <div className="w-full md:col-span-1 flex justify-end pb-1">
                    <button 
                      onClick={() => removeCollection(index)}
                      disabled={collections.length === 1}
                      className="p-2 text-slate-300 hover:text-rose-500 disabled:opacity-0"
                    >
                      <FaMinusCircle size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* EXPENSES CARD */}
          <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-slate-200/50 border border-slate-100 relative z-[10]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-bl-[5rem] -mr-10 -mt-10 opacity-50"></div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-100 rounded-2xl flex items-center justify-center">
                  <FaHandHoldingUsd className="text-rose-600" />
                </div>
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Expenses</h2>
              </div>
              <button 
                onClick={addExpense}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase hover:bg-rose-600 hover:text-white transition-all shadow-sm"
              >
                <FaPlusCircle /> Add Expense
              </button>
            </div>

            <div className="space-y-4">
              {expenses.map((exp, index) => (
                <div key={index} className="flex flex-col md:grid md:grid-cols-12 gap-4 items-start bg-slate-50/50 p-5 rounded-3xl border border-slate-50 group hover:border-rose-100 hover:bg-white transition-all duration-300">
                  <div className="w-full md:col-span-3">
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Amount (₹)</label>
                    <input 
                      type="number"
                      value={exp.amount}
                      onChange={(e) => updateExpense(index, 'amount', e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-black text-rose-600 outline-none"
                    />
                  </div>
                  <div className="w-full md:col-span-8">
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Expense Note</label>
                    <input 
                      type="text"
                      value={exp.note}
                      onChange={(e) => updateExpense(index, 'note', e.target.value)}
                      placeholder="Reason..."
                      className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-600 outline-none"
                    />
                  </div>
                  <div className="w-full md:col-span-1 flex justify-end pt-8">
                    <button 
                      onClick={() => removeExpense(index)}
                      disabled={expenses.length === 1}
                      className="p-2 text-slate-300 hover:text-rose-500 disabled:opacity-0"
                    >
                      <FaMinusCircle size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SUMMARY & SAVE — full width below expenses */}
          <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-8 text-white shadow-2xl shadow-slate-300 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full -ml-20 -mb-20"></div>

            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2 relative">
              <FaCalculator className="text-emerald-400" /> Receipt Summary
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 relative">
              <div className="bg-white/5 p-4 rounded-2xl">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Collected</div>
                <div className="text-2xl font-black text-emerald-400">₹{totalCollected.toLocaleString()}</div>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Expenses</div>
                <div className="text-2xl font-black text-rose-400">₹{totalExpense.toLocaleString()}</div>
              </div>
              <div className="bg-emerald-500/20 border border-emerald-500/30 p-4 rounded-2xl">
                <div className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1">Net Cash In Hand</div>
                <div className="text-2xl font-black text-white">₹{netAmount.toLocaleString()}</div>
              </div>
            </div>

            <button 
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-5 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-[1.5rem] text-sm font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 relative"
            >
              {submitting ? <FaSync className="animate-spin" /> : <FaCheckCircle size={20} />}
              Save All Records
            </button>
          </div>
        </div>

        {/* LIST SECTION */}
        <div className="mt-16">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-2 h-8 bg-slate-800 rounded-full"></div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Receipt History</h2>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
               <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-2 w-full sm:w-auto">
                  <input 
                    type="date" 
                    value={filterFromDate}
                    onChange={(e) => setFilterFromDate(e.target.value)}
                    className="text-[10px] font-black text-slate-600 outline-none px-2 border-r border-slate-100 bg-transparent"
                  />
                  <input 
                    type="date" 
                    value={filterToDate}
                    onChange={(e) => setFilterToDate(e.target.value)}
                    className="text-[10px] font-black text-slate-600 outline-none px-2 bg-transparent"
                  />
               </div>
               <div className="relative group flex-1 min-w-[200px]">
                  <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    type="text" 
                    placeholder="ID or Person..."
                    value={filterReceiptId}
                    onChange={(e) => setFilterReceiptId(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-emerald-500"
                  />
               </div>
               <button 
                onClick={fetchReceipts}
                className="p-4 bg-slate-800 text-white rounded-2xl hover:bg-slate-900 transition"
               >
                 <FaSync className={loading ? "animate-spin" : ""} />
               </button>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
             {/* Desktop Table (Hidden on mobile) */}
             <div className="hidden lg:block overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-slate-50/50 border-b border-slate-100">
                     <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Receipt ID / Date</th>
                     <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Person</th>
                     <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Collections</th>
                     <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Expenses</th>
                     <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Net Cash</th>
                     <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {loading ? (
                     <tr>
                       <td colSpan="6" className="px-8 py-20 text-center">
                         <div className="flex flex-col items-center gap-3">
                           <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetching History...</span>
                         </div>
                       </td>
                     </tr>
                   ) : receipts.length === 0 ? (
                     <tr>
                       <td colSpan="6" className="px-8 py-20 text-center opacity-30">
                         <FaReceipt size={60} className="mx-auto text-slate-300 mb-4" />
                         <span className="text-sm font-black text-slate-400 uppercase tracking-widest">No matching receipts found</span>
                       </td>
                     </tr>
                   ) : (
                     receipts.map((r) => (
                       <tr key={r._id} className="hover:bg-slate-50/50 transition-colors group">
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-black text-[10px]">
                                 DR
                               </div>
                               <div>
                                 <div className="text-sm font-black text-slate-800">{r.receiptId}</div>
                                 <div className="text-[10px] font-bold text-slate-400">{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                               <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                                 <FaUser size={12} />
                               </div>
                               <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{r.deliveryPerson}</span>
                            </div>
                         </td>
                         <td className="px-8 py-6 text-right">
                            <div className="flex flex-col items-end">
                               <span className="text-xs font-black text-emerald-600">₹{r.totalCollected.toLocaleString()}</span>
                               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{r.collections?.length} Entries</span>
                            </div>
                         </td>
                         <td className="px-8 py-6 text-right">
                            <div className="flex flex-col items-end">
                               <span className="text-xs font-black text-rose-500">₹{r.totalExpense.toLocaleString()}</span>
                               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{r.expenses?.length} Entries</span>
                            </div>
                         </td>
                         <td className="px-8 py-6 text-right">
                            <div className="inline-block px-4 py-2 bg-slate-900 text-white rounded-2xl text-xs font-black shadow-lg shadow-slate-200">
                              ₹{r.netAmount.toLocaleString()}
                            </div>
                         </td>
                         <td className="px-8 py-6 text-center">
                            <button 
                             onClick={() => handleDelete(r._id)}
                             className="w-10 h-10 flex items-center justify-center bg-white border border-slate-100 text-slate-300 hover:text-rose-500 hover:border-rose-100 rounded-xl transition-all shadow-sm"
                            >
                              <FaTrash size={12} />
                            </button>
                         </td>
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
             </div>

             {/* Mobile Card View (Visible on small screens) */}
             <div className="lg:hidden divide-y divide-slate-100">
               {loading ? (
                  <div className="p-12 text-center text-slate-400 font-black uppercase tracking-widest text-[10px]">Loading...</div>
               ) : receipts.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 font-black uppercase tracking-widest text-[10px]">No records found</div>
               ) : (
                 receipts.map((r) => (
                   <div key={r._id} className="p-6 bg-white">
                      <div className="flex items-start justify-between mb-4">
                         <div>
                            <div className="text-sm font-black text-slate-800 tracking-tight">{r.receiptId}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                              {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                         </div>
                         <button 
                           onClick={() => handleDelete(r._id)}
                           className="p-3 bg-rose-50 text-rose-500 rounded-xl"
                         >
                            <FaTrash size={12} />
                         </button>
                      </div>
                      
                      <div className="bg-slate-50 p-4 rounded-2xl mb-4">
                         <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                            <FaUser className="text-slate-400 text-[10px]" />
                            <span className="text-[10px] font-black text-slate-700 uppercase">{r.deliveryPerson}</span>
                         </div>
                         <div className="grid grid-cols-3 gap-2">
                            <div>
                               <div className="text-[8px] font-black text-slate-300 uppercase mb-1">Collected</div>
                               <div className="text-[11px] font-black text-emerald-600">₹{r.totalCollected.toLocaleString()}</div>
                            </div>
                            <div>
                               <div className="text-[8px] font-black text-slate-300 uppercase mb-1">Expenses</div>
                               <div className="text-[11px] font-black text-rose-500">₹{r.totalExpense.toLocaleString()}</div>
                            </div>
                            <div>
                               <div className="text-[8px] font-black text-slate-300 uppercase mb-1">Net Cash</div>
                               <div className="text-[11px] font-black text-slate-800">₹{r.netAmount.toLocaleString()}</div>
                            </div>
                         </div>
                      </div>
                   </div>
                 ))
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchDeliveryReceipt;
