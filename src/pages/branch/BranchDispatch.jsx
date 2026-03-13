import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useEffect, useState } from "react";
import { FaBox, FaDownload, FaLock, FaTruck, FaUsers } from "react-icons/fa";
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

export default function BranchDispatch() {
  const { currentBranch } = useBranch();
  const { voucherTypes } = useInventory();

  // State
  const [orderType, setOrderType] = useState("SO"); // SO or PO
  const [selectedVoucher, setSelectedVoucher] = useState("");
  // Removed selectedOrder state
  const [orders, setOrders] = useState([]);
  // Removed orderDetails state
  const [filteredVouchers, setFilteredVouchers] = useState([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [loadedProducts, setLoadedProducts] = useState(null);
  const [loadedParties, setLoadedParties] = useState(null);
    // Handle order selection (checkbox)
    const handleOrderCheckbox = (orderId) => {
      setSelectedOrderIds((prev) =>
        prev.includes(orderId)
          ? prev.filter((id) => id !== orderId)
          : [...prev, orderId]
      );
    };

    // Load products for selected orders
    const handleLoadProductsBulk = () => {
      if (!selectedOrderIds.length) return;
      const selectedOrders = orders.filter((order) => selectedOrderIds.includes(order._id));
      const products = selectedOrders.flatMap((order) =>
        (order.items || []).map((item) => ({
          name: item.name || item.productName,
          qty: item.qty,
          hsn: item.hsn,
          unit: "Units",
          invoiceId: order.invoiceId || order.poId,
        }))
      );
      setLoadedProducts({
        type: "products",
        data: products,
        orderType: orderType,
        invoiceIds: selectedOrders.map((o) => o.invoiceId || o.poId),
      });
      setLoadedParties(null);
      toast.success("Products loaded!");
    };

    // Load parties for selected orders
    const handleLoadPartiesBulk = async () => {
      if (!selectedOrderIds.length) return;
      setLoading(true);
      try {
        const selectedOrders = orders.filter((order) => selectedOrderIds.includes(order._id));
        const parties = [];
        for (const order of selectedOrders) {
          if (orderType === "SO") {
            const customerId = order.customer?.customerId || order.customer?.id;
            const response = await fetch(`${API_BASE}/customers/${customerId}`);
            const customerData = await response.json();
            parties.push({
              name: order.customer?.name,
              invoiceId: order.invoiceId,
              value: customerData.debit || 0,
              valueType: "debit",
            });
          } else {
            // Handle vendor as string or object
            if (typeof order.vendor === 'string') {
              parties.push({
                name: order.vendor,
                invoiceId: order.poId,
                value: 0,
                valueType: "credit",
              });
            } else {
              const vendorId = order.vendor?.vendorId || order.vendor?.id;
              if (vendorId) {
                const response = await fetch(`${API_BASE}/vendors/${vendorId}`);
                const vendorData = await response.json();
                parties.push({
                  name: order.vendor?.name,
                  invoiceId: order.poId,
                  value: vendorData.credit || 0,
                  valueType: "credit",
                });
              } else {
                parties.push({
                  name: order.vendor?.name || 'Unknown Vendor',
                  invoiceId: order.poId,
                  value: 0,
                  valueType: "credit",
                });
              }
            }
          }
        }
        setLoadedParties({
          type: "parties",
          data: parties,
          orderType: orderType,
        });
        setLoadedProducts(null);
        toast.success("Parties loaded!");
      } catch (error) {
        console.error("Error loading parties:", error);
        toast.error("Failed to load parties");
      } finally {
        setLoading(false);
      }
    };
  const [loading, setLoading] = useState(false);

  // Filter vouchers by order type
  useEffect(() => {
    const filtered = voucherTypes.filter((v) => v.orderType === orderType);
    setFilteredVouchers(filtered);
    setSelectedVoucher("");
    setOrders([]);
  }, [orderType, voucherTypes]);

  // Fetch orders when voucher changes
  useEffect(() => {
    if (selectedVoucher && currentBranch?._id) {
      fetchOrders();
    } else {
      setOrders([]);
    }
  }, [selectedVoucher]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const endpoint = orderType === "SO" ? "/sales-orders" : "/purchase-orders";
      const response = await fetch(`${API_BASE}${endpoint}?branchId=${currentBranch._id}`);
      const data = await response.json();

      // Filter by voucher type and get only finalized/invoiced orders
      const filtered = (data || []).filter((order) => {
        if (orderType === "SO") {
          return order.voucherType === selectedVoucher && order.invoiceGenerated;
        } else {
          return order.voucherType === selectedVoucher;
        }
      });

      setOrders(filtered);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  // Removed fetchOrderDetails and handleOrderSelect

  const handleLoadProducts = (order) => {
    if (!order) return;
    const products = (order.items || []).map((item) => ({
      name: item.name || item.productName,
      qty: item.qty,
      hsn: item.hsn,
      unit: "Units",
    }));
    setLoadedProducts({
      type: "products",
      data: products,
      orderType: orderType,
      invoiceId: order.invoiceId || order.poId,
    });
    toast.success("Products loaded!");
  };

  const handleLoadParties = async (order) => {
    if (!order) return;
    try {
      setLoading(true);
      if (orderType === "SO") {
        const customerId = order.customer?.customerId || order.customer?.id;
        const response = await fetch(`${API_BASE}/customers/${customerId}`);
        const customerData = await response.json();
        setLoadedParties({
          type: "parties",
          data: [
            {
              name: order.customer?.name,
              invoiceId: order.invoiceId,
              value: customerData.debit || 0,
              valueType: "debit",
            },
          ],
          orderType: orderType,
        });
      } else {
        const vendorId = order.vendor?.vendorId || order.vendor?.id;
        const response = await fetch(`${API_BASE}/vendors/${vendorId}`);
        const vendorData = await response.json();
        setLoadedParties({
          type: "parties",
          data: [
            {
              name: order.vendor?.name,
              invoiceId: order.poId,
              value: vendorData.credit || 0,
              valueType: "credit",
            },
          ],
          orderType: orderType,
        });
      }
      toast.success("Parties loaded!");
    } catch (error) {
      console.error("Error loading parties:", error);
      toast.error("Failed to load parties");
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!loadedProducts && !loadedParties) {
      toast.warning("Please load at least products or parties first!");
      return;
    }

    try {
      setLoading(true);
      const element = document.getElementById("loading-slip-content");
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`Loading-Slip-${Date.now()}.pdf`);
      toast.success("PDF exported successfully!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-16 md:pl-64 px-4 md:px-6 pb-10">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-secondary to-primary text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center gap-4">
            <FaTruck className="text-5xl opacity-80" />
            <h1 className="text-4xl font-bold">Loading Slip Generator 🚚</h1>
          </div>
        </div>

        {/* Selection Panel */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Order Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Order Type
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="SO">Sales Order</option>
                <option value="PO">Purchase Order</option>
              </select>
            </div>

            {/* Voucher Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Voucher Type
              </label>
              <select
                value={selectedVoucher}
                onChange={(e) => setSelectedVoucher(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">Select Voucher Type</option>
                {filteredVouchers.map((v) => (
                  <option key={v._id} value={v.name}>
                    {v.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Orders Table with Bulk Actions */}
        {orders.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                Orders
              </h3>
              <div className="flex gap-2">
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  onClick={handleLoadProductsBulk}
                  disabled={!selectedOrderIds.length || loading}
                >
                  Products
                </button>
                <button
                  className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  onClick={handleLoadPartiesBulk}
                  disabled={!selectedOrderIds.length || loading}
                >
                  Parties
                </button>
              </div>
            </div>
            <table className="w-full border-collapse border border-gray-300">
              <thead className="bg-gray-200">
                <tr>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Select</th>
                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Order ID</th>
                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Date</th>
                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Party</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(order._id)}
                        onChange={() => handleOrderCheckbox(order._id)}
                        disabled={loading}
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">{order.invoiceId || order.poId}</td>
                    <td className="border border-gray-300 px-4 py-2">{order.date ? new Date(order.date).toLocaleDateString() : '-'}</td>
                    <td className="border border-gray-300 px-4 py-2">{orderType === 'SO' ? order.customer?.name : (typeof order.vendor === 'string' ? order.vendor : order.vendor?.name)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Loading Slip Content */}
        {(loadedProducts || loadedParties) && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <div id="loading-slip-content" className="bg-white p-8">
              {/* Header */}
              <div className="border-b-2 border-gray-300 pb-6 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">
                      LOADING SLIP
                    </h2>
                    <p className="text-gray-600 mt-1">
                      {orderType === "SO" ? "Sales Order" : "Purchase Order"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Date:</span>{" "}
                      {new Date().toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-semibold">Ref:</span>{" "}
                      {loadedProducts?.invoiceId || loadedParties?.data?.[0]?.invoiceId}
                    </p>
                  </div>
                </div>
              </div>

              {/* Products Section */}
              {loadedProducts && (
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <FaBox /> Products
                  </h3>
                  <table className="w-full border-collapse border border-gray-300">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                          Product Name
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-right font-semibold">
                          HSN
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-right font-semibold">
                          Qty
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-center font-semibold">
                          Unit
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadedProducts.data.map((product, idx) => (
                        <tr key={idx}>
                          <td className="border border-gray-300 px-4 py-2">
                            {product.name}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right">
                            {product.hsn || "-"}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                            {product.qty}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            {product.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Parties Section */}
              {loadedParties && (
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <FaUsers /> {orderType === "SO" ? "Customer" : "Vendor"}
                  </h3>
                  <table className="w-full border-collapse border border-gray-300">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                          Party Name
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-right font-semibold">
                          Invoice ID
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-right font-semibold">
                          {orderType === "SO" ? "Debit (₹)" : "Credit (₹)"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadedParties.data.map((party, idx) => (
                        <tr key={idx}>
                          <td className="border border-gray-300 px-4 py-2">
                            {party.name}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right">
                            {party.invoiceId}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                            ₹{party.value.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer */}
              <div className="border-t-2 border-gray-300 pt-6 mt-8">
                <div className="flex justify-between text-sm text-gray-600">
                  <div>
                    <p className="font-semibold">Prepared By: ___________</p>
                  </div>
                  <div>
                    <p className="font-semibold">Authorized By: ___________</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Export Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleExportPDF}
                disabled={loading}
                className="bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-lg flex items-center gap-2 transition"
              >
                <FaDownload size={18} /> Export as PDF
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loadedProducts && !loadedParties && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <FaLock className="mx-auto text-5xl text-gray-400 mb-4" />
            <p className="text-lg text-gray-600 font-semibold mb-2">
              Select orders to generate loading slip
            </p>
            <p className="text-gray-500">
              Choose order type, voucher type, then select orders from the table and use the action buttons above to load products or parties data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
