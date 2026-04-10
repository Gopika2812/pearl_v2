import React, { useEffect, useState } from "react";
import { FaChevronDown, FaEdit, FaFileAlt, FaFileContract, FaHistory, FaSearch, FaSync, FaTrash } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import EInvoicePrintModal from "../../components/branch/EInvoicePrintModal";
import { useBranch } from "../../context/BranchContext";

const BranchSalesInvoices = () => {
  const { currentBranch, user } = useBranch();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [requestingAction, setRequestingAction] = useState(null); // ID of invoice currently requesting
  const [showEInvoiceModal, setShowEInvoiceModal] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(null); // Invoice to be cancelled
  const [cancelReason, setCancelReason] = useState("");

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
      const res = await fetchWithAuth(
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
      const res = await fetchWithAuth(`${API_BASE}/sales-orders/${soId}/request-re-edit`, {
        method: "PATCH",
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
      const res = await fetchWithAuth(`${API_BASE}/sales-orders/${soId}/request-cancel`, {
        method: "PATCH",
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

  const handleDirectCancel = async () => {
    if (!showCancelModal || !cancelReason.trim()) return;

    setRequestingAction(showCancelModal._id);
    try {
      const res = await fetchWithAuth(`${API_BASE}/invoices/${showCancelModal._id}/cancel`, {
        method: "PUT",
        body: JSON.stringify({
          reason: cancelReason,
          cancelledBy: user?.username || user?.fullName || "Staff"
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("✅ Invoice cancelled. Stock & Balance reverted.");
        setShowCancelModal(null);
        setCancelReason("");
        fetchInvoices();
      } else {
        toast.error(data.message || "Failed to cancel invoice");
      }
    } catch (err) {
      toast.error("Error cancelling invoice");
    } finally {
      setRequestingAction(null);
    }
  };

  // ✅ GENERATE E-INVOICE FUNCTION
  const handleGenerateEInvoice = async (invoice, transportDetails = null) => {
    // 🚀 Check if transport details are required (>10k and not provided yet)
    if (invoice.grandTotal > 10000 && !transportDetails && !invoice.ewayBillNo) {
      setShowTransportModal(invoice);
      return;
    }

    if (!transportDetails && !window.confirm(`Generate E-Invoice for ${invoice.invoiceNumber}?`)) {
      return;
    }

    setRequestingAction(invoice._id);
    try {
      const res = await fetchWithAuth(`${API_BASE}/einvoice/generate/${invoice._id}`, {
        method: "POST",
        body: JSON.stringify({
          userId: user?.id || user?._id,
          username: user?.username || user?.fullName || "Staff",
          transportDetails: transportDetails
        })
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`✅ E-Invoice ${data.ewayBillNo ? "& E-Way Bill " : ""}Generated Successfully`);
        setShowTransportModal(null);
        fetchInvoices();
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


  // 🚚 GENERATE E-WAY BILL ONLY (POST-IRN)
  const handleGenerateEWayBillOnly = async (invoice, transportDetails = null) => {
    if (!transportDetails) {
      setShowTransportModal({ ...invoice, isEwbOnly: true });
      return;
    }

    setRequestingAction(invoice._id);
    try {
      const res = await fetchWithAuth(`${API_BASE}/einvoice/generate-ewb-only/${invoice._id}`, {
        method: "POST",
        body: JSON.stringify({ transportDetails })
      });

      const data = await res.json();

      if (data.success) {
        toast.success("✅ E-Way Bill Generated Successfully");
        setShowTransportModal(null);
        fetchInvoices();
      } else {
        toast.error(`❌ Error: ${data.message || "Failed to generate E-Way Bill"}`);
      }
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setRequestingAction(null);
    }
  };

  const [showTransportModal, setShowTransportModal] = useState(null);

  // 🚚 TRANSPORT DETAILS MODAL COMPONENT
  const TransportDetailsModal = ({ invoice, onClose, onConfirm }) => {
    const isEwbOnly = invoice.isEwbOnly;
    const [details, setDetails] = useState({
      vehicleNo: invoice.vehicleNo || "",
      transportMode: invoice.transportMode || "1",
      transportDistance: invoice.transportDistance || 50, // Default to 50 for safety
      vehicleType: invoice.vehicleType || "REGULAR",
      transporterId: invoice.transporterId || "",
      transporterName: invoice.transporterName || ""
    });

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          <div className={`p-6 text-white text-center ${isEwbOnly ? "bg-blue-600" : "bg-[#319bab]"}`}>
            <h3 className="text-xl font-black uppercase tracking-tight flex items-center justify-center gap-2">
              <FaFileContract /> {isEwbOnly ? "Generate E-Way Bill" : "Transport Details Required"}
            </h3>
            <p className="text-xs opacity-90 mt-1 font-bold">
              {isEwbOnly ? "IRN is already generated. Now creating the E-Way Bill." : "Mandatory for E-Way Bill (Invoice > ₹10,000)"}
            </p>
          </div>

          <div className="p-8 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Transport Mode</label>
                <select
                  value={details.transportMode}
                  onChange={(e) => setDetails({ ...details, transportMode: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-[#319bab]"
                >
                  <option value="1">Road</option>
                  <option value="2">Rail</option>
                  <option value="3">Air</option>
                  <option value="4">Ship</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Vehicle Number</label>
                <input
                  type="text"
                  placeholder="TN01AB1234"
                  value={details.vehicleNo}
                  onChange={(e) => setDetails({ ...details, vehicleNo: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() })}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-[#319bab]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Distance (approx KM)</label>
                <input
                  type="number"
                  placeholder="50"
                  value={details.transportDistance}
                  onChange={(e) => setDetails({ ...details, transportDistance: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-[#319bab]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Vehicle Type</label>
                <select
                  value={details.vehicleType}
                  onChange={(e) => setDetails({ ...details, vehicleType: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-[#319bab]"
                >
                  <option value="REGULAR">Regular</option>
                  <option value="OVERSIZED">Oversized</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Transporter GSTIN (Optional)</label>
              <input
                type="text"
                placeholder="33XXXXX..."
                value={details.transporterId}
                onChange={(e) => setDetails({ ...details, transporterId: e.target.value.toUpperCase() })}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-[#319bab]"
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
                className={`flex-1 text-white px-6 py-4 rounded-2xl font-black text-xs shadow-xl transition ${isEwbOnly ? "bg-blue-600 shadow-blue-100 hover:bg-blue-700" : "bg-[#319bab] shadow-blue-100 hover:bg-blue-700"}`}
              >
                {isEwbOnly ? "GENERATE E-WAY BILL" : "GENERATE NOW"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 🔴 CANCEL INVOICE MODAL
  const CancelInvoiceModal = ({ invoice, onClose, onConfirm }) => {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="p-6 bg-red-600 text-white text-center">
            <h3 className="text-xl font-black uppercase tracking-tight flex items-center justify-center gap-2">
              <FaTrash /> Cancel Invoice
            </h3>
            <p className="text-xs opacity-90 mt-1 font-bold">
              This will revert stock and customer balance.
            </p>
          </div>

          <div className="p-8 space-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Cancel Narration (Mandatory)</label>
              <textarea
                placeholder="Enter reason for cancellation..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-red-500 min-h-[100px]"
              />
            </div>

            <div className="flex items-center gap-3 pt-6 border-t border-gray-50">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-4 rounded-2xl font-black text-xs text-gray-400 hover:bg-gray-50 transition"
              >
                NO, KEEP IT
              </button>
              <button
                onClick={onConfirm}
                disabled={!cancelReason.trim()}
                className="flex-1 bg-red-600 text-white px-6 py-4 rounded-2xl font-black text-xs shadow-xl shadow-red-100 hover:bg-red-700 transition disabled:opacity-50"
              >
                YES, CANCEL NOW
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <ToastContainer position="top-right" autoClose={2500} theme="colored" />

      {showTransportModal && (
        <TransportDetailsModal
          invoice={showTransportModal}
          onClose={() => setShowTransportModal(null)}
          onConfirm={(details) => {
            if (showTransportModal.isEwbOnly) {
              handleGenerateEWayBillOnly(showTransportModal, details);
            } else {
              handleGenerateEInvoice(showTransportModal, details);
            }
          }}
        />
      )}

      {/* 📄 UNIFIED E-INVOICE PRINT MODAL */}
      {showEInvoiceModal && (
        <EInvoicePrintModal
          invoice={showEInvoiceModal}
          onClose={() => setShowEInvoiceModal(null)}
        />
      )}

      {showCancelModal && (
        <CancelInvoiceModal
          invoice={showCancelModal}
          onClose={() => setShowCancelModal(null)}
          onConfirm={handleDirectCancel}
        />
      )}

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
                          <div className="flex flex-col gap-2 scale-90">
                            {/* E-INVOICE BADGE */}
                            {inv.einvoiceStatus === "GENERATED" ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-green-200">
                                  ✅ IRN READY
                                </span>
                                <code className="text-[8px] bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-bold truncate w-24" title={inv.irn}>{inv.irn?.substring(0, 12)}...</code>
                              </div>
                            ) : (
                              <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-yellow-200">
                                📄 SI PENDING
                              </span>
                            )}

                            {/* E-WAY BILL BADGE */}
                            {inv.ewayBillNo ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-blue-200">
                                  🚚 EWB READY
                                </span>
                                <code className="text-[8px] bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-bold">{inv.ewayBillNo}</code>
                              </div>
                            ) : inv.grandTotal > 10000 ? (
                              <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-orange-200">
                                📦 EWB REQD
                              </span>
                            ) : null}
                          </div>
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
                            {/* ✅ GENERATE E-WAY BILL ONLY BUTTON (Visible if E-Invoice exists but E-Way Bill missing for >50k) */}
                            {inv.einvoiceStatus === "GENERATED" && !inv.ewayBillNo && inv.grandTotal > 10000 && (
                              <button
                                onClick={() => handleGenerateEWayBillOnly(inv)}
                                disabled={requestingAction === inv._id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white text-[10px] font-black transition-all"
                                title="Only generate E-Way Bill"
                              >
                                {requestingAction === inv._id ? <FaSync className="animate-spin" /> : <><FaSync /> GEN EWB</>}
                              </button>
                            )}

                            {/* ✅ GENERATE E-INVOICE / E-WAY BILL BUTTON */}
                            <button
                              onClick={() => handleGenerateEInvoice(inv)}
                              disabled={requestingAction === inv._id}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[10px] font-black border ${inv.einvoiceStatus === "GENERATED" || inv.ewayBillNo
                                  ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-600 hover:text-white"
                                  : "bg-[#319bab] text-white border-[#319bab] hover:bg-blue-700"
                                }`}
                              title={(!inv.customer?.gstin || inv.customer?.gstin === "URP") ? "Generate Standalone E-Way Bill (B2C)" : "Generate E-Invoice & E-Way Bill (B2B)"}
                            >
                              {requestingAction === inv._id ? (
                                <FaSync className="animate-spin" />
                              ) : (
                                <>
                                  {(!inv.customer?.gstin || inv.customer?.gstin === "URP") ? <FaSync /> : <FaFileContract />}
                                  {inv.einvoiceStatus === "GENERATED" || inv.ewayBillNo
                                    ? "RE-GENERATE"
                                    : ((!inv.customer?.gstin || inv.customer?.gstin === "URP") ? "GEN E-WAY BILL" : "GENERATE E-INV")}
                                </>
                              )}
                            </button>

                            {/* SEPARATE DOWNLOAD BUTTONS */}
                            {inv.einvoiceStatus === "GENERATED" && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setShowEInvoiceModal(inv)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#319bab] text-white border border-[#319bab] hover:bg-blue-600 text-[10px] font-black transition-all shadow-sm"
                                  title="View/Print Custom E-Invoice"
                                >
                                  <FaFileAlt /> PDF
                                </button>
                                {inv.ewayBillPdfUrl && (
                                  <a
                                    href={`${import.meta.env.VITE_GSTZEN_DOMAIN || "https://my.gstzen.in"}${inv.ewayBillPdfUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 text-[10px] font-black transition-all shadow-sm"
                                    title="Download E-Way Bill (Portal PDF)"
                                  >
                                    🚚 EWB
                                  </a>
                                )}
                              </div>
                            )}

                            <button
                              onClick={() => handleRequestEdit(inv)}
                              disabled={requestingAction === inv._id || inv.status === "CANCELLED"}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[10px] font-black border bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-600 hover:text-white disabled:opacity-50"
                            >
                              {requestingAction === inv._id ? <FaSync className="animate-spin" /> : <FaEdit />}
                              RE-EDIT
                            </button>

                            <button
                              onClick={() => {
                                setCancelReason("");
                                setShowCancelModal(inv);
                              }}
                              disabled={requestingAction === inv._id || inv.status === "CANCELLED"}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[10px] font-black border bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white disabled:opacity-50"
                              title="Cancel Invoice and revert Stock/Balance"
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
                                        <td className="py-3 text-center font-black text-blue-600 bg-blue-50/50 rounded-lg">{item.qty} {item.unit || "Units"} {item.altQty > 0 && `(${item.altQty} ${item.altUnit})`}</td>
                                        <td className="py-3 text-right font-black text-gray-800">₹{item.total?.toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>

                                {/* 📊 DYNAMIC TAX SUMMARY (RECALCULATED FOR DISPLAY) */}
                                <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-100 space-y-2">
                                  {(() => {
                                    let cgst = 0, sgst = 0, igst = 0;
                                    let hasIgst = false;

                                    // 1. Items Tax
                                    (inv.items || []).forEach(item => {
                                      const taxable = (item.sellingPrice * item.qty) - (item.discountAmount || 0);
                                      if (item.igst) {
                                        igst += (taxable * (item.gst || 0)) / 100;
                                        hasIgst = true;
                                      } else {
                                        cgst += (taxable * (item.cgst || 0)) / 100;
                                        sgst += (taxable * (item.sgst || 0)) / 100;
                                      }
                                    });

                                    // 2. Transport GST Merge
                                    const tGst = (inv.transportCharge * (inv.transportGstPercent || 18)) / 100;
                                    if (hasIgst) igst += tGst;
                                    else { cgst += tGst / 2; sgst += tGst / 2; }

                                    return hasIgst ? (
                                      <div className="flex justify-between text-[11px] font-black text-blue-600">
                                        <span>COMMON IGST (Merged)</span>
                                        <span>₹{igst.toFixed(2)}</span>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex justify-between text-[11px] font-black text-blue-600">
                                          <span>COMMON CGST (Merged)</span>
                                          <span>₹{cgst.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-[11px] font-black text-blue-600">
                                          <span>COMMON SGST (Merged)</span>
                                          <span>₹{sgst.toFixed(2)}</span>
                                        </div>
                                      </>
                                    );
                                  })()}
                                  {inv.transportCharge > 0 && (
                                    <div className="flex justify-between text-[11px] font-bold text-orange-600">
                                      <span>TRANSPORT CHARGE</span>
                                      <span>₹{(inv.transportCharge || 0).toFixed(2)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-50">
                                <h4 className="font-black text-[10px] uppercase text-gray-400 mb-4 tracking-widest flex items-center gap-2">
                                  <FaHistory className="text-blue-500" /> Administrative Info
                                </h4>
                                <div className="space-y-4 text-xs">
                                  <div className="flex justify-between border-b border-gray-50 pb-2 text-[11px]">
                                    <span className="text-gray-500 font-bold uppercase tracking-tighter">Subtotal</span>
                                    <span className="font-black text-gray-800">₹{(inv.subtotal || 0).toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between border-b border-gray-50 pb-2">
                                    <span className="text-gray-500 font-bold">Billing Person</span>
                                    <span className="font-black text-gray-800">{inv.billingPerson || "N/A"}</span>
                                  </div>
                                  <div className="flex justify-between border-b border-gray-50 pb-2">
                                    <span className="text-gray-500 font-bold">Invoice Date</span>
                                    <span className="font-black text-gray-800">{new Date(inv.invoiceDate || inv.createdAt).toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between border-b border-gray-50 pb-2 pt-2">
                                    <span className="text-[#319bab] font-black text-sm uppercase">Grand Total</span>
                                    <span className="font-black text-blue-700 text-sm">₹{(inv.grandTotal || 0).toLocaleString()}</span>
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
