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
  const [createdPerson, setCreatedPerson] = useState({ id: user?.id || null, name: user?.fullName || user?.username || "" });
  const [assignedPerson, setAssignedPerson] = useState({ id: "", name: "" });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // PAGE FILTERS
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  
  const [tokenMessage, setTokenMessage] = useState("");
  const customerDropdownRef = useRef(null);

  useEffect(() => {
    fetchTokens();
    fetchBranchUsers();
  }, [currentBranch]);

  // Sync creator info when user context is ready
  useEffect(() => {
    if (user?.id) {
      setCreatedPerson({ id: user.id, name: user.fullName || user.username });
    }
  }, [user]);

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
    if (!tokenMessage.trim()) {
      toast.warning("Please enter a message for the token");
      return;
    }

    try {
      const payload = {
        branchId: currentBranch._id,
        assignedTo: assignedPerson.id ? assignedPerson : { id: null, name: "Unassigned" },
        customer: selectedCustomer ? { id: selectedCustomer._id, name: selectedCustomer.name } : { name: "INTERNAL" },
        message: tokenMessage
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
    setCreatedPerson({ id: user?.id || null, name: user?.fullName || user?.username || "" });
    setAssignedPerson({ id: "", name: "" });
    setSelectedCustomer(null);
    setCustomerSearch("");
    setTokenMessage("");
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

  const filteredTokens = useMemo(() => {
    const statusPriority = {
      "OPEN": 1,
      "TAKEN": 2,
      "IN_PROGRESS": 3,
      "COMPLETED": 4,
      "CANCELLED": 5
    };

    return tokens
      .filter(t => {
        const matchesSearch = 
          t.tokenId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.customer?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.createdBy?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.assignedTo?.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        // Sort by status priority first
        if (statusPriority[a.status] !== statusPriority[b.status]) {
          return statusPriority[a.status] - statusPriority[b.status];
        }
        // Then by most recent
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }, [tokens, searchQuery, statusFilter]);

  // --- CLICK OUTSIDE HANDLERS ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
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

    const handleAssign = async (userId, userName) => {
      try {
        const res = await fetchWithAuth(`${API_BASE}/tokens/${token._id}/assign`, {
          method: "PATCH",
          body: JSON.stringify({ assignedTo: { id: userId, name: userName } })
        });
        const data = await res.json();
        if (data.success) {
          toast.success(`Token assigned to ${userName}`);
          fetchTokens();
        }
      } catch (err) {
        toast.error("Assignment failed");
      }
    };

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
                  token.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                  token.status === "CANCELLED" ? "bg-red-50 text-red-600 border-red-100" :
                  "bg-blue-50 text-blue-600 border-blue-100"
                }`}>
                  {token.status?.replace("_", " ")}
                </span>
              </div>
              <h3 className="text-base font-black text-slate-800 tracking-tight leading-tight truncate">
                {token.customer?.name === "INTERNAL" ? "Task / Internal" : (token.customer?.name || "No Customer")}
              </h3>
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
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 relative group/assign">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-sans">
                    <FaUserFriends className="text-indigo-400" /> Assigned To
                  </p>
                  
                  {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") ? (
                    <div className="relative">
                      <select 
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-black text-slate-700 outline-none focus:border-indigo-500 transition-all appearance-none pr-6"
                        value={token.assignedTo?.id?._id || token.assignedTo?.id || ""}
                        onChange={(e) => {
                          const u = branchUsers.find(abu => abu._id === e.target.value);
                          if (u) handleAssign(u._id, u.fullName || u.username);
                          else handleAssign(null, "Unassigned");
                        }}
                      >
                        <option value="">Choose User...</option>
                        {branchUsers.map(u => (
                          <option key={u._id} value={u._id}>{u.fullName || u.username}</option>
                        ))}
                      </select>
                      <FaChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={8} />
                    </div>
                  ) : (
                    <p className="text-[10px] font-black text-slate-700 truncate">{token.assignedTo?.name || "Unassigned"}</p>
                  )}
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
                  <FaBox className="text-slate-300" /> Task Message
                </p>
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-[11px] font-bold text-slate-600 leading-relaxed min-h-[80px]">
                  {token.message || "No message provided."}
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
                Take Token
              </button>
            )}
            
            {token.status === "TAKEN" && (
              <>
                <button 
                  onClick={() => updateTokenStatus(token._id, "IN_PROGRESS")}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-9 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
                >
                  Start Work
                </button>
                <button 
                  onClick={() => updateTokenStatus(token._id, "COMPLETED")}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-9 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
                >
                  Finish
                </button>
              </>
            )}

            {token.status === "IN_PROGRESS" && (
              <button 
                onClick={() => updateTokenStatus(token._id, "COMPLETED")}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-9 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-200"
              >
                <FaCheckCircle /> Complete
              </button>
            )}

            {token.status === "COMPLETED" && (
              <div className="flex-1 flex items-center justify-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 h-9 rounded-xl border border-emerald-100 text-[10px] uppercase tracking-widest">
                <FaCheckCircle /> Completed
              </div>
            )}
            
            {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && !["COMPLETED", "CANCELLED"].includes(token.status) && (
              <button 
                onClick={() => updateTokenStatus(token._id, "CANCELLED")}
                className="w-9 h-9 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border border-red-100"
                title="Cancel Token"
              >
                <FaTimes size={14} />
              </button>
            )}
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
          {["ALL", "OPEN", "TAKEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map(status => (
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
          { label: "Done", value: tokens.filter(t => t.status === "COMPLETED").length, color: "text-emerald-600" }
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
                <div className="bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] p-6 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Created By</label>
                      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-black text-indigo-600 flex items-center gap-2">
                        <FaUserCircle className="text-indigo-400" />
                        {user?.fullName || user?.username} (Logged In)
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex justify-between items-center">
                        <span>Assigned To</span>
                        <span className="text-[8px] font-bold text-slate-300">OPTIONAL</span>
                      </label>
                      <select 
                        value={assignedPerson.id}
                        onChange={(e) => {
                          const u = branchUsers.find(abu => abu._id === e.target.value);
                          if (u) setAssignedPerson({ id: u._id, name: u.fullName || u.username });
                          else setAssignedPerson({ id: "", name: "" });
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                      >
                        <option value="">No Assignment (General)</option>
                        {branchUsers.map(abu => <option key={abu._id} value={abu._id}>{abu.fullName || abu.username}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <FaBox className="text-indigo-400" /> Token Message / Notes
                  </label>
                  <textarea 
                    value={tokenMessage}
                    onChange={(e) => setTokenMessage(e.target.value)}
                    placeholder="Enter task details, messages, or instructions here..."
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all min-h-[120px] resize-none shadow-inner"
                  />
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
