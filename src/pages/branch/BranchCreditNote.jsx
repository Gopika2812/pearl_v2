import { useEffect, useState } from "react";
import { FaPlus, FaUndoAlt, FaSearch, FaFileInvoiceDollar, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { toast } from "react-toastify";
import CustomerCreditNoteModal from "../../components/inventory/CustomerCreditNoteModal"; // Use this for standalone/unified
import { useBranch } from "../../context/BranchContext";
import { API_BASE, fetchWithAuth } from "../../api";

export default function BranchCreditNote() {
  const { currentBranch } = useBranch();
  const [creditNotes, setCreditNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCN, setExpandedCN] = useState({});

  useEffect(() => {
    if (currentBranch?._id) fetchCreditNotes();
  }, [currentBranch]);

  const fetchCreditNotes = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${API_BASE}/credit-notes?branchId=${currentBranch._id}`);
      const result = await response.json();
      if (result.success) {
        setCreditNotes(result.data || []);
      }
    } catch (error) {
      console.error("Error fetching credit notes:", error);
      toast.error("Failed to load credit notes");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedCN(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredCN = creditNotes.filter(cn => 
    cn.creditNoteId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cn.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date) => new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-teal-600 rounded-2xl shadow-lg shadow-teal-100 text-white">
              <FaUndoAlt size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">CREDIT NOTES</h1>
              <p className="text-gray-500 font-bold text-sm uppercase tracking-widest">Sales Returns & Customer Credits</p>
            </div>
          </div>
          
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-3 bg-teal-600 hover:bg-teal-700 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-teal-100 active:scale-95"
          >
            <FaPlus /> Create Credit Note
          </button>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Notes</p>
                <p className="text-3xl font-black text-gray-900">{filteredCN.length}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Credit Value</p>
                <p className="text-3xl font-black text-teal-600">₹{filteredCN.reduce((sum, cn) => sum + (cn.grandTotal || 0), 0).toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
                <FaSearch className="absolute -right-4 -bottom-4 text-8xl text-gray-50 -rotate-12" />
                <div className="z-10 w-full">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Search Records</p>
                    <input 
                      type="text"
                      placeholder="CN ID or Customer..."
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 text-sm font-bold focus:border-teal-500 outline-none transition-all"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
        </div>

        {/* RECORDS TABLE */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-20 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Fetching records...</p>
            </div>
          ) : filteredCN.length === 0 ? (
            <div className="p-20 text-center">
              <FaFileInvoiceDollar size={64} className="mx-auto text-gray-100 mb-4" />
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No credit notes found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">CN ID</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Items</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Invoice Ref</th>
                    <th className="px-10 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredCN.map((cn) => (
                    <React.Fragment key={cn._id}>
                      <tr className="group hover:bg-teal-50/30 transition-all cursor-pointer">
                        <td className="px-6 py-5 font-black text-teal-600 text-sm whitespace-nowrap">{cn.creditNoteId}</td>
                        <td className="px-6 py-5 font-bold text-gray-600 text-xs whitespace-nowrap">{formatDate(cn.createdAt)}</td>
                        <td className="px-6 py-5 font-black text-gray-800 text-xs">{cn.customer?.name}</td>
                        <td className="px-6 py-5 text-center">
                            <span className="bg-gray-100 px-2 py-1 rounded-lg text-[10px] font-black text-gray-500">{cn.items?.length || 0} ITEMS</span>
                        </td>
                        <td className="px-6 py-5 text-right font-black text-gray-900 text-sm">₹{(cn.grandTotal || 0).toLocaleString()}</td>
                        <td className="px-6 py-5">
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${cn.originalInvoiceId === 'STANDALONE' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600 uppercase'}`}>
                                {cn.originalInvoiceId}
                            </span>
                        </td>
                        <td className="px-10 py-5 text-center">
                            <button 
                              onClick={() => toggleExpand(cn._id)}
                              className="p-2 hover:bg-white rounded-xl text-teal-600 transition-all shadow-sm group-hover:shadow-md"
                            >
                                {expandedCN[cn._id] ? <FaChevronUp /> : <FaChevronDown />}
                            </button>
                        </td>
                      </tr>
                      {expandedCN[cn._id] && (
                        <tr className="bg-gray-50/50">
                          <td colSpan="7" className="px-6 py-4">
                            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                                <h4 className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Return Item Details</h4>
                                <div className="space-y-2">
                                    {cn.items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">x{item.qty}</span>
                                                <span className="font-bold text-gray-700">{item.name}</span>
                                            </div>
                                            <span className="font-black text-gray-900">₹{(item.total || 0).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate max-w-[70%]">Reason: {cn.reasonForReturn || 'Product Return'}</span>
                                    <span className="text-xs font-black text-teal-700">Total: ₹{(cn.grandTotal || 0).toLocaleString()}</span>
                                </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Standalone/Unified Creation Modal */}
      <CustomerCreditNoteModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onCreditSuccess={fetchCreditNotes}
        // No customer passed = allow selection in modal
      />
    </div>
  );
}

import React from "react";
