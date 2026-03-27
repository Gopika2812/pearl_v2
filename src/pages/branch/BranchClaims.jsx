import React, { useEffect, useState } from "react";
import { FaChevronDown, FaEdit, FaFileInvoice, FaSync } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE } from "../../api";
import EditBillModal from "../../components/EditBillModal";
import InvoiceGeneratorModal from "../../components/InvoiceGeneratorModal";
import AggregateSlipModal from "../../components/branch/AggregateSlipModal";
import { useBranch } from "../../context/BranchContext";

const BranchClaims = () => {
  const { currentBranch, user } = useBranch();
  const [salesOrders, setSalesOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showEditBillModal, setShowEditBillModal] = useState(false);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [invoicesByOrder, setInvoicesByOrder] = useState({});

  // Filter states
  const [filterVoucherType, setFilterVoucherType] = useState("");
  const [filterInvoiceId, setFilterInvoiceId] = useState("");
  const [filterCustomerName, setFilterCustomerName] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [filterFromTime, setFilterFromTime] = useState("");
  const [filterToTime, setFilterToTime] = useState("");

  // Fetch sales orders for current branch (only claims)
  const fetchSalesOrders = async () => {
    if (!currentBranch?._id) {
      toast.error("Branch not selected. Please select a branch from the sidebar.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/sales-orders?branchId=${currentBranch._id}&isClaim=true`
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to fetch claims");

      setSalesOrders(data || []);
      toast.success(`Fetched ${data?.length || 0} claims`);
    } catch (err) {
      console.error("Error fetching claims:", err);
      toast.error(err.message || "Failed to fetch claims");
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
          subtotal: updatedOrder.subtotal,
          totalTax: updatedOrder.totalTax,
          totalDiscount: updatedOrder.totalDiscount,
          grandTotal: updatedOrder.grandTotal,
          updatedBy: user?.id || user?._id,
          updatedByUsername: user?.username || user?.billingPerson,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update claim");

      setSalesOrders((prev) =>
        prev.map((order) =>
          order._id === updatedOrder._id ? updatedOrder : order
        )
      );

      toast.success("Claim updated successfully!");
    } catch (err) {
      console.error("Error updating claim:", err);
      toast.error(err.message || "Failed to update claim");
    }
  };

  const toggleExpanded = (orderId) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));

    if (!expandedOrders[orderId]) {
      fetchInvoicesForOrder(orderId);
    }
  };

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
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center">
                <FaFileInvoice className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-800">
                  Claims Orders
                </h1>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {currentBranch?.name || "Select a branch"}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSlipModal(true)}
                disabled={filteredSalesOrders.length === 0}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
              >
                <FaFileInvoice /> Generate Claim Slip
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
            Showing {filteredSalesOrders.length} of {salesOrders.length} claims
          </div>
        </div>

        {/* CLAIMS TABLE */}
        {loading ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="animate-pulse">Loading claims...</div>
          </div>
        ) : filteredSalesOrders.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-gray-500">{salesOrders.length === 0 ? "No claim orders found" : "No claims match your filters"}</p>
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
                    {user?.fieldPermissions?.claims_grandTotal !== false && <th className="px-6 py-4 text-right">Grand Total</th>}
                    {user?.fieldPermissions?.claims_invoiceGenerated !== false && <th className="px-6 py-4 text-center">Status</th>}
                    {user?.fieldPermissions?.claims_createdAt !== false && <th className="px-6 py-4 text-center">Date</th>}
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSalesOrders.map((order) => (
                    <React.Fragment key={order._id}>
                      <tr className="hover:bg-gray-50 transition">
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
                        {user?.fieldPermissions?.claims_grandTotal !== false && (
                          <td className="px-6 py-4 text-right font-bold text-[#319bab]">
                            ₹{(order.grandTotal || 0).toLocaleString()}
                          </td>
                        )}
                        {user?.fieldPermissions?.claims_invoiceGenerated !== false && (
                          <td className="px-6 py-4 text-center">
                            {order.invoiceGenerated ? (
                              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                                ✓ Invoiced
                              </span>
                            ) : (
                              <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-semibold">
                                Pending
                              </span>
                            )}
                          </td>
                        )}
                        {user?.fieldPermissions?.claims_createdAt !== false && (
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
                        )}
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center gap-2 justify-center flex-wrap">
                            <button
                              onClick={() => handleEditBill(order)}
                              disabled={order.invoiceGenerated}
                              className={`flex items-center gap-2 justify-center px-3 py-2 rounded-lg transition text-xs font-semibold ${
                                order.invoiceGenerated
                                  ? "bg-gray-300 text-gray-600 cursor-not-allowed opacity-50"
                                  : "bg-orange-500 text-white hover:bg-orange-600"
                              }`}
                            >
                              <FaEdit />
                              Edit Claim
                            </button>
                            <button
                              onClick={() => handleGenerateInvoice(order)}
                              disabled={order.invoiceGenerated}
                              className={`flex items-center gap-2 justify-center px-3 py-2 rounded-lg transition text-xs font-semibold ${
                                order.invoiceGenerated
                                  ? "bg-gray-400 text-gray-700 cursor-not-allowed opacity-50"
                                  : "bg-[#319bab] text-white hover:bg-[#257f87]"
                              }`}
                            >
                              <FaFileInvoice />
                              {order.invoiceGenerated ? "Invoice Generated" : "Generate Invoice"}
                            </button>
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
                                    📦 Claim Items
                                  </h4>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead className="bg-white text-gray-600 border-b">
                                        <tr>
                                          <th className="text-left py-2 px-3">Product Name</th>
                                          <th className="text-center py-2 px-3">HSN</th>
                                          <th className="text-center py-2 px-3">Qty</th>
                                          <th className="text-right py-2 px-3">Rate</th>
                                          <th className="text-right py-2 px-3">Discount</th>
                                          <th className="text-right py-2 px-3">Tax</th>
                                          <th className="text-right py-2 px-3">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {(order.items || []).map((item, idx) => (
                                          <tr key={idx} className="bg-white">
                                            <td className="py-2 px-3 font-semibold">{item.name}</td>
                                            <td className="py-2 px-3 text-center text-gray-600">{item.hsn}</td>
                                            <td className="py-2 px-3 text-center font-semibold">{item.qty}</td>
                                            <td className="py-2 px-3 text-right">₹{item.sellingPrice?.toFixed(2)}</td>
                                            <td className="py-2 px-3 text-right text-red-500">₹{(item.discountAmount || 0).toFixed(2)}</td>
                                            <td className="py-2 px-3 text-right text-blue-600">
                                              {item.igst ? `IGST ${item.gst}%` : `CGST ${item.cgst}% + SGST ${item.sgst}%`}
                                            </td>
                                            <td className="py-2 px-3 text-right font-bold text-[#319bab]">₹{item.total?.toLocaleString()}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
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

      {/* MODALS */}
      {showModal && selectedOrder && (
        <InvoiceGeneratorModal
          order={selectedOrder}
          onClose={() => {
            setShowModal(false);
            setSelectedOrder(null);
            fetchSalesOrders();
          }}
          onSuccess={() => {
            setShowModal(false);
            setSelectedOrder(null);
            fetchSalesOrders();
          }}
        />
      )}

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

      <AggregateSlipModal 
        isOpen={showSlipModal} 
        onClose={() => setShowSlipModal(false)} 
        orders={filteredSalesOrders} 
      />
    </div>
  );
};

export default BranchClaims;
