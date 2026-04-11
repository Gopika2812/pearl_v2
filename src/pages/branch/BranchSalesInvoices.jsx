import React, { useEffect, useState } from "react";
import { FaChevronDown, FaFileAlt, FaFileContract, FaHistory, FaSearch, FaSync, FaTrash } from "react-icons/fa";
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
  const [filterFromDate, setFilterFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [filterToDate, setFilterToDate] = useState(new Date().toISOString().split("T")[0]);
  const [fetchingDetails, setFetchingDetails] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [filterVoucherPrefix, setFilterVoucherPrefix] = useState("");
  const [filterEinvoiceStatus, setFilterEinvoiceStatus] = useState("");

  // 🌍 Helper to format date in Indian Standard Time (IST)
  const formatIST = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

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
      // Build query string
      let url = `${API_BASE}/invoices?branchId=${currentBranch._id}&page=${currentPage}`;
      
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (filterFromDate) url += `&fromDate=${filterFromDate}`;
      if (filterToDate) url += `&toDate=${filterToDate}`;
      if (filterVoucherPrefix) url += `&vPrefix=${encodeURIComponent(filterVoucherPrefix)}`;
      if (filterEinvoiceStatus) url += `&einvoiceStatus=${filterEinvoiceStatus}`;

      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch invoices");
      setInvoices(data.data || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [currentBranch?._id, debouncedSearch, filterFromDate, filterToDate, filterVoucherPrefix, filterEinvoiceStatus, currentPage]);

  const fetchVoucherTypes = async () => {
    if (!currentBranch?._id) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/voucher-types?branchId=${currentBranch._id}`);
      const data = await res.json();
      if (data.success) {
        // Filter only Sales Invoice (SI) types
        const siTypes = (data.data || []).filter(v => v.orderType === "SI");
        setVoucherTypes(siTypes);
      }
    } catch (err) {
      console.error("Error fetching voucher types:", err);
    }
  };

  useEffect(() => {
    fetchVoucherTypes();
  }, [currentBranch?._id]);

  const toggleExpanded = async (invoiceId) => {
    const isExpanding = !expandedInvoices[invoiceId];
    
    // Toggle first
    setExpandedInvoices((prev) => ({
      ...prev,
      [invoiceId]: isExpanding,
    }));

    // If expanding and items are missing (due to Thin Fetching), fetch them now!
    if (isExpanding) {
        const inv = invoices.find(i => i._id === invoiceId);
        if (inv && (!inv.items || inv.items.length === 0)) {
            setFetchingDetails(prev => ({ ...prev, [invoiceId]: true }));
            try {
                const res = await fetchWithAuth(`${API_BASE}/invoices/${invoiceId}`);
                const data = await res.json();
                
                // Allow both wrapped {success, data} and direct object response
                const invoiceData = data.success ? data.data : data;
                
                if (invoiceData && invoiceData.items) {
                    // Update the local invoices array with the full data
                    setInvoices(prev => prev.map(i => i._id === invoiceId ? invoiceData : i));
                }
            } catch (err) {
                console.error("Failed to fetch invoice details:", err);
                toast.error("Failed to load invoice items");
            } finally {
                setFetchingDetails(prev => ({ ...prev, [invoiceId]: false }));
            }
        }
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


  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <ToastContainer
        position="top-right"
        autoClose={2500}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="colored"
      />

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
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
        />
      )}

      <div className="w-full mx-auto px-4 sm:px-8 py-4">
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                <FaHistory className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800">
                  Sales Invoices
                  <span className="text-indigo-600 ml-1">History</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Manage & Monitor branch-level realizations
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Date Range</p>
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 font-black text-xs text-slate-600">
                  <span>{new Date(filterFromDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  <span className="text-slate-300">to</span>
                  <span>{new Date(filterToDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                </div>
              </div>
              <button
                onClick={fetchInvoices}
                className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-50 transition shadow-sm"
              >
                <FaSync className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>

        {/* FILTERS & SEARCH */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Search History</label>
              <div className="relative group">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Invoice ID, Customer name..."
                  className="w-full bg-slate-50/50 border border-slate-100 rounded-xl pl-11 pr-4 py-3 text-sm font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1); // Reset to page 1 on search
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Voucher Prefix</label>
              <select
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all outline-none"
                value={filterVoucherPrefix}
                onChange={(e) => {
                    setFilterVoucherPrefix(e.target.value);
                    setCurrentPage(1);
                }}
              >
                <option value="">ALL SERIES</option>
                {voucherTypes.map((v) => (
                  <option key={v._id} value={v.prefix}> {v.name.toUpperCase()} SERIES </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">E-Inv Status</label>
              <select
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all outline-none"
                value={filterEinvoiceStatus}
                onChange={(e) => setFilterEinvoiceStatus(e.target.value)}
              >
                <option value="">ALL STATUS</option>
                <option value="NOT_GENERATED">PENDING</option>
                <option value="GENERATED">IRN READY</option>
                <option value="FAILED">FAILED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">From</label>
              <input
                type="date"
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-black focus:bg-white focus:border-indigo-500 transition-all outline-none"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">To Date</label>
              <input
                type="date"
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-black focus:bg-white focus:border-indigo-500 transition-all outline-none"
                value={filterToDate}
                onChange={(e) => {
                    setFilterToDate(e.target.value);
                    setCurrentPage(1);
                }}
              />
            </div>
          </div>

          {(debouncedSearch || filterVoucherPrefix || filterEinvoiceStatus) && (
            <div className="mt-4 flex items-center gap-2">
              <div className="animate-pulse w-2 h-2 bg-indigo-500 rounded-full"></div>
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Advanced Search Active: Defaulting to all-time match</span>
            </div>
          )}
        </div>

        {/* DATA SECTION */}
        {loading ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-dashed border-gray-200 text-gray-400 font-bold">
            <div className="flex flex-col items-center gap-3">
              <FaSync className="animate-spin text-4xl text-indigo-500" />
              <p className="uppercase tracking-widest text-[11px] font-black">Fetching SI Records...</p>
            </div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-dashed border-gray-200 text-gray-400 font-bold">
            No finalized Sales Invoices found for this period.
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-black border-b border-slate-100 tracking-wider">
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
                <tbody className="divide-y divide-slate-50">
                  {invoices.map((inv) => (
                    <React.Fragment key={inv._id}>
                      <tr className="hover:bg-indigo-50/30 transition group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleExpanded(inv._id)}
                              className="text-indigo-600 p-2 hover:bg-white rounded-lg shadow-sm transition-all border border-transparent hover:border-indigo-100"
                            >
                              <FaChevronDown className={`transition-transform duration-300 ${expandedInvoices[inv._id] ? "rotate-180" : ""}`} />
                            </button>
                            <span className="font-black text-indigo-700 tracking-tight">{inv.invoiceNumber}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-1 rounded">
                            SO REF: {inv.salesOrderId?.invoiceId || "N/A"}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-black text-slate-800 text-xs">{inv.customer?.name}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">{inv.customer?.whatsapp || "No Contact"}</div>
                        </td>
                        <td className="px-6 py-5 text-right font-black text-indigo-700 tracking-tight text-base">
                          ₹{(inv.grandTotal || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="flex flex-col gap-2 scale-90">
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
                            {inv.einvoiceStatus === "GENERATED" && !inv.ewayBillNo && inv.grandTotal > 10000 && (
                              <button
                                onClick={() => handleGenerateEWayBillOnly(inv)}
                                disabled={requestingAction === inv._id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white text-[10px] font-black transition-all"
                              >
                                {requestingAction === inv._id ? <FaSync className="animate-spin" /> : <><FaSync size={12} /> GEN EWB</>}
                              </button>
                            )}
                            <button
                              onClick={() => handleGenerateEInvoice(inv)}
                              disabled={requestingAction === inv._id}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[10px] font-black border ${inv.einvoiceStatus === "GENERATED" || inv.ewayBillNo
                                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-600 hover:text-white"
                                : "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                                }`}
                            >
                              {requestingAction === inv._id ? <FaSync className="animate-spin" /> : (
                                <>
                                  {(!inv.customer?.gstin || inv.customer?.gstin === "URP") ? <FaSync size={12} /> : <FaFileContract size={12} />}
                                  {inv.einvoiceStatus === "GENERATED" || inv.ewayBillNo ? "RE-GENERATE" : ((!inv.customer?.gstin || inv.customer?.gstin === "URP") ? "GEN E-WAY BILL" : "GENERATE E-INV")}
                                </>
                              )}
                            </button>
                            {inv.einvoiceStatus === "GENERATED" && (
                              <div className="flex gap-1">
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    let fullInv = inv;
                                    if (!inv.items || inv.items.length === 0) {
                                      try {
                                        setFetchingDetails(prev => ({ ...prev, [inv._id]: true }));
                                        const res = await fetchWithAuth(`${API_BASE}/invoices/${inv._id}`);
                                        const data = await res.json();
                                        fullInv = data.success ? data.data : data;
                                        // Also update main list so we don't have to fetch again
                                        setInvoices(prev => prev.map(i => i._id === inv._id ? fullInv : i));
                                      } catch (err) {
                                        toast.error("Failed to load full invoice details");
                                        return;
                                      } finally {
                                        setFetchingDetails(prev => ({ ...prev, [inv._id]: false }));
                                      }
                                    }
                                    setShowEInvoiceModal(fullInv);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white border border-indigo-600 hover:bg-indigo-700 text-[10px] font-black transition-all shadow-sm"
                                  disabled={fetchingDetails[inv._id]}
                                >
                                  {fetchingDetails[inv._id] ? <FaSync className="animate-spin" size={12} /> : <FaFileAlt size={12} />}
                                  PDF
                                </button>
                                {inv.ewayBillPdfUrl && (
                                  <a
                                    href={`${import.meta.env.VITE_GSTZEN_DOMAIN || "https://my.gstzen.in"}${inv.ewayBillPdfUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 text-[10px] font-black transition-all shadow-sm"
                                  >
                                    🚚 EWB
                                  </a>
                                )}
                              </div>
                            )}
                            <button
                              onClick={() => {
                                setCancelReason("");
                                setShowCancelModal(inv);
                              }}
                              disabled={requestingAction === inv._id || inv.status === "CANCELLED"}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[10px] font-black border bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white disabled:opacity-50"
                            >
                              {requestingAction === inv._id ? <FaSync className="animate-spin" /> : <FaTrash size={12} />}
                              CANCEL
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedInvoices[inv._id] && (
                        <tr className="bg-indigo-50/20 animate-in fade-in slide-in-from-top-2">
                          <td colSpan="7" className="px-8 py-6">
                            {fetchingDetails[inv._id] ? (
                              <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-indigo-200">
                                <FaSync className="animate-spin text-3xl text-indigo-500 mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Loading Items Details...</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-50">
                                  <h4 className="font-black text-[10px] uppercase text-slate-400 mb-4 tracking-widest flex items-center gap-2">
                                    <FaFileAlt className="text-indigo-500" /> Billed Items
                                  </h4>
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-slate-400 font-black border-b border-slate-50">
                                        <th className="text-left py-3">DESCRIPTION</th>
                                        <th className="text-center py-3">QTY</th>
                                        <th className="text-right py-3">TOTAL</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(inv.items || []).map((item, idx) => (
                                        <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition">
                                          <td className="py-3 font-bold text-slate-700">{item.name}</td>
                                          <td className="py-3 text-center font-black text-indigo-600 bg-indigo-50/50 rounded-lg">{item.qty} {item.unit || "Units"}</td>
                                          <td className="py-3 text-right font-black text-slate-800">₹{(item.total || 0).toLocaleString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-50 flex flex-col justify-between">
                                  <div>
                                    <h4 className="font-black text-[10px] uppercase text-slate-400 mb-4 tracking-widest flex items-center gap-2">
                                      <FaHistory className="text-indigo-500" /> Administrative Info
                                    </h4>
                                    <div className="space-y-3 text-xs">
                                      <div className="flex justify-between border-b border-slate-50 pb-2">
                                        <span className="text-slate-500 font-bold uppercase tracking-tighter">Subtotal</span>
                                        <span className="font-black text-slate-800">₹{(inv.subtotal || 0).toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between border-b border-slate-50 pb-2">
                                        <span className="text-slate-500 font-bold uppercase tracking-tighter">Generated At</span>
                                        <span className="font-black text-slate-800">{formatIST(inv.createdAt || inv.invoiceDate)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-500 font-bold uppercase tracking-tighter">Inventory Date</span>
                                        <span className="font-black text-slate-800">{new Date(inv.invoiceDate).toLocaleDateString("en-IN")}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-6 p-4 bg-indigo-50 rounded-xl flex items-center justify-between border border-indigo-100">
                                    <span className="text-indigo-900 font-black text-sm uppercase tracking-tighter">Grand Total</span>
                                    <span className="font-black text-indigo-700 text-xl tracking-tight">₹{(inv.grandTotal || 0).toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                            )}
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

        {/* PAGINATION CONTROLS */}
        {!loading && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-4 py-8">
                <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 font-black text-xs hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    PREVIOUS
                </button>
                <div className="flex items-center gap-1">
                    {[...Array(pagination.pages)].map((_, i) => {
                        const pageNum = i + 1;
                        // Only show first, last, and pages around current
                        if (pageNum === 1 || pageNum === pagination.pages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${
                                        currentPage === pageNum 
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                                        : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                            return <span key={pageNum} className="text-slate-300 px-1">...</span>;
                        }
                        return null;
                    })}
                </div>
                <button
                    onClick={() => setCurrentPage(prev => Math.min(pagination.pages, prev + 1))}
                    disabled={currentPage === pagination.pages}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 font-black text-xs hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    NEXT
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

// 🚚 TRANSPORT DETAILS MODAL COMPONENT (Defined outside to prevent re-mounting/input lag)
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

// 🔴 CANCEL INVOICE MODAL (Defined outside to prevent re-mounting/input lag)
const CancelInvoiceModal = ({ invoice, onClose, onConfirm, cancelReason, setCancelReason }) => {
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

export default BranchSalesInvoices;
