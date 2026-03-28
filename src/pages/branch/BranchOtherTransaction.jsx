import React, { useEffect, useState } from "react";
import { FaPlus, FaTrash, FaMoneyBillWave, FaDownload, FaFileAlt, FaChevronDown } from "react-icons/fa";
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : "https://pearls-erp-2026.onrender.com/api";

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

  const ledgerGroups = [
    "Fixed Assets",
    "Current Assets",
    "Indirect Expenses",
    "Direct Expenses",
    "Loans & Liabilities",
    "Capital Account",
  ];

  const defaultNames = ["Vehicle", "Staff Welfare", "Bank Charges", "Contra", "Others"];

  useEffect(() => {
    if (currentBranch?._id) fetchTransactions();
  }, [currentBranch, type]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/other-transactions?branchId=${currentBranch._id}&type=${type}`, {
        headers: { "Content-Type": "application/json" },
      });
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
      const response = await fetch(`${API_BASE}/other-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      const response = await fetch(`${API_BASE}/other-transactions/${id}`, {
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
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Ledger Group</label>
                <select
                  value={formData.ledgerGroup}
                  onChange={(e) => setFormData({ ...formData, ledgerGroup: e.target.value })}
                  className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 transition font-medium"
                >
                  {ledgerGroups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Ledger Name</label>
                <div className="relative group">
                  <select
                    value={formData.ledgerName}
                    onChange={(e) => setFormData({ ...formData, ledgerName: e.target.value })}
                    className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 transition font-medium appearance-none"
                  >
                    {defaultNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                     <FaChevronDown size={12} />
                  </div>
                </div>
                <input 
                  type="text"
                  placeholder="Or type custom name..."
                  className="mt-2 w-full bg-gray-50 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 transition text-sm italic"
                  onChange={(e) => setFormData({ ...formData, ledgerName: e.target.value })}
                />
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
