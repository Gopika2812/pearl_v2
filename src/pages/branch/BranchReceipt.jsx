import React, { useEffect, useState } from "react";
import { FaChevronDown, FaChevronUp, FaFileAlt, FaPlus, FaSearch, FaHistory } from "react-icons/fa";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import CustomerDebitReceiptModal from "../../components/sales/CustomerDebitReceiptModal";
import CustomerReceiptModal from "../../components/inventory/CustomerReceiptModal";
import { useBranch } from "../../context/BranchContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : "https://pearls-erp-2026.onrender.com/api";

export default function BranchReceipt() {
  const { currentBranch, user } = useBranch();
  const navigate = useNavigate();
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [generalReceipts, setGeneralReceipts] = useState([]);
  const [creditNotes, setCreditNotes] = useState([]);
  const [receiptData, setReceiptData] = useState({});
  const [loading, setLoading] = useState(true);
  
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showDebitReceiptModal, setShowDebitReceiptModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [expandedInvoices, setExpandedInvoices] = useState({});

  // Pagination & Data Control
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInvoicesCount, setTotalInvoicesCount] = useState(0);
  const [limit] = useState(50); // Show 50 per page for better performance

  // Date filters
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
    const key = `branch-receipt_${fieldId}`;
    return user.fieldPermissions?.[key] !== false; // Default to true
  };

  const [searchTerm, setSearchTerm] = useState("");
  
  useEffect(() => {
    if (currentBranch?._id) fetchData();
  }, [currentBranch, fromDate, toDate, currentPage, searchTerm]);

  // Reset to page 1 when dates or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [fromDate, toDate, searchTerm]);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log("Fetching Branch Receipts for:", currentBranch?._id);
      
      // 1. Fetch Sales Invoices (Paginated & Filtered - GLOBAL SEARCH)
      const invResponse = await fetch(`${API_BASE}/invoices?branchId=${currentBranch._id}&fromDate=${fromDate}&toDate=${toDate}&page=${currentPage}&limit=${limit}&search=${encodeURIComponent(searchTerm)}`, {
        headers: { "Content-Type": "application/json" },
      });
      const invResult = await invResponse.json();
      const invArray = invResult.data || [];
      setInvoices(invArray);
      setTotalPages(invResult.pagination?.pages || 1);
      setTotalInvoicesCount(invResult.pagination?.total || invArray.length);

      // 2. Optimized: Fetch all receipts for these invoices in ONE call
      const allOrderIds = [
        ...invArray.map(i => i.salesOrderId?._id || i.salesOrderId).filter(Boolean)
      ];

      if (allOrderIds.length > 0) {
        const batchResponse = await fetch(`${API_BASE}/receipts/batch-summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIds: allOrderIds })
        });
        const batchResult = await batchResponse.json();
        if (batchResult.success) {
          const summary = batchResult.data;
          const newReceiptData = {};
          Object.keys(summary).forEach(id => {
            newReceiptData[id] = { totalReceived: summary[id], pending: 0 }; 
          });
          setReceiptData(newReceiptData);
        }
      }
    } catch (error) {
      console.error("Error fetching receipt data:", error);
      toast.error("Failed to load receipt management data");
    } finally {
      setLoading(false);
    }
  };

  const fetchReceiptsForInvoice = async (invoiceId) => {
    try {
      const branchId = currentBranch?._id || "";
      const response = await fetch(`${API_BASE}/receipts/order/${invoiceId}?branchId=${branchId}`, {
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      const receipts = result.data || [];

      const totalReceived = (receipts || []).reduce((sum, r) => {
        return r.paymentMethod === "BOUNCED" ? sum - (r.amount || 0) : sum + (r.amount || 0);
      }, 0);

      setReceiptData((prev) => ({
        ...prev,
        [invoiceId]: {
          ...prev[invoiceId],
          receipts: receipts || [],
          totalReceived,
        },
      }));
    } catch (error) {
      console.error("Error fetching receipts:", error);
    }
  };

  // Combine items for the same table with deduplication
  // Prefer Invoice objects over SalesOrder objects if they refer to the same thing
  const allItems = React.useMemo(() => {
    const combinedInvoicesMap = new Map();

    invoices.forEach(inv => {
      // Use Invoice Number as the primary display ID
      const displayKey = inv.invoiceNumber || inv._id;
      const orderId = inv.salesOrderId?._id || inv.salesOrderId || inv._id;
      
      combinedInvoicesMap.set(displayKey, { 
        ...inv, 
        _id: orderId, // Still use SO ID for receipt linking compatibility
        invoiceId: inv.invoiceNumber,
        rowType: "INVOICE" 
      });
    });

    return [
      ...Array.from(combinedInvoicesMap.values()),
      ...generalReceipts.map(gr => ({ ...gr, rowType: "GENERAL_RECEIPT" }))
    ].sort((a, b) => new Date(b.createdAt || b.invoiceDate) - new Date(a.createdAt || a.invoiceDate));
  }, [invoices, generalReceipts]);

  const toggleExpandInvoice = (invoiceId) => {
    if (!expandedInvoices[invoiceId]) {
      fetchReceiptsForInvoice(invoiceId);
    }
    setExpandedInvoices((prev) => ({
      ...prev,
      [invoiceId]: !prev[invoiceId],
    }));
  };

  const handleReceiptSuccess = () => {
    setShowReceiptModal(false);
    setSelectedInvoice(null);
    setSelectedCustomer(null);
    fetchData();
  };

  const filteredItems = React.useMemo(() => {
    // Note: Search is now handled globally by the backend!
    // We just need to return the allItems which are already filtered by the API
    return allItems;
  }, [allItems]);

  const getReceiptsForInvoice = (invoiceId) => {
    return receiptData[invoiceId]?.receipts || [];
  };

  const getCreditNoteAmount = (invoice) => {
    const invoiceId = invoice.invoiceId || invoice._id;
    // Match by originalInvoiceId or originalSalesOrderId
    return creditNotes
      .filter(cn => cn.originalInvoiceId === invoiceId || cn.originalSalesOrderId === invoice._id)
      .reduce((sum, cn) => sum + (cn.grandTotal || 0), 0);
  };

  const getTotalReceivedAmount = (invoice) => {
    return receiptData[invoice._id]?.totalReceived || 0;
  };

  const getReceiptStatus = (invoice) => {
    const receipts = getReceiptsForInvoice(invoice._id);
    if (receipts.length === 0) return "No Receipts";
    return `${receipts.length} Receipt${receipts.length > 1 ? "s" : ""}`;
  };

  const getStatusColor = (invoice) => {
    const received = getTotalReceivedAmount(invoice);
    const balance = invoice.grandTotal || 0;
    if (received === 0) return "bg-blue-100 text-blue-700";
    if (received < balance / 2) return "bg-orange-100 text-orange-700";
    return "bg-green-100 text-green-700";
  };

  const handleReceivePayment = (invoice, pending) => {
    // We need the full customer object for the new modal
    // Note: SalesOrder stores customer as an object with 'customerId' property
    const cust = invoice.customer || {};
    const customerId = cust.customerId || (typeof cust === 'string' ? cust : null);
    const customerName = cust.name || "Unknown Customer";
    
    // Safely extract the ID string
    let finalId = "";
    if (typeof customerId === 'string') finalId = customerId;
    else if (customerId && customerId._id) finalId = customerId._id.toString();
    else if (customerId) finalId = customerId.toString();

    if (!finalId || finalId === "[object Object]") {
        console.error("❌ Invalid Customer ID extracted:", customerId);
        return toast.error("Could not determine Customer ID");
    }
    
    // Set both to trigger the modal correctly
    setSelectedCustomer({ _id: finalId, name: customerName, branchId: invoice.branchId });
    setSelectedInvoice(invoice);
    setShowReceiptModal(true);
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full px-2 sm:px-4 py-2">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 text-white shadow-lg p-6 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FaFileAlt className="text-5xl opacity-80" />
              <div>
                <h1 className="text-4xl font-bold">Receipt Management</h1>
                <p className="text-cyan-100 mt-2">Receive payments from customers</p>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => navigate("/branch/receipt-records")}
                className="flex items-center gap-2 bg-cyan-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-cyan-900 transition shadow-lg border border-cyan-400"
              >
                <FaHistory /> View Records
              </button>
              <button
                onClick={() => setShowDebitReceiptModal(true)}
                className="flex items-center gap-2 bg-white text-cyan-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition shadow-lg"
                title="Create Customer Debit Receipt"
              >
                <FaPlus /> Debit Receipt
              </button>
            </div>
          </div>
        </div>

        {/* FILTERS BAR */}
        <div className="bg-white shadow-md p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-4 border border-cyan-100 items-end">
          <div className="md:col-span-2 relative">
            <label className="block text-[10px] font-bold text-cyan-600 uppercase mb-1">Search Records</label>
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400" />
              <input
                type="text"
                placeholder="Search by Order / Invoice ID, Customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-cyan-50/30 border border-cyan-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all text-sm font-medium"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-cyan-600 uppercase mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 py-2 bg-cyan-50/30 border border-cyan-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-cyan-600 uppercase mb-1">To Date</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-2 bg-cyan-50/30 border border-cyan-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all text-sm font-medium"
              />
              <button 
                onClick={() => {
                  setFromDate(new Date().toISOString().split('T')[0]);
                  setToDate(new Date().toISOString().split('T')[0]);
                  setSearchTerm("");
                  setCurrentPage(1);
                }}
                className="bg-cyan-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-cyan-700 transition flex-shrink-0"
              >
                TODAY
              </button>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="bg-white shadow-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">Loading sales invoices...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No matching sales invoices or receipts available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-cyan-50 to-cyan-100 border-b">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Expand</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Invoice ID</th>
                    {isFieldAllowed("customerDetails") && <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>}
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Warehouse</th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">Items</th>
                    {isFieldAllowed("amount") && (
                      <>
                        <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase">Total Amount</th>
                        <th className="px-4 py-4 text-right text-xs font-bold text-red-600 uppercase font-bold">Returns (CN)</th>
                        <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase">Received</th>
                        <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase">Pending</th>
                      </>
                    )}
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">Status</th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">Date</th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">                  {filteredItems.map((item) => (
                    <ReceiptRow
                      key={item._id}
                      item={item}
                      isExpanded={expandedInvoices[item._id]}
                      onToggleExpand={toggleExpandInvoice}
                      onReceive={handleReceivePayment}
                      receipts={getReceiptsForInvoice(item._id)}
                      isFieldAllowed={isFieldAllowed}
                      formatDateTime={formatDateTime}
                      getStatusColor={getStatusColor}
                      getReceiptStatus={getReceiptStatus}
                      getTotalReceivedAmount={getTotalReceivedAmount}
                      getCreditNoteAmount={getCreditNoteAmount}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-4 py-4 border-t flex items-center justify-between">
              <div className="text-xs font-bold text-gray-500 uppercase">
                Page <span className="text-cyan-600">{currentPage}</span> of <span className="text-cyan-600">{totalPages}</span>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className={`px-4 py-2 rounded-lg font-bold text-xs transition ${
                    currentPage === 1 
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed" 
                      : "bg-white border border-cyan-200 text-cyan-600 hover:bg-cyan-50 shadow-sm"
                  }`}
                >
                  PREVIOUS
                </button>
                
                {/* Simple Page Numbers */}
                <div className="hidden md:flex gap-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    // Only show 5 pages around current
                    if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-lg font-bold text-xs transition ${
                            currentPage === pageNum
                              ? "bg-cyan-600 text-white shadow-md"
                              : "bg-white border border-gray-200 text-gray-600 hover:border-cyan-400"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (pageNum === currentPage - 3 || pageNum === currentPage + 3) {
                      return <span key={pageNum} className="px-1 text-gray-400">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className={`px-4 py-2 rounded-lg font-bold text-xs transition ${
                    currentPage === totalPages 
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed" 
                      : "bg-cyan-600 text-white hover:bg-cyan-700 shadow-md"
                  }`}
                >
                  NEXT
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RECEIPT SUMMARY */}
        {filteredItems.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
              <p className="text-gray-600 text-sm uppercase font-bold mb-2">Total Invoices</p>
              <p className="text-3xl font-black text-gray-800">
                {totalInvoicesCount}
              </p>
            </div>

            {isFieldAllowed("amount") && (
              <>
                <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
                  <p className="text-gray-600 text-sm uppercase font-bold mb-2">Total Received</p>
                  <p className="text-3xl font-black text-green-600">
                    ₹{filteredItems.reduce((sum, item) => {
                      const isOrder = item.rowType === "ORDER" || item.rowType === "INVOICE";
                      return sum + (isOrder ? getTotalReceivedAmount(item) : (item.amount || 0));
                    }, 0).toLocaleString()}
                  </p>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500">
                  <p className="text-gray-600 text-sm uppercase font-bold mb-2">Total Pending</p>
                  <p className="text-3xl font-black text-orange-600">
                    ₹{filteredItems.reduce((sum, item) => {
                      const isOrder = item.rowType === "ORDER" || item.rowType === "INVOICE";
                      if (!isOrder) return sum;
                      const total = item.grandTotal || 0;
                      const received = getTotalReceivedAmount(item);
                      return sum + Math.max(0, total - received);
                    }, 0).toLocaleString()}
                  </p>
                </div>
              </>
            )}

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-500">
              <p className="text-gray-600 text-sm uppercase font-bold mb-2">Total Records</p>
              <p className="text-3xl font-black text-purple-600">
                {filteredItems.length}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* RECEIPT MODAL (UPGRADED TO CUSTOMER-CENTRIC) */}
      <CustomerReceiptModal
        isOpen={showReceiptModal}
        onClose={() => {
            setShowReceiptModal(false);
            setSelectedCustomer(null);
            setSelectedInvoice(null);
        }}
        customer={selectedCustomer}
        branchId={currentBranch?._id}
        initialInvoiceId={selectedInvoice?._id}
        onPaymentSuccess={handleReceiptSuccess}
      />

      {/* CUSTOMER DEBIT RECEIPT MODAL */}
      <CustomerDebitReceiptModal
        isOpen={showDebitReceiptModal}
        onClose={() => setShowDebitReceiptModal(false)}
        onReceiptSuccess={() => {
          setShowDebitReceiptModal(false);
          fetchData();
        }}
      />
    </div>
  );
}

// ⚡ PERFORMANCE OPTIMIZATION: Memoized Row Component to prevent unnecessary re-renders
const ReceiptRow = React.memo(({ 
  item, 
  isExpanded, 
  onToggleExpand, 
  onReceive, 
  receipts, 
  isFieldAllowed, 
  formatDateTime,
  getStatusColor,
  getReceiptStatus,
  getTotalReceivedAmount,
  getCreditNoteAmount
}) => {
  const isOrder = item.rowType === "ORDER" || item.rowType === "INVOICE";
  
  // Unified calculations
  const displayId = item.invoiceNumber || item.invoiceId || item.receiptId;
  const customerName = typeof item.customer === "object" ? item.customer?.name : item.customer;
  const totalAmount = isOrder ? (item.grandTotal || 0) : (item.amount || 0);
  const credNotes = isOrder ? getCreditNoteAmount(item) : 0;
  const received = isOrder ? getTotalReceivedAmount(item) : (item.amount || 0);
  const pending = isOrder ? Math.max(0, totalAmount - credNotes - received) : 0;
  
  // LATEST REQUIREMENT: Hide fully settled/credited bills
  if (isOrder && pending <= 0 && credNotes > 0) return null;

  const statusText = isOrder ? getReceiptStatus(item) : `Paid via ${item.paymentMethod || 'CASH'}`;
  const WarehouseName = isOrder ? (item.warehouse?.name || item.warehouse || "N/A") : "Direct Settle";

  return (
    <React.Fragment>
      {/* MAIN ROW */}
      <tr className={`${!isOrder ? "bg-gray-50/50" : ""} hover:bg-gray-50 transition`}>
        <td className="px-2 py-3 text-center">
          {isOrder ? (
            <button
              onClick={() => onToggleExpand(item._id)}
              className="text-cyan-600 hover:text-cyan-700 transition"
            >
              {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
            </button>
          ) : "-"}
        </td>
        <td className="px-4 py-3 font-bold text-cyan-600">
          {displayId}
        </td>
        {isFieldAllowed("customerDetails") && (
          <td className="px-4 py-3 font-semibold text-gray-800">
            {customerName}
          </td>
        )}
        <td className="px-4 py-3 text-gray-600 text-sm">
          {WarehouseName}
        </td>
        <td className="px-4 py-3 text-center">
          <span className="bg-cyan-600/10 text-cyan-600 px-3 py-1 rounded-full text-xs font-bold">
            {isOrder ? (item.items?.length || item.invoiceItems?.length || item.lastInvoicedItems?.length || 0) : 1}
          </span>
        </td>
        {isFieldAllowed("amount") && (
          <>
            <td className="px-4 py-3 text-right font-bold">
              ₹{totalAmount.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right font-bold text-red-500">
              {credNotes > 0 ? `- ₹${credNotes.toLocaleString()}` : "-"}
            </td>
            <td className="px-4 py-3 text-right font-bold text-green-600">
              ₹{received.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right font-bold text-orange-600">
              ₹{pending.toLocaleString()}
            </td>
          </>
        )}
        <td className="px-4 py-3 text-center">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              isOrder ? getStatusColor(item) : "bg-purple-100 text-purple-700"
            }`}
          >
            {statusText}
          </span>
        </td>
        <td className="px-4 py-3 text-center text-gray-600 text-[10px] leading-tight">
          {formatDateTime(item.createdAt || item.date || item.invoiceDate)}
        </td>
        <td className="px-4 py-3 text-center">
           <div className="flex justify-center gap-2">
             {isOrder ? (
               <>
                 {pending > 0 ? (
                   <button
                     onClick={() => onReceive(item, pending)}
                     className="inline-flex items-center gap-2 bg-cyan-600 text-white px-3 py-1.5 rounded-lg font-bold text-[10px] hover:bg-cyan-700 transition shadow-sm"
                   >
                     RECEIVE
                   </button>
                 ) : (
                   <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg font-bold text-[10px]">
                     ✓ Paid
                   </span>
                 )}
               </>
             ) : (
               <span className="text-[10px] text-gray-400 font-bold italic bg-gray-50 px-2 py-1 rounded">Settlement Log</span>
             )}
           </div>
        </td>
      </tr>
      {/* EXPANDED SECTION */}
      {isExpanded && (
        <tr>
           <td colSpan={11} className="p-0">
              <div className="bg-cyan-50/50 p-4 border-b border-cyan-100">
                 <div className="flex items-center gap-2 mb-3 text-xs font-black text-cyan-700 uppercase tracking-widest">
                    <FaHistory size={14} /> Payment History for {displayId}
                 </div>
                 <div className="bg-white rounded-xl shadow-sm border border-cyan-100 overflow-hidden">
                    <table className="w-full text-xs">
                       <thead className="bg-cyan-50 text-cyan-600 uppercase font-black tracking-tighter">
                          <tr>
                             <th className="px-4 py-2 text-left">Receipt ID</th>
                             <th className="px-4 py-2 text-left">Date</th>
                             <th className="px-4 py-2 text-center">Mode</th>
                             <th className="px-4 py-2 text-right">Amount</th>
                             <th className="px-4 py-2 text-center">Reference</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-cyan-50">
                          {receipts.length === 0 ? (
                             <tr>
                                <td colSpan={5} className="py-4 text-center text-gray-400 font-medium italic">
                                   No payment receipts found for this transaction.
                                </td>
                             </tr>
                          ) : (
                             receipts.map((r, ri) => (
                                <tr key={ri} className="hover:bg-cyan-50/30 transition">
                                   <td className="px-4 py-2 font-bold text-cyan-700">{r.receiptId}</td>
                                   <td className="px-4 py-2 text-gray-500 font-medium">{formatDateTime(r.createdAt)}</td>
                                   <td className="px-4 py-2 text-center">
                                      <span className="bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{r.paymentMethod}</span>
                                   </td>
                                   <td className="px-4 py-2 text-right font-black text-gray-800">₹{r.amount.toLocaleString()}</td>
                                   <td className="px-4 py-2 text-center text-gray-400 font-medium">{r.reference || "-"}</td>
                                </tr>
                             ))
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           </td>
        </tr>
      )}
    </React.Fragment>
  );
});
