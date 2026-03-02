import { useEffect, useState } from "react";
import {
  FaCheckCircle,
  FaChevronRight,
  FaEdit,
  FaExclamationTriangle,
  FaSearch,
  FaShoppingCart,
  FaSpinner,
  FaTimes,
  FaTimesCircle,
} from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API_BASE } from "../api";

const ReorderingDashboard = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [filterStatus, setFilterStatus] = useState("all"); // all, critical, low, normal
  const [searchTerm, setSearchTerm] = useState(""); // search term for product name/hsn
  const [showRecyclingModal, setShowRecyclingModal] = useState(false);
  const [recyclingData, setRecyclingData] = useState(null);
  const [lastVendor, setLastVendor] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [billingPersons, setBillingPersons] = useState([]);

  // Fetch dashboard data
  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/reordering/dashboard`);
      const data = await res.json();

      if (data.success) {
        setProducts(data.data);
      } else {
        toast.error("Failed to load dashboard");
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      toast.error("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch product details
  const handleProductClick = async (product) => {
    try {
      const res = await fetch(`${API_BASE}/reordering/product/${product.productId}`);
      const data = await res.json();

      if (data.success) {
        setSelectedProduct(data.data);
      }
    } catch (error) {
      console.error("Error fetching product details:", error);
      toast.error("Error loading product details");
    }
  };

  // Update reorder settings
  const handleSaveSettings = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/reordering/product/${editingId}/settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editData),
        }
      );

      const data = await res.json();

      if (data.success) {
        toast.success("Settings updated!");
        setEditingId(null);
        fetchDashboard();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("Error updating settings");
    }
  };

  // Handle recycling action - fetch last vendor and show modal
  const handleRecyclingAction = async () => {
    try {
      if (!selectedProduct) return;

      // Fetch warehouses and billing persons first
      const [warehousesRes, billingPersonsRes, poRes] = await Promise.all([
        fetch(`${API_BASE}/warehouses`),
        fetch(`${API_BASE}/sales-men`), // Billing persons
        fetch(`${API_BASE}/purchase-orders`),
      ]);

      const warehousesData = await warehousesRes.json();
      const billingPersonsData = await billingPersonsRes.json();
      const poData = await poRes.json();

      if (warehousesData.success) {
        setWarehouses(warehousesData.data || []);
      }
      if (billingPersonsData.success) {
        setBillingPersons(billingPersonsData.data || []);
      }

      if (poData.success) {
        // Find the last PO for this product
        const relevantPOs = poData.data.filter((po) =>
          po.items?.some((item) => 
            item.productId?.toString() === selectedProduct.productId.toString() ||
            item.productId === selectedProduct.productId
          )
        );

        if (relevantPOs.length > 0) {
          const lastPO = relevantPOs[relevantPOs.length - 1];
          const lastItem = lastPO.items.find((item) =>
            item.productId?.toString() === selectedProduct.productId.toString() ||
            item.productId === selectedProduct.productId
          );

          // Handle vendor as string, ObjectId or object
          let vendorName = "";
          let vendorId = "";
          
          if (typeof lastPO.vendor === "object" && lastPO.vendor?._id) {
            vendorName = lastPO.vendor.name || "";
            vendorId = lastPO.vendor._id;
          } else if (typeof lastPO.vendor === "string") {
            // If vendor is just a name string
            vendorName = lastPO.vendor;
            vendorId = lastPO.vendor;
          }

          // 🔄 Use CURRENT product prices (with margin), not last PO prices
          const purchasePrice = selectedProduct.purchasingPrice || 0;
          const sellingPrice = selectedProduct.sellingPrice || purchasePrice;
          const gst = selectedProduct.gst || 0;

          // Generate next invoice number based on voucher type
          const voucherType = lastPO.voucherType || "";
          const lastInvoiceNum = lastPO.invoiceId || "";
          const match = lastInvoiceNum.match(/\/(\d+)\//);
          const currentNum = match ? parseInt(match[1]) : 0;
          const nextNum = (currentNum + 1).toString().padStart(3, "0");
          const nextInvoiceId = `${voucherType}PO/${nextNum}/${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

          setLastVendor({
            name: vendorName,
            id: vendorId,
            city: lastPO.warehouse,
            invoiceId: lastPO.invoiceId,
            voucherType: lastPO.voucherType,
          });

          setRecyclingData({
            productId: selectedProduct.productId,
            productName: selectedProduct.productName,
            vendorId: vendorId,
            vendorName: vendorName,
            qty: selectedProduct.reordering.reorderQty,
            purchasePrice: purchasePrice,
            sellingPrice: sellingPrice,
            gst: gst,
            lastPODate: lastPO.date,
            lastPOQty: lastItem?.qty,
            // New fields
            voucherType: lastPO.voucherType,
            lastInvoiceId: lastPO.invoiceId,
            warehouse: lastPO.warehouse,
            billingPerson: lastPO.billingPerson,
            // Generated invoice
            newInvoiceId: nextInvoiceId,
          });
        } else {
          toast.warning("No previous orders found for this product");
          setRecyclingData({
            productId: selectedProduct.productId,
            productName: selectedProduct.productName,
            qty: selectedProduct.reordering.reorderQty,
            purchasePrice: 0,
            sellingPrice: 0,
            gst: 0,
          });
        }
        setShowRecyclingModal(true);
      }
    } catch (error) {
      console.error("Error fetching vendor data:", error);
      toast.error("Error loading vendor details");
    }
  };

  // Create purchase order from recycling action
  const handleCreateRecyclingPO = async () => {
    try {
      if (!recyclingData?.vendorId) {
        toast.error("Vendor is required");
        return;
      }

      const poPayload = {
        date: new Date().toISOString(),
        vendor: recyclingData.vendorId,
        voucherType: recyclingData.voucherType || "standard",
        warehouse: recyclingData.warehouse || "",
        billingPerson: recyclingData.billingPerson || "",
        items: [
          {
            productId: recyclingData.productId,
            name: recyclingData.productName,
            qty: recyclingData.qty,
            purchasePrice: recyclingData.purchasePrice,
            sellingPrice: recyclingData.sellingPrice,
            hsn: selectedProduct.hsn,
            gst: recyclingData.gst,
          },
        ],
        notes: `Auto-created from reordering - Product at ${selectedProduct.status} level | Previous PO: ${recyclingData.lastInvoiceId}`,
      };

      const res = await fetch(`${API_BASE}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(poPayload),
      });

      const data = await res.json();

      if (data.success) {
        // 🔄 Update ONLY purchasing price
        // Backend hook will auto-calculate: sellingPrice = purchasingPrice + margin
        const productUpdatePayload = {
          purchasingPrice: recyclingData.purchasePrice,
          // Margin stays the same - let hook calculate new selling price
        };

        const updateRes = await fetch(`${API_BASE}/products/${recyclingData.productId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productUpdatePayload),
        });

        const updateData = await updateRes.json();

        if (updateData.success) {
          // Calculate what the new selling price will be
          const currentMargin = selectedProduct.sellingPrice - selectedProduct.purchasingPrice;
          const newSellingPrice = recyclingData.purchasePrice + currentMargin;
          
          toast.success(
            `✅ PO Created: ${data.data.invoiceId}\n💰 Product prices updated!\nNew Purchase Price: ₹${recyclingData.purchasePrice.toFixed(2)}\nNew Selling Price: ₹${newSellingPrice.toFixed(2)}`
          );
        } else {
          // PO created but price update failed
          toast.warning(
            `✅ PO Created: ${data.data.invoiceId}\n⚠️ But price update failed. Please update manually.`
          );
        }

        setShowRecyclingModal(false);
        setRecyclingData(null);
        fetchDashboard();
      } else {
        toast.error(data.message || "Failed to create PO");
      }
    } catch (error) {
      console.error("Error creating PO:", error);
      toast.error("Error creating purchase order");
    }
  };

  // Filter products
  const filteredProducts = products
    .filter((p) =>
      filterStatus === "all"
        ? true
        : p.status.toLowerCase() === filterStatus
    )
    .filter((p) =>
      searchTerm.trim() === ""
        ? true
        : p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.hsn.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // Get status badge color
  const getStatusBadge = (status) => {
    const styles = {
      OUT_OF_STOCK: "bg-red-100 text-red-800 border-red-300",
      CRITICAL: "bg-orange-100 text-orange-800 border-orange-300",
      LOW: "bg-yellow-100 text-yellow-800 border-yellow-300",
      NORMAL: "bg-green-100 text-green-800 border-green-300",
    };
    return styles[status] || styles.NORMAL;
  };

  const getStatusIcon = (status) => {
    const icons = {
      OUT_OF_STOCK: <FaTimesCircle className="inline mr-1" />,
      CRITICAL: <FaExclamationTriangle className="inline mr-1" />,
      LOW: <FaExclamationTriangle className="inline mr-1" />,
      NORMAL: <FaCheckCircle className="inline mr-1" />,
    };
    return icons[status] || icons.NORMAL;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-primary/5 to-primary/10">
        <FaSpinner className="text-4xl text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 md:ml-64 mt-0">
      <ToastContainer
        position="top-right"
        autoClose={2500}
        theme="colored"
        toastStyle={{
          background: "rgba(49, 155, 171, 0.85)",
          borderRadius: "12px",
        }}
      />

      <div className="p-6 md:p-8">
        <div className="max-w-7xl">
          {/* Header */}
          <div className="mb-8 pb-6 border-b border-gray-200">
            <h1 className="text-3xl md:text-4xl font-black text-gray-800 mb-2">
              📦 Re-cycling stock
            </h1>
            <p className="text-gray-600 text-sm md:text-base">
              Monitor stock levels, pending orders, and manage re-ordering settings
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-l-4 border-red-500 hover:shadow-md transition">
              <div className="text-xs md:text-sm text-gray-500 mb-2 font-semibold">OUT OF STOCK</div>
              <div className="text-2xl md:text-3xl font-bold text-red-600">
                {products.filter((p) => p.status === "OUT_OF_STOCK").length}
              </div>
            </div>

            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-l-4 border-orange-500 hover:shadow-md transition">
              <div className="text-xs md:text-sm text-gray-500 mb-2 font-semibold">CRITICAL</div>
              <div className="text-2xl md:text-3xl font-bold text-orange-600">
                {products.filter((p) => p.status === "CRITICAL").length}
              </div>
            </div>

            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-l-4 border-yellow-500 hover:shadow-md transition">
              <div className="text-xs md:text-sm text-gray-500 mb-2 font-semibold">LOW STOCK</div>
              <div className="text-2xl md:text-3xl font-bold text-yellow-600">
                {products.filter((p) => p.status === "LOW").length}
              </div>
            </div>

            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-l-4 border-green-500 hover:shadow-md transition">
              <div className="text-xs md:text-sm text-gray-500 mb-2 font-semibold">NORMAL</div>
              <div className="text-2xl md:text-3xl font-bold text-green-600">
                {products.filter((p) => p.status === "NORMAL").length}
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="mb-6">
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by product name or HSN code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-10 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm md:text-base"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <FaTimes />
                </button>
              )}
            </div>
            {searchTerm && (
              <p className="text-xs text-gray-500 mt-2">
                Found {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-3 md:px-4 py-2 rounded-lg font-semibold text-xs md:text-sm transition ${
                filterStatus === "all"
                  ? "bg-primary text-white shadow-md"
                  : "bg-white text-gray-700 border border-gray-200 hover:border-primary/30"
              }`}
            >
              All Products ({products.length})
            </button>
            <button
              onClick={() => setFilterStatus("critical")}
              className={`px-3 md:px-4 py-2 rounded-lg font-semibold text-xs md:text-sm transition ${
                filterStatus === "critical"
                  ? "bg-red-600 text-white shadow-md"
                  : "bg-white text-gray-700 border border-gray-200 hover:border-red-200"
              }`}
            >
              🔴 Critical
            </button>
            <button
              onClick={() => setFilterStatus("low")}
              className={`px-3 md:px-4 py-2 rounded-lg font-semibold text-xs md:text-sm transition ${
                filterStatus === "low"
                  ? "bg-yellow-600 text-white shadow-md"
                  : "bg-white text-gray-700 border border-gray-200 hover:border-yellow-200"
              }`}
            >
              🟡 Low
            </button>
            <button
              onClick={() => setFilterStatus("normal")}
              className={`px-3 md:px-4 py-2 rounded-lg font-semibold text-xs md:text-sm transition ${
                filterStatus === "normal"
                  ? "bg-green-600 text-white shadow-md"
                  : "bg-white text-gray-700 border border-gray-200 hover:border-green-200"
              }`}
            >
              🟢 Normal
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Products List */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-xs md:text-sm">
                  <thead className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-gray-200">
                    <tr>
                      <th className="px-4 md:px-6 py-3 text-left font-bold text-gray-700">
                        Product Name
                      </th>
                      <th className="px-4 md:px-6 py-3 text-center font-bold text-gray-700">
                        Available
                      </th>
                      <th className="px-4 md:px-6 py-3 text-center font-bold text-gray-700">
                        Pending SO
                      </th>
                      <th className="px-4 md:px-6 py-3 text-center font-bold text-gray-700">
                        Status
                      </th>
                      <th className="px-4 md:px-6 py-3 text-center font-bold text-gray-700">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((product) => (
                        <tr key={product.productId} className="hover:bg-primary/2 transition">
                          <td className="px-4 md:px-6 py-4">
                            <div className="font-semibold text-gray-900">
                              {product.productName}
                            </div>
                            <div className="text-xs text-gray-500">
                              HSN: {product.hsn}
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 text-center">
                            <span className="font-bold text-lg text-primary">
                              {product.effectiveAvailable}
                            </span>
                            <div className="text-xs text-gray-500">
                              (Current: {product.currentStock})
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 text-center">
                            <span className="font-bold text-lg text-orange-600">
                              {product.pendingSO}
                            </span>
                            <div className="text-xs text-gray-500">
                              Not invoiced
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 text-center">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-bold ${getStatusBadge(
                                product.status
                              )}`}
                            >
                              {getStatusIcon(product.status)}
                              {product.status}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-4 text-center">
                            <button
                              onClick={() => handleProductClick(product)}
                              className="text-primary hover:text-primary/70 font-bold transition"
                            >
                              <FaChevronRight />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-4 md:px-6 py-8 text-center text-gray-500">
                          No products found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Product Details Panel */}
            <div className="lg:col-span-1">
              {selectedProduct ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-6">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 line-clamp-1">
                      {selectedProduct.productName}
                    </h2>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="text-gray-400 hover:text-gray-600 text-lg"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Stock Info */}
                  <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
                    <div>
                      <div className="text-xs text-gray-500 mb-1 font-semibold">Current Stock</div>
                      <div className="text-2xl font-bold text-primary">
                        {selectedProduct.stock.totalCurrentStock} units
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                        <div className="text-xs text-gray-600 mb-1 font-semibold">Allocated for SO</div>
                        <div className="text-lg font-bold text-orange-600">
                          {selectedProduct.stock.allocatedStock}
                        </div>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                        <div className="text-xs text-gray-600 mb-1 font-semibold">Effective Available</div>
                        <div className="text-lg font-bold text-green-600">
                          {selectedProduct.stock.effectiveAvailable}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sales Order Info */}
                  <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                    <h3 className="font-bold text-gray-900 text-sm">SALES ORDER INFO</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Ordered:</span>
                        <span className="font-bold">{selectedProduct.salesOrder.totalOrdered}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Invoiced:</span>
                        <span className="font-bold text-green-600">
                          {selectedProduct.salesOrder.totalInvoiced}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Pending (Not Invoiced):</span>
                        <span className="font-bold text-orange-600">
                          {selectedProduct.salesOrder.pendingSO}
                        </span>
                      </div>
                    </div>

                    {selectedProduct.salesOrder.details.length > 0 && (
                      <div className="mt-3 text-xs">
                        <div className="font-bold text-gray-700 mb-2">Recent Orders:</div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {selectedProduct.salesOrder.details.map((so, idx) => (
                            <div key={idx} className="bg-gray-50 p-2 rounded border border-gray-200">
                              <div className="font-bold text-gray-700">{so.soId}</div>
                              <div className="text-gray-600">
                                Ordered: {so.orderedQty} | Invoiced: {so.invoicedQty}
                              </div>
                              {so.pendingQty > 0 && (
                                <div className="text-orange-600 font-semibold">
                                  Pending: {so.pendingQty}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reorder Settings */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-900 text-sm">RE-ORDER SETTINGS</h3>

                    {editingId !== selectedProduct.productId ? (
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-gray-500 mb-1 font-semibold">Alert Threshold</div>
                          <div className="text-lg font-bold text-primary">
                            {selectedProduct.reordering.reorderLevel} units
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1 font-semibold">Reorder Quantity</div>
                          <div className="text-lg font-bold">
                            {selectedProduct.reordering.reorderQty} units
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <div className="text-xs text-gray-500 font-semibold">Lead Time</div>
                            <div className="font-bold">
                              {selectedProduct.reordering.leadTime} days
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-semibold">Period</div>
                            <div className="font-bold">
                              {selectedProduct.reordering.checkPeriod}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setEditingId(selectedProduct.productId);
                            setEditData(selectedProduct.reordering);
                          }}
                          className="w-full bg-primary text-white py-2 rounded-lg font-bold text-sm hover:bg-primary/90 transition mt-4 inline-flex items-center justify-center"
                        >
                          <FaEdit className="mr-2" /> Edit Settings
                        </button>

                        {(selectedProduct.status === "CRITICAL" || selectedProduct.status === "LOW" || selectedProduct.status === "OUT_OF_STOCK") && (
                          <button
                            onClick={handleRecyclingAction}
                            className="w-full bg-red-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-red-700 transition inline-flex items-center justify-center"
                          >
                            <FaShoppingCart className="mr-2" /> 🔄 Recycling Action
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-600 font-bold">
                            Alert Threshold (units)
                          </label>
                          <input
                            type="number"
                            value={editData.reorderLevel || ""}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                reorderLevel: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-gray-600 font-bold">
                            Reorder Quantity (units)
                          </label>
                          <input
                            type="number"
                            value={editData.reorderQty || ""}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                reorderQty: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-gray-600 font-bold">
                            Lead Time (days)
                          </label>
                          <input
                            type="number"
                            value={editData.leadTime || ""}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                leadTime: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-gray-600 font-bold">
                            Check Period
                          </label>
                          <select
                            value={editData.checkPeriod || "MONTHLY"}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                checkPeriod: e.target.value,
                              })
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="DAILY">Daily</option>
                            <option value="WEEKLY">Weekly</option>
                            <option value="MONTHLY">Monthly</option>
                            <option value="QUARTERLY">Quarterly</option>
                          </select>
                        </div>

                        <div className="flex gap-2 pt-4">
                          <button
                            onClick={handleSaveSettings}
                            className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-green-700 transition"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-bold text-sm hover:bg-gray-400 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
                  <p className="text-gray-500">Select a product to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Recycling Action Modal */}
      {showRecyclingModal && recyclingData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <FaShoppingCart className="mr-3 text-red-600" />
                🔄 Create Recycling Purchase Order
              </h2>
              <button
                onClick={() => {
                  setShowRecyclingModal(false);
                  setRecyclingData(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Left: PO Form */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">Invoice ID (Auto-Generated)</label>
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="font-bold text-blue-900">{recyclingData.newInvoiceId}</div>
                  </div>
                  {recyclingData.lastInvoiceId && (
                    <div className="text-xs text-gray-500 mt-1">Last: {recyclingData.lastInvoiceId}</div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">Product</label>
                  <div className="bg-gray-100 p-3 rounded-lg">
                    <div className="font-bold text-gray-900">{recyclingData.productName}</div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">Vendor *</label>
                  <input
                    type="text"
                    value={recyclingData.vendorName || ""}
                    onChange={(e) =>
                      setRecyclingData({ ...recyclingData, vendorName: e.target.value })
                    }
                    placeholder="Last vendor will be auto-filled"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">Warehouse *</label>
                  <select
                    value={recyclingData.warehouse || ""}
                    onChange={(e) =>
                      setRecyclingData({ ...recyclingData, warehouse: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select Warehouse</option>
                    {warehouses.map((w) => (
                      <option key={w._id} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                  {recyclingData.warehouse && (
                    <div className="text-xs text-gray-500 mt-1">From last order: {recyclingData.warehouse}</div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">Billing Person *</label>
                  <select
                    value={recyclingData.billingPerson || ""}
                    onChange={(e) =>
                      setRecyclingData({ ...recyclingData, billingPerson: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select Billing Person</option>
                    {billingPersons.map((bp) => (
                      <option key={bp._id} value={bp._id}>{bp.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">Quantity (units) *</label>
                  <input
                    type="number"
                    value={recyclingData.qty || ""}
                    onChange={(e) =>
                      setRecyclingData({ ...recyclingData, qty: parseInt(e.target.value) || 0 })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    (Reorder Qty: {selectedProduct.reordering.reorderQty} units)
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">
                    💰 Purchase Price (₹) <span className="text-blue-600">*Will Update Product</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={recyclingData.purchasePrice || ""}
                    onChange={(e) =>
                      setRecyclingData({ ...recyclingData, purchasePrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-blue-50"
                  />
                  <div className="text-xs text-blue-600 mt-1">📌 This will be saved as product's purchasing price</div>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">
                    🏷️ Selling Price (₹) <span className="text-blue-600">*Will Update Product</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={recyclingData.sellingPrice || ""}
                    onChange={(e) =>
                      setRecyclingData({ ...recyclingData, sellingPrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-blue-50"
                  />
                  <div className="text-xs text-blue-600 mt-1">📌 This will be saved as product's selling price</div>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">GST (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={recyclingData.gst || ""}
                    onChange={(e) =>
                      setRecyclingData({ ...recyclingData, gst: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="text-xs text-gray-500 mt-1">From last order</div>
                </div>

                <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                  <div className="text-xs text-gray-600 font-semibold mb-1">Estimated PO Total:</div>
                  <div className="text-2xl font-bold text-orange-600">
                    ₹{(recyclingData.qty * recyclingData.purchasePrice).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">With {recyclingData.gst}% GST: ₹{(recyclingData.qty * recyclingData.purchasePrice * (1 + recyclingData.gst / 100)).toFixed(2)}</div>
                </div>
              </div>

              {/* Right: Previous Order Details */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 max-h-[60vh] overflow-y-auto">
                <h3 className="font-bold text-gray-900 mb-4">📋 Previous Order Details</h3>

                {lastVendor ? (
                  <div className="space-y-4">
                    <div className="bg-white p-3 rounded-lg border border-gray-300">
                      <div className="text-xs text-gray-600 font-semibold mb-1">Last Invoice ID:</div>
                      <div className="font-bold text-gray-900">{lastVendor.invoiceId}</div>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-gray-300">
                      <div className="text-xs text-gray-600 font-semibold mb-1">Voucher Type:</div>
                      <div className="font-bold text-gray-900">{lastVendor.voucherType || "Standard"}</div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-600 font-semibold mb-1">Last Vendor:</div>
                      <div className="font-bold text-gray-900">{lastVendor.name}</div>
                      {lastVendor.city && (
                        <div className="text-xs text-gray-600">{lastVendor.city}</div>
                      )}
                    </div>

                    {recyclingData.lastPODate && (
                      <div>
                        <div className="text-xs text-gray-600 font-semibold mb-1">Last Order Date:</div>
                        <div className="font-bold text-gray-900">
                          {new Date(recyclingData.lastPODate).toLocaleDateString()}
                        </div>
                      </div>
                    )}

                    {recyclingData.lastPOQty && (
                      <div>
                        <div className="text-xs text-gray-600 font-semibold mb-1">Last Order Qty:</div>
                        <div className="font-bold text-gray-900">{recyclingData.lastPOQty} units</div>
                      </div>
                    )}

                    <div>
                      <div className="text-xs text-gray-600 font-semibold mb-1">Purchase Price (Last Order):</div>
                      <div className="font-bold text-gray-900">₹{recyclingData.purchasePrice?.toFixed(2)}</div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-600 font-semibold mb-1">Selling Price (Last Order):</div>
                      <div className="font-bold text-gray-900">₹{recyclingData.sellingPrice?.toFixed(2)}</div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-600 font-semibold mb-1">GST (Last Order):</div>
                      <div className="font-bold text-gray-900">{recyclingData.gst}%</div>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-gray-300 mt-4">
                      <div className="text-xs text-gray-700 font-semibold mb-2">📊 Stock Status:</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span>Current Stock:</span>
                          <span className="font-bold">{selectedProduct.stock.totalCurrentStock}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Effective Available:</span>
                          <span className="font-bold text-orange-600">{selectedProduct.stock.effectiveAvailable}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Alert Threshold:</span>
                          <span className="font-bold text-red-600">{selectedProduct.reordering.reorderLevel}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    <p>No previous orders found.</p>
                    <p className="mt-2">Please enter vendor details manually.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowRecyclingModal(false);
                  setRecyclingData(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-400 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRecyclingPO}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 transition flex flex-col items-center justify-center"
              >
                <div className="flex items-center">
                  <FaShoppingCart className="mr-2" />
                  Create PO
                </div>
                <div className="text-xs mt-1">+ Update Product Prices</div>
              </button>
            </div>
          </div>
        </div>
      )}    </div>
  );
};

export default ReorderingDashboard;
