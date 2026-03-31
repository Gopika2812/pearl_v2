import React, { useEffect, useState } from "react";
import { FaChevronDown, FaEdit, FaFileAlt, FaFileContract, FaHistory, FaSearch, FaSync, FaTrash } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

const BranchSalesInvoices = () => {
  const { currentBranch, user } = useBranch();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [requestingAction, setRequestingAction] = useState(null); // ID of invoice currently requesting

  // Search debounce logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchInvoices = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      // In this system, Sales Invoices are stored in the "Invoice" collection
      const res = await fetch(
        `${API_BASE}/invoices?branchId=${currentBranch._id}${debouncedSearch ? `&search=${debouncedSearch}` : ""}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch invoices");
      setInvoices(data.data || data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [currentBranch?._id, debouncedSearch]);

  const toggleExpanded = (invoiceId) => {
    setExpandedInvoices((prev) => ({
      ...prev,
      [invoiceId]: !prev[invoiceId],
    }));
  };

  const handleRequestEdit = async (invoice) => {
    if (!window.confirm(`Request Re-Edit for Invoice ${invoice.invoiceNumber}? This will notify admin for approval.`)) {
      return;
    }
    
    setRequestingAction(invoice._id);
    try {
      // Point to parent SO for re-edit request
      const soId = invoice.salesOrderId?._id || invoice.salesOrderId;
      const res = await fetch(`${API_BASE}/sales-orders/${soId}/request-re-edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: user?.username || user?.fullName || "Staff",
          userId: user?.id || user?._id
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Re-Edit request submitted to Admin");
        fetchInvoices();
      } else {
        toast.error(data.message || "Failed to submit request");
      }
    } catch (err) {
      toast.error("Error submitting request");
    } finally {
      setRequestingAction(null);
    }
  };

  const handleRequestCancel = async (invoice) => {
    if (!window.confirm(`Request CANCELLATION for Invoice ${invoice.invoiceNumber}? This requires admin approval.`)) {
      return;
    }

    setRequestingAction(invoice._id);
    try {
      // Point to parent SO for cancel request
      const soId = invoice.salesOrderId?._id || invoice.salesOrderId;
      const res = await fetch(`${API_BASE}/sales-orders/${soId}/request-cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: user?.username || user?.fullName || "Staff",
          userId: user?.id || user?._id
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Cancellation request submitted to Admin");
        fetchInvoices();
      } else {
        toast.error(data.message || "Failed to submit request");
      }
    } catch (err) {
      toast.error("Error submitting request");
    } finally {
      setRequestingAction(null);
    }
  };

  // ✅ GENERATE E-INVOICE FUNCTION
  const handleGenerateEInvoice = async (invoice) => {
    if (invoice.einvoiceStatus === "GENERATED") {
      toast.info("E-Invoice already generated for this invoice");
      return;
    }

    if (!window.confirm(`Generate E-Invoice for ${invoice.invoiceNumber}?\n\nThis will submit to GST Portal and generate IRN + E-Way Bill.`)) {
      return;
    }

    setRequestingAction(invoice._id);
    try {
      const res = await fetch(`${API_BASE}/einvoice/generate/${invoice._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id || user?._id,
          username: user?.username || user?.fullName || "Staff",
          generateEWayBill: invoice.grandTotal > 50000
        })
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`✅ E-Invoice Generated!\nIRN: ${data.data.irn}\nE-Way Bill: ${data.data.ewayBillNo || "Not Required"}`);
        fetchInvoices();
      } else {
        toast.error(`❌ Error: ${data.message || "Failed to generate E-Invoice"}`);
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Error generating E-Invoice: " + err.message);
    } finally {
      setRequestingAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <ToastContainer position="top-right" autoClose={2500} theme="colored" />

      <div className="w-full">
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#319bab] to-blue-700 rounded-xl flex items-center justify-center text-white">
                <FaFileAlt size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Sales Invoice Record</h1>
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Finalized SI Records
                </p>
              </div>
            </div>
            <button
              onClick={fetchInvoices}
              className="flex items-center gap-2 bg-[#319bab] text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition font-black text-xs shadow-lg shadow-blue-200"
            >
              <FaSync className={loading ? "animate-spin" : ""} /> REFRESH LIST
            </button>
          </div>
        </div>

        {/* SEARCH */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 relative">
          <FaSearch className="absolute left-8 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            placeholder="Search by Invoice ID (SI...), Customer, or Order Ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-[#319bab] text-sm font-medium"
          />
        </div>

        {/* TABLE */}
        {loading ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-dashed border-gray-200 text-gray-400 font-bold">
             <FaSync className="animate-spin inline-block mr-2" /> Loadingized SI records...
          </div>
        ) : invoices.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-dashed border-gray-200 text-gray-400 font-bold">
             No finalized Sales Invoices found in this branch.
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black border-b tracking-wider">
                  <tr>
                    <th className="px-6 py-5 text-left">Invoice ID (SI)</th>
                    <th className="px-6 py-5 text-left">Order Ref (SO)</th>
                    <th className="px-6 py-5 text-left">Customer Details</th>
                    <th className="px-6 py-5 text-right">Grand Total</th>
                    <th className="px-6 py-5 text-center">E-Invoice Status</th>
                    <th className="px-6 py-5 text-center">Status</th>
                    <th className="px-6 py-5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv) => (
                    <React.Fragment key={inv._id}>
                      <tr className="hover:bg-blue-50/30 transition group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <button
                               onClick={() => toggleExpanded(inv._id)}
                               className="text-[#319bab] p-2 hover:bg-white rounded-lg shadow-sm transition-all"
                            >
                              <FaChevronDown className={`transition-transform duration-300 ${expandedInvoices[inv._id] ? "rotate-180" : ""}`} />
                            </button>
                            <span className="font-black text-[#319bab] tracking-tight">{inv.invoiceNumber}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-[10px] font-black bg-gray-100 text-gray-600 px-2 py-1 rounded">
                             SO REF: {inv.salesOrderId?.invoiceId || "N/A"}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                            <div className="font-black text-gray-800 text-xs">{inv.customer?.name}</div>
                            <div className="text-[10px] text-gray-500 font-bold">{inv.customer?.whatsapp || "No Contact"}</div>
                        </td>
                        <td className="px-6 py-5 text-right font-black text-blue-700 tracking-tight text-base">
                           ₹{(inv.grandTotal || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-5 text-center">
                           {inv.einvoiceStatus === "GENERATED" ? (
                             <div className="flex flex-col items-center gap-1">
                               <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                                  ✅ Validated
                               </span>
                               <code className="text-[8px] bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-bold">{inv.irn?.substring(0, 8)}...</code>
                             </div>
                           ) : inv.einvoiceStatus === "FAILED" ? (
                             <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                                ❌ Failed
                             </span>
                           ) : (
                             <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                                📄 Pending
                             </span>
                           )}
                        </td>
                        <td className="px-6 py-5 text-center">
                           {inv.salesOrderId?.reEditRequestStatus === "PENDING" ? (
                             <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                                Re-Edit Requested
                             </span>
                           ) : inv.salesOrderId?.cancelRequestStatus === "PENDING" ? (
                             <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                                Cancellation Requested
                             </span>
                           ) : (
                             <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                Finalized
                             </span>
                           )}
                        </td>
                        <td className="px-6 py-4 text-center">
                           <div className="flex items-center gap-2 justify-center flex-wrap">
                              {/* ✅ GENERATE E-INVOICE BUTTON */}
                              <button
                                onClick={() => handleGenerateEInvoice(inv)}
                                disabled={requestingAction === inv._id || inv.einvoiceStatus === "GENERATED"}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[10px] font-black border ${
                                  inv.einvoiceStatus === "GENERATED"
                                    ? "bg-green-100 text-green-700 border-green-200 cursor-default"
                                    : "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-600 hover:text-white"
                                }`}
                                title={inv.einvoiceStatus === "GENERATED" ? `IRN: ${inv.irn}` : "Submit to GST Portal"}
                              >
                                {requestingAction === inv._id ? (
                                  <FaSync className="animate-spin" />
                                ) : inv.einvoiceStatus === "GENERATED" ? (
                                  <>✅ E-INVOICE</>
                                ) : (
                                  <>
                                    <FaFileContract />
                                    E-INVOICE
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() => handleRequestEdit(inv)}
                                disabled={requestingAction === inv._id || inv.salesOrderId?.reEditRequestStatus === "PENDING"}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[10px] font-black border ${
                                  inv.salesOrderId?.reEditRequestStatus === "PENDING"
                                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                    : "bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-600 hover:text-white"
                                }`}
                              >
                                {requestingAction === inv._id ? <FaSync className="animate-spin" /> : <FaEdit />}
                                RE-EDIT
                              </button>
                              <button
                                onClick={() => handleRequestCancel(inv)}
                                disabled={requestingAction === inv._id || inv.salesOrderId?.cancelRequestStatus === "PENDING"}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[10px] font-black border ${
                                  inv.salesOrderId?.cancelRequestStatus === "PENDING"
                                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                    : "bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white"
                                }`}
                              >
                                {requestingAction === inv._id ? <FaSync className="animate-spin" /> : <FaTrash />}
                                CANCEL
                              </button>
                           </div>
                        </td>
                      </tr>

                      {/* EXPANDED SECTION */}
                      {expandedInvoices[inv._id] && (
                        <tr className="bg-blue-50/20 animate-in fade-in slide-in-from-top-2">
                          <td colSpan="6" className="px-8 py-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                               <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-50">
                                 <h4 className="font-black text-[10px] uppercase text-gray-400 mb-4 tracking-widest flex items-center gap-2">
                                    <FaFileAlt className="text-blue-500" /> Billed Items
                                 </h4>
                                 <table className="w-full text-[11px]">
                                   <thead className="border-b border-gray-100">
                                     <tr className="text-gray-400 font-black">
                                       <th className="text-left py-3">DESCRIPTION</th>
                                       <th className="text-center py-3">QTY</th>
                                       <th className="text-right py-3">TOTAL</th>
                                     </tr>
                                   </thead>
                                   <tbody>
                                     {inv.items.map((item, idx) => (
                                       <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
                                         <td className="py-3 font-bold text-gray-700">{item.name}</td>
                                         <td className="py-3 text-center font-black text-blue-600 bg-blue-50/50 rounded-lg">{item.qty}</td>
                                         <td className="py-3 text-right font-black text-gray-800">₹{item.total?.toLocaleString()}</td>
                                       </tr>
                                     ))}
                                   </tbody>
                                 </table>
                               </div>

                               <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-50">
                                 <h4 className="font-black text-[10px] uppercase text-gray-400 mb-4 tracking-widest flex items-center gap-2">
                                    <FaHistory className="text-blue-500" /> Administrative Info
                                 </h4>
                                 <div className="space-y-4 text-xs">
                                    <div className="flex justify-between border-b border-gray-50 pb-2">
                                       <span className="text-gray-500 font-bold">Billing Person</span>
                                       <span className="font-black text-gray-800">{inv.billingPerson || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-50 pb-2">
                                       <span className="text-gray-500 font-bold">Invoice Date</span>
                                       <span className="font-black text-gray-800">{new Date(inv.invoiceDate || inv.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-50 pb-2">
                                       <span className="text-gray-500 font-bold">Financial Year</span>
                                       <span className="font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{inv.financialYear || "2025-26"}</span>
                                    </div>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default BranchSalesInvoices;
