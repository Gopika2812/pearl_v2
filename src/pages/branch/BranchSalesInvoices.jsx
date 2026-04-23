import React, { useEffect, useState } from "react";
import { FaChevronDown, FaFileAlt, FaFileContract, FaHistory, FaSearch, FaSync, FaTrash, FaFileExcel, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { API_BASE, fetchWithAuth } from "../../api";
import EInvoicePrintModal from "../../components/branch/EInvoicePrintModal";
import { useBranch } from "../../context/BranchContext";
import { getInvoiceHTML } from "../../utils/invoiceUtils";

const ExportColumnSelectorModal = ({ show, onClose, columns, selected, onSelect, exporting, onExport }) => {
  if (!show) return null;
  
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
        <div className="bg-indigo-600 p-8 flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <FaFileExcel size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Export Settings</h2>
              <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest">Select Columns to Include in Excel</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition border-0 bg-transparent text-white">
            <FaTimes />
          </button>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {columns.map(col => (
              <label 
                key={col.id} 
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  selected.includes(col.id) 
                  ? "bg-indigo-50 border-indigo-600 text-indigo-700" 
                  : "bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200"
                }`}
              >
                <input 
                  type="checkbox"
                  className="hidden"
                  checked={selected.includes(col.id)}
                  onChange={() => onSelect(col.id)}
                />
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                  selected.includes(col.id) ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-300"
                }`}>
                  {selected.includes(col.id) && <FaSync className="text-white text-[10px]" />}
                </div>
                <span className="text-[11px] font-black uppercase tracking-tight">{col.label}</span>
              </label>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => onSelect('ALL')}
              className="flex-1 py-4 rounded-2xl border-2 border-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition"
            >
              Select All
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl bg-slate-800 text-white font-black uppercase tracking-widest text-[10px] hover:bg-slate-900 transition"
            >
              Cancel
            </button>
            <button
              onClick={onExport}
              disabled={exporting}
              className="flex-[2] py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition shadow-xl shadow-emerald-100 flex items-center justify-center gap-2"
            >
              {exporting ? <FaSync className="animate-spin" /> : <FaFileExcel />}
              Download Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  
  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    // Global Super Admin or Branch Admin (local) bypass checks
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    
    const key = `sales-invoice-list_${fieldId}`;
    return user.fieldPermissions?.[key] !== false; // Default to true if not explicitly restricted
  };

  // --- SELECTIVE EXPORT STATE ---
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState([
    "date", "invoiceNumber", "voucherType", "customerName", "grandTotal", "creator"
  ]);

  const AVAILABLE_COLUMNS = [
    { id: "date", label: "Date" },
    { id: "invoiceNumber", label: "Invoice No" },
    { id: "voucherType", label: "Voucher Type (Series)" },
    { id: "customerName", label: "Customer Name" },
    { id: "customerGstin", label: "Customer GSTIN" },
    { id: "creator", label: "Created By" },
    { id: "productName", label: "Product Name" },
    { id: "hsn", label: "HSN Code" },
    { id: "price", label: "Rate" },
    { id: "qty", label: "Quantity" },
    { id: "taxableValue", label: "Taxable Value" },
    { id: "cgst", label: "CGST" },
    { id: "sgst", label: "SGST" },
    { id: "igst", label: "IGST" },
    { id: "discount", label: "Discount" },
    { id: "extraCharges", label: "Extra Charges" },
    { id: "grandTotal", label: "Grand Total" }
  ];

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

  /**
   * ⚡ DIRECT GENERATE CREDIT NOTE: Creates a full return and prints immediately.
   */
  const handleDirectGenerateCN = async (inv) => {
    if (!window.confirm(`Create a FULL RETURN (Credit Note) for ${inv.invoiceNumber}? This will return 100% of all items.`)) {
      return;
    }

    setRequestingAction(inv._id);
    try {
      // 1. Fetch full details (populated on backend with items.productId for HSN fallback)
      const res = await fetchWithAuth(`${API_BASE}/invoices/${inv._id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to fetch invoice details");
      const fullInv = data.data || data;

      // 2. Prepare Credit Note Payload (Full Return)
      const cnPayload = {
        branchId: currentBranch._id,
        customerId: fullInv.customer?.customerId?._id || fullInv.customer?._id,
        originalInvoiceId: fullInv.invoiceNumber,
        items: (fullInv.items || []).map(item => ({
          productId: item.productId?._id || item.productId,
          name: item.name,
          hsn: item.hsn || item.productId?.hsnCode || item.productId?.hsn || "",
          qty: item.qty, // Full Return
          sellingPrice: item.sellingPrice,
          gst: item.gst,
          cgst: item.cgst,
          sgst: item.sgst,
          igst: item.igst,
          unit: item.unit,
          total: item.total
        })),
        subtotal: fullInv.subtotal,
        totalTax: fullInv.totalTax,
        roundingOff: fullInv.roundingOff || 0,
        grandTotal: fullInv.grandTotal,
        reasonForReturn: "Full Return Generated from Invoice History",
        createdBy: user?.id || user?._id,
        createdByUsername: user?.username || "System"
      };

      // 3. Create the Credit Note
      const cnRes = await fetchWithAuth(`${API_BASE}/credit-notes`, {
        method: "POST",
        body: JSON.stringify(cnPayload)
      });

      const cnData = await cnRes.json();
      if (!cnRes.ok) throw new Error(cnData.message || "Failed to create Credit Note");

      const createdCN = cnData.data || cnData;

      // 4. Trigger Direct Print (Formal Layout)
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.warning("🔔 Pop-up blocked! Please allow pop-ups to print.");
      } else {
        const previewData = {
          ...cnPayload,
          seller: fullInv.seller || {},
          customer: fullInv.customer || {},
          invoiceDate: new Date()
        };
        const html = getInvoiceHTML(previewData, 2, createdCN, createdCN, 'CREDIT_NOTE');
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
          setTimeout(() => printWindow.close(), 1000);
        }, 500);
      }

      toast.success("✅ Credit Note created and print triggered!");
      fetchInvoices();
    } catch (err) {
      console.error("Direct CN failed:", err);
      toast.error(err.message || "Failed to generate Credit Note");
    } finally {
      setRequestingAction(null);
    }
  };

  const [showTransportModal, setShowTransportModal] = useState(null);
  const [exporting, setExporting] = useState(false);

  /**
   * 📊 DETAILED EXCEL EXPORT (Fetches everything in range with Items)
   * This mirrors the Sales Order format but includes item-level discounts,
   * transport charges,  /**
   * 📊 SELECTIVE EXCEL EXPORT
   * Builds the report dynamically based on user-selected columns.
   * Maps 'Voucher Type' to the Series codes (Z-1, CS, etc.) as requested.
   */
  const handleExportDetailedExcel = async () => {
    if (!currentBranch?._id) return;
    setExporting(true);
    try {
      // 1. Fetch matching invoices with includeItems=true for full data access
      let url = `${API_BASE}/invoices?branchId=${currentBranch._id}&limit=1000&includeItems=true`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (filterFromDate) url += `&fromDate=${filterFromDate}`;
      if (filterToDate) url += `&toDate=${filterToDate}`;
      if (filterVoucherPrefix) url += `&vPrefix=${encodeURIComponent(filterVoucherPrefix)}`;
      if (filterEinvoiceStatus) url += `&einvoiceStatus=${filterEinvoiceStatus}`;

      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch for export");

      const invoicesToExport = data.data || [];
      if (invoicesToExport.length === 0) {
        toast.warn("No invoices found in this range to export.");
        return;
      }

      // 2. Identify active columns based on user selection
      const activeColumns = AVAILABLE_COLUMNS.filter(c => selectedColumns.includes(c.id));
      const headerRow = activeColumns.map(c => c.label);
      
      const rows = [headerRow];

      invoicesToExport.forEach((inv) => {
        const invNo = inv.invoiceNumber || "-";
        const customerName = inv.customer?.name || "-";
        const invDate = inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : "-";
        
        // 🎫 Voucher Type Mapping (Extracting Series like Z-1, Z-2, CS)
        let voucherType = "Sales Invoice";
        if (invNo.includes("/SI/")) {
          const parts = invNo.split("/SI/");
          voucherType = parts[0].replace("SI", ""); 
        } else if (invNo.includes("SI/")) {
          voucherType = invNo.split("SI/")[0];
        } else if (invNo.includes("/")) {
          voucherType = invNo.split("/")[0];
        }

        // Accurate Creator Logic
        const soUser = inv.salesOrderId?.billingPerson || "";
        const siUser = inv.generatedBy || inv.billingPerson || "";
        let creator = siUser || soUser || "System";

        const items = inv.items || [];
        
        const rowData = activeColumns.map(col => {
          switch (col.id) {
            case "date": return invDate;
            case "invoiceNumber": return invNo;
            case "voucherType": return voucherType;
            case "customerName": return customerName;
            case "customerGstin": return inv.customer?.gstin || "URP";
            case "creator": return creator;
            case "productName": return items.map(i => i.name).join(", ");
            case "hsn": return items.map(i => i.hsn || "").filter(Boolean).join(", ");
            case "price": return items.length > 1 ? "Multiple" : (items[0]?.sellingPrice || 0);
            case "qty": return items.reduce((sum, i) => sum + (i.qty || 0), 0);
            case "taxableValue": return inv.subtotal || 0;
            case "cgst": return (typeof inv.totalTax === 'object' ? inv.totalTax?.cgst : (inv.totalTax || 0) / 2) || 0;
            case "sgst": return (typeof inv.totalTax === 'object' ? inv.totalTax?.sgst : (inv.totalTax || 0) / 2) || 0;
            case "igst": return (typeof inv.totalTax === 'object' ? inv.totalTax?.igst : 0) || 0;
            case "discount": return inv.totalDiscount || 0;
            case "extraCharges": return (inv.transportCharge || 0) + (inv.extraExpenseAmount || 0);
            case "grandTotal": return inv.grandTotal || 0;
            default: return "";
          }
        });
        rows.push(rowData);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sales_Export");
      XLSX.writeFile(workbook, `Sales_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success("Excel report generated with selected columns!");
      setShowColumnModal(false);
    } catch (err) {
      console.error("Export Error:", err);
      toast.error("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  };


  const handleToggleColumn = (colId) => {
    if (colId === 'ALL') {
      setSelectedColumns(AVAILABLE_COLUMNS.map(c => c.id));
      return;
    }
    if (selectedColumns.includes(colId)) {
      if (selectedColumns.length > 1) {
        setSelectedColumns(prev => prev.filter(id => id !== colId));
      } else {
        toast.error("At least one column must be selected");
      }
    } else {
      setSelectedColumns(prev => [...prev, colId]);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      
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

      {showColumnModal && (
        <ExportColumnSelectorModal 
          show={showColumnModal}
          onClose={() => setShowColumnModal(false)}
          columns={AVAILABLE_COLUMNS}
          selected={selectedColumns}
          onSelect={handleToggleColumn}
          exporting={exporting}
          onExport={handleExportDetailedExcel}
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
              {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.actionPermissions?.export !== false) && (
                <>
                  <button
                    onClick={() => setShowColumnModal(true)}
                    className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition shadow-sm"
                    title="Select Export Columns"
                  >
                    <FaFileExcel size={18} />
                  </button>
                  <button
                    onClick={handleExportDetailedExcel}
                    disabled={exporting}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 text-xs font-black"
                  >
                    {exporting ? <FaSync className="animate-spin" /> : <FaFileExcel />}
                    QUICK REPORT
                  </button>
                </>
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
                    {isFieldAllowed("dateTime") && <th className="px-6 py-5 text-left">Date & Time</th>}
                    {isFieldAllowed("siId") && <th className="px-6 py-5 text-left">Invoice ID (SI)</th>}
                    {isFieldAllowed("soRef") && <th className="px-6 py-5 text-left">Order Ref (SO)</th>}
                    {isFieldAllowed("customer") && <th className="px-6 py-5 text-left">Customer Details</th>}
                    {isFieldAllowed("createdBy") && <th className="px-6 py-5 text-left">Created By</th>}
                    {isFieldAllowed("grandTotal") && <th className="px-6 py-5 text-right">Grand Total</th>}
                    {isFieldAllowed("einvoiceStatus") && <th className="px-6 py-5 text-center">E-Invoice Status</th>}
                    {isFieldAllowed("status") && <th className="px-6 py-5 text-center">Status</th>}
                    {(isFieldAllowed("action_return") || isFieldAllowed("action_ewb") || isFieldAllowed("action_cancel") || isFieldAllowed("action_pdf")) && (
                      <th className="px-6 py-5 text-center">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {invoices.map((inv) => (
                    <React.Fragment key={inv._id}>
                      <tr className="hover:bg-indigo-50/30 transition group">
                        {isFieldAllowed("dateTime") && (
                          <td className="px-6 py-5 whitespace-nowrap">
                             <div className="text-[11px] font-black text-slate-700 tracking-tight">{formatIST(inv.invoiceDate)}</div>
                             <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{new Date(inv.invoiceDate).toDateString() === new Date().toDateString() ? "TODAY" : ""}</div>
                          </td>
                        )}
                        {isFieldAllowed("siId") && (
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
                        )}
                        {isFieldAllowed("soRef") && (
                          <td className="px-6 py-5">
                            <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-1 rounded">
                              SO REF: {inv.salesOrderId?.invoiceId || "N/A"}
                            </span>
                          </td>
                        )}
                        {isFieldAllowed("customer") && (
                          <td className="px-6 py-5">
                            <div className="font-black text-slate-800 text-xs">{inv.customer?.name}</div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">{inv.customer?.whatsapp || "No Contact"}</div>
                          </td>
                        )}
                        {isFieldAllowed("createdBy") && (
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-1.5">
                              {inv.salesOrderId?.billingPerson && (inv.generatedBy || inv.billingPerson) !== inv.salesOrderId?.billingPerson && (
                                 <div className="flex items-center gap-1.5 opacity-60">
                                    <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-widest border border-slate-200">SO</span>
                                    <span className="text-[10px] font-bold text-slate-500 truncate max-w-[100px]">{inv.salesOrderId.billingPerson}</span>
                                 </div>
                              )}
                              <div className="flex items-center gap-1.5">
                                 <span className="text-[8px] font-black bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded uppercase tracking-widest border border-indigo-200">INV</span>
                                 <span className="text-[10px] font-black text-indigo-700 uppercase tracking-tight">
                                    {inv.generatedBy || inv.billingPerson || inv.salesOrderId?.billingPerson || "SYSTEM"}
                                 </span>
                              </div>
                            </div>
                          </td>
                        )}
                        {isFieldAllowed("grandTotal") && (
                          <td className="px-6 py-5 text-right font-black text-indigo-700 tracking-tight text-base">
                            ₹{(inv.grandTotal || 0).toLocaleString()}
                          </td>
                        )}
                        {isFieldAllowed("einvoiceStatus") && (
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
                        )}
                        {isFieldAllowed("status") && (
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
                        )}
                        {(isFieldAllowed("action_return") || isFieldAllowed("action_ewb") || isFieldAllowed("action_cancel") || isFieldAllowed("action_pdf")) && (
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center gap-2 justify-center flex-wrap">
                              {isFieldAllowed("action_ewb") && inv.einvoiceStatus === "GENERATED" && !inv.ewayBillNo && inv.grandTotal > 10000 && (
                                <button
                                  onClick={() => handleGenerateEWayBillOnly(inv)}
                                  disabled={requestingAction === inv._id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white text-[10px] font-black transition-all"
                                >
                                  {requestingAction === inv._id ? <FaSync className="animate-spin" /> : <><FaSync size={12} /> GEN EWB</>}
                                </button>
                              )}
                              {isFieldAllowed("action_return") && (
                                <button
                                  onClick={() => handleDirectGenerateCN(inv)}
                                  disabled={requestingAction === inv._id || inv.status === "CANCELLED"}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-600 hover:text-white text-[10px] font-black transition-all shadow-sm disabled:opacity-50"
                                  title="Generate Full Return Credit Note"
                                >
                                  {requestingAction === inv._id ? <FaSync className="animate-spin" /> : <FaHistory size={12} />}
                                  RETURN (FULL)
                                </button>
                              )}
                              {isFieldAllowed("action_ewb") && (
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
                              )}
                              {isFieldAllowed("action_pdf") && inv.einvoiceStatus === "GENERATED" && (
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
                              {isFieldAllowed("action_cancel") && (
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
                              )}
                            </div>
                          </td>
                        )}
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
                                        <th className="text-right py-3">DISCOUNT</th>
                                        <th className="text-right py-3">TOTAL</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(inv.items || [])
                                        .filter(item => Number(item.qty || 0) > 0)
                                        .map((item, idx) => (
                                          <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition">
                                            <td className="py-3 font-bold text-slate-700">{item.name}</td>
                                            <td className="py-3 text-center font-black text-indigo-600 bg-indigo-50/50 rounded-lg">{item.qty} {item.unit || "Units"}</td>
                                            <td className="py-3 text-right">
                                              <div className="text-xs font-bold text-slate-400">{item.discountPercent || 0}%</div>
                                              <div className="text-[10px] text-red-500 font-black">-₹{(item.discountAmount || 0).toLocaleString()}</div>
                                            </td>
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
                                      {inv.commonDiscount > 0 && (
                                        <div className="flex justify-between border-b border-slate-50 pb-2">
                                          <span className="text-orange-600 font-bold uppercase tracking-tighter italic">Special Discount (-)</span>
                                          <span className="font-black text-orange-600">-₹{inv.commonDiscount.toLocaleString()}</span>
                                        </div>
                                      )}
                                      {inv.transportCharge > 0 && (
                                        <div className="flex justify-between border-b border-slate-50 pb-2">
                                          <span className="text-purple-600 font-bold uppercase tracking-tighter italic">Transport Charge (+)</span>
                                          <span className="font-black text-purple-600">
                                            ₹{inv.transportCharge.toLocaleString()}
                                            {inv.transportGstAmount > 0 && (
                                              <span className="text-[9px] ml-1 text-purple-400">
                                                (incl. ₹{inv.transportGstAmount.toFixed(2)} GST)
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                      )}
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
