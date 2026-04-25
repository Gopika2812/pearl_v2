import React, { useEffect, useState } from "react";
import { FaPlus, FaUndoAlt, FaSearch, FaFileInvoiceDollar, FaChevronDown, FaChevronUp, FaFileContract, FaPrint, FaTruck, FaSpinner, FaFilePdf } from "react-icons/fa";
import { toast } from "react-toastify";
import CustomerCreditNoteModal from "../../components/inventory/CustomerCreditNoteModal";
import { useBranch } from "../../context/BranchContext";
import { API_BASE, fetchWithAuth } from "../../api";
import EInvoicePrintModal from "../../components/branch/EInvoicePrintModal";
import { getInvoiceHTML } from "../../utils/invoiceUtils";

export default function BranchCreditNote() {
  const { currentBranch, user } = useBranch();
  const [creditNotes, setCreditNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCN, setExpandedCN] = useState({});
  const [requestingAction, setRequestingAction] = useState(null);
  const [showEInvoiceModal, setShowEInvoiceModal] = useState(null);
  const [editCN, setEditCN] = useState(null);
  const [showTransportModal, setShowTransportModal] = useState(null);

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

  const formatDate = (date) => new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const toggleExpand = (id) => {
    setExpandedCN(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredCN = creditNotes.filter(cn => 
    cn.creditNoteId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cn.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGenerateEInvoice = async (cn, transportDetails = null) => {
    // Check if transport details are required (>50k or as needed)
    if (cn.grandTotal > 50000 && !transportDetails && !cn.ewayBillNo) {
      setShowTransportModal(cn);
      return;
    }

    if (!transportDetails && !window.confirm(`Generate E-Invoice for ${cn.creditNoteId}?`)) {
      return;
    }

    setRequestingAction(cn._id);
    try {
      const res = await fetchWithAuth(`${API_BASE}/credit-notes/generate-einvoice/${cn._id}`, {
        method: "POST",
        body: JSON.stringify({
          userId: user?.id || user?._id,
          username: user?.username || user?.fullName || "Staff",
          transportDetails: transportDetails
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`✅ E-Invoice ${data.data.ewayBillNo ? "& E-Way Bill " : ""}Generated Successfully`);
        setShowTransportModal(null);
        fetchCreditNotes();
      } else {
        toast.error(`❌ Error: ${data.error || data.message || "Failed to generate"}`);
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Error generating E-Invoice: " + err.message);
    } finally {
      setRequestingAction(null);
    }
  };

  /**
   * 🖨️ HANDLE LOCAL PRINT: Uses the custom Pearl layout.
   */
  const handleLocalPrint = (cn) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.warning("🔔 Pop-up blocked! Please allow pop-ups to print.");
      return;
    }

    const previewData = {
      ...cn,
      seller: currentBranch || {}, // Branch info
      customer: cn.customer || {},
      invoiceDate: cn.createdAt
    };

    const html = getInvoiceHTML(previewData, 2, cn, cn, 'CREDIT_NOTE');
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 1000);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full px-4 sm:px-10 py-6">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100 text-white">
              <FaUndoAlt size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                CREDIT <span className="text-indigo-600">NOTES</span>
              </h1>
              <p className="text-gray-500 font-bold text-sm uppercase tracking-widest">Sales Returns & IRN Generation</p>
            </div>
          </div>
          
          <button 
            onClick={() => { setEditCN(null); setShowModal(true); }}
            className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 active:scale-95"
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
                <p className="text-3xl font-black text-indigo-600">₹{filteredCN.reduce((sum, cn) => sum + (cn.grandTotal || 0), 0).toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
                <FaSearch className="absolute -right-4 -bottom-4 text-8xl text-gray-50 -rotate-12" />
                <div className="z-10 w-full">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Search Records</p>
                    <input 
                      type="text"
                      placeholder="CN ID or Customer..."
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
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
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Fetching records...</p>
            </div>
          ) : filteredCN.length === 0 ? (
            <div className="p-20 text-center">
              <FaFileInvoiceDollar size={64} className="mx-auto text-gray-100 mb-4" />
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No credit notes found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-black border-b border-slate-100 tracking-wider">
                  <tr>
                    <th className="px-6 py-5 text-left">CN ID</th>
                    <th className="px-6 py-5 text-left">Date</th>
                    <th className="px-6 py-5 text-left">Customer</th>
                    <th className="px-6 py-5 text-center">Items</th>
                    <th className="px-6 py-5 text-right">Amount</th>
                    <th className="px-6 py-5 text-left">Invoice Ref</th>
                    <th className="px-6 py-5 text-center">E-Invoice Status</th>
                    <th className="px-6 py-5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredCN.map((cn) => (
                    <React.Fragment key={cn._id}>
                      <tr className="group hover:bg-indigo-50/30 transition-all cursor-pointer">
                        <td className="px-6 py-5 font-black text-indigo-700 text-sm whitespace-nowrap">{cn.creditNoteId}</td>
                        <td className="px-6 py-5 font-bold text-gray-600 text-[11px] whitespace-nowrap">{formatDate(cn.createdAt)}</td>
                        <td className="px-6 py-5 font-black text-gray-800 text-xs">{cn.customer?.name}</td>
                        <td className="px-6 py-5 text-center">
                            <span className="bg-slate-100 px-2 py-1 rounded-lg text-[10px] font-black text-slate-500">{cn.items?.length || 0} ITEMS</span>
                        </td>
                        <td className="px-6 py-5 text-right font-black text-indigo-700 text-sm">₹{(cn.grandTotal || 0).toLocaleString()}</td>
                        <td className="px-6 py-5">
                            <div className="flex flex-col">
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${cn.originalInvoiceId === 'STANDALONE' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600 uppercase'}`}>
                                    {cn.originalInvoiceId}
                                </span>
                                {cn.originalInvoiceDate && (
                                    <span className="text-[9px] text-gray-400 font-bold ml-1 mt-0.5">
                                        Dt: {new Date(cn.originalInvoiceDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })}
                                    </span>
                                )}
                            </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="flex flex-col gap-1 items-center scale-90">
                            {cn.einvoiceStatus === "GENERATED" ? (
                              <>
                                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-green-200">
                                  ✅ IRN READY
                                </span>
                                <code className="text-[8px] bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-bold truncate w-24" title={cn.irn}>{cn.irn?.substring(0, 12)}...</code>
                              </>
                            ) : (
                              <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-yellow-200">
                                📄 CN PENDING
                              </span>
                            )}
                            {cn.ewayBillNo && (
                              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-blue-200">
                                🚚 EWB READY
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                               onClick={() => handleGenerateEInvoice(cn)}
                               disabled={requestingAction === cn._id}
                               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[10px] font-black border ${cn.einvoiceStatus === "GENERATED" || cn.ewayBillNo
                                 ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-600 hover:text-white"
                                 : "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                               }`}
                            >
                               {requestingAction === cn._id ? <FaSpinner className="animate-spin" /> : (
                                 <>
                                   <FaFileContract size={12} />
                                   {cn.einvoiceStatus === "GENERATED" ? "RE-GENERATE" : "GENERATE E-INV"}
                                 </>
                               )}
                            </button>

                            {cn.einvoiceStatus === "GENERATED" && (
                              <button 
                                onClick={() => setShowEInvoiceModal(cn)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-black transition-all shadow-sm"
                                title="View PDF"
                              >
                                <FaFilePdf size={12} /> PDF
                              </button>
                            )}

                            <button 
                              onClick={() => { setEditCN(cn); setShowModal(true); }}
                              disabled={cn.einvoiceStatus === "GENERATED"}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black transition-all shadow-sm ${cn.einvoiceStatus === "GENERATED" ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-600 hover:text-white'}`}
                              title={cn.einvoiceStatus === "GENERATED" ? "Cannot edit after E-Invoice generation" : "Edit Credit Note"}
                            >
                              EDIT
                            </button>

                            <button 
                              onClick={() => handleLocalPrint(cn)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-600 hover:text-white text-[10px] font-black transition-all shadow-sm"
                              title="Local Formal Print"
                            >
                              <FaPrint size={12} /> PRINT
                            </button>

                            <button 
                              onClick={() => toggleExpand(cn._id)}
                              className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 transition shadow-sm border border-slate-100"
                            >
                                {expandedCN[cn._id] ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
                            </button>
                          </div>
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
                                                <div className="flex flex-col items-center justify-center min-w-[40px] bg-indigo-600 text-white rounded-lg py-1 px-2 shadow-sm">
                                                  <span className="text-[8px] font-black uppercase leading-none mb-0.5">Qty</span>
                                                  <span className="text-sm font-black leading-none">{item.qty || item.returnedQty || 0}</span>
                                                </div>
                                                <span className="font-black text-gray-700 uppercase tracking-tight">{item.name}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                              <span className="font-black text-gray-900">₹{(item.total || 0).toLocaleString()}</span>
                                            </div>
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
        onClose={() => { setShowModal(false); setEditCN(null); }}
        onCreditSuccess={fetchCreditNotes}
        editData={editCN}
        // No customer passed = allow selection in modal
      />

      {/* E-Invoice Document Modal */}
      {showEInvoiceModal && (
        <EInvoicePrintModal 
          invoice={showEInvoiceModal} 
          onClose={() => setShowEInvoiceModal(null)} 
        />
      )}

      {/* Transport Details Modal */}
      {showTransportModal && (
        <TransportDetailsModal 
          invoice={showTransportModal} 
          onClose={() => setShowTransportModal(null)} 
          onConfirm={(details) => handleGenerateEInvoice(showTransportModal, details)}
        />
      )}
    </div>
  );
}

const TransportDetailsModal = ({ invoice, onClose, onConfirm }) => {
  const [details, setDetails] = useState({
    vehicleNo: invoice.vehicleNo || "",
    transportMode: invoice.transportMode || "1",
    transportDistance: invoice.transportDistance || 50,
    vehicleType: invoice.vehicleType || "REGULAR",
    transporterId: invoice.transporterId || "",
    transporterName: invoice.transporterName || ""
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 text-center">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-left">
        <div className="p-6 bg-teal-600 text-white text-center">
          <h3 className="text-xl font-black uppercase tracking-tight flex items-center justify-center gap-2">
            <FaTruck /> Transport Details Required
          </h3>
          <p className="text-xs opacity-90 mt-1 font-bold">Mandatory for E-Way Bill (Value {">"} ₹50,000)</p>
        </div>

        <div className="p-8 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1 font-inter">Transport Mode</label>
              <select
                value={details.transportMode}
                onChange={(e) => setDetails({ ...details, transportMode: e.target.value })}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-teal-500"
              >
                <option value="1">Road</option>
                <option value="2">Rail</option>
                <option value="3">Air</option>
                <option value="4">Ship</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1 font-inter">Vehicle Number</label>
              <input
                type="text"
                placeholder="TN01AB1234"
                value={details.vehicleNo}
                onChange={(e) => setDetails({ ...details, vehicleNo: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() })}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1 font-inter">Distance (approx KM)</label>
              <input
                type="number"
                placeholder="50"
                value={details.transportDistance}
                onChange={(e) => setDetails({ ...details, transportDistance: e.target.value })}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1 font-inter">Vehicle Type</label>
              <select
                value={details.vehicleType}
                onChange={(e) => setDetails({ ...details, vehicleType: e.target.value })}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-teal-500"
              >
                <option value="REGULAR">Regular</option>
                <option value="OVERSIZED">Oversized</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-gray-400 ml-1 font-inter">Transporter GSTIN (Optional)</label>
            <input
              type="text"
              placeholder="33XXXXX..."
              value={details.transporterId}
              onChange={(e) => setDetails({ ...details, transporterId: e.target.value.toUpperCase() })}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-6 border-t border-gray-50">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl font-black text-xs text-gray-400 hover:bg-gray-50 transition"
            >
              CANCEL
            </button>
            <button
              onClick={() => {
                if (!details.vehicleNo) return toast.warning("Vehicle Number is required");
                onConfirm(details);
              }}
              className="flex-1 bg-teal-600 text-white px-6 py-4 rounded-2xl font-black text-xs shadow-xl shadow-teal-100 hover:bg-teal-700 transition"
            >
              GENERATE NOW
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

