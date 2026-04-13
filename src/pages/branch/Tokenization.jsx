import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  FaPlus, FaTicketAlt, FaUser, FaUserFriends, FaUserPlus, 
  FaCheckCircle, FaHistory, FaTimes, FaBox, FaUserCircle, 
  FaSpinner, FaShoppingBag, FaChevronDown, FaChevronUp, FaClock, FaSearch
} from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";

const Tokenization = () => {
  const { currentBranch, user } = useBranch();
  const { customers, products } = useInventory();
  const [tokens, setTokens] = useState([]);
  const [branchUsers, setBranchUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // MODAL FORM STATE
  const [createdPerson, setCreatedPerson] = useState({ id: user?.id || "", name: user?.fullName || user?.username || "" });
  const [assignedPerson, setAssignedPerson] = useState({ id: "", name: "" });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // PAGE FILTERS
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  
  const [tokenItems, setTokenItems] = useState([]);
  const [itemSearch, setItemSearch] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const customerDropdownRef = useRef(null);
  const productDropdownRef = useRef(null);

  useEffect(() => {
    fetchTokens();
    fetchBranchUsers();
  }, [currentBranch]);

  const fetchTokens = async () => {
    if (!currentBranch?._id) return;
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${API_BASE}/tokens/branch/${currentBranch._id}?status=ALL`);
      const data = await res.json();
      if (data.success) {
        setTokens(data.data);
      }
    } catch (err) {
      toast.error("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  };

  const fetchBranchUsers = async () => {
    if (!currentBranch?._id) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/branch-users/branch/${currentBranch._id}`);
      const data = await res.json();
      if (data.success) {
        setBranchUsers(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch branch users:", err);
    }
  };

  const handleCreateToken = async () => {
    if (!assignedPerson.id || !selectedCustomer || tokenItems.length === 0) {
      toast.warning("Please fill assigned person, customer and add at least one item");
      return;
    }

    try {
      const payload = {
        branchId: currentBranch._id,
        createdBy: createdPerson,
        assignedTo: assignedPerson,
        customer: { id: selectedCustomer._id, name: selectedCustomer.name },
        items: tokenItems
      };

      const res = await fetchWithAuth(`${API_BASE}/tokens`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`Token ${data.data.tokenId} created successfully!`);
        setShowCreateModal(false);
        resetForm();
        fetchTokens();
      } else {
        toast.error(data.message || "Failed to create token");
      }
    } catch (err) {
      toast.error("Something went wrong");
    }
  };

  const resetForm = () => {
    setCreatedPerson({ id: user?.id || "", name: user?.fullName || user?.username || "" });
    setAssignedPerson({ id: "", name: "" });
    setSelectedCustomer(null);
    setCustomerSearch("");
    setTokenItems([]);
    setItemSearch("");
    setItemQty(1);
    setSelectedProduct(null);
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

  // --- FORM HELPERS ---
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    return customers.filter(c => 
      c.name.toLowerCase().includes(customerSearch.toLowerCase())
    ).slice(0, 5);
  }, [customers, customerSearch]);

  const filteredProducts = useMemo(() => {
    if (!itemSearch.trim()) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(itemSearch.toLowerCase())
    ).slice(0, 5);
  }, [products, itemSearch]);

  const filteredTokens = useMemo(() => {
    return tokens.filter(t => {
      const matchesSearch = 
        t.tokenId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customer?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.createdBy?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assignedTo?.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [tokens, searchQuery, statusFilter]);

  const addItem = () => {
    if (!selectedProduct || !itemQty) return;
    const newItem = {
      productId: selectedProduct._id,
      name: selectedProduct.name,
      qty: Number(itemQty)
    };
    setTokenItems([...tokenItems, newItem]);
    setSelectedProduct(null);
    setItemSearch("");
    setItemQty(1);
  };

  const removeItem = (index) => {
    setTokenItems(tokenItems.filter((_, i) => i !== index));
  };

  // --- CLICK OUTSIDE HANDLERS ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- SUB-COMPONENT: TOKEN CARD ---
  const TokenCard = ({ token }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const isFinished = token.status === "FINISHED";

    // Extract timings from statusLog
    const takenLog = token.statusLog?.find(log => log.status === "TAKEN" || log.status === "IN_PROGRESS");
    const finishedLog = token.statusLog?.find(log => log.status === "FINISHED");

    const formatTime = (date) => {
      if (!date) return "--/--";
      return new Date(date).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
    };

    return (
      <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-lg group ${isFinished ? 'opacity-80 bg-slate-50' : ''}`}>
        <div className="p-4 md:p-5">
          {/* Default Compact View */}
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black tracking-widest uppercase border border-indigo-100">
                  {token.tokenId}
                </span>
                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black tracking-widest uppercase border ${
                  token.status === "OPEN" ? "bg-amber-50 text-amber-600 border-amber-100" :
                  token.status === "FINISHED" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                  "bg-blue-50 text-blue-600 border-blue-100"
                }`}>
                  {token.status?.replace("_", " ")}
                </span>
              </div>
              <h3 className="text-base font-black text-slate-800 tracking-tight leading-tight truncate">{token.customer?.name}</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">
                {formatTime(token.createdAt)}
              </p>
            </div>
            
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
            >
              {isExpanded ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
            </button>
          </div>

          {/* Expandable Section */}
          <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[800px] mt-4 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="pt-4 border-t border-slate-50">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <FaUserCircle className="text-slate-300" /> Created By
                  </p>
                  <p className="text-[10px] font-black text-slate-700 truncate">{token.createdBy?.name || "System"}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <FaUserFriends className="text-indigo-400" /> Assigned To
                  </p>
                  <p className="text-[10px] font-black text-slate-700 truncate">{token.assignedTo?.name}</p>
                </div>
              </div>

              {/* TIMING LOGS SECTION */}
              <div className="bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/50 mb-4">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <FaClock className="text-indigo-300" /> Timing Log
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-white/50 p-2 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Taken At</span>
                    <span className="text-[10px] font-black text-indigo-600">{takenLog ? formatTime(takenLog.updatedAt) : "Pending"}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/50 p-2 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Finished At</span>
                    <span className="text-[10px] font-black text-emerald-600">{finishedLog ? formatTime(finishedLog.updatedAt) : "In Progress"}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <FaBox className="text-slate-300" /> Items ({token.items?.length})
                </p>
                <div className="space-y-1.5">
                  {token.items?.map((item, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] flex items-center justify-between shadow-sm">
                      <span className="font-bold text-slate-700">{item.name}</span>
                      <span className="font-black text-indigo-600">x{item.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Actions Bar (Stays compact but functional) */}
          <div className="flex items-center gap-2 pt-4 border-t border-slate-50 mt-4">
            {token.status === "OPEN" && (
              <button 
                onClick={() => updateTokenStatus(token._id, "TAKEN")}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white h-9 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
              >
                Take
              </button>
            )}
            {(token.status === "TAKEN" || token.status === "OPEN") && (
              <button 
                onClick={() => updateTokenStatus(token._id, "IN_PROGRESS")}
                className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 h-9 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
              >
                In Progress
              </button>
            )}
            {token.status === "IN_PROGRESS" && (
              <button 
                onClick={() => updateTokenStatus(token._id, "FINISHED")}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-9 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
              >
                <FaCheckCircle /> Finish
              </button>
            )}
            {token.status === "FINISHED" && (
              <div className="flex-1 flex items-center justify-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 h-9 rounded-xl border border-emerald-100 text-[10px] uppercase tracking-widest">
                <FaCheckCircle /> Completed
              </div>
            )}
            <button className="w-9 h-9 rounded-xl bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center border border-slate-100">
              <FaHistory />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-20 md:pt-4 md:pl-20 px-4 pb-12">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-100">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-2xl shadow-lg shadow-indigo-200">
              <FaTicketAlt className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Token Management</h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Workflow Tracking System</p>
            </div>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-200 text-xs"
          >
            Create New Token
          </button>
        </div>
      </div>

      {/* Filters Hub */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-500">
            <FaSearch />
          </div>
          <input 
            type="text" 
            placeholder="Search by ID, Customer, Creator or Staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
          />
        </div>
        <div className="flex gap-2 p-1.5 bg-white border-2 border-slate-100 rounded-2xl shadow-sm overflow-x-auto no-scrollbar">
          {["ALL", "OPEN", "TAKEN", "IN_PROGRESS", "FINISHED"].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                statusFilter === status 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              }`}
            >
              {status.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active", value: tokens.filter(t => ["OPEN", "TAKEN", "IN_PROGRESS"].includes(t.status)).length, color: "text-indigo-600" },
          { label: "Pending", value: tokens.filter(t => t.status === "OPEN").length, color: "text-amber-600" },
          { label: "In Progress", value: tokens.filter(t => ["TAKEN", "IN_PROGRESS"].includes(t.status)).length, color: "text-blue-600" },
          { label: "Done Today", value: tokens.filter(t => t.status === "FINISHED").length, color: "text-emerald-600" }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <h2 className={`text-xl font-black ${stat.color}`}>{stat.value}</h2>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FaSpinner className="text-3xl text-indigo-500 animate-spin mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing...</p>
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-slate-100">
            <p className="text-slate-400 font-bold uppercase text-[10px]">No Tokens Found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTokens.map(token => (
              <TokenCard key={token._id} token={token} />
            ))}
          </div>
        )}
      </div>

      {/* Create Token Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-slate-900 px-8 py-8 text-white flex justify-between items-center">
              <h2 className="text-xl font-black tracking-tight">New Order Token</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-white/40 hover:text-white transition-colors">
                <FaTimes size={20} />
              </button>
            </div>

            <div className="p-8 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Created By</label>
                  <select 
                    value={createdPerson.id}
                    onChange={(e) => {
                      const u = branchUsers.find(abu => abu._id === e.target.value);
                      if (u) setCreatedPerson({ id: u._id, name: u.fullName || u.username });
                    }}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value={user?.id}>{user?.fullName || user?.username}</option>
                    {branchUsers.map(abu => abu._id !== user?.id && <option key={abu._id} value={abu._id}>{abu.fullName || abu.username}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Assigned To</label>
                  <select 
                    value={assignedPerson.id}
                    onChange={(e) => {
                      const u = branchUsers.find(abu => abu._id === e.target.value);
                      if (u) setAssignedPerson({ id: u._id, name: u.fullName || u.username });
                    }}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value="">Select Assignee</option>
                    {branchUsers.map(abu => <option key={abu._id} value={abu._id}>{abu.fullName || abu.username}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Customer</label>
                  <div className="relative" ref={customerDropdownRef}>
                    <input 
                      type="text" 
                      placeholder="Search customer..."
                      value={customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                    />
                    {showCustomerDropdown && filteredCustomers.length > 0 && (
                      <div className="absolute top-[110%] left-0 right-0 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-20">
                        {filteredCustomers.map(c => (
                          <div key={c._id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setShowCustomerDropdown(false); }} className="px-5 py-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors">
                            <span className="font-bold text-slate-800 text-xs">{c.name}</span>
                            <span className="text-[9px] font-black text-slate-400">{c.mobile || c.whatsapp}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <FaShoppingBag className="text-indigo-400" /> Items List
                </h4>
                <div className="flex gap-2 mb-6">
                  <div className="flex-1 relative" ref={productDropdownRef}>
                    <input type="text" placeholder="Item name..." value={itemSearch} onChange={(e) => { setItemSearch(e.target.value); setShowProductDropdown(true); }} onFocus={() => setShowProductDropdown(true)} className="w-full bg-white border-2 border-slate-100 rounded-lg px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-all" />
                    {showProductDropdown && filteredProducts.length > 0 && (
                      <div className="absolute top-[110%] left-0 right-0 bg-white rounded-lg shadow-xl border border-slate-100 overflow-hidden z-20">
                        {filteredProducts.map(p => (
                          <div key={p._id} onClick={() => { setSelectedProduct(p); setItemSearch(p.name); setShowProductDropdown(false); }} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-800 border-b border-slate-50 last:border-0">{p.name}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="number" value={itemQty} onChange={(e) => setItemQty(e.target.value)} className="w-16 bg-white border-2 border-slate-100 rounded-lg px-2 py-2.5 text-xs font-black text-indigo-600 outline-none text-center" />
                  <button onClick={addItem} disabled={!selectedProduct || !itemQty} className="bg-indigo-600 text-white w-10 flex items-center justify-center rounded-lg hover:bg-indigo-700 transition"><FaPlus size={12} /></button>
                </div>

                <div className="space-y-2">
                  {tokenItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-800">{item.name}</span>
                        <span className="text-[10px] font-black text-indigo-600">x{item.qty}</span>
                      </div>
                      <button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors"><FaTimes size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-8 py-6 flex gap-4 border-t border-slate-100">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 bg-white border-2 border-slate-200 text-slate-600 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-slate-100 transition text-[10px]">Cancel</button>
              <button onClick={handleCreateToken} className="flex-[2] bg-indigo-600 text-white py-3 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl shadow-indigo-100 text-[10px]">Create Token</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tokenization;
