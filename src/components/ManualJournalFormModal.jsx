import React, { useState, useEffect } from "react";
import { FaPlus, FaTimes, FaUser, FaStore, FaWallet, FaCheck, FaBook, FaSearch } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../api";

const ManualJournalFormModal = ({ isOpen, onClose, onRefresh, currentBranch }) => {
  const [formData, setFormData] = useState({
    by: { partyType: "DEBTOR", partyId: "", partyName: "", partyGroup: "Sundry Debtors" },
    to: { partyType: "VENDOR", partyId: "", partyName: "", partyGroup: "Sundry Creditors" },
    amount: "",
    paymentMode: "CASH",
    narration: "",
    entryType: "DEBIT"
  });

  const [vendors, setVendors] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [showInstantLedger, setShowInstantLedger] = useState(false);
  const [instantLedgerName, setInstantLedgerName] = useState("");
  const [instantLedgerGroup, setInstantLedgerGroup] = useState("Indirect Expenses");
  const [instantLedgerSide, setInstantLedgerSide] = useState("by"); // "by" or "to"

  const [partyLoading, setPartyLoading] = useState(false);
  const [lastFetchedBranch, setLastFetchedBranch] = useState(null);

  const fetchParties = async () => {
    if (!currentBranch?._id) return;
    setPartyLoading(true);
    try {
      const branchId = currentBranch._id;
      const [vRes, dRes, lRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/vendors?branchId=${branchId}`),
        fetchWithAuth(`${API_BASE}/customers?branchId=${branchId}&mini=true`),
        fetchWithAuth(`${API_BASE}/tally-journals?branchId=${branchId}`)
      ]);
      
      const vData = await vRes.json();
      const dData = await dRes.json();
      const lData = await lRes.json();
      
      const vFinal = vData.success ? vData.data : (Array.isArray(vData) ? vData : []);
      const dFinal = dData.success ? dData.data : (Array.isArray(dData) ? dData : []);
      const lFinal = lData.success ? lData.data : (Array.isArray(lData) ? lData : []);
      
      // Standardize groups
      const vGroup = "Sundry Creditors";
      const dGroup = "Sundry Debtors";

      setVendors(vFinal.map(v => ({ ...v, group: vGroup })));
      setDebtors(dFinal.map(d => ({ ...d, group: dGroup })));
      setLedgers(lFinal);
      setLastFetchedBranch(branchId);
    } catch (err) {
      console.error("Fetch parties error:", err);
      toast.error("Failed to load parties.");
    } finally {
      setPartyLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentBranch?._id && lastFetchedBranch !== currentBranch._id) {
      fetchParties();
    }
  }, [isOpen, currentBranch?._id]);

  const handleInstantLedgerSave = async () => {
    if (!instantLedgerName) return toast.error("Name is required");
    if (!/^[A-Z]/.test(instantLedgerName)) return toast.error("Name must start with a Capital letter");

    try {
      const res = await fetchWithAuth(`${API_BASE}/manual-journals/instant-ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: instantLedgerName, 
          group: instantLedgerGroup,
          branchId: currentBranch._id 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      
      toast.success(`Ledger "${data.journalName}" created under ${instantLedgerGroup}`);
      
      setLedgers(prev => [...prev, { ...data, name: data.journalName, group: instantLedgerGroup }]);
      
      const side = instantLedgerSide;
      setFormData(prev => ({
        ...prev,
        [side]: { partyType: "LEDGER", partyId: data._id, partyName: data.journalName, partyGroup: instantLedgerGroup }
      }));
      setSearchTerms(prev => ({ ...prev, [side]: data.journalName }));
      
      setShowInstantLedger(false);
      setInstantLedgerName("");
      setInstantLedgerGroup("Indirect Expenses");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const [searchTerms, setSearchTerms] = useState({ by: "", to: "" });
  const [activeDropdown, setActiveDropdown] = useState(null); // 'by', 'to', or null
  const dropdownRef = React.useRef(null);
  const groupRef = React.useRef(null);
  const byRef = React.useRef(null);
  const toRef = React.useRef(null);

  const [primaryCategory, setPrimaryCategory] = useState("Indirect Expenses");
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close group dropdown if clicking outside its area
      if (groupRef.current && !groupRef.current.contains(event.target)) {
        setGroupDropdownOpen(false);
      }
      // Close party dropdowns if clicking outside their areas
      if (byRef.current && !byRef.current.contains(event.target)) {
        if (activeDropdown === 'by') setActiveDropdown(null);
      }
      if (toRef.current && !toRef.current.contains(event.target)) {
        if (activeDropdown === 'to') setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeDropdown, groupDropdownOpen]);

  const resetForm = () => {
    setFormData({
      by: { partyType: "DEBTOR", partyId: "", partyName: "", partyGroup: "Sundry Debtors" },
      to: { partyType: "VENDOR", partyId: "", partyName: "", partyGroup: "Sundry Creditors" },
      amount: "",
      paymentMode: "CASH",
      narration: "",
      entryType: "DEBIT"
    });
    setSearchTerms({ by: "", to: "" });
    setActiveDropdown(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.by.partyId || !formData.to.partyId) return toast.error("Select both By and To parties");
    if (!formData.amount || formData.amount <= 0) return toast.error("Enter a valid amount");

    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/manual-journals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, branchId: currentBranch._id, primaryCategory })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success("Journal Entry Created Successfully!");
      resetForm();
      onRefresh();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const ACCOUNT_GROUPS = [
    "Indirect Expenses", "Direct Expenses", "Indirect Income", "Direct Income",
    "Fixed Assets", "Current Assets", "Current Liabilities", "Sundry Debtors", 
    "Sundry Creditors", "Capital Account", "Loans (Liability)"
  ];

  if (!isOpen) return null;

  const filteredGroups = ACCOUNT_GROUPS.filter(g => 
    g.toLowerCase().includes(groupSearchTerm.toLowerCase())
  );

  const renderPartySelector = (side) => {
    const data = formData[side];
    const searchTerm = searchTerms[side];
    const isOpen = activeDropdown === side;
    const currentRef = side === 'by' ? byRef : toRef;
    
    // Combine and remove duplicates based on _id
    const rawParties = [
      ...vendors.map(v => ({ ...v, type: 'VENDOR', group: 'Sundry Creditors' })),
      ...debtors.map(d => ({ ...d, type: 'DEBTOR', group: 'Sundry Debtors' })),
      ...ledgers.map(l => ({ ...l, type: 'LEDGER' }))
    ];

    const uniquePartiesMap = new Map();
    rawParties.forEach(p => {
      if (!uniquePartiesMap.has(p._id)) {
        uniquePartiesMap.set(p._id, p);
      }
    });
    const allParties = Array.from(uniquePartiesMap.values());

    const filteredParties = allParties.filter(p => 
      (p.journalName || p.name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div ref={currentRef} className="space-y-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col relative">
        <div className="flex justify-between items-center px-1">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
            {side === 'by' ? 'Debit (BY)' : 'Credit (TO)'}
          </label>
          {data.partyName && (
            <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase max-w-[150px] truncate">
              {data.partyName}
            </span>
          )}
        </div>
        
        <div className="relative group">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search any account..."
                className="w-full bg-slate-50 border border-transparent rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition pr-10"
                value={searchTerm}
                onFocus={() => { 
                  setActiveDropdown(side); 
                  setGroupDropdownOpen(false);
                  setSearchTerms(prev => ({ ...prev, [side]: "" })); // Clear on focus
                }}
                onChange={(e) => {
                  setSearchTerms({ ...searchTerms, [side]: e.target.value });
                  setActiveDropdown(side);
                }}
              />
              {data.partyId && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                  <FaCheck size={10} />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setInstantLedgerSide(side); setShowInstantLedger(true); }}
              className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shrink-0"
            >
              <FaPlus size={12} />
            </button>
          </div>

          {/* GLOBAL DROPDOWN LIST */}
          {isOpen && (
            <div className="absolute left-0 right-0 z-50 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden max-h-[220px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
              <div className="bg-slate-50/50 px-4 py-2 border-b border-slate-100">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Select Account</span>
              </div>
              {partyLoading ? (
                <div className="p-4 text-center">
                  <div className="w-4 h-4 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-[9px] font-black text-slate-300 uppercase">Searching...</p>
                </div>
              ) : filteredParties.length === 0 ? (
                <div className="p-6 text-center opacity-40">
                  <p className="text-[9px] font-black uppercase italic">No accounts found</p>
                </div>
              ) : (
                filteredParties.map(p => {
                  const isSelected = data.partyId === p._id;
                  const name = p.journalName || p.name;
                  const group = p.group || 'General Ledger';
                  return (
                    <button
                      key={`${p.type}-${p._id}`}
                      type="button"
                      onClick={() => {
                        setFormData({ 
                          ...formData, 
                          [side]: { 
                            partyType: p.type, 
                            partyId: p._id, 
                            partyName: name, 
                            partyGroup: group 
                          } 
                        });
                        setSearchTerms({ ...searchTerms, [side]: name });
                        setActiveDropdown(null);
                      }}
                      className={`w-full text-left px-5 py-3 text-[11px] font-bold border-b border-slate-50 last:border-0 transition-all flex items-center justify-between ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${p.type === 'VENDOR' ? 'bg-red-50 text-red-500' : p.type === 'DEBTOR' ? 'bg-emerald-50 text-emerald-500' : 'bg-indigo-50 text-indigo-500'}`}>
                            {p.type}
                          </span>
                          <span className="text-[8px] opacity-40 uppercase tracking-tighter">{group}</span>
                        </div>
                      </div>
                      {isSelected && <FaCheck className="text-indigo-600" size={8} />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        ref={dropdownRef}
        className="bg-slate-50 w-full max-w-2xl rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
      >
        <div className="bg-white px-5 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <FaBook className="text-white text-sm" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Journal Operation</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Manual Accounting Post</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><FaTimes size={12} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-5 overflow-y-auto max-h-[85vh]">
          {/* PRIMARY PARENT LEDGER - SEARCHABLE DROPDOWN */}
          <div ref={groupRef} className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm relative">
            <div className="flex items-center justify-between mb-2 px-1">
              <label className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Select Parent Ledger</label>
              {primaryCategory && (
                <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase">
                  Selected: {primaryCategory}
                </span>
              )}
            </div>
            
            <div className="relative">
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Type to search accounting groups..."
                  className="w-full bg-slate-50 border border-transparent rounded-xl px-4 py-3.5 text-xs font-black uppercase text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition shadow-sm pr-10"
                  value={groupSearchTerm}
                  onFocus={() => { 
                    setGroupDropdownOpen(true); 
                    setActiveDropdown(null); 
                    setGroupSearchTerm(""); // Clear on focus
                  }}
                  onChange={(e) => {
                    setGroupSearchTerm(e.target.value);
                    setGroupDropdownOpen(true);
                  }}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                  <FaSearch size={12} />
                </div>
              </div>

              {groupDropdownOpen && (
                <div className="absolute left-0 right-0 z-50 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden max-h-[250px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                  <div className="bg-slate-50/50 px-4 py-2 border-b border-slate-100">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Available Parent Ledgers</span>
                  </div>
                  {filteredGroups.length === 0 ? (
                    <div className="p-6 text-center opacity-40">
                      <p className="text-[9px] font-black uppercase italic text-slate-400">No matching group</p>
                    </div>
                  ) : (
                    filteredGroups.map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setPrimaryCategory(g);
                          setGroupSearchTerm(g);
                          setGroupDropdownOpen(false);
                          // DO NOT clear the by/to fields here
                        }}
                        className={`w-full text-left px-5 py-3.5 text-[10px] font-black uppercase border-b border-slate-50 last:border-0 transition-all flex items-center justify-between ${primaryCategory === g ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span>{g}</span>
                        {primaryCategory === g && <FaCheck className="text-indigo-600" size={10} />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-2 px-1">Selected: <span className="text-indigo-600">{primaryCategory || 'None'}</span></p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {renderPartySelector("by")}
            {renderPartySelector("to")}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1 text-right block">Amount (₹)</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.00"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-xl font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-inner text-right"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-sm">₹</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Payment Mode</label>
              <select
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-4 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer appearance-none"
                value={formData.paymentMode}
                onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
              >
                <option value="CASH">CASH</option>
                <option value="UPI">UPI / G-PAY</option>
                <option value="BANK_TRANSFER">BANK TRANSFER</option>
                <option value="CHEQUE">CHEQUE</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Narration / Remark</label>
            <textarea
              placeholder="Explain the reason for this entry..."
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 transition h-20 resize-none shadow-sm"
              value={formData.narration}
              onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
            />
          </div>

          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-400 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Saving...
                </div>
              ) : <><FaCheck size={12} /> Post Journal Entry</>}
            </button>
          </div>
        </form>
      </div>

      {/* INSTANT LEDGER MODAL */}
      {showInstantLedger && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-indigo-900/40 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[2rem] shadow-2xl w-96 space-y-4 border-2 border-indigo-500 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                <FaPlus />
              </div>
              <h3 className="font-black text-indigo-900 uppercase text-[10px] tracking-widest">Create New Ledger</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1 px-1">Ledger Name</label>
                <input
                  type="text"
                  placeholder="e.g. DISCOUNT ALLOWED"
                  className="w-full border-b-2 border-indigo-100 py-3 outline-none focus:border-indigo-600 text-sm font-bold uppercase placeholder:text-gray-300"
                  value={instantLedgerName}
                  onChange={(e) => setInstantLedgerName(e.target.value.toUpperCase())}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1 px-1">Account Group (Parent)</label>
                <select
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
                  value={instantLedgerGroup}
                  onChange={(e) => setInstantLedgerGroup(e.target.value)}
                >
                  <option value="Indirect Expenses">Indirect Expenses</option>
                  <option value="Direct Expenses">Direct Expenses</option>
                  <option value="Indirect Income">Indirect Income</option>
                  <option value="Direct Income">Direct Income</option>
                  <option value="Fixed Assets">Fixed Assets</option>
                  <option value="Current Assets">Current Assets</option>
                  <option value="Current Liabilities">Current Liabilities</option>
                  <option value="Loans (Liability)">Loans (Liability)</option>
                  <option value="Capital Account">Capital Account</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <button onClick={() => setShowInstantLedger(false)} className="flex-1 text-[10px] font-black text-gray-400 uppercase tracking-widest">Back</button>
              <button onClick={handleInstantLedgerSave} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200">Create Ledger</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualJournalFormModal;
