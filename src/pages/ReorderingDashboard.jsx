import { useEffect, useState } from "react";
import {
  FaCheckCircle,
  FaChevronRight,
  FaEdit,
  FaExclamationTriangle,
  FaSearch,
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
    </div>
  );
};

export default ReorderingDashboard;
