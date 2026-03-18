import { useEffect, useState } from "react";
import { FaArrowLeft, FaCheck, FaEye, FaFileInvoice } from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import { API_BASE } from "../../api";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#319bab] outline-none text-sm";
const labelClass =
  "block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight";

export default function InventorySalesInvoice() {
  const [salesOrders, setSalesOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [editMode, setEditMode] = useState({});
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  // Filter states
  const [filterVoucherType, setFilterVoucherType] = useState("");
  const [filterInvoiceId, setFilterInvoiceId] = useState("");
  const [filterCustomerName, setFilterCustomerName] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");

  // Fetch all sales orders
  useEffect(() => {
    fetchSalesOrders();
  }, []);

  const fetchSalesOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sales-orders`);
      const data = await res.json();
      
      if (data.success) {
        setSalesOrders(data.data || []);
      } else {
        setSalesOrders(data.data || []);
      }
    } catch (err) {
      console.error("❌ Failed to fetch sales orders:", err);
      toast.error("Failed to load sales orders");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setInvoiceItems(order.items.map((item) => ({ ...item })));
    setEditMode({});
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...invoiceItems];
    updated[index][field] = value;
    
    // Recalculate total if qty or sellingPrice changes
    if (field === "qty" || field === "sellingPrice") {
      updated[index].total = updated[index].qty * updated[index].sellingPrice * (1 + updated[index].gst / 100);
    }
    
    setInvoiceItems(updated);
    setEditMode({ ...editMode, [index]: true });
  };

  const handleRemoveItem = (index) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = invoiceItems.reduce((sum, item) => {
      return sum + item.qty * item.sellingPrice;
    }, 0);

    const totalTax = invoiceItems.reduce((sum, item) => {
      const itemSubtotal = item.qty * item.sellingPrice;
      return sum + (itemSubtotal * item.gst) / 100;
    }, 0);

    const grandTotal = subtotal + totalTax + (selectedOrder?.transportCharge || 0) + (selectedOrder?.extraExpenseAmount || 0);

    return { subtotal, totalTax, grandTotal };
  };

  const handleGenerateInvoice = async () => {
    if (invoiceItems.length === 0) {
      return toast.error("Add at least one item to generate invoice");
    }

    setGeneratingInvoice(true);
    try {
      const { subtotal, totalTax, grandTotal } = calculateTotals();

      const payload = {
        salesOrderId: selectedOrder._id,
        invoiceItems,
        invoiceSampleItems: selectedOrder.sampleItems || [],
        invoiceSubtotal: subtotal,
        invoiceTotalDiscount: selectedOrder.totalDiscount || 0,
        invoiceTotalTax: totalTax,
        invoiceTransportCharge: selectedOrder.transportCharge || 0,
        invoiceGrandTotal: grandTotal,
        invoiceOpeningBalance: selectedOrder.openingBalance,
        invoiceClosingBalance: selectedOrder.openingBalance + grandTotal,
      };

      console.log("📤 Generating invoice with payload:", payload);

      const res = await fetch(`${API_BASE}/sales-orders/${selectedOrder._id}/generate-invoice`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to generate invoice");
      }

      console.log("✅ Invoice generated successfully");
      toast.success(`Invoice Generated: ${data.invoiceId}`);
      
      // Refresh the list
      fetchSalesOrders();
      setSelectedOrder(null);
    } catch (err) {
      console.error("❌ Invoice generation failed:", err);
      toast.error(err.message || "Failed to generate invoice");
    } finally {
      setGeneratingInvoice(false);
    }
  };

  // Filter sales orders based on criteria
  const filteredSalesOrders = salesOrders.filter((order) => {
    const matchesVoucherType = filterVoucherType === "" || 
      (order.voucherType && order.voucherType.toLowerCase().includes(filterVoucherType.toLowerCase()));
    
    const matchesInvoiceId = filterInvoiceId === "" || 
      (order.invoiceId && order.invoiceId.toLowerCase().includes(filterInvoiceId.toLowerCase()));
    
    const matchesCustomerName = filterCustomerName === "" || 
      (order.customer.name && order.customer.name.toLowerCase().includes(filterCustomerName.toLowerCase()));
    
    const orderDate = new Date(order.createdAt);
    const matchesFromDate = filterFromDate === "" || orderDate >= new Date(filterFromDate);
    const matchesToDate = filterToDate === "" || orderDate <= new Date(filterToDate + "T23:59:59");

    return matchesVoucherType && matchesInvoiceId && matchesCustomerName && matchesFromDate && matchesToDate;
  });

  const { subtotal, totalTax, grandTotal } = selectedOrder && invoiceItems.length > 0 
    ? calculateTotals() 
    : { subtotal: 0, totalTax: 0, grandTotal: 0 };

  if (selectedOrder) {
    return (
      <div className="space-y-6">
        <ToastContainer
          position="top-right"
          autoClose={2500}
          newestOnTop
          closeOnClick
          pauseOnHover
          theme="colored"
        />

        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setSelectedOrder(null)}
              className="flex items-center gap-2 text-[#319bab] hover:text-teal-700 font-semibold transition"
            >
              <FaArrowLeft /> Back to Orders
            </button>
            <h2 className="text-2xl font-bold text-gray-800">
              Invoice: {selectedOrder.invoiceId}
            </h2>
            <div className="w-24"></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>Customer</label>
              <input className={`${inputClass} bg-gray-50`} value={selectedOrder.customer.name} readOnly />
            </div>
            <div>
              <label className={labelClass}>WhatsApp</label>
              <input className={`${inputClass} bg-gray-50`} value={selectedOrder.customer.whatsapp} readOnly />
            </div>
            <div>
              <label className={labelClass}>Warehouse</label>
              <input className={`${inputClass} bg-gray-50`} value={selectedOrder.warehouse} readOnly />
            </div>
            <div>
              <label className={labelClass}>Created</label>
              <input className={`${inputClass} bg-gray-50`} value={new Date(selectedOrder.createdAt).toLocaleDateString()} readOnly />
            </div>
          </div>
        </div>

        {/* INVOICE ITEMS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Invoice Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left px-4 py-2 text-xs font-bold text-gray-600">Product</th>
                  <th className="text-center px-4 py-2 text-xs font-bold text-gray-600">HSN</th>
                  <th className="text-center px-4 py-2 text-xs font-bold text-gray-600">Qty</th>
                  <th className="text-right px-4 py-2 text-xs font-bold text-gray-600">Price</th>
                  <th className="text-right px-4 py-2 text-xs font-bold text-gray-600">GST</th>
                  <th className="text-right px-4 py-2 text-xs font-bold text-gray-600">Total</th>
                  <th className="text-center px-4 py-2 text-xs font-bold text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoiceItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-center">{item.hsn}</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        className={`${inputClass} w-20 text-center`}
                        value={item.qty}
                        onChange={(e) => handleItemChange(idx, "qty", parseInt(e.target.value) || 0)}
                        min="1"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        className={`${inputClass} w-24 text-right`}
                        value={item.sellingPrice}
                        onChange={(e) => handleItemChange(idx, "sellingPrice", parseFloat(e.target.value) || 0)}
                        step="0.01"
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-sm">{item.gst}%</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      ₹{(item.qty * item.sellingPrice * (1 + item.gst / 100)).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="text-red-500 hover:text-red-700 transition"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TOTALS */}
        <div className="bg-gradient-to-br from-blue-50 to-teal-50 p-6 rounded-2xl border border-blue-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">Subtotal</p>
              <p className="text-2xl font-bold text-gray-800">₹{subtotal.toFixed(2)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">Tax</p>
              <p className="text-2xl font-bold text-blue-600">₹{totalTax.toFixed(2)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">Transport</p>
              <p className="text-2xl font-bold text-gray-800">₹{(selectedOrder.transportCharge || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">Extra Expenses</p>
              <p className="text-2xl font-bold text-orange-600">₹{(selectedOrder.extraExpenseAmount || 0).toFixed(2)}</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-white rounded-lg border-2 border-green-200">
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold text-gray-700">Grand Total</p>
              <p className="text-3xl font-bold text-green-600">₹{grandTotal.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => setSelectedOrder(null)}
            className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-bold hover:bg-gray-300 transition flex items-center gap-2"
          >
            <FaArrowLeft /> Cancel
          </button>
          <button
            onClick={handleGenerateInvoice}
            disabled={generatingInvoice || invoiceItems.length === 0}
            className="px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 disabled:bg-gray-400 transition flex items-center gap-2"
          >
            <FaCheck /> {generatingInvoice ? "Generating..." : "Generate Invoice"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer position="top-right" autoClose={2500} />

      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-500 to-teal-500 text-white p-6 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <FaFileInvoice className="text-3xl" />
          <h1 className="text-3xl font-bold">Sales Invoice</h1>
        </div>
        <p className="text-blue-100">Convert Sales Orders to Invoices and generate financial documents</p>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className={labelClass}>Voucher Type</label>
            <input
              type="text"
              placeholder="Search voucher type..."
              className={inputClass}
              value={filterVoucherType}
              onChange={(e) => setFilterVoucherType(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Invoice ID</label>
            <input
              type="text"
              placeholder="Search invoice ID..."
              className={inputClass}
              value={filterInvoiceId}
              onChange={(e) => setFilterInvoiceId(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Customer Name</label>
            <input
              type="text"
              placeholder="Search customer..."
              className={inputClass}
              value={filterCustomerName}
              onChange={(e) => setFilterCustomerName(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>From Date</label>
            <input
              type="date"
              className={inputClass}
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>To Date</label>
            <input
              type="date"
              className={inputClass}
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500">
          Showing {filteredSalesOrders.length} of {salesOrders.length} orders
        </div>
      </div>

      {/* SALES ORDERS LIST */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading sales orders...</p>
        </div>
      ) : filteredSalesOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 text-lg">{salesOrders.length === 0 ? "No sales orders found" : "No orders match your filters"}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredSalesOrders.map((order) => (
            <div
              key={order._id}
              className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition"
            >
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">Voucher Type</p>
                  <p className="text-sm font-semibold text-gray-800">{order.voucherType || "N/A"}</p>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">Invoice ID</p>
                  <p className="text-lg font-bold text-gray-800">{order.invoiceId}</p>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">Customer</p>
                  <p className="text-sm font-semibold text-gray-800">{order.customer.name}</p>
                  <p className="text-xs text-gray-500">{order.customer.whatsapp}</p>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">Date</p>
                  <p className="text-sm font-semibold text-gray-800">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">Grand Total</p>
                  <p className="text-lg font-bold text-green-600">₹{order.grandTotal.toFixed(2)}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSelectOrder(order)}
                    className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-bold hover:bg-blue-600 transition flex items-center justify-center gap-2"
                  >
                    <FaFileInvoice /> Generate
                  </button>
                  <button
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                    title="View details"
                  >
                    <FaEye />
                  </button>
                </div>
              </div>

              {order.recordType === "SALES INVOICE" && (
                <div className="mt-3 inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                  ✓ Invoiced
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
