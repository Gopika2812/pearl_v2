import React, { useEffect, useState } from "react";
import { FaPlus, FaTrash, FaMoneyBillWave, FaDownload, FaFileAlt, FaChevronDown } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";

export default function BranchOtherTransaction({ type }) {
  const { currentBranch, user } = useBranch();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    ledgerGroup: "Indirect Expenses",
    ledgerName: "Others",
    amount: "",
    gst: "0",
    note: "",
  });

  const [availableGroups, setAvailableGroups] = useState([]);
  const [availableLedgers, setAvailableLedgers] = useState([]);
  const [showQuickAddGroup, setShowQuickAddGroup] = useState(false);
  const [showQuickAddLedger, setShowQuickAddLedger] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupNature, setNewGroupNature] = useState("Expense");
  const [newLedgerName, setNewLedgerName] = useState("");

  useEffect(() => {
    if (currentBranch?._id) {
       fetchTransactions();
       fetchGroups();
    }
  }, [currentBranch, type]);

  useEffect(() => {
    if (formData.ledgerGroup) {
      const groupObj = availableGroups.find(g => g.name === formData.ledgerGroup);
      if (groupObj) fetchLedgers(groupObj._id);
      else setAvailableLedgers([]);
    }
  }, [formData.ledgerGroup, availableGroups]);

  const fetchGroups = async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE}/ledgers/groups?branchId=${currentBranch._id}`);
      const data = await response.json();
      setAvailableGroups(Array.isArray(data) ? data : []);
      
      // Default to "Indirect Expenses" if available
      if (data.some(g => g.name === "Indirect Expenses")) {
        setFormData(prev => ({ ...prev, ledgerGroup: "Indirect Expenses" }));
      } else if (data.length > 0) {
        setFormData(prev => ({ ...prev, ledgerGroup: data[0].name }));
      }
    } catch (err) {
      console.error("Error fetching groups:", err);
    }
  };

  const fetchLedgers = async (groupId) => {
    try {
      const response = await fetchWithAuth(`${API_BASE}/ledgers?branchId=${currentBranch._id}&groupId=${groupId}`);
      const data = await response.json();
      setAvailableLedgers(Array.isArray(data) ? data : []);
      if (data.length > 0) {
          setFormData(prev => ({ ...prev, ledgerName: data[0].name }));
      } else {
          setFormData(prev => ({ ...prev, ledgerName: "Others" }));
      }
    } catch (err) {
      console.error("Error fetching ledgers:", err);
    }
  };

  const handleQuickAddGroup = async () => {
    if (!newGroupName.trim()) return toast.error("Enter group name");
    try {
      const response = await fetchWithAuth(`${API_BASE}/ledgers/groups`, {
        method: "POST",
        body: JSON.stringify({
          name: newGroupName,
          nature: newGroupNature,
          branchId: currentBranch._id,
        }),
      });
      if (response.ok) {
        toast.success("Group created");
        const data = await response.json();
        setAvailableGroups(prev => [...prev, data]);
        setFormData(prev => ({ ...prev, ledgerGroup: data.name }));
        setShowQuickAddGroup(false);
        setNewGroupName("");
      } else {
        const err = await response.json();
        toast.error(err.message || "Failed to create group");
      }
    } catch (err) {
      toast.error("Group creation failed");
    }
  };

  const handleQuickAddLedger = async () => {
    if (!newLedgerName.trim()) return toast.error("Enter ledger name");
    const groupObj = availableGroups.find(g => g.name === formData.ledgerGroup);
    if (!groupObj) return toast.error("Select a group first");
    
    try {
      const response = await fetchWithAuth(`${API_BASE}/ledgers`, {
        method: "POST",
        body: JSON.stringify({
          name: newLedgerName,
          groupId: groupObj._id,
          branchId: currentBranch._id,
          openingDebit: 0,
          openingCredit: 0,
        }),
      });
      if (response.ok) {
        toast.success("Ledger created");
        const data = await response.json();
        setAvailableLedgers(prev => [...prev, data]);
        setFormData(prev => ({ ...prev, ledgerName: data.name }));
        setShowQuickAddLedger(false);
        setNewLedgerName("");
      } else {
        const err = await response.json();
        toast.error(err.message || "Failed to create ledger");
      }
    } catch (err) {
      toast.error("Ledger creation failed");
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${API_BASE}/other-transactions?branchId=${currentBranch._id}&type=${type}`);
      const data = await response.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ledgerName || !formData.amount) {
      return toast.error("Please fill required fields");
    }

    try {
      const response = await fetchWithAuth(`${API_BASE}/other-transactions`, {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          branchId: currentBranch._id,
          type: type.toUpperCase(),
          recordedBy: user?._id,
        }),
      });

      if (response.ok) {
        toast.success(`${type} recorded successfully`);
        setShowModal(false);
        setFormData({
          ledgerGroup: "Indirect Expenses",
          ledgerName: "Others",
          amount: "",
          gst: "0",
          note: "",
        });
        fetchTransactions();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to record transaction");
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Server error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      const response = await fetchWithAuth(`${API_BASE}/other-transactions/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success("Deleted successfully");
        fetchTransactions();
      }
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const isPayment = type.toUpperCase() === "PAYMENT";
  const themeColor = isPayment ? "red" : "green";
  const Icon = isPayment ? FaMoneyBillWave : FaDownload;

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4">
        {/* HEADER */}
        <div className={`bg-gradient-to-r from-${themeColor}-600 to-${themeColor}-700 text-white rounded-2xl shadow-lg p-8 mb-8`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Icon className="text-5xl opacity-80" />
              <div>
                <h1 className="text-4xl font-bold">Other {type}</h1>
                <p className={`text-${themeColor}-100 mt-2`}>Record miscellaneous {type.toLowerCase()} transactions</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className={`flex items-center justify-center gap-2 bg-white text-${themeColor}-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition shadow-lg w-full md:w-auto`}
            >
              <FaPlus /> Create {type}
            </button>
          </div>
        </div>

        {/* LIST TABLE */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          {loading ? (
            <div className="p-12 text-center text-gray-500 font-medium">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center text-gray-400 font-medium">No {type.toLowerCase()} records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`bg-${themeColor}-50 border-b border-${themeColor}-100`}>
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Ledger Group</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Ledger Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Note</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">GST %</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((t) => (
                    <tr key={t._id} className="hover:bg-gray-50/50 transition duration-150">
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-bold text-gray-500">{t.transactionId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(t.date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold">{t.ledgerGroup}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">{t.ledgerName}</td>
                      <td className="px-6 py-4 max-w-xs truncate text-xs text-gray-500 italic">"{t.note || "-"}"</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">{t.gst}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-base font-black text-gray-900">
                        ₹{Number(t.amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button onClick={() => handleDelete(t._id)} className="text-red-400 hover:text-red-600 transition p-2 hover:bg-red-50 rounded-lg">
                          <FaTrash size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            <div className={`bg-gradient-to-r from-${themeColor}-600 to-${themeColor}-700 p-6 text-white`}>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Icon /> Create {type}
              </h2>
              <p className={`text-${themeColor}-100 text-sm mt-1 opacity-90`}>Fill in the details for the new entry</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Ledger Group</label>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowQuickAddGroup(!showQuickAddGroup);
                      setNewGroupNature(isPayment ? "Expense" : "Income");
                    }}
                    className="text-blue-600 hover:text-blue-800 p-1 bg-blue-50 rounded-lg transition"
                    title="Add New Group"
                  >
                    <FaPlus size={10} />
                  </button>
                </div>
                
                {showQuickAddGroup ? (
                   <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col gap-2 mb-2 animate-in slide-in-from-top-2 duration-300">
                      <input 
                        type="text" 
                        placeholder="New Group Name..." 
                        className="w-full bg-white border-0 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 font-bold"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <select 
                           className="flex-1 bg-white border-0 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-wider"
                           value={newGroupNature}
                           onChange={(e) => setNewGroupNature(e.target.value)}
                        >
                           <option value="Asset">Asset</option>
                           <option value="Liability">Liability</option>
                           <option value="Income">Income</option>
                           <option value="Expense">Expense</option>
                        </select>
                        <button 
                          type="button" 
                          onClick={handleQuickAddGroup}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                        >
                          Save
                        </button>
                      </div>
                   </div>
                ) : (
                  <select
                    value={formData.ledgerGroup}
                    onChange={(e) => setFormData({ ...formData, ledgerGroup: e.target.value })}
                    className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 transition font-medium"
                  >
                    {availableGroups.length > 0 ? (
                       availableGroups.map(g => <option key={g._id} value={g.name}>{g.name}</option>)
                    ) : (
                       <option disabled>Loading Groups...</option>
                    )}
                  </select>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Ledger Name</label>
                  <button 
                    type="button"
                    onClick={() => setShowQuickAddLedger(!showQuickAddLedger)}
                    className="text-blue-600 hover:text-blue-800 p-1 bg-blue-50 rounded-lg transition"
                    title="Add New Ledger"
                  >
                    <FaPlus size={10} />
                  </button>
                </div>

                {showQuickAddLedger ? (
                   <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex gap-2 mb-2 animate-in slide-in-from-top-2 duration-300">
                      <input 
                        type="text" 
                        placeholder="New Ledger Name..." 
                        className="flex-1 bg-white border-0 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 font-bold"
                        value={newLedgerName}
                        onChange={(e) => setNewLedgerName(e.target.value)}
                      />
                      <button 
                        type="button" 
                        onClick={handleQuickAddLedger}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                      >
                        Save
                      </button>
                   </div>
                ) : (
                  <div className="relative group">
                    <select
                      value={formData.ledgerName}
                      onChange={(e) => setFormData({ ...formData, ledgerName: e.target.value })}
                      className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 transition font-medium appearance-none"
                    >
                      {availableLedgers.length > 0 ? (
                        availableLedgers.map(n => <option key={n._id} value={n.name}>{n.name}</option>)
                      ) : (
                        <option value="Others">Others</option>
                      )}
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                       <FaChevronDown size={12} />
                    </div>
                  </div>
                )}
                
                {!showQuickAddLedger && (
                   <input 
                    type="text"
                    placeholder="Or type custom name..."
                    className="mt-2 w-full bg-gray-50 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 transition text-sm italic"
                    value={formData.ledgerName === "Others" ? "" : formData.ledgerName}
                    onChange={(e) => setFormData({ ...formData, ledgerName: e.target.value })}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                    <input
                      type="number"
                      required
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full bg-gray-50 border-0 rounded-xl pl-8 pr-4 py-3 focus:ring-2 focus:ring-blue-500 font-black text-lg"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">GST %</label>
                  <input
                    type="number"
                    value={formData.gst}
                    onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                    className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-bold"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Note (Optional)</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 text-sm h-24 resize-none"
                  placeholder="e.g. 5th due paid for vehicle..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 px-4 py-4 rounded-xl font-black text-white bg-gradient-to-r from-${themeColor}-600 to-${themeColor}-700 shadow-xl shadow-${themeColor}-500/20 hover:scale-[1.02] active:scale-95 transition-all`}
                >
                  Record Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
