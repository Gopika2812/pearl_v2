import React, { useEffect, useState } from "react";
import { FaHistory, FaSearch, FaSync, FaTruck, FaCheckCircle, FaUser, FaCommentDots, FaMapMarkerAlt, FaChevronDown, FaBoxOpen, FaClipboardCheck, FaUndo } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import FilterableSelect from "../../components/FilterableSelect";
import { getInvoiceHTML } from "../../utils/invoiceUtils";

const BranchDeliveryFlow = () => {
  const { currentBranch, user } = useBranch();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL"); // ALL, PENDING, PICKED, COMPLETED
  const [filterFromDate, setFilterFromDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterToDate, setFilterToDate] = useState(new Date().toISOString().split("T")[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [updatingId, setUpdatingId] = useState(null);
  const [branchUsers, setBranchUsers] = useState([]);
  const [rowPayments, setRowPayments] = useState({}); // { invoiceId: ['CASH', 'SIGNATURE'] }
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [filterVoucherPrefix, setFilterVoucherPrefix] = useState("");
  const [sortField, setSortField] = useState("invoiceNumber");
  const [sortOrder, setSortOrder] = useState("desc");
  const [pickingAnim, setPickingAnim] = useState({}); // { invoiceId: 'packing' | 'done' }

  const handlePickWithAnimation = (invoiceId) => {
    // Phase 1: Packing (box spins)
    setPickingAnim(prev => ({ ...prev, [invoiceId]: 'packing' }));
    // Phase 2: Done (green checkmark)
    setTimeout(() => {
      setPickingAnim(prev => ({ ...prev, [invoiceId]: 'done' }));
    }, 800);
    // Phase 3: Fire API & cleanup
    setTimeout(() => {
      setPickingAnim(prev => { const n = { ...prev }; delete n[invoiceId]; return n; });
      handleMarkStatus(invoiceId, 'PICKED');
    }, 1600);
  };

  const [completingAnim, setCompletingAnim] = useState({}); // { invoiceId: 'processing' | 'done' }

  const handleCompleteWithAnimation = (invoiceId) => {
    // Phase 1: Processing (clipboard spins)
    setCompletingAnim(prev => ({ ...prev, [invoiceId]: 'processing' }));
    // Phase 2: Done (green checkmark)
    setTimeout(() => {
      setCompletingAnim(prev => ({ ...prev, [invoiceId]: 'done' }));
    }, 800);
    // Phase 3: Fire API & cleanup
    setTimeout(() => {
      setCompletingAnim(prev => { const n = { ...prev }; delete n[invoiceId]; return n; });
      handleMarkStatus(invoiceId, 'COMPLETED');
    }, 1600);
  };

  const fetchBranchUsers = async () => {
    if (!currentBranch?._id) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/branch-users/branch/${currentBranch._id}`);
      const data = await res.json();
      if (data.success) {
        setBranchUsers(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch branch users", err);
    }
  };

  const fetchInvoices = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      let url = `${API_BASE}/invoices?branchId=${currentBranch._id}&page=${currentPage}&limit=50`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (filterFromDate) url += `&fromDate=${filterFromDate}`;
      if (filterToDate) url += `&toDate=${filterToDate}`;
      if (filterVoucherPrefix) url += `&vPrefix=${encodeURIComponent(filterVoucherPrefix)}`;
      if (sortField) url += `&sortBy=${sortField}&sortOrder=${sortOrder}`;
      
      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch invoices");
      
      let filteredData = data.data || [];
      
      // Client-side status filtering if backend doesn't support it yet
      if (filterStatus !== "ALL") {
        filteredData = filteredData.filter(inv => (inv.deliveryStatus || "PENDING") === filterStatus);
      }

      setInvoices(filteredData);
      if (data.pagination) setPagination(data.pagination);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchBranchUsers();
    fetchVoucherTypes();
  }, [currentBranch?._id, filterFromDate, filterToDate, currentPage, filterStatus, filterVoucherPrefix, sortField, sortOrder]);
  
  const fetchVoucherTypes = async () => {
    if (!currentBranch?._id) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/voucher-types?branchId=${currentBranch._id}`);
      const data = await res.json();
      if (data.success) {
        const siTypes = (data.data || []).filter(v => v.orderType === "SI");
        setVoucherTypes(siTypes);
      }
    } catch (err) {
      console.error("Error fetching voucher types:", err);
    }
  };

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchInvoices();
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleUpdateField = async (invoiceId, field, value) => {
    // Show a small indicator that we are saving
    const updateToast = toast.info(`Saving ${field}...`, { autoClose: 1000 });
    try {
      const res = await fetchWithAuth(`${API_BASE}/invoices/${invoiceId}/delivery-flow`, {
        method: "PATCH",
        body: JSON.stringify({ 
          [field]: value, 
          updatedBy: user?.username || "System",
          updatedById: user?._id || user?.id || null
        })
      });
      const data = await res.json();
      if (data.success) {
        setInvoices(prev => prev.map(inv => inv._id === invoiceId ? data.data : inv));
      } else {
        toast.error(data.message || "Update failed");
      }
    } catch (err) {
      toast.error("Failed to update field");
    }
  };

  const handleMarkStatus = async (invoiceId, status, paymentType = "NONE") => {
    // Permission Check: Only Admin/SuperAdmin can revert to PENDING
    if (status === "PENDING" && user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      toast.error("Only Admins can revert status");
      return;
    }

    const inv = invoices.find(i => i._id === invoiceId);
    if (status === "PICKED" || status === "COMPLETED") {
        const missing = [];
        if (!inv?.storageMan || inv.storageMan === "NONE") missing.push("Storage Man");
        if (!inv?.stockChecker || inv.stockChecker === "NONE") missing.push("Stock Checker");
        if (!inv?.deliveryPerson || inv.deliveryPerson === "NONE") {
            // Check both string field and populated object
            if (!inv.deliveryMan && !inv.deliveryPerson) missing.push("Delivery Person");
        }

        if (missing.length > 0) {
            alert(`Mandatory Assignment Missing: ${missing.join(", ")}. Please assign everyone before marking status.`);
            return;
        }
    }

    const confirmMsg = status === "PICKED" ? "Mark this delivery as PICKED?" : 
                       status === "COMPLETED" ? `Mark as Delivered with selected options?` : 
                       "Revert this delivery to PENDING?";
    
    if (!window.confirm(confirmMsg)) return;

    // Get payments for this row if completing
    const paymentTypes = status === "COMPLETED" ? (rowPayments[invoiceId] || []).join(",") : "NONE";

    setUpdatingId(invoiceId);
    try {
      const updatePayload = { 
        deliveryStatus: status, 
        updatedBy: user?.username || "System",
        updatedById: user?._id || user?.id || null,
        deliveryPaymentType: paymentTypes,
        deliveryCompletedAt: status === "COMPLETED" ? new Date() : null,
        isReverted: status === "PENDING" && inv.deliveryStatus === "COMPLETED"
      };

      // ⚡ REFRESH/CLEAR FIELDS IF REVERTING TO PENDING
      if (status === "PENDING") {
        updatePayload.storageMan = "";
        updatePayload.storageManComment = "";
        updatePayload.stockChecker = "";
        updatePayload.stockCheckerComment = "";
        updatePayload.deliveryPerson = "";
        updatePayload.deliveryPersonComment = "";
        updatePayload.deliveryPaymentType = "NONE";
        updatePayload.deliveryPaymentAmount = 0;
        updatePayload.deliverySignature = "";
      }

      const res = await fetchWithAuth(`${API_BASE}/invoices/${invoiceId}/delivery-flow`, {
        method: "PATCH",
        body: JSON.stringify(updatePayload)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Delivery marked as ${status.toLowerCase()}`);
        setInvoices(prev => prev.map(inv => inv._id === invoiceId ? data.data : inv));
      } else {
        toast.error(data.message || "Update failed");
      }
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };


  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const isFieldLocked = (inv, personField, commentField) => {
    // Locked only if completed
    return inv.deliveryStatus === "COMPLETED";
  };

  const handleViewInvoice = async (invoice) => {
    try {
        // Fetch full details if items are missing
        let fullInv = invoice;
        if (!invoice.items || invoice.items.length === 0) {
            const res = await fetchWithAuth(`${API_BASE}/invoices/${invoice._id}`);
            const data = await res.json();
            fullInv = data.success ? data.data : data;
        }

        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            toast.warning("Pop-up blocked! Please allow pop-ups to view invoice.");
            return;
        }

        const html = getInvoiceHTML(fullInv, 1, fullInv, fullInv, 'INVOICE');
        printWindow.document.write(html);
        printWindow.document.close();
    } catch (err) {
        console.error("View invoice failed:", err);
        toast.error("Failed to load invoice details");
    }
  };

  const formatIST = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      {/* Pick Animation Keyframes */}
      <style>{`
        @keyframes pickSpin {
          0% { transform: rotateY(0deg) scale(1); }
          50% { transform: rotateY(180deg) scale(1.3); }
          100% { transform: rotateY(360deg) scale(1); }
        }
        @keyframes pickPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes pickBounceIn {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pickTextSlide {
          0% { transform: translateX(10px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes completeSpin {
          0% { transform: rotateY(0deg) scale(1); }
          50% { transform: rotateY(180deg) scale(1.3); }
          100% { transform: rotateY(360deg) scale(1); }
        }
        @keyframes completePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
      <div className="w-full mx-auto px-4 sm:px-8 py-4">
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                <FaTruck className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                  Delivery <span className="text-indigo-600">Flow</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Track and manage Sales Invoice processing stages
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchInvoices}
                className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-50 transition shadow-sm"
              >
                <FaSync className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-1">
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Search</label>
              <div className="relative group">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  placeholder="SI ID, Customer, Names..."
                  className="w-full bg-slate-50/50 border border-slate-100 rounded-xl pl-11 pr-4 py-2.5 text-sm font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Status</label>
              <select
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">ALL STATUS</option>
                <option value="PENDING">PENDING</option>
                <option value="PICKED">PICKED</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">From</label>
              <input
                type="date"
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-black focus:bg-white focus:border-indigo-500 transition-all outline-none"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">To</label>
              <input
                type="date"
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-black focus:bg-white focus:border-indigo-500 transition-all outline-none"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Voucher Prefix</label>
              <select
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none"
                value={filterVoucherPrefix}
                onChange={(e) => setFilterVoucherPrefix(e.target.value)}
              >
                <option value="">ALL SERIES</option>
                {voucherTypes.map((v) => (
                  <option key={v._id} value={v.prefix}> {v.name.toUpperCase()} SERIES </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* MOBILE CARDS & TABLE WRAPPER */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Desktop Table View (Hidden on mobile) */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">S.No</th>
                  <th 
                    className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group"
                    onClick={() => {
                      const newOrder = sortField === "invoiceNumber" && sortOrder === "desc" ? "asc" : "desc";
                      setSortField("invoiceNumber");
                      setSortOrder(newOrder);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      SI ID / Date
                      <div className={`flex flex-col text-[8px] transition-opacity ${sortField === "invoiceNumber" ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}>
                        <FaChevronDown className={`transition-transform ${sortField === "invoiceNumber" && sortOrder === "asc" ? "rotate-180" : ""}`} />
                      </div>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Information</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Storage Man</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Checker</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Person</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                      <FaSync className="animate-spin inline-block mr-2" /> Loading Deliveries...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv, idx) => (
                    <tr key={inv._id} className={`hover:bg-slate-50/50 transition-colors ${inv.deliveryStatus === 'COMPLETED' ? 'bg-emerald-50/10' : ''}`}>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-black text-slate-400">{(currentPage - 1) * 50 + idx + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <button 
                            onClick={() => handleViewInvoice(inv)}
                            className="text-left text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            {inv.invoiceNumber}
                          </button>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{formatIST(inv.createdAt || inv.invoiceDate)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">{inv.customer?.name}</span>
                          <div className="flex items-center gap-1 mt-0.5 opacity-60">
                            <FaMapMarkerAlt className="text-[10px] text-indigo-400" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                               {inv.area || inv.customer?.address || "NO AREA"}
                            </span>
                          </div>
                        </div>
                      </td>
                      
                      {/* STORAGE MAN */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 p-2 bg-slate-50/50 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-white transition-all group min-w-[160px]">
                          <FilterableSelect
                            options={[{ _id: "", name: "NONE" }, ...branchUsers.map(u => ({ _id: u.name, name: u.name }))]}
                            value={inv.storageMan}
                            onChange={(val) => handleUpdateField(inv._id, 'storageMan', val)}
                            placeholder="Assign Storage"
                            disabled={isFieldLocked(inv, 'storageMan', 'storageManComment')}
                            className="!text-[10px] !font-black !uppercase"
                          />
                          <input 
                            type="text"
                            value={inv.storageManComment || ""}
                            onChange={(e) => handleUpdateField(inv._id, 'storageManComment', e.target.value)}
                            placeholder="Add note..."
                            disabled={isFieldLocked(inv, 'storageMan', 'storageManComment')}
                            className="text-[9px] font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-100 outline-none"
                          />
                        </div>
                      </td>

                      {/* STOCK CHECKER */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 p-2 bg-slate-50/50 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-white transition-all group min-w-[160px]">
                          <FilterableSelect
                            options={[{ _id: "", name: "NONE" }, ...branchUsers.map(u => ({ _id: u.name, name: u.name }))]}
                            value={inv.stockChecker}
                            onChange={(val) => handleUpdateField(inv._id, 'stockChecker', val)}
                            placeholder="Assign Checker"
                            disabled={isFieldLocked(inv, 'stockChecker', 'stockCheckerComment')}
                            className="!text-[10px] !font-black !uppercase"
                          />
                          <input 
                            type="text"
                            value={inv.stockCheckerComment || ""}
                            onChange={(e) => handleUpdateField(inv._id, 'stockCheckerComment', e.target.value)}
                            placeholder="Add note..."
                            disabled={isFieldLocked(inv, 'stockChecker', 'stockCheckerComment')}
                            className="text-[9px] font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-100 outline-none"
                          />
                        </div>
                      </td>

                      {/* DELIVERY PERSON */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 p-2 bg-slate-50/50 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-white transition-all group min-w-[160px]">
                          <FilterableSelect
                            options={[
                              ...(inv.deliveryMan?.name ? [{ _id: inv.deliveryMan.name, name: inv.deliveryMan.name }] : []),
                              ...(inv.salesOrderId?.deliveryMan?.name ? [{ _id: inv.salesOrderId.deliveryMan.name, name: inv.salesOrderId.deliveryMan.name }] : []),
                              ...branchUsers.map(u => ({ _id: u.name, name: u.name }))
                            ].filter((v, i, a) => a.findIndex(t => t._id === v._id) === i)}
                            value={inv.deliveryPerson || inv.deliveryMan?.name || inv.salesOrderId?.deliveryMan?.name || ""}
                            onChange={(val) => handleUpdateField(inv._id, 'deliveryPerson', val)}
                            placeholder="Assign Delivery"
                            disabled={isFieldLocked(inv, 'deliveryPerson', 'deliveryPersonComment')}
                            className="!text-[10px] !font-black !uppercase"
                          />
                          <input 
                            type="text"
                            value={inv.deliveryPersonComment || ""}
                            onChange={(e) => handleUpdateField(inv._id, 'deliveryPersonComment', e.target.value)}
                            placeholder="Add note..."
                            disabled={isFieldLocked(inv, 'deliveryPerson', 'deliveryPersonComment')}
                            className="text-[9px] font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-100 outline-none"
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {inv.deliveryStatus === 'COMPLETED' ? (
                          <div className="flex flex-col items-center gap-2">
                            <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                              <FaCheckCircle size={9} /> Completed
                            </span>
                            <span className="text-[8px] font-bold text-slate-400">{inv.deliveryPaymentType}</span>
                            {isAdmin && (
                              <button
                                onClick={() => handleMarkStatus(inv._id, 'PENDING')}
                                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-600 border border-rose-100 hover:border-rose-300 transition-all"
                              >
                                <FaUndo className="transition-transform duration-300 group-hover:[transform:rotateY(180deg)]" />
                                Revert
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 min-w-[200px]">
                            {/* Status pill for PICKED */}
                            {inv.deliveryStatus === 'PICKED' && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">📦 Picked</span>
                              </div>
                            )}
                            {/* Payment checkboxes */}
                            <div className="flex flex-wrap gap-1">
                              {['CASH', 'CHEQUE', 'OLD_PAYMENT', 'SPOT_PAYMENT', 'SIGNATURE'].map(opt => (
                                <label key={opt} className="flex items-center gap-1 px-1.5 py-1 bg-slate-50 border border-slate-100 rounded-md cursor-pointer hover:bg-indigo-50 hover:border-indigo-100 transition-all">
                                  <input
                                    type="checkbox"
                                    className="w-2.5 h-2.5 rounded accent-indigo-600"
                                    checked={(rowPayments[inv._id] || []).includes(opt)}
                                    onChange={(e) => {
                                      const current = rowPayments[inv._id] || [];
                                      const next = e.target.checked ? [...current, opt] : current.filter(x => x !== opt);
                                      setRowPayments({ ...rowPayments, [inv._id]: next });
                                    }}
                                  />
                                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">{opt.replace('_', ' ')}</span>
                                </label>
                              ))}
                            </div>
                            {/* Action buttons */}
                            <div className="flex gap-1.5">
                              {inv.deliveryStatus === 'PENDING' && (
                                <button
                                  onClick={() => !pickingAnim[inv._id] && handlePickWithAnimation(inv._id)}
                                  disabled={!!pickingAnim[inv._id]}
                                  className={`group flex-1 flex items-center justify-center gap-1.5 py-2 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md transition-all duration-500 ${
                                    pickingAnim[inv._id] === 'done'
                                      ? 'bg-emerald-500 shadow-emerald-200 scale-105'
                                      : pickingAnim[inv._id] === 'packing'
                                        ? 'bg-amber-600 shadow-amber-300'
                                        : 'bg-amber-500 shadow-amber-200 hover:bg-amber-600 hover:scale-105 active:scale-95'
                                  }`}
                                  style={{ perspective: '400px' }}
                                >
                                  {pickingAnim[inv._id] === 'done' ? (
                                    <>
                                      <FaCheckCircle style={{ animation: 'pickBounceIn 0.4s ease-out forwards' }} />
                                      <span style={{ animation: 'pickTextSlide 0.3s ease-out 0.1s both' }}>Picked!</span>
                                    </>
                                  ) : pickingAnim[inv._id] === 'packing' ? (
                                    <>
                                      <FaBoxOpen style={{ animation: 'pickSpin 0.8s ease-in-out forwards' }} />
                                      <span style={{ animation: 'pickPulse 0.5s ease-in-out infinite' }}>Packing...</span>
                                    </>
                                  ) : (
                                    <>
                                      <FaBoxOpen className="transition-transform duration-500 group-hover:[transform:rotateY(360deg)] drop-shadow-sm" />
                                      Mark Picked
                                    </>
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => !completingAnim[inv._id] && (rowPayments[inv._id] || []).length > 0 && handleCompleteWithAnimation(inv._id)}
                                disabled={(rowPayments[inv._id] || []).length === 0 || !!completingAnim[inv._id]}
                                className={`group flex-[2] flex items-center justify-center gap-1.5 py-2 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md transition-all duration-500 ${
                                  completingAnim[inv._id] === 'done'
                                    ? 'bg-emerald-500 shadow-emerald-200 scale-105'
                                    : completingAnim[inv._id] === 'processing'
                                      ? 'bg-indigo-700 shadow-indigo-300'
                                      : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100'
                                }`}
                                style={{ perspective: '400px' }}
                              >
                                {completingAnim[inv._id] === 'done' ? (
                                  <>
                                    <FaCheckCircle style={{ animation: 'pickBounceIn 0.4s ease-out forwards' }} />
                                    <span style={{ animation: 'pickTextSlide 0.3s ease-out 0.1s both' }}>Completed!</span>
                                  </>
                                ) : completingAnim[inv._id] === 'processing' ? (
                                  <>
                                    <FaClipboardCheck style={{ animation: 'completeSpin 0.8s ease-in-out forwards' }} />
                                    <span style={{ animation: 'completePulse 0.5s ease-in-out infinite' }}>Delivering...</span>
                                  </>
                                ) : (
                                  <>
                                    <FaClipboardCheck className="transition-transform duration-500 group-hover:[transform:rotateY(360deg)] drop-shadow-sm" />
                                    Mark Complete
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (Visible on small screens) */}
          <div className="lg:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                <FaSync className="animate-spin inline-block mb-2" /><br />Loading...
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                No records found
              </div>
            ) : (
              invoices.map((inv, idx) => (
                <div key={inv._id} className={`p-4 ${inv.deliveryStatus === 'COMPLETED' ? 'bg-emerald-50/20' : 'bg-white'}`}>
                  {/* Card Header: SI & Status */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 tracking-tighter">#{(currentPage - 1) * 50 + idx + 1}</span>
                        <button onClick={() => handleViewInvoice(inv)} className="text-sm font-black text-indigo-600 tracking-tight">{inv.invoiceNumber}</button>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{formatIST(inv.createdAt || inv.invoiceDate)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {inv.deliveryStatus === 'COMPLETED' ? (
                        <span className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">Delivered</span>
                      ) : inv.deliveryStatus === 'PICKED' ? (
                        <span className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">In Transit</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-200">Pending</span>
                      )}
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-xs font-black text-slate-800 uppercase tracking-tight mb-1">{inv.customer?.name}</div>
                    <div className="flex items-center gap-1.5">
                      <FaMapMarkerAlt className="text-indigo-400 text-[10px]" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        {inv.area || inv.customer?.address || "No Area"}
                      </span>
                    </div>
                  </div>

                  {/* Assignments */}
                  <div className="grid grid-cols-1 gap-3 mb-4">
                    {/* Storage */}
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Storage & Note</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <FilterableSelect
                            options={[{ _id: "", name: "NONE" }, ...branchUsers.map(u => ({ _id: u.name, name: u.name }))]}
                            value={inv.storageMan}
                            onChange={(val) => handleUpdateField(inv._id, 'storageMan', val)}
                            placeholder="Storage"
                            className="!py-2 !text-[11px] !font-black !uppercase"
                          />
                        </div>
                        <div className="flex-1">
                          <input 
                            type="text"
                            value={inv.storageManComment || ""}
                            onChange={(e) => handleUpdateField(inv._id, 'storageManComment', e.target.value)}
                            placeholder="Note..."
                            className="w-full text-[10px] font-bold text-slate-600 bg-white border border-slate-100 rounded-xl px-3 py-2 shadow-sm outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Checker */}
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Checker & Note</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <FilterableSelect
                            options={[{ _id: "", name: "NONE" }, ...branchUsers.map(u => ({ _id: u.name, name: u.name }))]}
                            value={inv.stockChecker}
                            onChange={(val) => handleUpdateField(inv._id, 'stockChecker', val)}
                            placeholder="Checker"
                            className="!py-2 !text-[11px] !font-black !uppercase"
                          />
                        </div>
                        <div className="flex-1">
                          <input 
                            type="text"
                            value={inv.stockCheckerComment || ""}
                            onChange={(e) => handleUpdateField(inv._id, 'stockCheckerComment', e.target.value)}
                            placeholder="Note..."
                            className="w-full text-[10px] font-bold text-slate-600 bg-white border border-slate-100 rounded-xl px-3 py-2 shadow-sm outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Delivery */}
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Delivery & Note</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <FilterableSelect
                            options={[
                              ...(inv.deliveryMan?.name ? [{ _id: inv.deliveryMan.name, name: inv.deliveryMan.name }] : []),
                              ...(inv.salesOrderId?.deliveryMan?.name ? [{ _id: inv.salesOrderId.deliveryMan.name, name: inv.salesOrderId.deliveryMan.name }] : []),
                              ...branchUsers.map(u => ({ _id: u.name, name: u.name }))
                            ].filter((v, i, a) => a.findIndex(t => t._id === v._id) === i)}
                            value={inv.deliveryPerson || inv.deliveryMan?.name || inv.salesOrderId?.deliveryMan?.name || ""}
                            onChange={(val) => handleUpdateField(inv._id, 'deliveryPerson', val)}
                            placeholder="Delivery"
                            className="!py-2 !text-[11px] !font-black !uppercase"
                          />
                        </div>
                        <div className="flex-1">
                          <input 
                            type="text"
                            value={inv.deliveryPersonComment || ""}
                            onChange={(e) => handleUpdateField(inv._id, 'deliveryPersonComment', e.target.value)}
                            placeholder="Note..."
                            className="w-full text-[10px] font-bold text-slate-600 bg-white border border-slate-100 rounded-xl px-3 py-2 shadow-sm outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Checkboxes & Action */}
                  <div className="pt-3 border-t border-slate-50">
                    {inv.deliveryStatus !== 'COMPLETED' ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                           {['CASH', 'CHEQUE', 'OLD_PAYMENT', 'SPOT_PAYMENT', 'SIGNATURE'].map(opt => (
                              <label key={opt} className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg cursor-pointer">
                                <input 
                                  type="checkbox"
                                  className="w-3 h-3 rounded text-indigo-600"
                                  checked={(rowPayments[inv._id] || []).includes(opt)}
                                  onChange={(e) => {
                                    const current = rowPayments[inv._id] || [];
                                    const next = e.target.checked ? [...current, opt] : current.filter(x => x !== opt);
                                    setRowPayments({ ...rowPayments, [inv._id]: next });
                                  }}
                                />
                                <span className="text-[9px] font-black text-slate-500 tracking-tighter uppercase">{opt.replace('_', ' ')}</span>
                              </label>
                           ))}
                        </div>
                        <div className="flex gap-2">
                             {inv.deliveryStatus === 'PENDING' && (
                               <button
                                 onClick={() => !pickingAnim[inv._id] && handlePickWithAnimation(inv._id)}
                                 disabled={!!pickingAnim[inv._id]}
                                 className={`group flex-1 flex items-center justify-center gap-2 py-3.5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all duration-500 ${
                                   pickingAnim[inv._id] === 'done'
                                     ? 'bg-emerald-500 shadow-emerald-200 scale-[1.05]'
                                     : pickingAnim[inv._id] === 'packing'
                                       ? 'bg-amber-600 shadow-amber-300'
                                       : 'bg-amber-500 shadow-amber-200 hover:bg-amber-600 hover:scale-[1.03] active:scale-95'
                                 }`}
                                 style={{ perspective: '600px' }}
                               >
                                 {pickingAnim[inv._id] === 'done' ? (
                                   <>
                                     <FaCheckCircle size={16} style={{ animation: 'pickBounceIn 0.4s ease-out forwards' }} />
                                     <span style={{ animation: 'pickTextSlide 0.3s ease-out 0.1s both' }}>Picked!</span>
                                   </>
                                 ) : pickingAnim[inv._id] === 'packing' ? (
                                   <>
                                     <FaBoxOpen size={16} style={{ animation: 'pickSpin 0.8s ease-in-out forwards' }} />
                                     <span style={{ animation: 'pickPulse 0.5s ease-in-out infinite' }}>Packing...</span>
                                   </>
                                 ) : (
                                   <>
                                     <span className="inline-block transition-transform duration-500 group-hover:[transform:rotateY(360deg)]">
                                       <FaBoxOpen size={14} />
                                     </span>
                                     Mark Picked
                                   </>
                                 )}
                               </button>
                             )}
                            <button 
                               onClick={() => !completingAnim[inv._id] && (rowPayments[inv._id] || []).length > 0 && handleCompleteWithAnimation(inv._id)} 
                               disabled={(rowPayments[inv._id] || []).length === 0 || !!completingAnim[inv._id]}
                               className={`group flex-[2] flex items-center justify-center gap-2 py-3.5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all duration-500 ${
                                 completingAnim[inv._id] === 'done'
                                   ? 'bg-emerald-500 shadow-emerald-200 scale-[1.05]'
                                   : completingAnim[inv._id] === 'processing'
                                     ? 'bg-indigo-700 shadow-indigo-300'
                                     : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:hover:scale-100'
                               }`}
                               style={{ perspective: '600px' }}
                             >
                               {completingAnim[inv._id] === 'done' ? (
                                 <>
                                   <FaCheckCircle size={16} style={{ animation: 'pickBounceIn 0.4s ease-out forwards' }} />
                                   <span style={{ animation: 'pickTextSlide 0.3s ease-out 0.1s both' }}>Completed!</span>
                                 </>
                               ) : completingAnim[inv._id] === 'processing' ? (
                                 <>
                                   <FaClipboardCheck size={16} style={{ animation: 'completeSpin 0.8s ease-in-out forwards' }} />
                                   <span style={{ animation: 'completePulse 0.5s ease-in-out infinite' }}>Delivering...</span>
                                 </>
                               ) : (
                                 <>
                                   <span className="inline-block transition-transform duration-500 group-hover:[transform:rotateY(360deg)]">
                                     <FaClipboardCheck size={14} />
                                   </span>
                                   Mark Complete
                                 </>
                               )}
                             </button>
                         </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                         <div className="text-[10px] font-bold text-slate-400 uppercase">Paid via: {inv.deliveryPaymentType}</div>
                         {isAdmin && <button onClick={() => handleMarkStatus(inv._id, 'PENDING')} className="text-[10px] font-black text-indigo-500 underline uppercase tracking-widest">Revert</button>}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* PAGINATION */}
          <div className="bg-slate-50/50 p-4 border-t border-slate-100 flex items-center justify-between">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
               Total: {pagination.total} Records | Page {currentPage} of {pagination.pages}
             </p>
             <div className="flex items-center gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50"
                >
                  Prev
                </button>
                <button 
                  disabled={currentPage >= pagination.pages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* DELIVERY COMPLETION MODAL REMOVED */}

    </div>
  );
};


export default BranchDeliveryFlow;
