import React, { useEffect, useState } from "react";
import { FaPlus, FaUndoAlt, FaSearch, FaFileInvoiceDollar, FaChevronDown, FaChevronUp, FaFileContract, FaPrint } from "react-icons/fa";
import { toast } from "react-toastify";
import SupplierDebitNoteModal from "../../components/inventory/SupplierDebitNoteModal";
import { useBranch } from "../../context/BranchContext";
import { API_BASE, fetchWithAuth } from "../../api";
import { getInvoiceHTML } from "../../utils/invoiceUtils";

export default function BranchDebitNote() {
  const { currentBranch, user } = useBranch();
  
  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    // Global Super Admin or Branch Admin (local) bypass checks
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    
    const key = `debit-note_${fieldId}`;
    return user.fieldPermissions?.[key] !== false; // Default to true if not explicitly restricted
  };
  const [debitNotes, setDebitNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDN, setExpandedDN] = useState({});

  useEffect(() => {
    if (currentBranch?._id) fetchDebitNotes();
  }, [currentBranch]);

  const fetchDebitNotes = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${API_BASE}/debit-notes?branchId=${currentBranch._id}`);
      const result = await response.json();
      if (result.success) {
        setDebitNotes(result.data || []);
      }
    } catch (error) {
      console.error("Error fetching debit notes:", error);
      toast.error("Failed to load debit notes");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedDN(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredDN = debitNotes.filter(dn => 
    dn.debitNoteId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dn.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date) => new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const handlePrint = (dn, layoutType = 'PROFESSIONAL') => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.warning("Pop-up blocked! Please allow pop-ups to print.");
      return;
    }

    const previewData = {
      ...dn,
      seller: currentBranch || {}, 
      vendor: dn.vendor || {},
      invoiceDate: dn.createdAt
    };

    const mode = layoutType === 'PROFESSIONAL' ? 'DEBIT_NOTE_PROFESSIONAL' : 'DEBIT_NOTE';
    const html = getInvoiceHTML(previewData, 2, dn, dn, mode);
    
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 1000);
    }, 500);
  };

  const handleEdit = (dn) => {
    if (dn.status === "Cancelled") return toast.warning("Cannot edit a cancelled debit note");
    setEditData(dn);
    setShowModal(true);
  };

  const handleCancel = async (dn) => {
    const narration = window.prompt("Enter reason for cancellation:");
    if (!narration) return;

    try {
      const res = await fetchWithAuth(`${API_BASE}/debit-notes/${dn._id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ narration })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Debit note cancelled");
        fetchDebitNotes();
      } else {
        toast.error(data.message || "Failed to cancel");
      }
    } catch (err) {
      toast.error("Error cancelling debit note");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 font-sans">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-rose-600 rounded-2xl shadow-lg shadow-rose-100 text-white italic">
              <FaUndoAlt size={32} className="-rotate-90" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">DEBIT NOTES</h1>
              <p className="text-gray-500 font-bold text-sm uppercase tracking-widest">Purchase Returns & Vendor Debits</p>
            </div>
          </div>
          
          <button 
            onClick={() => { setEditData(null); setShowModal(true); }}
            className="flex items-center gap-3 bg-rose-600 hover:bg-rose-700 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-rose-100 active:scale-95"
          >
            <FaPlus /> Create Debit Note
          </button>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Notes</p>
                <p className="text-3xl font-black text-gray-900 tracking-tighter">{filteredDN.length}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Debit Value</p>
                <p className="text-3xl font-black text-rose-600 tracking-tighter italic">₹{filteredDN.reduce((sum, dn) => sum + (dn.grandTotal || 0), 0).toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
                <FaSearch className="absolute -right-4 -bottom-4 text-8xl text-gray-50 -rotate-12" />
                <div className="z-10 w-full">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Search Records</p>
                    <input 
                      type="text"
                      placeholder="DN ID or Vendor..."
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 text-sm font-bold focus:border-rose-500 outline-none transition-all placeholder:text-gray-300"
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
              <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Fetching records...</p>
            </div>
          ) : filteredDN.length === 0 ? (
            <div className="p-20 text-center">
              <FaFileInvoiceDollar size={64} className="mx-auto text-gray-100 mb-4" />
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No debit notes found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {isFieldAllowed("dnId") && <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">DN ID</th>}
                    {isFieldAllowed("date") && <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>}
                    {isFieldAllowed("vendor") && <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Vendor</th>}
                    {isFieldAllowed("items") && <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Items</th>}
                    {isFieldAllowed("amount") && <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>}
                    {isFieldAllowed("invoiceRef") && <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Invoice Ref</th>}
                    <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                    {isFieldAllowed("details") && <th className="px-10 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Details</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredDN.map((dn) => (
                    <React.Fragment key={dn._id}>
                      <tr className="group hover:bg-rose-50/30 transition-all cursor-pointer">
                        {isFieldAllowed("dnId") && <td className="px-6 py-5 font-black text-rose-600 text-sm whitespace-nowrap">{dn.debitNoteId}</td>}
                        {isFieldAllowed("date") && <td className="px-6 py-5 font-bold text-gray-600 text-xs whitespace-nowrap">{formatDate(dn.createdAt)}</td>}
                        {isFieldAllowed("vendor") && <td className="px-6 py-5 font-black text-gray-800 text-xs uppercase">{dn.vendor?.name}</td>}
                        {isFieldAllowed("items") && (
                          <td className="px-6 py-5 text-center">
                              <span className="bg-gray-100 px-2 py-1 rounded-lg text-[10px] font-black text-gray-500">{dn.items?.length || 0} ITEMS</span>
                          </td>
                        )}
                        {isFieldAllowed("amount") && <td className="px-6 py-5 text-right font-black text-gray-900 text-sm italic">₹{(dn.grandTotal || 0).toLocaleString()}</td>}
                        {isFieldAllowed("invoiceRef") && (
                          <td className="px-6 py-5">
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${!dn.originalPurchaseOrderId ? 'bg-orange-100 text-orange-600 truncate max-w-[150px] block' : 'bg-blue-100 text-blue-600 uppercase'}`}>
                                   {dn.originalInvoiceId || 'STANDALONE'}
                                   {dn.originalInvoiceDate && ` (Dt: ${new Date(dn.originalInvoiceDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })})`}
                               </span>
                          </td>
                        )}
                        <td className="px-6 py-5 text-center">
                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${dn.status === 'Cancelled' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                {dn.status || 'Created'}
                            </span>
                        </td>
                        {isFieldAllowed("details") && (
                          <td className="px-10 py-5 text-center">
                              <div className="flex items-center gap-2 justify-center">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleEdit(dn); }}
                                    className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-600 hover:text-white transition-all text-[10px] font-black border border-amber-100"
                                    title="Edit Debit Note"
                                  >
                                      EDIT
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleCancel(dn); }}
                                    className="px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all text-[10px] font-black border border-red-100"
                                    title="Cancel Debit Note"
                                  >
                                      CANCEL
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); toggleExpand(dn._id); }}
                                    className="p-2 hover:bg-white rounded-xl text-rose-600 transition-all shadow-sm group-hover:shadow-md border border-transparent hover:border-rose-100"
                                  >
                                      {expandedDN[dn._id] ? <FaChevronUp /> : <FaChevronDown />}
                                  </button>
                                </div>
                            </td>
                        )}
                      </tr>
                      {expandedDN[dn._id] && (
                        <tr className="bg-gray-50/50">
                          <td colSpan="7" className="px-12 py-6">
                            <div className="bg-white rounded-[2rem] border-2 border-rose-100 p-6 space-y-4 shadow-xl shadow-rose-50 animate-fadeIn">
                                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                                  <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] italic">Purchase Return Ledger Detail</h4>
                                  <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest italic">{dn.debitNoteId} / {formatDate(dn.createdAt)}</span>
                                </div>
                                <div className="space-y-2">
                                    {dn.items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs border-b border-gray-50 pb-2 last:border-0 last:pb-0 group/item">
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col items-center justify-center min-w-[40px] bg-rose-600 text-white rounded-lg py-1 px-2 shadow-sm">
                                                  <span className="text-[8px] font-black uppercase leading-none mb-0.5">Qty</span>
                                                  <span className="text-sm font-black leading-none">{item.qty || item.returnedQty || 0}</span>
                                                </div>
                                                <span className="font-black text-gray-700 uppercase tracking-tight">{item.name}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                              <span className="text-[9px] text-gray-400 font-bold italic">@ ₹{item.purchasePrice} {item.discountPercent > 0 && <span className="text-rose-400">(-{item.discountPercent}%)</span>}</span>
                                              <span className="font-black text-gray-900 italic">₹{((item.total || 0)).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-4 mt-2 border-t border-gray-100 flex justify-between items-end">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Reason for Return</span>
                                      <p className="text-[11px] font-bold text-gray-600 bg-gray-50 px-3 py-2 rounded-xl italic">"{dn.reason || 'Material Returned to Vendor'}"</p>
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 italic">Note Grand Total</span>
                                      <span className="text-xl font-black text-rose-700 tracking-tighter italic">₹{(dn.grandTotal || 0).toLocaleString()}</span>
                                    </div>
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

      <SupplierDebitNoteModal 
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditData(null); }}
        editData={editData}
        onSuccess={fetchDebitNotes}
      />
    </div>
  );
}

