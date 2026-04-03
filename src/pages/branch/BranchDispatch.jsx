import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useEffect, useState } from "react";
import { FaBox, FaDownload, FaLock, FaTruck, FaUsers } from "react-icons/fa";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";
import { useInventory } from "../../context/InventoryContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : "https://pearls-erp-2026.onrender.com/api";

export default function BranchDispatch() {
  const { currentBranch, user } = useBranch();
  const { voucherTypes } = useInventory();
  const [searchParams] = useSearchParams();

  // State
  const [orderType, setOrderType] = useState(searchParams.get("type") || "SO"); // SO or PO
  const [selectedVoucher, setSelectedVoucher] = useState(searchParams.get("voucher") || "");
  // Removed selectedOrder state
  const [orders, setOrders] = useState([]);
  // Removed orderDetails state
  const [filteredVouchers, setFilteredVouchers] = useState([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  
  // Auto-detect voucher from name if only type and name provided
  useEffect(() => {
    if (voucherTypes.length > 0 && searchParams.get("voucher") && !selectedVoucher) {
      setSelectedVoucher(searchParams.get("voucher"));
    }
  }, [voucherTypes, searchParams]);
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
    const handleLoadProductsBulk = (preventClear = false) => {
      if (!selectedOrderIds.length) {
        toast.warning("Please select at least one order");
        return;
      }
      if (!selectedVoucher) {
        toast.warning("Please select a voucher type");
        return;
      }
      const selectedOrders = orders.filter((order) => selectedOrderIds.includes(order._id));
      const products = selectedOrders.flatMap((order) =>
        (order.items || []).map((item) => ({
          name: item.name || item.productName,
          qty: item.qty,
          hsn: item.hsn,
          unit: item.unit || "Units",
          altQty: item.altQty || 0,
          altUnit: item.altUnit || "",
          invoiceId: order.invoiceId || order.poId,
        }))
      );
      setLoadedProducts({
        type: "products",
        data: products,
        orderType: orderType,
        invoiceIds: selectedOrders.map((o) => o.invoiceId || o.poId),
      });
      if (!preventClear) {
        setLoadedParties(null);
        toast.success(`Products loaded for ${orderType === 'SO' ? 'Sales' : 'Purchase'} Order!`);
      }
    };

    // Load parties for selected orders
    const handleLoadPartiesBulk = async (preventClear = false) => {
      if (!selectedOrderIds.length) {
        toast.warning("Please select at least one order");
        return;
      }
      if (!selectedVoucher) {
        toast.warning("Please select a voucher type");
        return;
      }
      setLoading(true);
      try {
        const selectedOrders = orders.filter((order) => selectedOrderIds.includes(order._id));
        const parties = [];

        // Pre-fetch all vendors for the branch if any PO order has vendor as string
        let allVendors = [];
        if (orderType === "PO" && selectedOrders.some((o) => typeof o.vendor === 'string')) {
          const vRes = await fetch(`${API_BASE}/vendors?branchId=${currentBranch._id}`);
          const vData = await vRes.json();
          allVendors = vData.data || vData || [];
        }

        for (const order of selectedOrders) {
          if (orderType === "SO") {
            const customerId = order.customer?.customerId || order.customer?.id;
            if (customerId) {
              const response = await fetch(`${API_BASE}/customers/${customerId}`);
              const customerData = await response.json();
              parties.push({
                name: order.customer?.name || 'Unknown Customer',
                invoiceId: order.invoiceId,
                value: customerData.debit || 0,
                valueType: "debit",
              });
            }
          } else {
            // Handle vendor as string or object for PO
            const vendorName = typeof order.vendor === 'string' ? order.vendor : order.vendor?.name;
            const poInvoiceId = order.invoiceId || order.poId;
            if (typeof order.vendor === 'string') {
              // Vendor stored as plain name — look up by name in allVendors
              const matched = allVendors.find(
                (v) => v.name?.toLowerCase() === order.vendor.toLowerCase()
              );
              parties.push({
                name: vendorName,
                invoiceId: poInvoiceId,
                value: matched?.credit || 0,
                valueType: "credit",
              });
            } else {
              const vendorId = order.vendor?.vendorId || order.vendor?._id || order.vendor?.id;
              if (vendorId) {
                const response = await fetch(`${API_BASE}/vendors/${vendorId}`);
                const vendorData = await response.json();
                parties.push({
                  name: vendorName || 'Unknown Vendor',
                  invoiceId: poInvoiceId,
                  value: vendorData.credit || 0,
                  valueType: "credit",
                });
              } else {
                parties.push({
                  name: vendorName || 'Unknown Vendor',
                  invoiceId: poInvoiceId,
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
        if (!preventClear) {
          setLoadedProducts(null);
          toast.success(`Parties loaded for ${orderType === 'SO' ? 'Sales' : 'Purchase'} Order!`);
        }
      } catch (error) {
        console.error("Error loading parties:", error);
        toast.error("Failed to load parties");
      } finally {
        setLoading(false);
      }
    };

    const handleLoadBothBulk = async () => {
      if (!selectedOrderIds.length) {
        toast.warning("Please select at least one order");
        return;
      }
      if (!selectedVoucher) {
        toast.warning("Please select a voucher type");
        return;
      }
      handleLoadProductsBulk(true);
      await handleLoadPartiesBulk(true);
      toast.success("Products & Parties loaded together!");
    };
  const [loading, setLoading] = useState(false);

  // Filter vouchers by order type
  useEffect(() => {
    let filtered = voucherTypes.filter((v) => v.orderType === orderType);
    
    // Apply granular voucher authorization
    if (user?.allowedVoucherTypes && user.allowedVoucherTypes.length > 0) {
      filtered = filtered.filter(v => user.allowedVoucherTypes.includes(v._id));
    }

    setFilteredVouchers(filtered);
    setSelectedVoucher("");
    setOrders([]);
  }, [orderType, voucherTypes, user]);

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
          // Show both confirmed invoices and pending Sales Orders
          return order.voucherType === selectedVoucher && (order.invoiceGenerated || order.status === "PLACED");
        } else {
          // Show both confirmed invoices and pending Purchase Orders
          return order.voucherType === selectedVoucher && (order.status === "INVOICED" || order.status === "PLACED");
        }
      });

      setOrders(filtered);

      // If initialOrderId provided, auto-select it
      const initialOrderId = searchParams.get("orderId");
      if (initialOrderId) {
        const matched = filtered.find(o => o._id === initialOrderId || o.invoiceId === initialOrderId || o.poId === initialOrderId);
        if (matched) {
          setSelectedOrderIds([matched._id]);
        }
      }
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
      unit: item.unit || "Units",
      altQty: item.altQty || 0,
      altUnit: item.altUnit || "",
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
        const poInvoiceId = order.invoiceId || order.poId;
        const vendorName = typeof order.vendor === 'string' ? order.vendor : order.vendor?.name;
        let creditValue = 0;
        if (typeof order.vendor === 'string') {
          // Vendor stored as plain name — fetch all vendors and match by name
          const vRes = await fetch(`${API_BASE}/vendors?branchId=${currentBranch._id}`);
          const vData = await vRes.json();
          const allVendors = vData.data || vData || [];
          const matched = allVendors.find(
            (v) => v.name?.toLowerCase() === order.vendor.toLowerCase()
          );
          creditValue = matched?.credit || 0;
        } else {
          const vendorId = order.vendor?.vendorId || order.vendor?._id || order.vendor?.id;
          if (vendorId) {
            const response = await fetch(`${API_BASE}/vendors/${vendorId}`);
            const vendorData = await response.json();
            creditValue = vendorData.credit || 0;
          }
        }
        setLoadedParties({
          type: "parties",
          data: [
            {
              name: vendorName || 'Unknown Vendor',
              invoiceId: poInvoiceId,
              value: creditValue,
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

      const imgWidth = 210; // A4 width
      const pageHeight = 297; // A4 height
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add the first page
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add subsequent pages if content overflows
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Loading-Slip-${Date.now()}.pdf`);
      toast.success("PDF exported successfully!");

      // ✅ Audit log — record that a loading slip was generated
      try {
        const invoiceIds = loadedProducts?.invoiceIds?.join(", ") || loadedParties?.data?.map(p => p.invoiceId).join(", ") || "N/A";
        await fetch(`${API_BASE}/audit-logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user?._id || user?.id || "System",
            userModel: "BranchUser",
            username: user?.username || user?.name || "System",
            branchId: currentBranch?._id,
            action: "GENERATE_SLIP",
            description: `Generated Loading Slip for ${orderType === "SO" ? "Sales" : "Purchase"} Orders [${invoiceIds}] — Voucher: ${selectedVoucher?.toUpperCase()}`,
          }),
        });
      } catch (logErr) {
        console.warn("⚠️ Audit log for GENERATE_SLIP failed (non-blocking):", logErr);
      }
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20 px-4 md:px-6 pb-10">
      <div className="w-full">
        <div className="bg-gradient-to-r from-secondary to-primary text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center gap-4">
            <FaTruck className="text-5xl opacity-80" />
            <h1 className="text-4xl font-bold">Loading Slip Generator 🚚</h1>
          </div>
        </div>

        {/* Selection Panel */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Filter by Order Type & Voucher</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Order Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="text-red-500">*</span> Order Type
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="SO">Sales Order (SO)</option>
                <option value="PO">Purchase Order (PO)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Select to filter vouchers</p>
            </div>

            {/* Voucher Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="text-red-500">*</span> Voucher Type
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
              <p className="text-xs text-gray-500 mt-1">{filteredVouchers.length} types available</p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Status
              </label>
              <div className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg flex items-center h-10">
                <span className={`text-sm font-semibold ${orders.length > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                  {orders.length > 0 ? `${orders.length} Order(s) Found` : 'No Orders'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Orders Table with Bulk Actions */}
        {orders.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FaTruck className="text-primary" /> Available Orders ({orders.length})
              </h3>
              <div className="flex gap-2">
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  onClick={handleLoadProductsBulk}
                  disabled={!selectedOrderIds.length || loading}
                  title="Load products from selected orders"
                >
                  <FaBox /> Load Products
                </button>
                <button
                  className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  onClick={handleLoadPartiesBulk}
                  disabled={!selectedOrderIds.length || loading}
                  title="Load parties (Customer/Vendor) from selected orders"
                >
                  <FaUsers /> Load Parties
                </button>
                <button
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  onClick={handleLoadBothBulk}
                  disabled={!selectedOrderIds.length || loading}
                  title="Load both products and parties at once"
                >
                  <FaBox />+<FaUsers /> Load Both
                </button>
              </div>
            </div>
            <table className="w-full border-collapse border border-gray-300">
              <thead className="bg-gray-200">
                <tr>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Select</th>
                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold">{orderType === 'SO' ? 'Invoice ID' : 'PO ID'}</th>
                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Date</th>
                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold">{orderType === 'SO' ? 'Customer' : 'Vendor'}</th>
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
                    <td className="border border-gray-300 px-4 py-2">{(order.date || order.createdAt) ? new Date(order.date || order.createdAt).toLocaleDateString() : '-'}</td>
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
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-800">
                      LOADING SLIP
                    </h2>
                    <p className="text-gray-600 mt-2 text-lg font-semibold">
                      {orderType === "SO" ? "📦 Sales Order" : "🛒 Purchase Order"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Date:</span>{" "}
                      {new Date().toLocaleDateString('en-IN')}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-semibold">Type:</span>{" "}
                      {selectedVoucher || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-semibold">Ref:</span>{" "}
                      {loadedProducts?.invoiceIds?.join(', ') || loadedParties?.data?.[0]?.invoiceId || 'N/A'}
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
                          {loadedProducts.orderType === "SO" ? "Sales Order Qty" : "PO Qty"}
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
                            {product.qty} {product.unit || "Units"} {product.altQty > 0 && `(${product.altQty} ${product.altUnit})`}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center text-[10px] text-gray-500">
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
                    <FaUsers /> {loadedParties.orderType === "SO" ? "Customer Details" : "Vendor Details"}
                  </h3>
                  <table className="w-full border-collapse border border-gray-300">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                          {loadedParties.orderType === "SO" ? "Customer Name" : "Vendor Name"}
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-right font-semibold">
                          {loadedParties.orderType === "SO" ? "Invoice ID" : "PO ID"}
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-right font-semibold">
                          {loadedParties.orderType === "SO" ? "Debit (₹)" : "Credit (₹)"}
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
              Ready to generate loading slip
            </p>
            <div className="text-gray-500 text-left max-w-2xl mx-auto">
              <p className="mb-2"><strong>Step 1:</strong> Select an <span className="text-primary font-semibold">Order Type</span> (Sales Order or Purchase Order)</p>
              <p className="mb-2"><strong>Step 2:</strong> Select a <span className="text-primary font-semibold">Voucher Type</span> from the filtered list</p>
              <p className="mb-2"><strong>Step 3:</strong> Review and <span className="text-primary font-semibold">select one or multiple orders</span> from the table below</p>
              <p className="mb-2"><strong>Step 4:</strong> Click <span className="text-blue-600 font-semibold">"Load Products"</span> to see product details with quantities</p>
              <p className="mb-2"><strong>Step 5:</strong> Or click <span className="text-green-600 font-semibold">"Load Parties"</span> to see customer/vendor details with invoice info</p>
              <p><strong>Step 6:</strong> Download the loading slip as PDF</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
