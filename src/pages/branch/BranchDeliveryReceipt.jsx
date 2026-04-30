import React, { useEffect, useState } from "react";
import { 
  FaHistory, FaSearch, FaSync, FaReceipt, FaUser, FaWallet, 
  FaHandHoldingUsd, FaPlus, FaTrash, FaPlusCircle, FaMinusCircle, 
  FaCoins, FaCalculator, FaFileInvoiceDollar, FaCheckCircle, FaCalendarAlt, FaMapMarkerAlt,
  FaChevronDown, FaChevronUp, FaUndo
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
  const [expandedId, setExpandedId] = useState(null);
  const [selectedReceipts, setSelectedReceipts] = useState([]);
  const [showBankModal, setShowBankModal] = useState(false);
  const [targetBank, setTargetBank] = useState("ICICI Bank");
  const [transferring, setTransferring] = useState(false);

  // Batch Form State
  const [entries, setEntries] = useState([
    { id: Date.now(), type: "COLLECTION", customerId: "", name: "", amount: "", paymentMode: "CASH", note: "" }
  ]);
  const [denominations, setDenominations] = useState({
    500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0
  });
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
      const res = await fetchWithAuth(`${API_BASE}/customers?branchId=${currentBranch._id}&limit=10000&mini=true`);
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

  const toggleSelect = (id) => {
    setSelectedReceipts(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBankTransfer = async () => {
    if (selectedReceipts.length === 0) return;
    setTransferring(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/delivery-receipts/bank-transfer`, {
        method: "PATCH",
        body: JSON.stringify({ 
          receiptIds: selectedReceipts, 
          bankName: targetBank 
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Transferred to " + targetBank);
        setShowBankModal(false);
        setSelectedReceipts([]);
        fetchReceipts();
      } else {
        toast.error(data.message || "Failed to transfer");
      }
    } catch (err) {
      toast.error("Error processing transfer");
    } finally {
      setTransferring(false);
    }
  };

  // Dynamic Handlers
  const addEntry = () => {
    setEntries([...entries, { id: Date.now() + Math.random(), type: "COLLECTION", customerId: "", name: "", amount: "", paymentMode: "CASH", note: "" }]);
  };

  const removeEntry = (index) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index, field, value) => {
    const newEntries = [...entries];
    if (field === 'customerId') {
      const cust = customers.find(c => c._id === value);
      newEntries[index].customerId = value;
      newEntries[index].name = cust?.name || "";
    } else {
      newEntries[index][field] = value;
    }
    setEntries(newEntries);
  };

  // Calculations
  const validCollections = entries.filter(e => e.type === "COLLECTION" && e.customerId && Number(e.amount) > 0);
  const validExpenses = entries.filter(e => e.type === "EXPENSE" && Number(e.amount) > 0);

  const totalCollected = validCollections.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalExpense = validExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netAmount = totalCollected - totalExpense;

  const denominationsTotal = Object.entries(denominations).reduce((sum, [val, count]) => sum + (Number(val) * Number(count)), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validCollections.length === 0 && validExpenses.length === 0) {
      toast.error("Please add at least one valid collection or expense");
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
          denominations: {
            d500: Number(denominations[500]),
            d200: Number(denominations[200]),
            d100: Number(denominations[100]),
            d50: Number(denominations[50]),
            d20: Number(denominations[20]),
            d10: Number(denominations[10]),
            d5: Number(denominations[5]),
            d2: Number(denominations[2]),
            d1: Number(denominations[1]),
            total: denominationsTotal
          },
          createdBy: user?.username || "System",
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Receipt ${data.data.receiptId} saved!`);
        setEntries([{ id: Date.now(), type: "COLLECTION", customerId: "", name: "", amount: "", paymentMode: "CASH", note: "" }]);
        setDenominations({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
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

  const handleRevert = async (id) => {
    if (!window.confirm("Are you sure you want to revert this bank transfer? It will become available for transfer again.")) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/delivery-receipts/revert-transfer/${id}`, {
        method: "PATCH"
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Transfer reverted");
        fetchReceipts(); // Refresh the list
      } else {
        toast.error(data.message || "Failed to revert transfer");
      }
    } catch (err) {
      toast.error("Error reverting transfer");
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
          {/* NOTEBOOK UI */}
          <div className="w-full overflow-x-auto pb-8 relative z-20 scrollbar-hide">
            <div className="min-w-[350px] w-full bg-[#fdfbf7] rounded-lg shadow-2xl relative border border-[#e5e5e5] min-h-[400px]">
              {/* NOTEBOOK BINDING HOLES */}
              <div className="absolute top-0 bottom-0 left-2 sm:left-3 w-4 flex flex-col justify-start pt-12 space-y-6 sm:space-y-8 z-30">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-[#cbd5e1] shadow-inner opacity-60"></div>
                ))}
              </div>

              {/* LINES */}
              <div 
                className="absolute inset-0 pointer-events-none z-0" 
                style={{ 
                  backgroundImage: 'repeating-linear-gradient(transparent, transparent 47px, #94a3b840 47px, #94a3b840 48px)', 
                  backgroundPositionY: '50px' 
                }}
              ></div>
              
              {/* RED MARGINS */}
              <div className="absolute top-0 bottom-0 left-10 sm:left-16 w-px bg-rose-400/60 pointer-events-none z-10 shadow-[1px_0_0_rgba(251,113,133,0.3)]"></div>
              
              {/* HEADER */}
              <div className="h-[50px] border-b-2 border-rose-500/30 flex items-center pl-12 sm:pl-20 pr-2 sm:pr-8 relative z-20 bg-white/50 backdrop-blur-[2px]">
                <div className="w-[22%] sm:w-[15%] text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</div>
                <div className="flex-1 text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 sm:px-4 border-l border-transparent">Particulars</div>
                <div className="hidden md:block w-[15%] text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Mode</div>
                <div className="w-[25%] sm:w-[20%] text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Amount (₹)</div>
                <div className="w-[10%] sm:w-[5%]"></div>
              </div>
              {/* ENTRIES */}
              <div className="relative z-20 py-0 flex flex-col min-h-[400px] pb-40">
                {entries.map((entry, index) => (
                  <div key={entry.id} className="flex pl-12 sm:pl-20 pr-2 sm:pr-8 items-center hover:bg-yellow-50/30 transition-colors group" style={{ height: '48px' }}>
                     <div className="w-[22%] sm:w-[15%] pr-2 sm:pr-4 h-full flex items-center relative group/type">
                        <select 
                          value={entry.type} 
                          onChange={(e) => updateEntry(index, 'type', e.target.value)} 
                          className={`w-full bg-transparent outline-none font-black text-[9px] sm:text-xs h-full cursor-pointer appearance-none pr-3 sm:pr-4 z-10 ${entry.type === 'EXPENSE' ? 'text-rose-600' : 'text-slate-600'}`}
                        >
                           <option value="COLLECTION" className="text-slate-800">Coll.</option>
                           <option value="EXPENSE" className="text-rose-600 font-bold">Exp.</option>
                        </select>
                        <FaChevronDown size={7} className={`absolute right-1 sm:right-4 pointer-events-none transition-colors ${entry.type === 'EXPENSE' ? 'text-rose-400' : 'text-slate-300'}`} />
                     </div>
                     <div className="flex-1 px-2 sm:px-4 h-full flex items-center border-l border-slate-200/50 group-hover:border-slate-300 transition-colors relative">
                        {entry.type === 'COLLECTION' ? (
                          <div className="w-full h-full flex items-center absolute inset-x-2 sm:inset-x-4">
                             <FilterableSelect
                                options={customers}
                                value={entry.customerId}
                                onChange={(val) => updateEntry(index, 'customerId', val)}
                                placeholder="Select..."
                                className="!border-none !bg-transparent !px-0 !py-0 !rounded-none !h-full w-full !shadow-none text-[10px] sm:text-xs"
                             />
                          </div>
                        ) : (
                          <input 
                            type="text" 
                            placeholder="Reason..." 
                            value={entry.note} 
                            onChange={(e) => updateEntry(index, 'note', e.target.value)} 
                            className="w-full bg-transparent outline-none font-bold text-[10px] sm:text-xs text-rose-600 h-full placeholder:text-slate-300 placeholder:italic focus:border-b focus:border-rose-300" 
                          />
                        )}
                     </div>
                     <div className="hidden md:flex w-[15%] px-4 h-full items-center border-l border-slate-200/50 group-hover:border-slate-300 transition-colors">
                        {entry.type === 'COLLECTION' ? (
                          <select 
                            value={entry.paymentMode} 
                            onChange={(e) => updateEntry(index, 'paymentMode', e.target.value)} 
                            className="w-full bg-transparent outline-none font-bold text-xs text-slate-600 h-full text-center cursor-pointer appearance-none"
                          >
                             <option value="CASH">CASH</option>
                             <option value="UPI">UPI</option>
                          </select>
                        ) : (
                          <div className="w-full text-center text-slate-300 text-[10px] font-black italic">-</div>
                        )}
                     </div>
                     <div className="w-[25%] sm:w-[20%] pl-2 sm:pl-4 h-full flex items-center justify-end border-l border-slate-200/50 group-hover:border-slate-300 transition-colors">
                        <input 
                          type="number" 
                          placeholder="0" 
                          value={entry.amount} 
                          onChange={(e) => updateEntry(index, 'amount', e.target.value)} 
                          className={`w-full bg-transparent outline-none font-black text-xs sm:text-sm text-right h-full placeholder:text-slate-300 ${entry.type === 'COLLECTION' ? 'text-emerald-600' : 'text-rose-600'}`} 
                        />
                     </div>
                     <div className="w-[10%] sm:w-[5%] flex items-center justify-end h-full pl-1 sm:pl-2 border-l border-slate-200/50 group-hover:border-slate-300 transition-colors">
                        <button 
                          onClick={() => removeEntry(index)} 
                          disabled={entries.length === 1} 
                          className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full text-slate-300 hover:bg-rose-100 hover:text-rose-500 disabled:opacity-0 transition-all"
                        >
                           <FaMinusCircle size={12} />
                        </button>
                     </div>
                  </div>
                ))}
              </div>

              {/* ADD ROW BUTTON */}
              <div className="pl-12 sm:pl-20 pr-3 sm:pr-8 h-[56px] flex items-center relative z-20 group">
                <button 
                  onClick={addEntry} 
                  className="flex items-center gap-3 px-6 py-2 bg-emerald-50 hover:bg-emerald-100/80 text-[10px] sm:text-xs font-black text-emerald-600 border border-emerald-100 rounded-full transition-all duration-300 uppercase tracking-[0.2em] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner"
                >
                  <FaPlusCircle className="text-emerald-500" /> 
                  <span>Add New Row</span>
                  <div className="ml-2 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                </button>
              </div>

              {/* DENOMINATIONS SECTION */}
              <div className="mt-8 pl-12 sm:pl-20 pr-2 sm:pr-8 py-6 relative z-20 border-t border-slate-200 bg-slate-50/30">
                <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <FaCoins className="text-amber-500" /> Cash Breakdown
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2 sm:gap-3">
                   {[500, 200, 100, 50, 20, 10, 5, 2, 1].map((val) => (
                     <div key={val} className="flex flex-col bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm group hover:border-amber-200 transition-colors">
                        <span className="text-[9px] font-black text-slate-400 uppercase mb-1">₹{val} Notes</span>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] text-slate-300 font-bold italic">x</span>
                           <input 
                             type="number"
                             min="0"
                             value={denominations[val] === 0 ? "" : denominations[val]}
                             onChange={(e) => {
                               const newVal = e.target.value === "" ? 0 : Number(e.target.value);
                               const currentTotalWithoutThis = Object.entries(denominations)
                                 .reduce((sum, [k, v]) => Number(k) === val ? sum : sum + (Number(k) * Number(v)), 0);
                               
                               if (currentTotalWithoutThis + (newVal * val) > netAmount) {
                                 toast.warning(`Total cannot exceed Net Cash (₹${netAmount.toLocaleString()})`);
                                 return;
                               }
                               setDenominations({...denominations, [val]: e.target.value});
                             }}
                             className="w-full bg-transparent outline-none font-black text-[11px] text-slate-700"
                             placeholder="0"
                           />
                        </div>
                        <div className="mt-1.5 pt-1 border-t border-slate-50 text-[9px] font-black text-amber-600 text-right">
                           ₹{(Number(denominations[val] || 0) * val).toLocaleString()}
                        </div>
                     </div>
                   ))}
                </div>
                
                {/* MATCHING STATUS */}
                <div className="mt-4 flex items-center justify-between bg-white/50 p-3 rounded-2xl border border-slate-100 border-dashed">
                   <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${Math.abs(denominationsTotal - netAmount) < 1 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">
                        {Math.abs(denominationsTotal - netAmount) < 1 ? 'Cash Matches Net Amount' : `Mismatch: ₹${Math.abs(denominationsTotal - netAmount).toLocaleString()}`}
                      </span>
                   </div>
                   <div className="text-xs font-black text-slate-800">
                     Denom Total: <span className="text-amber-600">₹{denominationsTotal.toLocaleString()}</span>
                   </div>
                </div>
              </div>

              {/* TOTALS FOOTER */}
              <div className="mt-8 sm:mt-12 pl-12 sm:pl-20 pr-3 sm:pr-8 py-6 relative z-20 border-t border-slate-800 bg-white/40 backdrop-blur-sm rounded-b-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 sm:gap-0">
                  <div className="flex gap-4 sm:gap-8">
                     <div>
                       <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Collected</div>
                       <div className="text-base sm:text-xl font-black text-emerald-600">₹{totalCollected.toLocaleString()}</div>
                     </div>
                     <div>
                       <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Expenses</div>
                       <div className="text-base sm:text-xl font-black text-rose-500">₹{totalExpense.toLocaleString()}</div>
                     </div>
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                     <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Cash in Hand</div>
                     <div className="text-2xl sm:text-3xl font-black text-slate-800 border-b-[2px] sm:border-b-[3px] border-double border-slate-800 pb-1 inline-block">
                       ₹{netAmount.toLocaleString()}
                     </div>
                  </div>
                </div>

                <div className="mt-6 sm:mt-8 flex justify-end">
                  <button 
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full sm:w-auto px-8 py-3 sm:py-4 bg-slate-900 rounded-xl text-white text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {submitting ? <FaSync className="animate-spin" /> : <FaCheckCircle size={14} />}
                    Submit Receipt
                  </button>
                </div>
              </div>
            </div>
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
                {(user?.role?.toUpperCase() === "ADMIN" || user?.role?.toUpperCase() === "SUPER_ADMIN" || user?.role?.toUpperCase() === "SUPERADMIN") && (
                   <button 
                    onClick={() => setShowBankModal(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all animate-in fade-in zoom-in duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     <FaFileInvoiceDollar size={14} /> Transfer to Bank {selectedReceipts.length > 0 ? `(${selectedReceipts.length})` : ""}
                   </button>
                )}
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
                      <th className="px-6 py-6 text-center w-12">
                         <input 
                           type="checkbox" 
                           className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                           checked={receipts.length > 0 && selectedReceipts.length === receipts.filter(r => !r.isBankTransferred).length}
                           onChange={(e) => {
                             if (e.target.checked) {
                               setSelectedReceipts(receipts.filter(r => !r.isBankTransferred).map(r => r._id));
                             } else {
                               setSelectedReceipts([]);
                             }
                           }}
                         />
                      </th>
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
                       <td colSpan="7" className="px-8 py-20 text-center">
                         <div className="flex flex-col items-center gap-3">
                           <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetching History...</span>
                         </div>
                       </td>
                     </tr>
                   ) : receipts.length === 0 ? (
                     <tr>
                       <td colSpan="7" className="px-8 py-20 text-center opacity-30">
                         <FaReceipt size={60} className="mx-auto text-slate-300 mb-4" />
                         <span className="text-sm font-black text-slate-400 uppercase tracking-widest">No matching receipts found</span>
                       </td>
                     </tr>
                   ) : (
                     receipts.map((r) => (
                       <React.Fragment key={r._id}>
                         <tr className={`hover:bg-slate-50/50 transition-colors group ${r.isBankTransferred ? 'opacity-50' : ''}`}>
                           <td className="px-6 py-6 text-center">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-30"
                                checked={selectedReceipts.includes(r._id)}
                                onChange={() => toggleSelect(r._id)}
                                disabled={r.isBankTransferred}
                              />
                           </td>
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
                            <div className="flex items-center justify-center gap-2">
                              {r.isBankTransferred && (
                                <button 
                                 onClick={() => handleRevert(r._id)}
                                 className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-500 border border-indigo-100 hover:bg-indigo-100 rounded-xl transition-all shadow-sm"
                                 title="Revert Transfer"
                                >
                                  <FaUndo size={12} />
                                </button>
                              )}
                              <button 
                               onClick={() => setExpandedId(expandedId === r._id ? null : r._id)}
                               className="w-10 h-10 flex items-center justify-center bg-white border border-slate-100 text-slate-400 hover:text-emerald-500 hover:border-emerald-100 rounded-xl transition-all shadow-sm"
                              >
                                {expandedId === r._id ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                              </button>
                              <button 
                               onClick={() => handleDelete(r._id)}
                               className="w-10 h-10 flex items-center justify-center bg-white border border-slate-100 text-slate-300 hover:text-rose-500 hover:border-rose-100 rounded-xl transition-all shadow-sm"
                              >
                                <FaTrash size={12} />
                              </button>
                            </div>
                         </td>
                       </tr>
                       {expandedId === r._id && (
                         <tr className="bg-slate-50/50">
                           <td colSpan="7" className="p-0">
                             <div className="p-6 md:px-12 border-b border-slate-100">
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                 <div>
                                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                     <FaWallet className="text-emerald-500" /> Collections
                                   </h4>
                                   {r.collections?.length > 0 ? (
                                     <div className="space-y-2">
                                       {r.collections.map((c, i) => (
                                         <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                           <div className="flex flex-col">
                                             <span className="text-xs font-black text-slate-700">{c.customer?.name || "Unknown"}</span>
                                             <span className="text-[9px] font-bold text-slate-400 uppercase">{c.paymentMode}</span>
                                           </div>
                                           <span className="text-xs font-black text-emerald-600">₹{c.amount?.toLocaleString()}</span>
                                         </div>
                                       ))}
                                     </div>
                                   ) : (
                                     <div className="text-xs font-bold text-slate-400 italic">No collections</div>
                                   )}
                                 </div>
                                 <div>
                                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                     <FaHandHoldingUsd className="text-rose-500" /> Expenses
                                   </h4>
                                   {r.expenses?.length > 0 ? (
                                     <div className="space-y-2">
                                       {r.expenses.map((e, i) => (
                                         <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                           <span className="text-xs font-bold text-slate-600">{e.note || "No note"}</span>
                                           <span className="text-xs font-black text-rose-500">₹{e.amount?.toLocaleString()}</span>
                                         </div>
                                       ))}
                                     </div>
                                   ) : (
                                     <div className="text-xs font-bold text-slate-400 italic">No expenses</div>
                                   )}
                                 </div>
                               </div>
                                {r.denominations && (
                                  <div className="mt-8 pt-6 border-t border-slate-100">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                      <FaCoins className="text-amber-500" /> Cash Breakdown
                                    </h4>
                                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-3">
                                      {[500, 200, 100, 50, 20, 10, 5, 2, 1].map(val => (
                                        <div key={val} className="bg-white p-3 rounded-2xl border border-slate-100 flex flex-col items-center shadow-sm">
                                          <span className="text-[8px] font-black text-slate-300 uppercase mb-1">₹{val}</span>
                                          <span className="text-[11px] font-black text-slate-700">x {r.denominations[`d${val}`] || 0}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                             </div>
                           </td>
                         </tr>
                       )}
                     </React.Fragment>
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
                         <div className="flex items-center gap-3">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                              checked={selectedReceipts.includes(r._id)}
                              onChange={() => toggleSelect(r._id)}
                              disabled={r.isBankTransferred}
                            />
                            <div>
                               <div className="text-sm font-black text-slate-800 tracking-tight">{r.receiptId}</div>
                               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                 {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                               </div>
                            </div>
                         </div>
                         <div className="flex items-center gap-2">
                           {r.isBankTransferred && (
                             <button 
                               onClick={() => handleRevert(r._id)}
                               className="p-3 bg-indigo-50 text-indigo-500 rounded-xl"
                             >
                               <FaUndo size={12} />
                             </button>
                           )}
                           <button 
                             onClick={() => setExpandedId(expandedId === r._id ? null : r._id)}
                             className="p-3 bg-slate-50 text-slate-500 rounded-xl"
                           >
                             {expandedId === r._id ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                           </button>
                           <button 
                             onClick={() => handleDelete(r._id)}
                             className="p-3 bg-rose-50 text-rose-500 rounded-xl"
                           >
                               <FaTrash size={12} />
                           </button>
                         </div>
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

                      {/* Expandable Details */}
                      {expandedId === r._id && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                          <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <FaWallet className="text-emerald-500" /> Collections
                            </h4>
                            {r.collections?.length > 0 ? (
                              <div className="space-y-2">
                                {r.collections.map((c, i) => (
                                  <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-black text-slate-700">{c.customer?.name || "Unknown"}</span>
                                      <span className="text-[9px] font-bold text-slate-400 uppercase">{c.paymentMode}</span>
                                    </div>
                                    <span className="text-xs font-black text-emerald-600">₹{c.amount?.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs font-bold text-slate-400 italic">No collections</div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <FaHandHoldingUsd className="text-rose-500" /> Expenses
                            </h4>
                            {r.expenses?.length > 0 ? (
                              <div className="space-y-2">
                                {r.expenses.map((e, i) => (
                                  <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <span className="text-xs font-bold text-slate-600">{e.note || "No note"}</span>
                                    <span className="text-xs font-black text-rose-500">₹{e.amount?.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs font-bold text-slate-400 italic">No expenses</div>
                            )}
                          </div>
                          {r.denominations && (
                            <div className="pt-4 border-t border-slate-100">
                               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                 <FaCoins className="text-amber-500" /> Cash Breakdown
                               </h4>
                               <div className="grid grid-cols-3 gap-2">
                                  {[500, 200, 100, 50, 20, 10, 5, 2, 1].map(val => (
                                     <div key={val} className="bg-white p-2 rounded-xl border border-slate-100 flex flex-col items-center">
                                        <span className="text-[8px] font-black text-slate-300 uppercase">₹{val}</span>
                                        <span className="text-[10px] font-black text-slate-700">x {r.denominations[`d${val}`] || 0}</span>
                                     </div>
                                  ))}
                               </div>
                            </div>
                          )}
                        </div>
                      )}
                   </div>
                 ))
               )}
             </div>
          </div>
        </div>
      </div>

      {/* BANK SELECTION MODAL */}
      {showBankModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !transferring && setShowBankModal(false)}></div>
            <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 relative z-10 shadow-2xl animate-in zoom-in fade-in duration-300">
              <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                    <FaFileInvoiceDollar size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Bank Transfer</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Select Destination Bank</p>
                  </div>
              </div>

              <div className="space-y-4 mb-8">
                  <label className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer ${targetBank === 'ICICI Bank' ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${targetBank === 'ICICI Bank' ? 'border-indigo-500' : 'border-slate-300'}`}>
                          {targetBank === 'ICICI Bank' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>}
                        </div>
                        <span className="text-sm font-black text-slate-700">ICICI Bank</span>
                    </div>
                    <input type="radio" name="bank" className="hidden" checked={targetBank === 'ICICI Bank'} onChange={() => setTargetBank('ICICI Bank')} />
                  </label>

                  <label className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer ${targetBank === 'State Bank' ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${targetBank === 'State Bank' ? 'border-indigo-500' : 'border-slate-300'}`}>
                          {targetBank === 'State Bank' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>}
                        </div>
                        <span className="text-sm font-black text-slate-700">State Bank</span>
                    </div>
                    <input type="radio" name="bank" className="hidden" checked={targetBank === 'State Bank'} onChange={() => setTargetBank('State Bank')} />
                  </label>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowBankModal(false)}
                  disabled={transferring}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBankTransfer}
                  disabled={transferring}
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {transferring ? <FaSync className="animate-spin" /> : <FaCheckCircle />}
                  Confirm Transfer
                </button>
              </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default BranchDeliveryReceipt;
