import React, { useEffect, useState } from "react";
import { FaChevronDown, FaEdit, FaFileInvoice, FaSync, FaTrash, FaFilePdf, FaFileExcel } from "react-icons/fa";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE } from "../../api";
import EditBillModal from "../../components/EditBillModal";
import InvoiceGeneratorModal from "../../components/InvoiceGeneratorModal";
import AggregateSlipModal from "../../components/branch/AggregateSlipModal";
import { useBranch } from "../../context/BranchContext";

const BranchInvoicedOrders = () => {
  const { currentBranch, user } = useBranch();
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

  // Filter states
  const [filterVoucherType, setFilterVoucherType] = useState("");
  const [filterInvoiceId, setFilterInvoiceId] = useState("");
  const [filterCustomerName, setFilterCustomerName] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [filterFromTime, setFilterFromTime] = useState("");
  const [filterToTime, setFilterToTime] = useState("");

  // Fetch sales orders for current branch
  const fetchSalesOrders = async () => {
    // Get branch ID from context
    if (!currentBranch?._id) {
      toast.error("Branch not selected. Please select a branch from the sidebar.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/sales-orders?branchId=${currentBranch._id}&isClaim=false`
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

  useEffect(() => {
    fetchSalesOrders();
  }, [currentBranch?._id]);

  const handleGenerateInvoice = (order) => {
    setSelectedOrder(order);
    setShowModal(true);
  };

  const handleEditBill = (order) => {
    setEditingOrder(order);
    setShowEditBillModal(true);
  };

  const handleSaveEditedBill = async (updatedOrder) => {
    try {
      const res = await fetch(`${API_BASE}/sales-orders/${updatedOrder._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: updatedOrder.items,
          sampleItems: updatedOrder.sampleItems,
          customer: updatedOrder.customer,
          transportCharge: updatedOrder.transportCharge,
          subtotal: updatedOrder.subtotal,
          totalTax: updatedOrder.totalTax,
          totalDiscount: updatedOrder.totalDiscount,
          grandTotal: updatedOrder.grandTotal,
          updatedBy: user?.id || user?._id,
          updatedByUsername: user?.username || user?.billingPerson,
        }),


      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update order");

      // Update local state
      setSalesOrders((prev) =>
        prev.map((order) =>
          order._id === updatedOrder._id ? updatedOrder : order
        )
      );

      toast.success("Bill updated successfully!");
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
        headers: { "Content-Type": "application/json" },
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

  const handleCancelBill = async (order) => {
    if (!window.confirm(`Cancel bill ${order.invoiceId}? This will revert all stock and customer balance effects but KEEP the record in the database for audit.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/sales-orders/${order._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: user?.id || user?._id, 
          username: user?.username || user?.fullName || user?.name || "System" 
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Bill cancelled successfully");
        fetchSalesOrders(); // Refresh list
      } else {
        toast.error(data.message || "Failed to cancel bill");
      }
    } catch (err) {
      console.error("Error cancelling bill:", err);
      toast.error("An error occurred while cancelling the bill");
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
        `${API_BASE}/invoices?salesOrderId=${salesOrderId}`
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
    const matchesVoucherType = filterVoucherType === "" || 
      (order.voucherType && order.voucherType.toLowerCase().includes(filterVoucherType.toLowerCase()));
    
    const matchesInvoiceId = filterInvoiceId === "" || 
      (order.invoiceId && order.invoiceId.toLowerCase().includes(filterInvoiceId.toLowerCase()));
    
    const matchesCustomerName = filterCustomerName === "" || 
      (order.customer?.name && order.customer.name.toLowerCase().includes(filterCustomerName.toLowerCase()));
    
    const orderDate = new Date(order.createdAt);
    const orderDateStr = orderDate.toISOString().split('T')[0];
    const orderTimeStr = orderDate.toTimeString().slice(0, 5);
    
    const matchesFromDate = filterFromDate === "" || orderDateStr >= filterFromDate;
    const matchesToDate = filterToDate === "" || orderDateStr <= filterToDate;
    const matchesFromTime = filterFromTime === "" || filterFromDate === "" || orderDateStr > filterFromDate || (orderDateStr === filterFromDate && orderTimeStr >= filterFromTime);
    const matchesToTime = filterToTime === "" || filterToDate === "" || orderDateStr < filterToDate || (orderDateStr === filterToDate && orderTimeStr <= filterToTime);

    return matchesVoucherType && matchesInvoiceId && matchesCustomerName && matchesFromDate && matchesToDate && matchesFromTime && matchesToTime;
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
        "Invoice ID": order.invoiceId || "-",
        "Customer Name": order.customer?.name || "-",
        "Customer WhatsApp": order.customer?.whatsapp || "-",
        "Items Count": (order.items || []).length + (order.sampleItems || []).length,
        "Grand Total": order.grandTotal || 0,
        "Date": new Date(order.createdAt).toLocaleDateString("en-IN"),
      }));

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

      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4">
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#319bab] to-[#257f87] rounded-xl flex items-center justify-center">
                <FaFileInvoice className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-800">
                  Sales Orders to Invoice
                </h1>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {currentBranch?.name || "Select a branch"}
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
                <FaFileExcel /> Excel
              </button>
              <button
                onClick={() => setShowSlipModal(true)}
                disabled={filteredSalesOrders.length === 0}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
              >
                <FaFileInvoice /> Generate Slip
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            
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
                    <th className="px-6 py-4 text-left">Invoice ID</th>
                    <th className="px-6 py-4 text-left">Customer</th>
                    <th className="px-6 py-4 text-center">Items</th>
                    <th className="px-6 py-4 text-right">Grand Total</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Date</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSalesOrders.map((order) => (
                    <React.Fragment key={order._id}>
                      <tr className={`hover:bg-gray-50 transition ${order.status === "CANCELLED" ? "opacity-60 bg-red-50/50" : ""}`}>
                       
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleExpanded(order._id)}
                              className="text-[#319bab] hover:bg-gray-200 p-1 rounded transition"
                            >
                              <FaChevronDown
                                className={`text-xs transition-transform ${
                                  expandedOrders[order._id]
                                    ? "rotate-180"
                                    : ""
                                }`}
                              />
                            </button>
                            <span className="font-bold text-[#319bab]">
                              {order.invoiceId}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-800">
                            {order.customer?.name}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {order.customer?.whatsapp}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                            {(order.items || []).length +
                              (order.sampleItems || []).length}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-[#319bab]">
                          ₹{(order.grandTotal || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {order.status === "CANCELLED" ? (
                             <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold line-through">
                                Cancelled
                             </span>
                          ) : order.status === "INVOICED" || order.invoiceGenerated ? (
                             <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                               ✓ Invoiced
                             </span>
                          ) : (
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-600 text-xs">
                          {new Date(order.createdAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center gap-2 justify-center flex-wrap">
                            {(order.status === "INVOICED" || order.invoiceGenerated) && order.status !== "CANCELLED" && (
                                <button
                                    onClick={() => handleDirectReEdit(order._id)}
                                    disabled={requestingReEdit === order._id}
                                    className="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-2 rounded-lg transition text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-200 whitespace-nowrap"
                                    title="Unlock this bill for editing. Changes will be calculated as a Delta on re-invoice."
                                >
                                    <FaSync className={requestingReEdit === order._id ? "animate-spin" : ""} />
                                    Re-Edit
                                </button>
                            )}

                            <button
                              onClick={() => handleEditBill(order)}
                              disabled={order.status === "INVOICED" || (order.invoiceGenerated && order.status !== "PLACED")}
                              className={`flex items-center gap-2 justify-center px-3 py-2 rounded-lg transition text-xs font-semibold ${
                                order.status === "INVOICED" || (order.invoiceGenerated && order.status !== "PLACED")
                                  ? "bg-gray-300 text-gray-600 cursor-not-allowed opacity-50"
                                  : "bg-orange-500 text-white hover:bg-orange-600 shadow-md shadow-orange-500/20"
                              }`}
                              title={order.status === "INVOICED" || (order.invoiceGenerated && order.status !== "PLACED") ? "Requires Re-Edit to modify invoiced bill" : "Edit bill items"}
                            >
                              <FaEdit />
                              Edit Bill
                            </button>
                            <button
                               onClick={() => handleGenerateInvoice(order)}
                               disabled={order.invoiceGenerated && order.reEditRequestStatus !== "APPROVED"}
                               className={`flex items-center gap-2 justify-center px-3 py-2 rounded-lg transition text-xs font-semibold ${
                                 order.invoiceGenerated && order.reEditRequestStatus !== "APPROVED"
                                   ? "bg-gray-400 text-gray-700 cursor-not-allowed opacity-50"
                                   : "bg-[#319bab] text-white hover:bg-[#257f87] shadow-md shadow-[#319bab]/20"
                               }`}
                             >
                               <FaFileInvoice />
                               {order.invoiceGenerated && order.reEditRequestStatus !== "APPROVED" ? "Invoice Generated" : order.invoiceGenerated ? "Re-generate Invoice" : "Generate Invoice"}
                             </button>

                             {(user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "SUPER_ADMIN") && (
                               <button
                                 onClick={() => handleCancelBill(order)}
                                 className="flex items-center gap-2 justify-center px-3 py-2 rounded-lg transition text-xs font-semibold bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-500/20"
                                 title="Cancel this bill and revert all changes"
                               >
                                 <FaTrash />
                                 Cancel Bill
                               </button>
                             )}
                           </div>
                         </td>
                      </tr>

                      {/* EXPANDED ITEMS ROW */}
                      {expandedOrders[order._id] && (
                        <tr className="bg-gray-50">
                          <td colSpan="7" className="px-6 py-4">
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
                                              {item.qty} {item.isNegativeStockBilled && <span title="Billed with negative stock">⚠️</span>}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                              ₹{item.sellingPrice?.toFixed(2)}
                                            </td>
                                            <td className="py-2 px-3 text-right text-red-500">
                                              ₹
                                              {(item.discountAmount || 0).toFixed(
                                                2
                                              )}
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
                                                {item.qty} {item.isNegativeStockBilled && <span title="Billed with negative stock">⚠️</span>}
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
                            <td colSpan="7" className="px-6 py-4">
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
                                                    {originalItem?.qty || "-"} {originalItem?.isNegativeStockBilled && <span title="Billed with negative stock">⚠️</span>}
                                                  </td>
                                                  <td className="py-2 px-3 text-center font-semibold text-green-600">
                                                    {invoiceItem.qty}
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

      {/* EDIT BILL MODAL */}
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

      {/* AGGREGATE SLIP MODAL */}
      <AggregateSlipModal 
        isOpen={showSlipModal} 
        onClose={() => setShowSlipModal(false)} 
        orders={filteredSalesOrders} 
      />
    </div>
  );
};

export default BranchInvoicedOrders;
