import React, { useEffect, useState } from "react";
import { FaChevronDown, FaEdit, FaFileInvoice, FaSync, FaTrash, FaFilePdf, FaFileExcel, FaTruck, FaBan } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE } from "../../api";
import EditBillModal from "../../components/EditBillModal";
import InvoiceGeneratorModal from "../../components/InvoiceGeneratorModal";
import AggregateSlipModal from "../../components/branch/AggregateSlipModal";
import { useBranch } from "../../context/BranchContext";
import { getInvoiceHTML } from "../../utils/invoiceUtils";

const BranchInvoicedOrders = () => {
  const { currentBranch, user } = useBranch();
  const navigate = useNavigate();

  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
    const key = `invoiced-orders_${fieldId}`;
    return user.fieldPermissions?.[key] !== false; // Default to true
  };

  const [salesOrders, setSalesOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showEditBillModal, setShowEditBillModal] = useState(false);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [invoicesByOrder, setInvoicesByOrder] = useState({}); // New: store invoices for each SO
  const [requestingReEdit, setRequestingReEdit] = useState(null); // ID of order currently requesting re-edit
  const [showCopyChoice, setShowCopyChoice] = useState(false);
  const [processingPrint, setProcessingPrint] = useState(false);
  const [voucherTypes, setVoucherTypes] = useState([]);

  // Cancel SO state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [cancelNarration, setCancelNarration] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Filter states
  const [filterVoucherType, setFilterVoucherType] = useState("");
  const [filterGenerated, setFilterGenerated] = useState(""); // ALL, GENERATED, NOT_GENERATED
  const [filterInvoiceId, setFilterInvoiceId] = useState("");
  const [filterCustomerName, setFilterCustomerName] = useState("");
  const [filterFromDate, setFilterFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterToDate, setFilterToDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterFromTime, setFilterFromTime] = useState("");
  const [filterToTime, setFilterToTime] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Search debounce logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch((filterInvoiceId || filterCustomerName || "").trim());
    }, 500);
    return () => clearTimeout(handler);
  }, [filterInvoiceId, filterCustomerName]);

  // Selection state for multi-select loading slip
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const selectedOrders = salesOrders.filter(so => selectedOrderIds.includes(so._id));

  // Fetch sales orders for current branch
  const fetchSalesOrders = async () => {
    // Get branch ID from context
    if (!currentBranch?._id) {
      toast.error("Branch not selected. Please select a branch from the sidebar.");
      return;
    }

    setLoading(true);
    try {
      const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : "";
      const voucherParam = filterVoucherType ? `&voucherType=${encodeURIComponent(filterVoucherType)}` : "";
      const generatedParam = filterGenerated ? `&generated=${filterGenerated === "GENERATED"}` : "";

      const res = await fetch(
        `${API_BASE}/sales-orders?branchId=${currentBranch._id}&isClaim=false&fromDate=${filterFromDate}&toDate=${filterToDate}${searchParam}${voucherParam}${generatedParam}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to fetch orders");

      setSalesOrders(data || []);
      toast.success(`Fetched ${data?.length || 0} sales orders`);
    } catch (err) {
      console.error("Error fetching sales orders:", err);
      toast.error(err.message || "Failed to fetch sales orders");
    } finally {
      setLoading(false);
    }
  };

  const fetchVoucherTypes = async () => {
    if (!currentBranch?._id) return;
    try {
      const res = await fetch(`${API_BASE}/voucher-types?branchId=${currentBranch._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      if (data.success) {
        // 🎯 FILTER: Only show types meant for Sales Orders (SO)
        const relevantTypes = (data.data || []).filter(v => v.orderType === "SO");
        setVoucherTypes(relevantTypes);
      }
    } catch (err) {
      console.error("Error fetching voucher types:", err);
    }
  };

  useEffect(() => {
    fetchSalesOrders();
  }, [currentBranch?._id, filterFromDate, filterToDate, debouncedSearch, filterVoucherType, filterGenerated]);

  useEffect(() => {
    fetchVoucherTypes();
  }, [currentBranch?._id]);

  const resetFilters = () => {
    setFilterInvoiceId("");
    setFilterCustomerName("");
    setFilterFromDate(new Date().toISOString().split('T')[0]);
    setFilterToDate(new Date().toISOString().split('T')[0]);
    setFilterVoucherType("");
    setFilterGenerated("");
    toast.info("Filters reset to Today");
  };

  const handleGenerateInvoice = (order) => {
    setSelectedOrder(order);
    setShowModal(true); // Open the Back Order Workbench / Generator
  };

  /**
   * ⚡ DIRECT PRINT: Processes the invoice in the background and prints.
   */
  const handleDirectPrint = async (numCopies) => {
    if (!selectedOrder) return;

    setProcessingPrint(true);
    setShowCopyChoice(false);

    try {
      // 1. Generate Invoice Preview with default items (100% quantity)
      const defaultItems = (selectedOrder.items || []).map(item => ({
        ...item,
        confirmedQty: item.qty,
        backOrderQty: 0
      }));

      const previewRes = await fetch(`${API_BASE}/invoices/preview/${selectedOrder._id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          items: defaultItems,
          notes: selectedOrder.notes || "",
          invoiceType: "TAX_INVOICE",
          commonDiscount: selectedOrder.commonDiscount || 0
        })
      });

      const previewData = await previewRes.json();
      if (!previewRes.ok) throw new Error(previewData.message || "Preview failed");

      // 2. Finalize Invoice
      const finalizeRes = await fetch(`${API_BASE}/invoices/finalize/${selectedOrder._id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          items: defaultItems,
          notes: selectedOrder.notes || "",
          invoiceType: "TAX_INVOICE",
          commonDiscount: selectedOrder.commonDiscount || 0,
          finalizedBy: user?.id || user?._id,
          finalizedByUsername: user?.username || user?.fullName || user?.name || "System",
        })
      });

      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok) throw new Error(finalizeData.message || "Finalize failed");

      // 3. Trigger Print
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.warning("🔔 Pop-up blocked! Please allow pop-ups to print.");
      } else {
        const html = getInvoiceHTML(previewData, numCopies, selectedOrder, finalizeData.invoice);
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
          setTimeout(() => printWindow.close(), 1000);
        }, 500);
      }

      toast.success("✅ Invoice generated and print triggered!");
      fetchSalesOrders(); // Refresh list
    } catch (err) {
      console.error("Direct print failed:", err);
      toast.error(err.message || "Failed to generate invoice");
    } finally {
      setProcessingPrint(false);
      setSelectedOrder(null);
    }
  };

  const handleEditBill = (order) => {
    setEditingOrder(order);
    setShowEditBillModal(true);
  };

  const handleSaveEditedBill = async (updatedOrder) => {
    try {
      const res = await fetch(`${API_BASE}/sales-orders/${updatedOrder._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          items: updatedOrder.items,
          sampleItems: updatedOrder.sampleItems,
          customer: updatedOrder.customer,
          transportCharge: updatedOrder.transportCharge,
          transportGstPercent: updatedOrder.transportGstPercent,
          transportGstAmount: updatedOrder.transportGstAmount,
          subtotal: updatedOrder.subtotal,
          totalTax: updatedOrder.totalTax,
          totalDiscount: updatedOrder.totalDiscount,
          commonDiscount: updatedOrder.commonDiscount,
          roundOff: updatedOrder.roundOff,
          grandTotal: updatedOrder.grandTotal,
          updatedBy: user?.id || user?._id,
          updatedByUsername: user?.username || user?.billingPerson || localStorage.getItem("username"),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update order");

      // Use the server-returned order (re-calculated by DB) to update state
      const serverUpdatedOrder = data.data || data.order || updatedOrder;

      setSalesOrders((prev) =>
        prev.map((order) =>
          order._id === serverUpdatedOrder._id ? serverUpdatedOrder : order
        )
      );

      toast.success("Bill updated successfully!");
      fetchSalesOrders(); // 🔄 Forced database-wide sync
    } catch (err) {
      console.error("Error updating bill:", err);
      toast.error(err.message || "Failed to update bill");
    }
  };

  const handleDirectReEdit = async (orderId) => {
    if (!window.confirm("Re-Edit this bill? It will be unlocked for modification, and any quantity/balance changes will be calculated as a Delta on re-invoice.")) {
      return;
    }
    setRequestingReEdit(orderId);
    try {
      const res = await fetch(`${API_BASE}/sales-orders/${orderId}/approve-edit`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ editedBy: user?.username || user?.billingPerson })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Bill unlocked for editing");
        fetchSalesOrders();
      } else {
        toast.error(data.message || "Failed to unlock bill");
      }
    } catch (err) {
      toast.error("Error unlocking bill");
    } finally {
      setRequestingReEdit(null);
    }
  };

  const handleOpenCancelModal = (order) => {
    setCancellingOrder(order);
    setCancelNarration("");
    setShowCancelModal(true);
  };

  const handleCancelOrder = async () => {
    if (!cancelNarration.trim()) {
      toast.warning("Please enter a narration / reason for cancellation");
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch(`${API_BASE}/sales-orders/${cancellingOrder._id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ narration: cancelNarration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to cancel");
      toast.success(`✅ ${cancellingOrder.invoiceId} cancelled successfully`);
      setShowCancelModal(false);
      setCancellingOrder(null);
      fetchSalesOrders();
    } catch (err) {
      toast.error(err.message || "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  };



  const toggleExpanded = (orderId) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));

    // Fetch invoices for this sales order when expanding
    if (!expandedOrders[orderId]) {
      fetchInvoicesForOrder(orderId);
    }
  };

  // Fetch invoices for a specific sales order
  const fetchInvoicesForOrder = async (salesOrderId) => {
    try {
      const res = await fetch(
        `${API_BASE}/invoices?salesOrderId=${salesOrderId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      const data = await res.json();

      setInvoicesByOrder((prev) => ({
        ...prev,
        [salesOrderId]: data || [],
      }));
    } catch (err) {
      console.error("Error fetching invoices:", err);
    }
  };

  // Filter sales orders based on criteria
  const filteredSalesOrders = salesOrders.filter((order) => {
    // 🚩 REMOVED FILTER - ALL ORDERS SHOULD BE VISIBLE AS RECORDS

    const matchesVoucherType = filterVoucherType === "" ||
      (order.voucherType && order.voucherType.toLowerCase().includes(filterVoucherType.toLowerCase()));

    const matchesInvoiceId = filterInvoiceId === "" ||
      (order.invoiceId && order.invoiceId.toLowerCase().includes(filterInvoiceId.toLowerCase()));

    const matchesCustomerName = filterCustomerName === "" ||
      (order.customer?.name && order.customer.name.toLowerCase().includes(filterCustomerName.toLowerCase()));


    const od = order.orderDate ? new Date(order.orderDate) : null;
    const ct = new Date(order.createdAt);
    const displayDate = od ? od : ct;
    const orderDateStr = `${displayDate.getFullYear()}-${String(displayDate.getMonth() + 1).padStart(2, "0")}-${String(displayDate.getDate()).padStart(2, "0")}`;
    const orderTimeStr = `${String(ct.getHours()).padStart(2, "0")}:${String(ct.getMinutes()).padStart(2, "0")}`;

    const matchesFromDate = filterFromDate === "" || orderDateStr >= filterFromDate;
    const matchesToDate = filterToDate === "" || orderDateStr <= filterToDate;
    const matchesFromTime = filterFromTime === "" || filterFromDate === "" || orderDateStr > filterFromDate || (orderDateStr === filterFromDate && orderTimeStr >= filterFromTime);
    const matchesToTime = filterToTime === "" || filterToDate === "" || orderDateStr < filterToDate || (orderDateStr === filterToDate && orderTimeStr <= filterToTime);

    const matchesGenerated = filterGenerated === "" ||
      (filterGenerated === "GENERATED" && order.invoiceGenerated) ||
      (filterGenerated === "NOT_GENERATED" && !order.invoiceGenerated);

    return matchesVoucherType && matchesInvoiceId && matchesCustomerName && matchesFromDate && matchesToDate && matchesFromTime && matchesToTime && matchesGenerated;
  });

  const handleExportPDF = () => {
    const doc = new jsPDF();

    const tableColumn = ["Invoice ID", "Customer", "Grand Total"];
    const tableRows = [];

    filteredSalesOrders.forEach((order) => {
      const orderData = [
        order.invoiceId,
        order.customer?.name || "N/A",
        `Rs. ${(order.grandTotal || 0).toLocaleString()}`
      ];
      tableRows.push(orderData);
    });

    // Add a title
    doc.setFontSize(18);
    doc.text("Invoiced Orders Report", 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    // Generate table using the autoTable function directly
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 25,
      theme: 'grid',
      headStyles: { fillColor: [49, 155, 171] }, // Matches #319bab
      alternateRowStyles: { fillColor: [240, 240, 240] },
      margin: { top: 25 }
    });

    doc.save(`Invoiced_Orders_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("PDF report generated successfully");
  };

  const handleExportExcel = () => {
    try {
      const invoicedOnly = filteredSalesOrders.filter(order => order.invoiceGenerated);

      if (invoicedOnly.length === 0) {
        toast.warn("No invoiced data to export");
        return;
      }

      const exportData = invoicedOnly.map((order) => ({
        "Date": new Date(order.createdAt).toLocaleDateString("en-IN"),
        "Invoice ID": order.invoiceId || "-",
        "Customer Name": order.customer?.name || "-",
        "Customer WhatsApp": order.customer?.whatsapp || "-",
        "Items Count": (order.items || []).length + (order.sampleItems || []).length,
        "Sub Total": order.subtotal || 0,
        "Grand Total": order.grandTotal || 0,
      }));

      // Add final summary row
      const totalSub = exportData.reduce((sum, row) => sum + row["Sub Total"], 0);
      const totalGrand = exportData.reduce((sum, row) => sum + row["Grand Total"], 0);

      exportData.push({
        "Date": "TOTAL",
        "Invoice ID": "",
        "Customer Name": "",
        "Customer WhatsApp": "",
        "Items Count": "",
        "Sub Total": totalSub,
        "Grand Total": totalGrand,
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Invoiced Orders");
      XLSX.writeFile(workbook, `Invoiced_Orders_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Excel exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export Excel");
    }
  };

  const handleExportDetailedExcel = () => {
    try {
      const invoicedOnly = filteredSalesOrders.filter(order => order.invoiceGenerated || order.status === "CONFIRMED");

      if (invoicedOnly.length === 0) {
        toast.warn("No data to export for detailed report");
        return;
      }

      const rows = [];

      // Header for the detailed report
      const headerRow = [
        "Date", "Invoice No", "Customer", "Product Name", "Price", "Qty", "GST (%)", "Discount (Amt)", "Line Total"
      ];
      rows.push(headerRow);

      invoicedOnly.forEach((order) => {
        const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN");
        const invoiceNo = order.invoiceId || order.salesInvoiceId || "-";
        const customerName = order.customer?.name || "-";

        // 1. Add each regular item
        const items = order.invoiceItems || order.items || [];
        items.forEach((item) => {
          rows.push([
            orderDate,
            invoiceNo,
            customerName,
            item.name,
            item.sellingPrice || 0,
            item.qty || 0,
            `${item.gst || 0}%`,
            item.discountAmount || 0,
            item.total || 0
          ]);
        });

        // 2. Add sample items if any
        const samples = order.invoiceSampleItems || order.sampleItems || [];
        samples.forEach((sample) => {
          rows.push([
            orderDate,
            invoiceNo,
            customerName,
            `🎁 (Sample) ${sample.name}`,
            sample.sellingPrice || 0, // Usually 0 or reduced
            sample.qty || 0,
            "0%", // Samples usually exempt or handled separately
            0,
            0 // Samples are not billed
          ]);
        });

        // 3. Add Transport Charge if applicable
        if (order.transportCharge > 0) {
          rows.push([
            "", "", "", "🚚 Transport Charge", "", "", "", "", order.transportCharge
          ]);
        }

        // 4. Add Special/Common Discount if applicable
        if (order.commonDiscount > 0) {
          rows.push([
            "", "", "", "🛡️ Special Discount", "", "", "", "", -order.commonDiscount
          ]);
        }

        // 5. Add Sub Total
        rows.push([
          "", "", "", "📊 SUB TOTAL", "", "", "", "", order.subtotal || 0
        ]);

        // 6. Add Grand Total
        rows.push([
          "", "", "", "💰 GRAND TOTAL", "", "", "", "", order.grandTotal || 0
        ]);

        // 7. Add Blank Row for separation
        rows.push(["", "", "", "", "", "", "", "", ""]);
      });

      // Add Final Summary Row for the entire report
      const totalSubAll = invoicedOnly.reduce((sum, o) => sum + (o.subtotal || 0), 0);
      const totalGrandAll = invoicedOnly.reduce((sum, o) => sum + (o.grandTotal || 0), 0);

      rows.push(["", "", "", "━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", "", "━━━━━━━━━━"]);
      rows.push(["", "", "", "🔥 TOTAL (ALL ORDERS)", "", "", "", "", ""]);
      rows.push(["", "", "", "Total Sub Total", "", "", "", "", totalSubAll]);
      rows.push(["", "", "", "Total Grand Total", "", "", "", "", totalGrandAll]);

      const worksheet = XLSX.utils.aoa_to_sheet(rows);

      // Styling columns width (approximate)
      const wscols = [
        { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 15 }
      ];
      worksheet['!cols'] = wscols;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Detailed Export");
      XLSX.writeFile(workbook, `Detailed_Sales_Report_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success("Detailed Excel exported successfully!");
    } catch (error) {
      console.error("Detailed export error:", error);
      toast.error("Failed to generate detailed Excel report");
    }
  };

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

      <div className="w-full mx-auto px-4 sm:px-8 py-4">
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#319bab] to-[#257f87] rounded-xl flex items-center justify-center">
                <FaFileInvoice className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-800">
                  Sales Order List
                </h1>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Pending Orders (SO)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExportPDF}
                disabled={filteredSalesOrders.length === 0}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50 shadow-sm text-sm font-bold"
              >
                <FaFilePdf /> PDF
              </button>
              <button
                onClick={handleExportExcel}
                disabled={filteredSalesOrders.length === 0}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50 shadow-sm text-sm font-bold"
              >
                <FaFileExcel /> Summary
              </button>
              <button
                onClick={handleExportDetailedExcel}
                disabled={filteredSalesOrders.length === 0}
                className="flex items-center gap-2 bg-indigo-700 text-white px-4 py-2 rounded-lg hover:bg-indigo-800 transition disabled:opacity-50 shadow-sm text-sm font-bold"
                title="Export with individual product lines and totals"
              >
                <FaFileExcel /> Detailed Report
              </button>
              <button
                onClick={() => {
                  if (selectedOrderIds.length > 0) {
                    setShowSlipModal(true);
                  } else {
                    toast.warn("Please select at least one order to generate a consolidated slip");
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition shadow-sm text-sm font-bold ${selectedOrderIds.length > 0
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
              >
                <FaTruck />
                Generate Consolidated Slip ({selectedOrderIds.length})
              </button>
              <button
                onClick={fetchSalesOrders}
                disabled={loading}
                className="flex items-center gap-2 bg-[#319bab] text-white px-4 py-2 rounded-lg hover:bg-[#257f87] transition disabled:opacity-50 shadow-sm"
              >
                <FaSync className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 relative overflow-hidden">
          {debouncedSearch && (
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#319bab] via-indigo-500 to-[#319bab] animate-pulse"></div>
          )}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">Filters</h3>
            {debouncedSearch && (
              <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-widest animate-bounce">
                🌍 Searching Globally (All Dates)
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4">

            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight">Invoice ID</label>
              <input
                type="text"
                placeholder="Search invoice ID..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#319bab] outline-none text-sm"
                value={filterInvoiceId}
                onChange={(e) => setFilterInvoiceId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight">Customer Name</label>
              <input
                type="text"
                placeholder="Search customer..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#319bab] outline-none text-sm"
                value={filterCustomerName}
                onChange={(e) => setFilterCustomerName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight">From Date</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#319bab] outline-none text-sm"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight">From Time</label>
              <input
                type="time"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#319bab] outline-none text-sm"
                value={filterFromTime}
                onChange={(e) => setFilterFromTime(e.target.value)}
                disabled={!filterFromDate}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight">To Date</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#319bab] outline-none text-sm"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight">To Time</label>
              <input
                type="time"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#319bab] outline-none text-sm"
                value={filterToTime}
                onChange={(e) => setFilterToTime(e.target.value)}
                disabled={!filterToDate}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight">Voucher Type</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none text-sm bg-white font-bold"
                value={filterVoucherType}
                onChange={(e) => setFilterVoucherType(e.target.value)}
              >
                <option value="">ALL TYPES</option>
                {voucherTypes.map((v) => (
                  <option key={v._id} value={v.name}>
                    {v.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight">Generation</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none text-sm bg-white font-bold"
                value={filterGenerated}
                onChange={(e) => setFilterGenerated(e.target.value)}
              >
                <option value="">ALL STATUS</option>
                <option value="GENERATED" className="text-green-600">GENERATED</option>
                <option value="NOT_GENERATED" className="text-red-500">NOT GENERATED</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full bg-slate-100 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-200 transition text-sm font-bold flex items-center justify-center gap-2 border border-slate-200 h-[38px]"
                title="Reset to Today"
              >
                <FaSync className="text-xs" /> Reset
              </button>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Showing {filteredSalesOrders.length} of {salesOrders.length} orders
          </div>
        </div>

        {/* SALES ORDERS TABLE */}
        {loading ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="animate-pulse">Loading sales orders...</div>
          </div>
        ) : filteredSalesOrders.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-gray-500">{salesOrders.length === 0 ? "No sales orders found" : "No orders match your filters"}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold border-b">
                  <tr>
                    <th className="px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrderIds(filteredSalesOrders.map(so => so._id));
                          } else {
                            setSelectedOrderIds([]);
                          }
                        }}
                        checked={filteredSalesOrders.length > 0 && selectedOrderIds.length === filteredSalesOrders.length}
                      />
                    </th>
                    <th className="px-6 py-4 text-left">Invoice ID</th>
                    <th className="px-6 py-4 text-left">Voucher Type</th>
                    <th className="px-6 py-4 text-left">Customer</th>
                    {isFieldAllowed("itemsCount") && <th className="px-6 py-4 text-center">Items</th>}
                    {isFieldAllowed("grandTotal") && <th className="px-6 py-4 text-right">Grand Total</th>}
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Date</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSalesOrders.map((order) => (
                    <React.Fragment key={order._id}>
                      <tr className={`hover:bg-gray-50 transition ${order.status === "CANCELLED" ? "opacity-60 bg-red-50/50" : ""}`}>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                            checked={selectedOrderIds.includes(order._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrderIds(prev => [...prev, order._id]);
                              } else {
                                setSelectedOrderIds(prev => prev.filter(id => id !== order._id));
                              }
                            }}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleExpanded(order._id)}
                              className="text-[#319bab] hover:bg-gray-200 p-1 rounded transition"
                            >
                              <FaChevronDown
                                className={`text-xs transition-transform ${expandedOrders[order._id]
                                  ? "rotate-180"
                                  : ""
                                  }`}
                              />
                            </button>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <div className={`p-1 w-2 h-2 rounded-full ${order.invoiceGenerated ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`} title={order.invoiceGenerated ? "Invoice Generated" : "Pending Invoice"}></div>
                                <span className="font-bold text-[#319bab] text-xs">
                                  SO: {order.invoiceId}
                                </span>
                              </div>
                              {order.salesInvoiceId && (
                                <span className="font-black text-blue-600 text-[10px] ml-4">
                                  SI: {order.salesInvoiceId}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-black">
                           <span className="bg-slate-100 px-2 py-1 rounded text-[10px] text-slate-600 border border-slate-200 uppercase tracking-tighter">
                             {order.voucherType || "GE"}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-800">
    {order.customer?.name}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {order.customer?.whatsapp}
                          </div>
                        </td>
                        {isFieldAllowed("itemsCount") && (
                          <td className="px-6 py-4 text-center">
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                              {(order.items || []).length +
                                (order.sampleItems || []).length}
                            </span>
                          </td>
                        )}
                        {isFieldAllowed("grandTotal") && (
                          <td className="px-6 py-4 text-right font-bold text-[#319bab]">
                            ₹{(order.grandTotal || 0).toLocaleString()}
                          </td>
                        )}
                        <td className="px-6 py-4 text-center">
                          {order.status === "CANCELLED" ? (
                            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-bold line-through uppercase tracking-wider">
                              Cancelled
                            </span>
                          ) : order.editHistory?.some(h => h.editType === 'RE_INVOICED') ? (
                            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-indigo-200">
                              ✓ Re-Invoiced (V2)
                            </span>
                          ) : order.invoiceGenerated ? (
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                              ✓ Invoiced (V1)
                            </span>
                          ) : (
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                              Pending Order
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-600 text-xs">
                          {(() => {
                            const od = order.orderDate ? new Date(order.orderDate) : null;
                            const ct = new Date(order.createdAt);
                            const d = od ? od : ct;
                            const day = String(d.getDate()).padStart(2, "0");
                            const month = String(d.getMonth() + 1).padStart(2, "0");
                            const year = d.getFullYear();
                            const time = ct.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
                            return `${day}-${month}-${year}, ${time}`;
                          })()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center gap-2 justify-center flex-wrap">
                            <button
                              onClick={() => handleGenerateInvoice(order)}
                              className="flex items-center gap-2 justify-center px-3 py-2 rounded-lg transition text-xs font-semibold bg-[#319bab] text-white hover:bg-[#257f87] shadow-md shadow-[#319bab]/20"
                              disabled={order.status === "CANCELLED"}
                            >
                              <FaFileInvoice />
                              {order.invoiceGenerated ? "Re-generate Invoice" : "Generate Invoice"}
                            </button>

                            {/* Cancel Button — Admin & Super Admin only */}
                            {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && order.status !== "CANCELLED" && (
                              <button
                                onClick={() => handleOpenCancelModal(order)}
                                className="flex items-center gap-1 px-3 py-2 rounded-lg transition text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 hover:border-red-600 shadow-sm"
                                title="Cancel this Sales Order"
                              >
                                <FaBan className="text-xs" />
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* EXPANDED ITEMS ROW */}
                      {expandedOrders[order._id] && (
                        <tr className="bg-gray-50">
                          <td colSpan="10" className="px-6 py-4">
                            <div className="space-y-4">
                              {/* REGULAR ITEMS */}
                              {(order.items || []).length > 0 && (
                                <div>
                                  <h4 className="font-bold text-gray-800 mb-3">
                                    📦 Order Items
                                  </h4>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead className="bg-white text-gray-600 border-b">
                                        <tr>
                                          <th className="text-left py-2 px-3">
                                            Product Name
                                          </th>
                                          <th className="text-center py-2 px-3">
                                            HSN
                                          </th>
                                          <th className="text-center py-2 px-3">
                                            Qty
                                          </th>
                                          <th className="text-right py-2 px-3">
                                            Rate
                                          </th>
                                          <th className="text-right py-2 px-3">
                                            Discount
                                          </th>
                                          <th className="text-right py-2 px-3">
                                            Tax
                                          </th>
                                          <th className="text-right py-2 px-3">
                                            Total
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {(order.items || []).map((item, idx) => (
                                          <tr key={idx} className="bg-white">
                                            <td className="py-2 px-3 font-semibold">
                                              {item.name}
                                            </td>
                                            <td className="py-2 px-3 text-center text-gray-600">
                                              {item.hsn}
                                            </td>
                                            <td className={`py-2 px-3 text-center font-bold ${item.isNegativeStockBilled ? 'text-red-600 bg-red-50 rounded shadow-sm border border-red-100 flex items-center justify-center gap-1' : ''}`}>
                                              {item.qty} {item.unit || "Units"} {item.altQty > 0 && `(${item.altQty} ${item.altUnit})`} {item.isNegativeStockBilled && <span title="Billed with negative stock">⚠️</span>}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                              ₹{item.sellingPrice?.toFixed(2)}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                              <div className="font-semibold text-gray-800">
                                                {item.discountPercent || 0}%
                                              </div>
                                              <div className="text-[10px] text-red-500">
                                                -₹{(item.discountAmount || 0).toFixed(2)}
                                              </div>
                                            </td>
                                            <td className="py-2 px-3 text-right text-blue-600">
                                              {item.igst
                                                ? `IGST ${item.gst}%`
                                                : `CGST ${item.cgst}% + SGST ${item.sgst}%`}
                                            </td>
                                            <td className="py-2 px-3 text-right font-bold text-[#319bab]">
                                              ₹{item.total?.toLocaleString()}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* 📊 DYNAMIC TAX SUMMARY (RECALCULATED FOR DISPLAY) */}
                                  <div className="mt-4 flex justify-end">
                                    <div className="w-full md:w-64 bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-2">
                                      <div className="flex justify-between text-xs text-gray-500 font-bold uppercase">
                                        <span>Subtotal</span>
                                        <span>₹{(order.subtotal || 0).toFixed(2)}</span>
                                      </div>

                                      {(() => {
                                        let cgst = 0, sgst = 0, igst = 0;
                                        let hasIgst = false;

                                        // 1. Items Tax
                                        (order.items || []).forEach(item => {
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
                                        const tGst = (order.transportCharge * (order.transportGstPercent || 18)) / 100;
                                        if (hasIgst) igst += tGst;
                                        else { cgst += tGst / 2; sgst += tGst / 2; }

                                        return hasIgst ? (
                                          <div className="flex justify-between text-xs font-black text-blue-600 border-t border-gray-50 pt-2">
                                            <span>IGST (Merged)</span>
                                            <span>₹{igst.toFixed(2)}</span>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="flex justify-between text-xs font-black text-blue-600 border-t border-gray-50 pt-2">
                                              <span>CGST (Merged)</span>
                                              <span>₹{cgst.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs font-black text-blue-600">
                                              <span>SGST (Merged)</span>
                                              <span>₹{sgst.toFixed(2)}</span>
                                            </div>
                                          </>
                                        );
                                      })()}

                                      {order.transportCharge > 0 && (
                                        <div className="flex justify-between text-xs text-orange-600 font-bold border-t border-gray-50 pt-2">
                                          <span>Transport</span>
                                          <span>₹{(order.transportCharge || 0).toFixed(2)}</span>
                                        </div>
                                      )}

                                      <div className="flex justify-between text-sm font-black text-[#319bab] border-t-2 border-dashed border-gray-100 pt-2 mt-2">
                                        <span>Grand Total</span>
                                        <span>₹{(order.grandTotal || 0).toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* SAMPLE ITEMS */}
                              {(order.sampleItems || []).length > 0 && (
                                <div>
                                  <h4 className="font-bold text-gray-800 mb-3 text-yellow-700">
                                    🎁 Sample Items
                                  </h4>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead className="bg-yellow-50 text-gray-600 border-b">
                                        <tr>
                                          <th className="text-left py-2 px-3">
                                            Product Name
                                          </th>
                                          <th className="text-center py-2 px-3">
                                            HSN
                                          </th>
                                          <th className="text-center py-2 px-3">
                                            Qty
                                          </th>
                                          <th className="text-right py-2 px-3">
                                            Rate
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {(order.sampleItems || []).map(
                                          (item, idx) => (
                                            <tr
                                              key={idx}
                                              className="bg-yellow-50"
                                            >
                                              <td className="py-2 px-3 font-semibold">
                                                {item.name}
                                              </td>
                                              <td className="py-2 px-3 text-center text-gray-600">
                                                {item.hsn}
                                              </td>
                                              <td className={`py-2 px-3 text-center font-bold ${item.isNegativeStockBilled ? 'text-red-600 bg-red-50 rounded shadow-sm border border-red-100 flex items-center justify-center gap-1' : ''}`}>
                                                {item.qty} {item.unit || "Units"} {item.altQty > 0 && `(${item.altQty} ${item.altUnit})`} {item.isNegativeStockBilled && <span title="Billed with negative stock">⚠️</span>}
                                              </td>
                                              <td className="py-2 px-3 text-right">
                                                ₹{item.sellingPrice?.toFixed(2)}
                                              </td>
                                            </tr>
                                          )
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* 🕓 EDIT HISTORY (Audit Trail) */}
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                  <FaSync className="text-gray-400 text-xs" />
                                  Edit History (Audit Trail)
                                </h4>
                                <div className="space-y-3">
                                  {order.editHistory && order.editHistory.length > 0 ? (
                                    order.editHistory.map((history, idx) => (
                                      <div key={idx} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm relative overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                                        <div className="flex justify-between items-start mb-2">
                                          <div>
                                            <span className="text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded mr-2">
                                              Version {history.version}
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-500 uppercase">
                                              {history.editType?.replace(/_/g, ' ')}
                                            </span>
                                          </div>
                                          <span className="text-[10px] text-gray-400 font-mono">
                                            {new Date(history.editedAt).toLocaleString()}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px]">
                                          <div className="flex gap-2">
                                            <span className="text-gray-500 text-right">Items:</span>
                                            <span className="font-bold text-gray-800">{(history.items || []).length} items</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="text-gray-500">Grand Total:</span>
                                            <span className="font-bold text-indigo-600">₹{(history.grandTotal || 0).toLocaleString()}</span>
                                          </div>
                                          {history.note && (
                                            <div className="w-full mt-1 italic text-gray-600 border-t border-gray-50 pt-1">
                                              Note: {history.note}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 text-center text-gray-500 text-xs italic">
                                      No previous edits recorded for this order. History starts after the first modification or re-invoice.
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* EXPANDED SALES INVOICES ROW */}
                      {expandedOrders[order._id] &&
                        (invoicesByOrder[order._id] || []).length > 0 && (
                          <tr className="bg-green-50">
                            <td colSpan="10" className="px-6 py-4">
                              <div className="space-y-4">
                                <h4 className="font-bold text-gray-800">
                                  📄 Sales Invoices Generated
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead className="bg-white text-gray-600 border-b">
                                      <tr>
                                        <th className="text-left py-2 px-3">
                                          Invoice No
                                        </th>
                                        <th className="text-center py-2 px-3">
                                          Date
                                        </th>
                                        <th className="text-left py-2 px-3">
                                          Product Name
                                        </th>
                                        <th className="text-center py-2 px-3">
                                          SO Qty
                                        </th>
                                        <th className="text-center py-2 px-3">
                                          Invoice Qty
                                        </th>
                                        <th className="text-center py-2 px-3">
                                          Pending ⚠️
                                        </th>
                                        <th className="text-right py-2 px-3">
                                          Amount
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {(invoicesByOrder[order._id] || []).map(
                                        (invoice) =>
                                          invoice.items.map(
                                            (invoiceItem, itemIdx) => {
                                              const originalItem = order.items.find(
                                                (i) =>
                                                  i.productId?.toString() ===
                                                  invoiceItem.productId?.toString()
                                              );
                                              const backOrderQty =
                                                (originalItem?.qty || 0) -
                                                invoiceItem.qty;

                                              return (
                                                <tr
                                                  key={`${invoice._id}-${itemIdx}`}
                                                  className="bg-white"
                                                >
                                                  <td className="py-2 px-3 font-semibold text-[#319bab]">
                                                    {itemIdx === 0
                                                      ? invoice.invoiceNumber
                                                      : ""}
                                                  </td>
                                                  <td className="py-2 px-3 text-center text-gray-600">
                                                    {itemIdx === 0
                                                      ? new Date(
                                                        invoice.invoiceDate
                                                      ).toLocaleString("en-IN", {
                                                        day: "2-digit",
                                                        month: "2-digit",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                        hour12: true,
                                                      })
                                                      : ""}
                                                  </td>
                                                  <td className="py-2 px-3 font-semibold">
                                                    {invoiceItem.name}
                                                  </td>
                                                  <td className={`py-2 px-3 text-center font-bold ${originalItem?.isNegativeStockBilled ? 'text-red-600 bg-red-50 rounded shadow-sm border border-red-100 flex items-center justify-center gap-1' : ''}`}>
                                                    {originalItem?.qty ? `${originalItem.qty} ${originalItem.unit || "Units"} ${originalItem.altQty > 0 ? `(${originalItem.altQty} ${originalItem.altUnit})` : ""}` : "-"} {originalItem?.isNegativeStockBilled && <span title="Billed with negative stock">⚠️</span>}
                                                  </td>
                                                  <td className="py-2 px-3 text-center font-semibold text-green-600">
                                                    {invoiceItem.qty} {invoiceItem.unit || "Units"} {invoiceItem.altQty > 0 && `(${invoiceItem.altQty} ${invoiceItem.altUnit})`}
                                                  </td>
                                                  <td className="py-2 px-3 text-center font-semibold text-red-600">
                                                    {backOrderQty > 0
                                                      ? backOrderQty
                                                      : "0"}
                                                  </td>
                                                  <td className="py-2 px-3 text-right font-bold text-[#319bab]">
                                                    ₹
                                                    {(
                                                      invoiceItem.total || 0
                                                    ).toLocaleString()}
                                                  </td>
                                                </tr>
                                              );
                                            }
                                          )
                                      )}
                                    </tbody>
                                  </table>

                                  {/* 📊 DYNAMIC TAX SUMMARY (RECALCULATED FOR DISPLAY) */}
                                  <div className="mt-4 flex justify-end">
                                    <div className="w-full bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-2">
                                      <div className="flex justify-between text-[10px] text-gray-500 font-black uppercase">
                                        <span>Subtotal</span>
                                        <span>₹{(inv.subtotal || 0).toFixed(2)}</span>
                                      </div>

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
                                          <div className="flex justify-between text-xs font-black text-blue-700">
                                            <span>COMMON IGST</span>
                                            <span>₹{igst.toFixed(2)}</span>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="flex justify-between text-xs font-black text-blue-700">
                                              <span>COMMON CGST</span>
                                              <span>₹{cgst.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs font-black text-blue-700">
                                              <span>COMMON SGST</span>
                                              <span>₹{sgst.toFixed(2)}</span>
                                            </div>
                                          </>
                                        );
                                      })()}

                                      {inv.transportCharge > 0 && (
                                        <div className="flex justify-between text-[10px] text-orange-700 font-black uppercase border-t border-blue-100 pt-2">
                                          <span>Transport</span>
                                          <span>₹{(inv.transportCharge || 0).toFixed(2)}</span>
                                        </div>
                                      )}

                                      <div className="flex justify-between text-sm font-black text-blue-900 border-t-2 border-dashed border-blue-200 pt-2 mt-2">
                                        <span>FINAL TOTAL</span>
                                        <span>₹{(inv.grandTotal || 0).toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                      {expandedOrders[order._id] &&
                        (invoicesByOrder[order._id] || []).length === 0 && (
                          <tr className="bg-blue-50">
                            <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                              <p className="text-sm">
                                No invoices generated yet for this sales order
                              </p>
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

      {/* INVOICE PREVIEW MODAL */}
      {showModal && selectedOrder && (
        <InvoiceGeneratorModal
          order={selectedOrder}
          onClose={() => {
            setShowModal(false);
            setSelectedOrder(null);
            fetchSalesOrders(); // Refresh list
          }}
          onSuccess={() => {
            setShowModal(false);
            setSelectedOrder(null);
            fetchSalesOrders(); // Refresh list
          }}
        />
      )}

      {/* RE-EDIT BILL MODAL */}
      {showEditBillModal && editingOrder && (
        <EditBillModal
          order={editingOrder}
          branchId={currentBranch?._id}
          onClose={() => {
            setShowEditBillModal(false);
            setEditingOrder(null);
          }}
          onSave={handleSaveEditedBill}
        />
      )}

      {/* QUICK COPY CHOICE MODAL */}
      {showCopyChoice && !processingPrint && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
              <FaFileInvoice className="text-4xl mx-auto mb-3 opacity-90" />
              <h3 className="text-xl font-black">Direct Print</h3>
              <p className="text-xs text-blue-100 mt-1 uppercase tracking-widest font-bold">SO: {selectedOrder?.invoiceId}</p>
            </div>

            <div className="p-8">
              <p className="text-gray-600 text-sm text-center mb-6 font-semibold">How many copies would you like to print?</p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleDirectPrint(1)}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <span className="text-3xl group-hover:scale-110 transition">📄</span>
                  <span className="font-bold text-gray-800">1 Copy</span>
                </button>
                <button
                  onClick={() => handleDirectPrint(2)}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <span className="text-3xl group-hover:scale-110 transition">👥</span>
                  <span className="font-bold text-gray-800">2 Copies</span>
                </button>
              </div>
            </div>

            <div className="bg-gray-50 p-4 text-center">
              <button
                onClick={() => {
                  setShowCopyChoice(false);
                  setSelectedOrder(null);
                }}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROCESSING OVERLAY */}
      {processingPrint && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-md z-[9999] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-xl font-black text-gray-800">Processing Invoice...</h3>
            <p className="text-sm text-gray-500 mt-2">Opening print window shortly</p>
          </div>
        </div>
      )}

      {/* AGGREGATE SLIP MODAL */}
      {showSlipModal && (
        <AggregateSlipModal
          isOpen={showSlipModal}
          onClose={() => setShowSlipModal(false)}
          orders={selectedOrders}
          branch={currentBranch}
        />
      )}

      {/* ══ CANCEL ORDER MODAL (Admin / Super Admin only) ══ */}
      {showCancelModal && cancellingOrder && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-red-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <FaBan className="text-white text-lg" />
              </div>
              <div>
                <h2 className="text-white font-black text-lg">Cancel Sales Order</h2>
                <p className="text-red-100 text-xs mt-0.5">This action will revert stock and customer balance</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Order Info */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="text-gray-500 font-bold">Order ID</span>
                  <span className="font-black text-red-700">{cancellingOrder.invoiceId}</span>
                </div>
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="text-gray-500 font-bold">Customer</span>
                  <span className="font-bold text-gray-800">{cancellingOrder.customer?.name}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold">Grand Total</span>
                  <span className="font-black text-gray-800">₹{(cancellingOrder.grandTotal || 0).toLocaleString()}</span>
                </div>
                {cancellingOrder.status === "INVOICED" && (
                  <div className="mt-3 text-xs text-red-600 font-bold bg-red-100 rounded-lg px-3 py-2">
                    ⚠️ This order is INVOICED. Stock and customer balance will be fully reverted.
                  </div>
                )}
              </div>

              {/* Narration Input */}
              <div className="mb-5">
                <label className="block text-sm font-black text-gray-700 mb-2">
                  Cancellation Reason / Narration <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelNarration}
                  onChange={(e) => setCancelNarration(e.target.value)}
                  placeholder="Enter reason for cancellation (e.g. Customer request, Wrong order, Duplicate entry...)"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none resize-none text-sm text-gray-800 font-medium placeholder:text-gray-300 transition"
                  rows={3}
                  autoFocus
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowCancelModal(false); setCancellingOrder(null); }}
                  className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition text-sm"
                  disabled={cancelling}
                >
                  Go Back
                </button>
                <button
                  onClick={handleCancelOrder}
                  disabled={cancelling || !cancelNarration.trim()}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black hover:bg-red-700 transition text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-200"
                >
                  {cancelling ? (
                    <><FaSync className="animate-spin text-xs" /> Cancelling...</>
                  ) : (
                    <><FaBan className="text-xs" /> Confirm Cancel</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchInvoicedOrders;
