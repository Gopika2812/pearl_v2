import React, { useEffect, useState } from "react";
import { 
  FaHistory, FaSearch, FaSync, FaReceipt, FaUser, FaWallet, 
  FaHandHoldingUsd, FaChevronDown, FaChevronUp, FaUniversity, FaCalendarCheck, FaUndo
} from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import ScrollToggleButton from "../../components/ScrollToggleButton";

const BranchTransferredReceipts = () => {
  const { currentBranch, user } = useBranch();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchTransferredReceipts = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/delivery-receipts/transferred?branchId=${currentBranch._id}`);
      const data = await res.json();
      if (data.success) {
        setReceipts(data.data || []);
      }
    } catch (err) {
      toast.error("Failed to fetch transferred receipts");
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async (id) => {
    if (!window.confirm("Are you sure you want to revert this bank transfer? It will be moved back to the pending list.")) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/delivery-receipts/revert-transfer/${id}`, {
        method: "PATCH"
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Transfer reverted successfully");
        fetchTransferredReceipts();
      } else {
        toast.error(data.message || "Failed to revert transfer");
      }
    } catch (err) {
      toast.error("Error reverting transfer");
    }
  };

  useEffect(() => {
    fetchTransferredReceipts();
  }, [currentBranch?._id]);

  return (
    <div className="relative min-h-screen bg-[#f8fafc] pt-20 md:pt-8 md:pl-24 pr-4 pb-12 font-poppins">
      <ScrollToggleButton />
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-200">
              <FaUniversity className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight uppercase">
                Receipts <span className="text-indigo-500">Transferred</span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Bank Deposit History</p>
            </div>
          </div>
          <button 
            onClick={fetchTransferredReceipts}
            className="p-4 bg-white shadow-sm border border-slate-100 text-slate-400 rounded-2xl hover:text-indigo-500 transition"
          >
            <FaSync className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="bg-white rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transfer ID / Receipts</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank Details</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transferred By</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amounts</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetching Deposits...</span>
                        </div>
                      </td>
                    </tr>
                  ) : receipts.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-8 py-20 text-center opacity-30">
                        <FaUniversity size={60} className="mx-auto text-slate-300 mb-4" />
                        <span className="text-sm font-black text-slate-400 uppercase tracking-widest">No bank transfers found</span>
                      </td>
                    </tr>
                  ) : (
                    receipts.map((r) => {
                      const collections = r.collections && r.collections.length > 0
                        ? r.collections
                        : (r.receiptIds?.flatMap(rcpt => rcpt.collections || []) || []);

                      const expenses = r.expenses && r.expenses.length > 0
                        ? r.expenses
                        : (r.receiptIds?.flatMap(rcpt => rcpt.expenses || []) || []);

                      return (
                        <React.Fragment key={r._id}>
                          <tr className="hover:bg-indigo-50/30 transition-colors">
                            <td className="px-8 py-6">
                               <div>
                                  <div className="text-sm font-black text-slate-800">{r.transferId || "Legacy Transfer"}</div>
                                  <div className="flex flex-wrap gap-1 mt-1.5 max-w-[280px]">
                                    {r.receiptNumbers && r.receiptNumbers.length > 0 ? (
                                      r.receiptNumbers.map((num, idx) => (
                                        <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[9px] font-black uppercase tracking-wider">
                                          {num}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[9px] font-black uppercase tracking-wider">
                                        {r.receiptId}
                                      </span>
                                    )}
                                  </div>
                               </div>
                            </td>
                            <td className="px-8 py-6">
                               <div className="flex items-center gap-2">
                                  <div className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                    {r.bankName}
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                     <FaCalendarCheck size={10} />
                                     {new Date(r.transferredAt).toLocaleDateString()}
                                  </div>
                               </div>
                            </td>
                            <td className="px-8 py-6">
                               <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                                    <FaUser size={12} />
                                  </div>
                                  <span className="text-xs font-black text-slate-700 uppercase">{r.transferredBy}</span>
                                </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                               <div className="flex flex-col items-end gap-0.5">
                                  <div className="flex items-center gap-1.5">
                                     <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Net:</span>
                                     <span className="text-xs font-black text-slate-700">₹{r.netAmount?.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                     <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Deposited:</span>
                                     <span className="text-xs font-black text-emerald-600">₹{(r.totalTransferred || r.netAmount)?.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                     <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Expense:</span>
                                     <span className="text-xs font-black text-rose-500">₹{(r.totalExpense || 0)?.toLocaleString()}</span>
                                  </div>
                               </div>
                            </td>
                            <td className="px-8 py-6 text-center">
                               <div className="flex items-center justify-center gap-2">
                                 <button 
                                  onClick={() => handleRevert(r._id)}
                                  className="w-10 h-10 flex items-center justify-center bg-white border border-slate-100 text-slate-300 hover:text-indigo-500 hover:border-indigo-100 rounded-xl transition-all shadow-sm"
                                  title="Revert Transfer"
                                 >
                                   <FaUndo size={12} />
                                 </button>
                                 <button 
                                  onClick={() => setExpandedId(expandedId === r._id ? null : r._id)}
                                  className="w-10 h-10 flex items-center justify-center bg-white border border-slate-100 text-slate-400 hover:text-indigo-500 rounded-xl transition-all"
                                 >
                                   {expandedId === r._id ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                                 </button>
                               </div>
                            </td>
                          </tr>
                          {expandedId === r._id && (
                            <tr className="bg-slate-50/50">
                              <td colSpan="5" className="p-0">
                                <div className="p-8 border-b border-slate-100">
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                     <div>
                                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                         <FaWallet className="text-emerald-500" /> Collections Included
                                       </h4>
                                       {collections.length > 0 ? (
                                         <div className="space-y-2">
                                           {collections.map((c, i) => (
                                             <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                               <div className="flex flex-col">
                                                 <span className="text-xs font-black text-slate-700">{c.customer?.name}</span>
                                                 <span className="text-[9px] font-bold text-slate-400 uppercase">{c.paymentMode}</span>
                                               </div>
                                               <span className="text-xs font-black text-emerald-600">₹{c.amount?.toLocaleString()}</span>
                                             </div>
                                           ))}
                                         </div>
                                       ) : (
                                         <div className="text-xs font-bold text-slate-400 italic">No collections in this batch</div>
                                       )}
                                     </div>
                                     <div>
                                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                         <FaHandHoldingUsd className="text-rose-500" /> Expenses Deducted
                                       </h4>
                                       {expenses.length > 0 ? (
                                         <div className="space-y-2">
                                           {expenses.map((e, i) => (
                                             <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                               <span className="text-xs font-bold text-slate-600">{e.note || "Expense"}</span>
                                               <span className="text-xs font-black text-rose-500">₹{e.amount?.toLocaleString()}</span>
                                             </div>
                                           ))}
                                         </div>
                                       ) : (
                                         <div className="text-xs font-bold text-slate-400 italic">No expenses in this batch</div>
                                       )}
                                     </div>
                                   </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                 )}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    </div>
  );
};

export default BranchTransferredReceipts;
