import React, { useEffect, useState } from "react";
import { FaChevronDown, FaEdit, FaSearch, FaShoppingCart, FaSync, FaTrash } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import * as XLSX from "xlsx";
import { API_BASE, fetchWithAuth } from "../../api";
import EditPurchaseOrderModal from "../../components/branch/EditPurchaseOrderModal";
import { useBranch } from "../../context/BranchContext";

const BranchPurchaseOrders = () => {
  const { currentBranch, user } = useBranch();

  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
    const key = `branch-purchase-orders_${fieldId}`;
    return user.fieldPermissions?.[key] !== false; // Default to true
  };

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [editingOrder, setEditingOrder] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editItems, setEditItems] = useState([]);

  // Search debounce logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchPurchaseOrders = async (searchOverride) => {
    // Get branch ID from context
    if (!currentBranch?._id) {
      toast.error("Branch not selected. Please select a branch from the sidebar.");
      return;
    }

    setLoading(true);
    try {
      const search = searchOverride !== undefined ? searchOverride : debouncedSearch;
      const res = await fetchWithAuth(
        `${API_BASE}/purchase-orders?branchId=${currentBranch._id}${search ? `&search=${search}` : ""}`
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to fetch orders");

      setPurchaseOrders(data || []);
      toast.success(`Fetched ${data?.length || 0} purchase orders`);
    } catch (err) {
      console.error("Error fetching purchase orders:", err);
      toast.error(err.message || "Failed to fetch purchase orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, [currentBranch?._id, debouncedSearch]);

  const toggleExpanded = (orderId) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "PLACED": return "bg-blue-100 text-blue-700";
      case "INVOICED": return "bg-green-100 text-green-700";
      case "CANCELLED": return "bg-red-100 text-red-600 line-through";
      case "PENDING": return "bg-yellow-100 text-yellow-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  // Now using server-side search:
  const filteredOrders = purchaseOrders;


  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm("Cancel this purchase order? It will be kept in records as CANCELLED.")) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetchWithAuth(`${API_BASE}/purchase-orders/${orderId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to cancel order");

      toast.success("Purchase order cancelled and kept in records.");
      fetchPurchaseOrders();
    } catch (err) {
      console.error("Cancel error:", err);
      toast.error(err.message || "Failed to cancel order");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (order) => {
    setEditingOrder(order);
    setShowEditModal(true);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...editItems];
    updated[index][field] = value;
    if (field === "qty" || field === "purchasePrice" || field === "gst") {
      const q = parseFloat(updated[index].qty) || 0;
      const p = parseFloat(updated[index].purchasePrice) || 0;
      const g = parseFloat(updated[index].gst) || 0;
      const base = q * p;
      updated[index].rowPrice = base;
      updated[index].total = base * (1 + g / 100);
    }
    setEditItems(updated);
  };

  const handleConfirmInvoice = async () => {
    if (!editingOrder) return;
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${API_BASE}/purchase-orders/${editingOrder._id}/generate-invoice`, {
        method: "POST",
        body: JSON.stringify({ items: editItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to generate invoice");

      toast.success(`Purchase Invoice ${data.piNumber} generated successfully!`);
      setShowInvoiceModal(false);
      setEditingOrder(null);
      fetchPurchaseOrders();
    } catch (err) {
      toast.error(err.message || "Failed to generate invoice");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestEdit = async (orderId) => {
    if (!window.confirm("Request admin permission to re-edit this invoiced Purchase Order?")) return;
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${API_BASE}/purchase-orders/${orderId}/request-edit`, {
        method: "PATCH",
        body: JSON.stringify({ requestedBy: "Current User" }) // In a real app, use actual user name
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit request");
      toast.success("Edit request submitted to admin");
      fetchPurchaseOrders();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCancel = async (orderId) => {
    if (!window.confirm("Request admin permission to CANCEL this invoiced Purchase Order? This will revert stock and vendor balance if approved.")) return;
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${API_BASE}/purchase-orders/${orderId}/request-cancel`, {
        method: "PATCH",
        body: JSON.stringify({ requestedBy: "Current User" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit request");
      toast.success("Cancel request submitted to admin");
      fetchPurchaseOrders();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    try {
      if (purchaseOrders.length === 0) {
        toast.warn("No data to export");
        return;
      }
      const exportData = purchaseOrders.map((order) => {
        const extraExpensesStr = (order.extraExpenses || [])
          .map(e => `${e.expenseName}: ₹${e.totalPrice}`)
          .join(", ") || "-";

        return {
          "Vendor": order.vendor || "-",
          "PO Number": order.invoiceId || "-",
          "PI Number": order.purchaseInvoiceId || "-",
          "Subtotal": order.subtotal || 0,
          "Tax Amount": order.totalTax || 0,
          "Extra Charges": order.extraExpenseAmount || 0,
          "Extra Details": extraExpensesStr,
          "Grand Total": order.grandTotal || 0,
          "Status": order.status || "-",
          "Date": new Date(order.createdAt).toLocaleDateString("en-IN"),
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Orders");
      XLSX.writeFile(workbook, `Purchase_Orders_${new Date().toISOString().split('T')[0]}.xlsx`);
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

      {/* INVOICE PREVIEW & EDIT MODAL */}
      {showInvoiceModal && editingOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-gray-100">
            <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 flex justify-between items-center shadow-lg">
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest">
                  📄 Invoice Preview & Edit
                </h2>
                <p className="text-xs text-green-100 mt-1 font-bold">
                  Finalize items and units before generating Purchase Invoice for {editingOrder.invoiceId}
                </p>
              </div>
              <button onClick={() => setShowInvoiceModal(false)} className="text-2xl hover:scale-110 transition drop-shadow-md">✕</button>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-inner">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Vendor</p>
                  <p className="text-sm font-black text-gray-800">{editingOrder.vendor || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Warehouse</p>
                  <p className="text-sm font-black text-gray-800">{editingOrder.warehouse || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">PO Date</p>
                  <p className="text-sm font-black text-gray-800">{new Date(editingOrder.date || editingOrder.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-sm">
                <table className="w-full text-xs">
                  <thead className="bg-[#319bab]/10 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-4 text-left font-black text-[#319bab] uppercase">Product</th>
                      <th className="px-4 py-4 text-center font-black text-[#319bab] uppercase w-24">Qty</th>
                      <th className="px-4 py-4 text-center font-black text-[#319bab] uppercase w-24">Unit</th>
                      <th className="px-4 py-4 text-right font-black text-[#319bab] uppercase w-32">Rate (₹)</th>
                      <th className="px-4 py-4 text-center font-black text-[#319bab] uppercase w-16">GST %</th>
                      <th className="px-4 py-4 text-right font-black text-[#319bab] uppercase w-32">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {editItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition drop-shadow-sm">
                        <td className="px-4 py-4 font-bold text-gray-700">{item.name}</td>
                        <td className="px-4 py-4">
                          <input
                            type="number"
                            className="w-full border border-gray-200 rounded-lg px-2 py-2 text-center font-bold focus:ring-1 focus:ring-green-500 outline-none transition"
                            value={item.qty}
                            onChange={(e) => handleItemChange(idx, "qty", e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <input
                            type="text"
                            className="w-full border border-gray-200 rounded-lg px-2 py-2 text-center font-bold focus:ring-1 focus:ring-green-500 outline-none transition uppercase text-[10px]"
                            value={item.unit}
                            placeholder="kg"
                            onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <input
                            type="number"
                            className="w-full border border-gray-200 rounded-lg px-2 py-2 text-right font-bold focus:ring-1 focus:ring-green-500 outline-none transition"
                            value={item.purchasePrice}
                            onChange={(e) => handleItemChange(idx, "purchasePrice", e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-4 text-center font-black text-gray-400">{item.gst}%</td>
                        <td className="px-4 py-4 text-right font-black text-green-600">
                          ₹{(parseFloat(item.total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-gray-100">
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-8 py-3 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition shadow-md shadow-gray-50 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmInvoice}
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:shadow-lg hover:shadow-green-100 transition shadow-md shadow-green-50 active:scale-95 disabled:opacity-50"
                >
                  {loading ? "Generating..." : "✔️ Confirm & Generate Invoice"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full">
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#319bab] to-[#257f87] rounded-xl flex items-center justify-center">
                <FaShoppingCart className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-800">
                  Purchase Orders
                </h1>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {currentBranch?.name || "Select a branch"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-sm font-bold text-sm"
              >
                Export Excel
              </button>
              <button
                onClick={fetchPurchaseOrders}
                disabled={loading}
                className="flex items-center gap-2 bg-[#319bab] text-white px-4 py-2 rounded-lg hover:bg-[#257f87] transition disabled:opacity-50"
              >
                <FaSync className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex items-center gap-4">
          <div className="relative flex-1">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search by Invoice ID, Vendor, or Item Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-[#319bab] transition-all text-sm font-medium text-gray-700"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-gray-400 hover:text-red-500 font-bold transition-colors text-xs px-2"
            >
              CLEAR
            </button>
          )}
        </div>

        {/* PURCHASE ORDERS TABLE */}
        {loading ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="animate-pulse">Loading purchase orders...</div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-gray-500">
              {searchTerm ? `No purchase orders matching "${searchTerm}"` : "No purchase orders found"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold border-b">
                  <tr>
                    <th className="px-6 py-4 text-left">Order / Bill ID</th>
                    <th className="px-6 py-4 text-left">Vendor</th>
                    {isFieldAllowed("itemsCount") && <th className="px-6 py-4 text-center">Items</th>}
                    {isFieldAllowed("grandTotal") && <th className="px-6 py-4 text-right">Grand Total</th>}
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Date</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOrders.map((order) => (
                    <React.Fragment key={order._id}>
                      <tr className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => toggleExpanded(order._id)}
                              className="text-[#319bab] hover:bg-gray-200 p-1 rounded transition mt-0.5"
                            >
                              <FaChevronDown
                                className={`text-xs transition-transform ${expandedOrders[order._id]
                                  ? "rotate-180"
                                  : ""
                                  }`}
                              />
                            </button>
                            <div className="flex flex-col">
                              <span className="font-bold text-[#319bab] text-xs">
                                PO: {order.invoiceId}
                              </span>
                              {order.purchaseInvoiceId && (
                                <span className="font-black text-green-700 text-[10px] mt-1 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                                  PI: {order.purchaseInvoiceId}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-800">
                            {order.vendor}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {order.warehouse}
                          </div>
                        </td>
                        {isFieldAllowed("itemsCount") && (
                          <td className="px-6 py-4 text-center">
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                              {(order.items || []).length}
                            </span>
                          </td>
                        )}
                        {isFieldAllowed("grandTotal") && (
                          <td className="px-6 py-4 text-right font-bold text-[#319bab]">
                            ₹{(order.grandTotal || 0).toLocaleString()}
                          </td>
                        )}
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                                order.status
                              )}`}
                            >
                              {order.status}
                            </span>

                            {/* REQUEST STATUS LABELS */}
                            {order.editRequestStatus === "PENDING" && (
                              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                Edit Pending
                              </span>
                            )}
                            {order.editRequestStatus === "REJECTED" && (
                              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                Edit Rejected
                              </span>
                            )}
                            {order.cancelRequestStatus === "PENDING" && (
                              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                Cancel Pending
                              </span>
                            )}
                            {order.cancelRequestStatus === "REJECTED" && (
                              <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                Cancel Rejected
                              </span>
                            )}
                          </div>
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
                          <div className="flex items-center justify-center gap-2">
                            {order.status !== 'INVOICED' ? (
                              <>
                                <button
                                  onClick={() => handleEditClick(order)}
                                  className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-lg transition shadow-md shadow-orange-100"
                                  title="Edit Order"
                                >
                                  <FaEdit size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteOrder(order._id)}
                                  className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition shadow-md shadow-red-100"
                                  title="Delete Order"
                                >
                                  <FaTrash size={14} />
                                </button>
                                <button
                                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs shadow-md shadow-green-100 transition disabled:bg-gray-300 disabled:cursor-not-allowed uppercase"
                                  disabled={loading}
                                  onClick={() => {
                                    setEditingOrder(order);
                                    setEditItems(order.items.map(i => ({ ...i })));
                                    setShowInvoiceModal(true);
                                  }}
                                >
                                  Invoiced
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEditClick(order)}
                                  className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-lg transition shadow-md shadow-orange-100 flex items-center gap-1 text-xs font-bold"
                                  title="Edit Invoiced Order"
                                >
                                  <FaEdit size={12} /> RE-EDIT
                                </button>
                                <button
                                  onClick={() => handleDeleteOrder(order._id)}
                                  className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition shadow-md shadow-red-100 flex items-center gap-1 text-xs font-bold"
                                  title="Cancel Invoiced Order"
                                >
                                  <FaTrash size={12} /> CANCEL
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* EXPANDED ITEMS ROW */}
                      {expandedOrders[order._id] && (
                        <tr className="bg-gray-50">
                          <td colSpan="10" className="px-6 py-4">
                            <div className="space-y-4">
                              {/* PURCHASE ITEMS */}
                              {(order.items || []).length > 0 && (
                                <div>
                                  <h4 className="font-bold text-gray-800 mb-3">
                                    📦 Purchase Items
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
                                            Purchase Price
                                          </th>
                                          <th className="text-right py-2 px-3">
                                            Selling Price
                                          </th>
                                          <th className="text-right py-2 px-3">
                                            Discount (%)
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
                                            <td className="py-2 px-3 text-center font-semibold">
                                              {item.qty}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                              ₹{item.purchasePrice?.toFixed(2)}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                              ₹{item.sellingPrice?.toFixed(2)}
                                            </td>
                                            <td className="py-2 px-3 text-right text-red-500 font-bold">
                                              {item.discountPercent || 0}%
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

                              {/* EXTRA EXPENSES */}
                              {(order.extraExpenses || []).length > 0 && (
                                <div className="mt-4">
                                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                    🚚 Extra Expenses
                                  </h4>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead className="bg-orange-50 text-orange-700 border-b">
                                        <tr>
                                          <th className="text-left py-2 px-3">Expense Name</th>
                                          <th className="text-right py-2 px-3">Base Amount</th>
                                          <th className="text-right py-2 px-3">GST %</th>
                                          <th className="text-right py-2 px-3">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {order.extraExpenses.map((exp, idx) => (
                                          <tr key={idx} className="bg-white">
                                            <td className="py-2 px-3 font-semibold text-gray-700">{exp.expenseName}</td>
                                            <td className="py-2 px-3 text-right text-gray-600">₹{(exp.basePrice || exp.amount || 0).toLocaleString()}</td>
                                            <td className="py-2 px-3 text-right text-blue-500">{exp.gstPercent || exp.gst || 0}%</td>
                                            <td className="py-2 px-3 text-right font-bold text-orange-600">₹{(exp.totalPrice || 0).toLocaleString()}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* ORDER SUMMARY */}
                              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm mt-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                  <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                                    <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest block mb-1">Subtotal</span>
                                    <p className="font-bold text-gray-900 text-base">
                                      ₹{(order.subtotal || 0).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                                    <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest block mb-1">Tax Amount</span>
                                    <p className="font-bold text-gray-900 text-base">
                                      ₹{(order.totalTax || 0).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="bg-orange-50/50 p-3 rounded-lg border border-orange-100">
                                    <span className="text-[10px] uppercase font-black text-orange-400 tracking-widest block mb-1">Extra Charges</span>
                                    <p className="font-bold text-orange-600 text-base">
                                      ₹{(order.extraExpenseAmount || 0).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="bg-[#319bab]/5 p-3 rounded-lg border border-[#319bab]/10">
                                    <span className="text-[10px] uppercase font-black text-[#319bab]/60 tracking-widest block mb-1">Grand Total</span>
                                    <p className="font-bold text-[#319bab] text-xl">
                                      ₹{(order.grandTotal || 0).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* EDIT HISTORY */}
                            {order.editHistory && order.editHistory.length > 0 && (
                              <div className="mt-4 space-y-3">
                                <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                  🕓 Edit History
                                  <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full font-normal">
                                    {order.editHistory.length} version{order.editHistory.length > 1 ? "s" : ""}
                                  </span>
                                </h4>

                                {order.editHistory.map((snap, idx) => {
                                  const typeConfig = {
                                    CREATED: { icon: "📋", label: "Original", color: "border-blue-200 bg-blue-50" },
                                    PRE_INVOICE_EDIT: { icon: "✏️", label: "Edited (Pre-Invoice)", color: "border-yellow-200 bg-yellow-50" },
                                    INVOICED: { icon: "✅", label: "Invoiced", color: "border-green-200 bg-green-50" },
                                    RE_EDIT_STARTED: { icon: "🔄", label: "Re-Edit Started", color: "border-orange-200 bg-orange-50" },
                                    RE_INVOICED: { icon: "🔁", label: "Re-Invoiced", color: "border-purple-200 bg-purple-50" },
                                  };
                                  const cfg = typeConfig[snap.editType] || { icon: "📌", label: snap.editType, color: "border-gray-200 bg-gray-50" };

                                  return (
                                    <div key={idx} className={`rounded-xl border p-3 ${cfg.color}`}>
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-gray-700">
                                          {cfg.icon} {cfg.label}
                                        </span>
                                        <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                          <span>{new Date(snap.editedAt).toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                                          <span className="font-bold text-gray-700">₹{(snap.grandTotal || 0).toLocaleString()}</span>
                                        </div>
                                      </div>

                                      {/* Items Table */}
                                      {snap.items && snap.items.length > 0 && (
                                        <table className="w-full text-[11px]">
                                          <thead className="text-gray-500 border-b">
                                            <tr>
                                              <th className="text-left pb-1 font-semibold">Product</th>
                                              <th className="text-center pb-1 font-semibold">Qty</th>
                                              <th className="text-right pb-1 font-semibold">Price</th>
                                              <th className="text-right pb-1 font-semibold">Total</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {snap.items.map((item, iIdx) => (
                                              <tr key={iIdx} className="border-b border-dashed last:border-0">
                                                <td className="py-1 text-gray-800">{item.name}</td>
                                                <td className="py-1 text-center font-bold">{item.qty}</td>
                                                <td className="py-1 text-right text-gray-600">₹{item.purchasePrice}</td>
                                                <td className="py-1 text-right font-bold">₹{(item.total || 0).toLocaleString()}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}

                                      {/* Note */}
                                      {snap.note && (
                                        <p className="text-[10px] text-gray-500 mt-2 italic border-t pt-1">{snap.note}</p>
                                      )}
                                    </div>
                                  );
                                })}
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
      </div>

      {/* EDIT MODAL */}
      {showEditModal && editingOrder && (
        <EditPurchaseOrderModal
          order={editingOrder}
          branchId={currentBranch?._id}
          onClose={() => {
            setShowEditModal(false);
            setEditingOrder(null);
          }}
          onSave={() => {
            fetchPurchaseOrders();
          }}
        />
      )}
    </div>
  );
};

export default BranchPurchaseOrders;
