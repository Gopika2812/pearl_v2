import React, { useEffect, useState, useRef, useCallback } from "react";
import { FaHistory, FaSearch, FaSync, FaTruck, FaCheckCircle, FaUser, FaCommentDots, FaMapMarkerAlt, FaChevronDown, FaBoxOpen, FaClipboardCheck, FaUndo, FaPlus, FaTrash, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { useSearchParams } from "react-router-dom";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import FilterableSelect from "../../components/FilterableSelect";
import { getInvoiceHTML } from "../../utils/invoiceUtils";
import ScrollToggleButton from "../../components/ScrollToggleButton";
import LiveScannerModal from "../../components/branch/LiveScannerModal";

const BranchDeliveryFlow = () => {
  const { currentBranch, user } = useBranch();
  const [searchParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "ALL"); // ALL, PENDING, PICKED, COMPLETED
  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam) {
      setFilterStatus(statusParam);
    }
  }, [searchParams]);
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
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkData, setBulkData] = useState({
    storageMan: [""],
    storageManComment: "",
    stockChecker: [""],
    stockCheckerComment: "",
    deliveryPerson: [""],
    deliveryPersonComment: ""
  });
  const [scanInput, setScanInput] = useState("");
  const [selectedScanRole, setSelectedScanRole] = useState("pick"); // pick, deliveryCompleted
  const [showScanCompletionModal, setShowScanCompletionModal] = useState(null); // invoice
  const [scanPaymentOptions, setScanPaymentOptions] = useState([]);
  const [showLiveScanner, setShowLiveScanner] = useState(false);
  const [showBulkScanModal, setShowBulkScanModal] = useState(null); // array of inv numbers
  const [verifiedInvoices, setVerifiedInvoices] = useState({}); // { invoiceId: boolean }

  const addStaffSlot = (role) => {
    if (bulkData[role].length >= 5) {
      toast.warning(`Maximum 5 ${role.replace(/([A-Z])/g, ' $1').toLowerCase()}s allowed`);
      return;
    }
    setBulkData(prev => ({
      ...prev,
      [role]: [...prev[role], ""]
    }));
  };

  const updateStaffSlot = (role, index, value) => {
    const newArr = [...bulkData[role]];
    newArr[index] = value;
    setBulkData(prev => ({ ...prev, [role]: newArr }));
  };

  const removeStaffSlot = (role, index) => {
    if (bulkData[role].length <= 1) return;
    const newArr = bulkData[role].filter((_, i) => i !== index);
    setBulkData(prev => ({ ...prev, [role]: newArr }));
  };

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

  // Check if all 3 notes are filled for an invoice
  const areNotesFilled = (inv) => {
    const sc = localComments[`${inv._id}_storageManComment`] ?? inv.storageManComment;
    const cc = localComments[`${inv._id}_stockCheckerComment`] ?? inv.stockCheckerComment;
    const dc = localComments[`${inv._id}_deliveryPersonComment`] ?? inv.deliveryPersonComment;
    return !!(sc && sc.trim()) && !!(cc && cc.trim()) && !!(dc && dc.trim());
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

  const debounceTimers = useRef({});
  const [localComments, setLocalComments] = useState({}); // { `${invoiceId}_${field}`: value }

  const handleUpdateField = async (invoiceId, field, value) => {
    // For comment fields, debounce to avoid spamming API on every keystroke
    const isComment = field.toLowerCase().includes('comment');

    if (isComment) {
      // Update local state immediately for responsive typing
      const key = `${invoiceId}_${field}`;
      setLocalComments(prev => ({ ...prev, [key]: value }));

      // Clear previous debounce timer
      if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);

      // Set new debounce timer (save after 800ms of no typing)
      debounceTimers.current[key] = setTimeout(async () => {
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
            toast.success(`Note saved`, { autoClose: 1500, toastId: key });
            setInvoices(prev => prev.map(inv => inv._id === invoiceId ? data.data : inv));
            setLocalComments(prev => { const n = { ...prev }; delete n[key]; return n; });
          } else {
            toast.error(data.message || "Failed to save note");
          }
        } catch (err) {
          toast.error("Failed to save note");
        }
      }, 800);
      return;
    }

    // For non-comment fields (dropdowns), save immediately
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
    if (status === "PENDING" && user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN" && user?.role !== "MANAGER") {
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


  const handleBulkUpdate = async () => {
    if (selectedInvoices.length === 0) return;

    // Filter out empty selections and join with commas
    const finalData = {
      storageMan: bulkData.storageMan.filter(name => name && name !== "NONE").join(", "),
      storageManComment: bulkData.storageManComment,
      stockChecker: bulkData.stockChecker.filter(name => name && name !== "NONE").join(", "),
      stockCheckerComment: bulkData.stockCheckerComment,
      deliveryPerson: bulkData.deliveryPerson.filter(name => name && name !== "NONE").join(", "),
      deliveryPersonComment: bulkData.deliveryPersonComment
    };

    if (!finalData.storageMan && !finalData.stockChecker && !finalData.deliveryPerson) {
      toast.warning("Please select at least one person to assign");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/invoices/delivery-flow/bulk`, {
        method: "PATCH",
        body: JSON.stringify({
          invoiceIds: selectedInvoices,
          ...finalData,
          updatedBy: user?.username || "System",
          updatedById: user?._id || user?.id || null
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Bulk update successful");
        setShowBulkModal(false);
        setSelectedInvoices([]);
        setBulkData({
          storageMan: [""], storageManComment: "",
          stockChecker: [""], stockCheckerComment: "",
          deliveryPerson: [""], deliveryPersonComment: ""
        });
        fetchInvoices();
      } else {
        toast.error(data.message || "Bulk update failed");
      }
    } catch (err) {
      toast.error("Error in bulk update");
    } finally {
      setLoading(false);
    }
  };

  const handleScanSubmit = async (e, manualCode = null) => {
    if (e) e.preventDefault();
    const inputToUse = manualCode || scanInput;
    if (!inputToUse.trim()) return;

    if (inputToUse.startsWith("BULK:")) {
      const invNos = inputToUse.replace("BULK:", "").split(",");
      setShowBulkScanModal(invNos);
      setScanInput("");
      return;
    }

    const invNo = inputToUse.trim().toUpperCase();
    setScanInput("");

    // Find invoice in current list or fetch if not found
    let inv = invoices.find(i => i.invoiceNumber === invNo);

    if (!inv) {
      try {
        setLoading(true);
        const res = await fetchWithAuth(`${API_BASE}/invoices/by-number/${invNo}`);
        const data = await res.json();
        if (data.success) {
          inv = data.data;
        }
      } catch (err) {
        console.error("Fetch by number failed", err);
      } finally {
        setLoading(false);
      }
    }

    if (!inv) {
      toast.error(`Invoice ${invNo} not found.`);
      return;
    }

    const currentStatus = inv.deliveryStatus || "PENDING";

    if (currentStatus === "COMPLETED") {
      toast.info(`Invoice ${invNo} is already COMPLETED`);
      return;
    }

    if (selectedScanRole === "pick") {
      // Progressive scan logic: Scan 3 times to assign storageMan, stockChecker, and deliveryPerson
      const hasStorage = inv.storageMan && inv.storageMan !== "NONE" && inv.storageMan.trim();
      const hasChecker = inv.stockChecker && inv.stockChecker !== "NONE" && inv.stockChecker.trim();
      const hasDelivery = inv.deliveryPerson && inv.deliveryPerson !== "NONE" && inv.deliveryPerson.trim();

      let targetRole = "";
      if (!hasStorage) {
        targetRole = "storageMan";
      } else if (!hasChecker) {
        targetRole = "stockChecker";
      } else if (!hasDelivery) {
        targetRole = "deliveryPerson";
      } else {
        toast.info(`Invoice ${invNo} already has Storage, Checker, and Delivery Person assigned.`);
        return;
      }

      // Always transition status to PICKED when scanning under 'pick'
      await performScanUpdate(inv, "PICKED", [], targetRole);

    } else if (selectedScanRole === "deliveryCompleted") {
      // Delivery completion scan logic
      const hasStorage = inv.storageMan && inv.storageMan !== "NONE" && inv.storageMan.trim();
      const hasChecker = inv.stockChecker && inv.stockChecker !== "NONE" && inv.stockChecker.trim();
      const hasDelivery = inv.deliveryPerson && inv.deliveryPerson !== "NONE" && inv.deliveryPerson.trim();
      const storageComment = inv.storageManComment && inv.storageManComment.trim();
      const checkerComment = inv.stockCheckerComment && inv.stockCheckerComment.trim();
      const deliveryComment = inv.deliveryPersonComment && inv.deliveryPersonComment.trim();

      if (!hasStorage || !storageComment || !hasChecker || !checkerComment || !hasDelivery || !deliveryComment) {
        toast.error(`Invoice ${invNo} cannot be completed. Please assign Storage Man, Stock Checker, and Delivery Person with all comments first.`);
        return;
      }

      // All filled, open completion modal to select payment/dispatch options
      setShowScanCompletionModal(inv);
    }
  };

  const performScanUpdate = async (inv, status, paymentOptions = [], targetRole = null) => {
    const activeRole = targetRole || selectedScanRole;

    let payload = {
      deliveryStatus: status,
      updatedBy: user?.username || "System",
      updatedById: user?._id || user?.id || null
    };

    if (activeRole !== "deliveryCompleted") {
      const commentField = activeRole + "Comment";
      const timestamp = new Date().toLocaleString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true });

      let roleLabel = activeRole;
      if (activeRole === "storageMan") roleLabel = "Storage Man";
      else if (activeRole === "stockChecker") roleLabel = "Stock Checker";
      else if (activeRole === "deliveryPerson") roleLabel = "Delivery Person";

      payload[activeRole] = user?.username || user?.fullName || "System";
      payload[commentField] = `${roleLabel} confirmed by ${user?.username || 'System'} at ${timestamp}`;
    }

    if (status === "COMPLETED") {
      payload.deliveryPaymentType = paymentOptions.join(",");
      payload.deliveryCompletedAt = new Date();
    }

    try {
      const res = await fetchWithAuth(`${API_BASE}/invoices/${inv._id}/delivery-flow`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Saved successfully!`);
        if (invoices.some(i => i._id === inv._id)) {
          setInvoices(prev => prev.map(i => i._id === inv._id ? data.data : i));
        } else {
          fetchInvoices();
        }
        setShowScanCompletionModal(null);
        setScanPaymentOptions([]);
      } else {
        toast.error(data.message || "Update failed");
      }
    } catch (err) {
      toast.error("Failed to update record");
    }
  };
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "MANAGER";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  // Check if invoice is 2+ days old (not today or yesterday)
  const isOldRecord = (inv) => {
    const invDate = new Date(inv.createdAt || inv.invoiceDate);
    invDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - invDate) / (1000 * 60 * 60 * 24));
    return diffDays >= 2;
  };

  const isFieldLocked = (inv, personField, commentField) => {
    // Locked if CANCELLED, completed OR if record is 2+ days old
    return inv.status === "CANCELLED" || inv.deliveryStatus === "COMPLETED" || isOldRecord(inv);
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
    <div className="relative min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <ScrollToggleButton />
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
                  Pick & <span className="text-indigo-600">Delivery Completed</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Track and manage Sales Invoice processing stages
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedInvoices.length > 0 && (
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center gap-2"
                >
                  <FaUser /> Select Multi User ({selectedInvoices.length})
                </button>
              )}
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
                <option value="PENDING">PICK</option>
                <option value="PICKED">PICKED</option>
                <option value="COMPLETED">DELIVERY COMPLETED</option>
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

        {/* QUICK SCAN ASSIGNMENT */}
        <div className="bg-slate-800 p-6 rounded-[2rem] shadow-xl mb-6 border border-slate-700 overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700"></div>
          <div className="relative flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              <h2 className="text-white text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                  <FaSearch className="text-white text-xs" />
                </div>
                Quick Scan Assignment
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 ml-10">
                Select role and scan QR code to automatically assign yourself
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
              <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700/50">
                {[
                  { id: 'pick', label: 'Pick' },
                  { id: 'deliveryCompleted', label: 'Delivery Completed' }
                ].map(role => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedScanRole(role.id)}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedScanRole === role.id
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                        : "text-slate-500 hover:text-slate-300"
                      }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleScanSubmit} className="relative w-full sm:w-80 flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleScanSubmit()}
                    placeholder="Scan QR or Type SI No..."
                    className="w-full bg-slate-900 border border-slate-700 text-white px-5 py-3 rounded-2xl text-sm font-bold focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none placeholder:text-slate-600"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                    <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Live</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => scanInput.trim() ? handleScanSubmit() : setShowLiveScanner(true)}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20 active:scale-95 border-0 cursor-pointer"
                >
                  {scanInput.trim() ? "Submit" : "Scan"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* LIVE SCANNER MODAL */}
        <LiveScannerModal
          show={showLiveScanner}
          onClose={() => setShowLiveScanner(false)}
          onScanSuccess={(code) => {
            setScanInput(code);
            // Handle auto-submit after scan
            setTimeout(() => {
              handleScanSubmit(null, code);
            }, 100);
          }}
        />

        {/* MOBILE CARDS & TABLE WRAPPER */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Desktop Table View (Hidden on mobile) */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-center w-12">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={invoices.length > 0 && selectedInvoices.length === invoices.filter(i => i.deliveryStatus !== 'COMPLETED' && i.status !== 'CANCELLED' && !isOldRecord(i)).length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInvoices(invoices.filter(i => i.deliveryStatus !== 'COMPLETED' && i.status !== 'CANCELLED' && !isOldRecord(i)).map(i => i._id));
                        } else {
                          setSelectedInvoices([]);
                        }
                      }}
                    />
                  </th>
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
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                      <FaSync className="animate-spin inline-block mr-2" /> Loading Deliveries...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv, idx) => (
                    <tr key={inv._id} className={`transition-colors ${inv.status === "CANCELLED" || isOldRecord(inv) ? 'opacity-50 bg-slate-100/50 pointer-events-none' : inv.deliveryStatus === 'COMPLETED' ? 'bg-emerald-50/10 hover:bg-slate-50/50' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-20"
                          checked={selectedInvoices.includes(inv._id)}
                          disabled={inv.deliveryStatus === 'COMPLETED' || inv.status === 'CANCELLED'}
                          onChange={() => {
                            setSelectedInvoices(prev =>
                              prev.includes(inv._id) ? prev.filter(id => id !== inv._id) : [...prev, inv._id]
                            );
                          }}
                        />
                      </td>
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
                            value={localComments[`${inv._id}_storageManComment`] ?? inv.storageManComment ?? ""}
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
                            value={localComments[`${inv._id}_stockCheckerComment`] ?? inv.stockCheckerComment ?? ""}
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
                            value={localComments[`${inv._id}_deliveryPersonComment`] ?? inv.deliveryPersonComment ?? ""}
                            onChange={(e) => handleUpdateField(inv._id, 'deliveryPersonComment', e.target.value)}
                            placeholder="Add note..."
                            disabled={isFieldLocked(inv, 'deliveryPerson', 'deliveryPersonComment')}
                            className="text-[9px] font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-100 outline-none"
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {inv.status === "CANCELLED" ? (
                          <div className="flex flex-col items-center gap-2">
                            <span className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 border border-rose-200">
                              <FaUndo size={9} /> Cancelled
                            </span>
                          </div>
                        ) : inv.deliveryStatus === 'COMPLETED' ? (
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
                              {['CHEQUE', 'OLD_PAYMENT', 'SPOT_CASH', 'SPOT_UPI', 'CASH_UPI', 'SIGNATURE'].map(opt => (
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
                                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">{{ CHEQUE: 'Cheque', OLD_PAYMENT: 'Old Payment', SPOT_CASH: 'Spot Payment Cash', SPOT_UPI: 'Spot Payment UPI', CASH_UPI: 'Cash & UPI', SIGNATURE: 'Signature' }[opt]}</span>
                                </label>
                              ))}
                            </div>
                            {/* Completion verification checkbox */}
                            {inv.deliveryStatus === 'PICKED' && (
                              <label className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl cursor-pointer group hover:bg-indigo-100 transition-all">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  checked={!!verifiedInvoices[inv._id]}
                                  onChange={(e) => setVerifiedInvoices(prev => ({ ...prev, [inv._id]: e.target.checked }))}
                                />
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-indigo-700 uppercase tracking-tight">Verify Dispatch</span>
                                  <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">Mandatory for Completion</span>
                                </div>
                              </label>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-1.5">
                              {inv.deliveryStatus === 'PENDING' && (
                                <button
                                  onClick={() => !pickingAnim[inv._id] && handlePickWithAnimation(inv._id)}
                                  disabled={!!pickingAnim[inv._id]}
                                  className={`group flex-1 flex items-center justify-center gap-1.5 py-2 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md transition-all duration-500 ${pickingAnim[inv._id] === 'done'
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
                                onClick={() => !completingAnim[inv._id] && verifiedInvoices[inv._id] && (rowPayments[inv._id] || []).length > 0 && areNotesFilled(inv) && handleCompleteWithAnimation(inv._id)}
                                disabled={(rowPayments[inv._id] || []).length === 0 || !areNotesFilled(inv) || !verifiedInvoices[inv._id] || !!completingAnim[inv._id]}
                                className={`group flex-[2] flex items-center justify-center gap-1.5 py-2 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md transition-all duration-500 ${completingAnim[inv._id] === 'done'
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
                <div key={inv._id} className={`p-4 ${inv.status === "CANCELLED" || isOldRecord(inv) ? 'opacity-50 bg-slate-100 pointer-events-none' : inv.deliveryStatus === 'COMPLETED' ? 'bg-emerald-50/20' : 'bg-white'}`}>
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
                      {inv.status === "CANCELLED" ? (
                        <span className="px-2.5 py-1 bg-rose-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">Cancelled</span>
                      ) : inv.deliveryStatus === 'COMPLETED' ? (
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
                            value={localComments[`${inv._id}_storageManComment`] ?? inv.storageManComment ?? ""}
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
                            value={localComments[`${inv._id}_stockCheckerComment`] ?? inv.stockCheckerComment ?? ""}
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
                            value={localComments[`${inv._id}_deliveryPersonComment`] ?? inv.deliveryPersonComment ?? ""}
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
                          {['CHEQUE', 'OLD_PAYMENT', 'SPOT_CASH', 'SPOT_UPI', 'CASH_UPI', 'SIGNATURE'].map(opt => (
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
                              <span className="text-[9px] font-black text-slate-500 tracking-tighter uppercase">{{ CHEQUE: 'Cheque', OLD_PAYMENT: 'Old Payment', SPOT_CASH: 'Spot Payment Cash', SPOT_UPI: 'Spot Payment UPI', CASH_UPI: 'Cash & UPI', SIGNATURE: 'Signature' }[opt]}</span>
                            </label>
                          ))}
                        </div>
                        {/* Mobile Verification Checkbox */}
                        {inv.deliveryStatus === 'PICKED' && (
                          <label className="flex items-center gap-2 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl cursor-pointer mb-3">
                            <input
                              type="checkbox"
                              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              checked={!!verifiedInvoices[inv._id]}
                              onChange={(e) => setVerifiedInvoices(prev => ({ ...prev, [inv._id]: e.target.checked }))}
                            />
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-indigo-700 uppercase tracking-tight">Verify Dispatch</span>
                              <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">Mandatory to Complete</span>
                            </div>
                          </label>
                        )}
                        <div className="flex gap-2">
                          {inv.deliveryStatus === 'PENDING' && (
                            <button
                              onClick={() => !pickingAnim[inv._id] && handlePickWithAnimation(inv._id)}
                              disabled={!!pickingAnim[inv._id]}
                              className={`group flex-1 flex items-center justify-center gap-2 py-3.5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all duration-500 ${pickingAnim[inv._id] === 'done'
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
                            onClick={() => !completingAnim[inv._id] && verifiedInvoices[inv._id] && (rowPayments[inv._id] || []).length > 0 && areNotesFilled(inv) && handleCompleteWithAnimation(inv._id)}
                            disabled={(rowPayments[inv._id] || []).length === 0 || !areNotesFilled(inv) || !verifiedInvoices[inv._id] || !!completingAnim[inv._id]}
                            className={`group flex-[2] flex items-center justify-center gap-2 py-3.5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all duration-500 ${completingAnim[inv._id] === 'done'
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

      {/* BULK ASSIGNMENT MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowBulkModal(false)}></div>
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg relative z-10 animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="bg-indigo-600 p-8 text-white rounded-t-[2.5rem] shrink-0">
              <h3 className="text-xl font-black uppercase tracking-tight">Bulk Staff Assignment</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-1">
                Assigning staff for {selectedInvoices.length} selected invoices
              </p>
            </div>

            <div className="p-8 space-y-8 overflow-y-auto scrollbar-hide flex-1 pb-20">
              {/* Category Helper */}
              {['storageMan', 'stockChecker', 'deliveryPerson'].map((role) => (
                <div key={role} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      {role.replace(/([A-Z])/g, ' $1')}s
                    </label>
                    <button
                      onClick={() => addStaffSlot(role)}
                      className="w-6 h-6 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-100 transition-colors"
                      title="Add more"
                    >
                      <FaPlus size={10} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {bulkData[role].map((val, idx) => (
                      <div key={idx} className="flex gap-2 items-center animate-in slide-in-from-left-2 duration-200">
                        <div className="flex-1">
                          <FilterableSelect
                            options={[{ _id: "", name: "NONE" }, ...branchUsers.map(u => ({ _id: u.name, name: u.name }))]}
                            value={val}
                            onChange={(newVal) => updateStaffSlot(role, idx, newVal)}
                            placeholder={`Select ${role.replace(/([A-Z])/g, ' $1')} ${idx + 1}`}
                          />
                        </div>
                        {bulkData[role].length > 1 && (
                          <button
                            onClick={() => removeStaffSlot(role, idx)}
                            className="w-8 h-8 flex items-center justify-center text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <FaTrash size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="pt-1">
                      <input
                        type="text"
                        value={bulkData[`${role}Comment`]}
                        onChange={(e) => setBulkData(prev => ({ ...prev, [`${role}Comment`]: e.target.value }))}
                        placeholder={`Add ${role.replace(/([A-Z])/g, ' $1').toLowerCase()} note...`}
                        className="w-full text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 outline-none focus:bg-white focus:border-indigo-300 transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-slate-100 rounded-b-[2.5rem] z-20">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkUpdate}
                  className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
                >
                  Confirm Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScanCompletionModal && (
        <ScanCompletionModal
          invoice={showScanCompletionModal}
          onClose={() => {
            setShowScanCompletionModal(null);
            setScanPaymentOptions([]);
          }}
          selectedOptions={scanPaymentOptions}
          setSelectedOptions={setScanPaymentOptions}
          onConfirm={() => performScanUpdate(showScanCompletionModal, "COMPLETED", scanPaymentOptions)}
        />
      )}

      {showBulkScanModal && (
        <BulkScanAssignmentModal
          invNumbers={showBulkScanModal}
          branchUsers={branchUsers}
          onClose={() => setShowBulkScanModal(null)}
          onConfirm={async (data) => {
            setLoading(true);
            try {
              const res = await fetchWithAuth(`${API_BASE}/invoices/bulk-delivery-update`, {
                method: "PATCH",
                body: JSON.stringify({
                  invoiceNumbers: showBulkScanModal,
                  ...data
                })
              });
              const resData = await res.json();
              if (resData.success) {
                toast.success(`✅ ${showBulkScanModal.length} invoices updated`);
                fetchInvoices();
                setShowBulkScanModal(null);
              } else {
                toast.error(resData.message || "Bulk update failed");
              }
            } catch (err) {
              toast.error("Bulk update failed");
            } finally {
              setLoading(false);
            }
          }}
        />
      )}

    </div>
  );
};

// 💳 SCAN COMPLETION MODAL
const ScanCompletionModal = ({ invoice, onClose, onConfirm, selectedOptions, setSelectedOptions }) => {
  const [verifyDispatch, setVerifyDispatch] = useState(false);
  const options = ["CHEQUE", "OLD PAYMENT", "SPOTPAYMENTCASH", "SPOTPAYMENTUPI", "CASH & UPI", "SIGNATURE"];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
        <div className="bg-slate-800 p-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
              <FaClipboardCheck className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">Complete Delivery</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{invoice.invoiceNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition border-0 bg-transparent text-white cursor-pointer">
            <FaTimes />
          </button>
        </div>
        <div className="p-8">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Select Delivery Options (Multiple Allowed)</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {options.map(opt => (
              <label key={opt} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer group ${selectedOptions.includes(opt) ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={selectedOptions.includes(opt)}
                  onChange={() => {
                    if (selectedOptions.includes(opt)) setSelectedOptions(selectedOptions.filter(o => o !== opt));
                    else setSelectedOptions([...selectedOptions, opt]);
                  }}
                />
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${selectedOptions.includes(opt) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200 group-hover:border-slate-300'}`}>
                  {selectedOptions.includes(opt) && <FaCheckCircle className="text-white text-xs" />}
                </div>
                <span className="text-[10px] font-black uppercase tracking-tight">{opt}</span>
              </label>
            ))}
          </div>

          <label className={`flex items-center gap-3 p-4 mb-6 rounded-2xl border-2 transition-all cursor-pointer group ${verifyDispatch ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'}`}>
            <input
              type="checkbox"
              className="hidden"
              checked={verifyDispatch}
              onChange={() => setVerifyDispatch(!verifyDispatch)}
            />
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${verifyDispatch ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200 group-hover:border-slate-300'}`}>
              {verifyDispatch && <FaCheckCircle className="text-white text-xs" />}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-tight">VERIFY DISPATCH</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">MANDATORY FOR COMPLETION</span>
            </div>
          </label>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              disabled={!verifyDispatch}
              onClick={onConfirm}
              className={`flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${verifyDispatch ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
            >
              Mark as Completed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const BulkScanAssignmentModal = ({ invNumbers, branchUsers, onClose, onConfirm }) => {
  const [storageMan, setStorageMan] = useState("");
  const [stockChecker, setStockChecker] = useState("");
  const [deliveryPerson, setDeliveryPerson] = useState("");
  const [storageManComment, setStorageManComment] = useState("");
  const [stockCheckerComment, setStockCheckerComment] = useState("");
  const [deliveryPersonComment, setDeliveryPersonComment] = useState("");

  // Auto-update comments when staff is selected
  useEffect(() => {
    if (storageMan || stockChecker || deliveryPerson) {
      const timestamp = new Date().toLocaleString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true });
      setStorageManComment(`Picked by ${storageMan || '...'} | Checked by ${stockChecker || '...'} at ${timestamp}`);
      setStockCheckerComment(`Checked by ${stockChecker || '...'} | Picked by ${storageMan || '...'} at ${timestamp}`);
      setDeliveryPersonComment(`Delivery Person confirmed by ${deliveryPerson || '...'} at ${timestamp}`);
    }
  }, [storageMan, stockChecker, deliveryPerson]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
        <div className="bg-indigo-600 p-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <FaClipboardCheck className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">Bulk Scan Assignment</h2>
              <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest">{invNumbers.length} Invoices Detected</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition border-0 bg-transparent text-white cursor-pointer">
            <FaTimes />
          </button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto max-h-[75vh]">
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Select Storage Man</label>
                <select
                  value={storageMan}
                  onChange={(e) => setStorageMan(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 text-sm font-bold focus:outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="">Select Staff</option>
                  {branchUsers.map(u => <option key={u._id} value={u.username || u.fullName}>{u.username || u.fullName}</option>)}
                </select>
              </div>
              <input
                type="text"
                value={storageManComment}
                onChange={(e) => setStorageManComment(e.target.value)}
                placeholder="Edit storage comment..."
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 focus:bg-white focus:border-indigo-300 outline-none"
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Select Stock Checker</label>
                <select
                  value={stockChecker}
                  onChange={(e) => setStockChecker(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 text-sm font-bold focus:outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="">Select Staff</option>
                  {branchUsers.map(u => <option key={u._id} value={u.username || u.fullName}>{u.username || u.fullName}</option>)}
                </select>
              </div>
              <input
                type="text"
                value={stockCheckerComment}
                onChange={(e) => setStockCheckerComment(e.target.value)}
                placeholder="Edit checker comment..."
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 focus:bg-white focus:border-indigo-300 outline-none"
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Select Delivery Person</label>
                <select
                  value={deliveryPerson}
                  onChange={(e) => setDeliveryPerson(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 text-sm font-bold focus:outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="">Select Staff</option>
                  {branchUsers.map(u => <option key={u._id} value={u.username || u.fullName}>{u.username || u.fullName}</option>)}
                </select>
              </div>
              <input
                type="text"
                value={deliveryPersonComment}
                onChange={(e) => setDeliveryPersonComment(e.target.value)}
                placeholder="Edit delivery comment..."
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 focus:bg-white focus:border-indigo-300 outline-none"
              />
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-4">
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-3">
              <FaBoxOpen className="text-amber-500 text-xl" />
              <p className="text-[10px] font-black text-amber-800 uppercase tracking-tight leading-relaxed">
                Clicking update will automatically mark all {invNumbers.length} invoices as <span className="bg-amber-500 text-white px-1.5 py-0.5 rounded">PICKED</span> status.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition">Cancel</button>
              <button
                disabled={!storageMan || !stockChecker || !deliveryPerson}
                onClick={() => onConfirm({ storageMan, stockChecker, deliveryPerson, storageManComment, stockCheckerComment, deliveryPersonComment, deliveryStatus: 'PICKED' })}
                className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition disabled:opacity-50 shadow-xl shadow-indigo-100"
              >
                Mark All as Picked
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default BranchDeliveryFlow;
