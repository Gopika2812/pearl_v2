import { useEffect, useState } from "react";
import { FaBox, FaCheck, FaChevronDown, FaSync } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

const RecyclingEntry = () => {
  const { currentBranch } = useBranch();
  const [productsBelow, setProductsBelow] = useState([]);
  const [restockingEntries, setRestockingEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState({});
  const [restockingInProgress, setRestockingInProgress] = useState({});

  // Fetch products below threshold
  const fetchProductsBelow = async () => {
    const branchId = currentBranch?._id || localStorage.getItem("selectedBranchId");
    if (!branchId) {
      toast.error("Branch not selected");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/reordering/restocking/products-below-threshold?branchId=${branchId}`
      );
      const data = await res.json();
      setProductsBelow(data || []);
    } catch (err) {
      console.error("Error:", err);
      toast.error("Failed to fetch  products");
    } finally {
      setLoading(false);
    }
  };

  // Fetch restocking entries
  const fetchRestockingEntries = async () => {
    const branchId = currentBranch?._id || localStorage.getItem("selectedBranchId");
    if (!branchId) return;

    try {
      const res = await fetch(
        `${API_BASE}/reordering/restocking/entries?branchId=${branchId}`
      );
      const data = await res.json();
      setRestockingEntries(data || []);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  useEffect(() => {
    fetchProductsBelow();
    fetchRestockingEntries();
  }, [currentBranch?._id]);

  // Handle restock click
  const handleRestock = async (product) => {
    const branchId = currentBranch?._id || localStorage.getItem("selectedBranchId");
    setRestockingInProgress((prev) => ({
      ...prev,
      [product._id]: true,
    }));

    try {
      const res = await fetch(`${API_BASE}/reordering/restocking/restock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          productId: product._id,
          vendor: product.preferredVendor,
          notes: `Auto-restocking triggered - Stock below ${product.minStockQty}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(
        `✓ Restocking initiated! PO created: ${data.purchaseOrder.invoiceId}`
      );

      // Refresh data
      await fetchProductsBelow();
      await fetchRestockingEntries();
    } catch (err) {
      console.error("Error:", err);
      toast.error(err.message || "Failed to create restocking request");
    } finally {
      setRestockingInProgress((prev) => ({
        ...prev,
        [product._id]: false,
      }));
    }
  };

  // Handle mark received
  const handleMarkReceived = async (entryId) => {
    try {
      const res = await fetch(
        `${API_BASE}/reordering/restocking/entries/${entryId}/received`,
        { method: "PUT" }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success("✓ Restocking marked as received & stock updated");
      await fetchRestockingEntries();
    } catch (err) {
      console.error("Error:", err);
      toast.error("Failed to update status");
    }
  };

  const toggleExpanded = (id) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getStatusBadge = (status) => {
    const badges = {
      INITIATED: "bg-blue-100 text-blue-700",
      PO_CREATED: "bg-yellow-100 text-yellow-700",
      RECEIVED: "bg-green-100 text-green-700",
      CANCELLED: "bg-red-100 text-red-700",
    };
    return badges[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-16 md:pl-64">
      <ToastContainer position="top-right" autoClose={2500} theme="colored" />

      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4">
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                <FaBox className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-800">
                  Recycling & Restocking Entry
                </h1>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {currentBranch?.name || "Select a branch"}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                fetchProductsBelow();
                fetchRestockingEntries();
              }}
              disabled={loading}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
            >
              <FaSync className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* PRODUCTS BELOW THRESHOLD */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-orange-100 border-b">
            <h2 className="text-lg font-bold text-orange-900">
              📦 Products Below Minimum Stock
            </h2>
            <p className="text-sm text-orange-700 mt-1">
              {productsBelow.length} product(s) need restocking
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center animate-pulse">Loading products...</div>
          ) : productsBelow.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              ✓ All products are well stocked!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[11px] font-bold border-b">
                  <tr>
                    <th className="px-6 py-4 text-left"></th>
                    <th className="px-6 py-4 text-left">Product Name</th>
                    <th className="px-6 py-4 text-center">Current</th>
                    <th className="px-6 py-4 text-center">Min</th>
                    <th className="px-6 py-4 text-center">Max</th>
                    <th className="px-6 py-4 text-center">Restock Qty</th>
                    <th className="px-6 py-4 text-left">Preferred Vendor</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {productsBelow.map((product) => (
                    <tr key={product._id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleExpanded(product._id)}
                          className="text-orange-500 hover:bg-gray-200 p-1 rounded transition"
                        >
                          <FaChevronDown
                            className={`text-xs transition-transform ${
                              expandedProducts[product._id] ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-800">
                          {product.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold">
                          {product.totalQty || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-semibold">
                        {product.minStockQty || 10}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold">
                        {product.maxStockQty || 50}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                          {product.restockingQty} units
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {product.preferredVendor || "-"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleRestock(product)}
                          disabled={restockingInProgress[product._id]}
                          className="flex items-center gap-2 justify-center bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition disabled:opacity-50 text-xs font-semibold mx-auto"
                        >
                          <FaBox />
                          {restockingInProgress[product._id]
                            ? "Creating..."
                            : "Restock"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RESTOCKING HISTORY */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-green-100 border-b">
            <h2 className="text-lg font-bold text-green-900">
              📋 Restocking Entries History
            </h2>
            <p className="text-sm text-green-700 mt-1">
              {restockingEntries.length} total entries
            </p>
          </div>

          {restockingEntries.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No restocking entries yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[11px] font-bold border-b">
                  <tr>
                    <th className="px-6 py-4 text-left">Product</th>
                    <th className="px-6 py-4 text-center">Current Qty</th>
                    <th className="px-6 py-4 text-center">Restock Qty</th>
                    <th className="px-6 py-4 text-left">Vendor</th>
                    <th className="px-6 py-4 text-left">PO Number</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Date</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {restockingEntries.map((entry) => (
                    <tr key={entry._id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-semibold">
                        {entry.productName}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {entry.currentQty}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold">
                        {entry.restockingQty}
                      </td>
                      <td className="px-6 py-4">{entry.vendor}</td>
                      <td className="px-6 py-4 text-blue-600 font-semibold">
                        {entry.purchaseOrderNumber || "-"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                            entry.status
                          )}`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-600 text-xs">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {entry.status === "PO_CREATED" ? (
                          <button
                            onClick={() => handleMarkReceived(entry._id)}
                            className="flex items-center gap-2 justify-center bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition text-xs font-semibold mx-auto"
                          >
                            <FaCheck />
                            Received
                          </button>
                        ) : entry.status === "RECEIVED" ? (
                          <span className="text-green-600 font-semibold">
                            ✓ Done
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecyclingEntry;
