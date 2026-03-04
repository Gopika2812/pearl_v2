import { useEffect, useState } from "react";
import { FaArrowUp, FaBox, FaExclamationCircle, FaExclamationTriangle, FaSync } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

export default function BranchRecycling() {
  const { currentBranch, user } = useBranch();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restockingInProgress, setRestockingInProgress] = useState({});
  const [branchLoaded, setBranchLoaded] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchProducts = async () => {
    if (!currentBranch?._id) {
      console.warn("⚠️  Branch not yet loaded in context");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const branchId = currentBranch._id;
      const url = `${API_BASE}/products?branchId=${branchId}`;
      console.log("🔍 Fetching products from:", url);
      console.log("📌 Branch ID:", branchId);
      console.log("📌 Current Branch:", currentBranch);
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("📦 Full API Response:", data);
      
      let productList = [];
      
      // API returns { success, data: [...], pagination: {...} }
      if (data?.data && Array.isArray(data.data)) {
        productList = data.data;
        console.log("✨ Extracted products from data.data:", productList.length, "items");
      } else if (Array.isArray(data)) {
        productList = data;
        console.log("✨ Response is direct array:", productList.length, "items");
      } else if (data?.products && Array.isArray(data.products)) {
        productList = data.products;
        console.log("✨ Extracted products from data.products:", productList.length, "items");
      } else {
        console.warn("⚠️  No products array found in response");
      }
      
      console.log("✅ Final product list:", productList);
      setProducts(productList);
      
      if (productList.length === 0) {
        toast.info("No products found for this branch");
      }
    } catch (err) {
      console.error("❌ Error fetching products:", err);
      toast.error(err.message || "Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  // Wait for branch to load from localStorage, then fetch products
  useEffect(() => {
    if (currentBranch?._id) {
      console.log("✅ Branch loaded:", currentBranch.name);
      setBranchLoaded(true);
      fetchProducts();
    } else {
      setBranchLoaded(false);
    }
  }, [currentBranch?._id]);

  // Categorize products by stock level
  const categorizeProducts = (prods) => {
    return {
      outOfStock: prods.filter((p) => p.totalQty === 0),
      lowStock: prods.filter(
        (p) => p.totalQty > 0 && p.totalQty < (p.reorderLevel || 10)
      ),
      normalStock: prods.filter(
        (p) => p.totalQty >= (p.reorderLevel || 10) && p.totalQty > 0
      ),
    };
  };

  // Get last PO info for vendor and voucher type
  const fetchLastPOForVendor = async (productId) => {
    try {
      const res = await fetch(
        `${API_BASE}/purchase-orders?branchId=${currentBranch._id}&limit=1&sort=-date`
      );
      const data = await res.json();
      return data && data.length > 0 ? data[0] : null;
    } catch (err) {
      console.error("Error fetching last PO:", err);
      return null;
    }
  };

  // Generate next voucher ID
  const generateNextVoucherId = (lastPO) => {
    if (!lastPO?.invoiceId) return `PO/001/${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    
    const parts = lastPO.invoiceId.split("/");
    const prefix = parts[0]; // e.g., "ZONE1PO" or "PO"
    const currentNum = parseInt(parts[1]) || 0;
    const fyear = parts[2] || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    
    return `${prefix}/${String(currentNum + 1).padStart(3, "0")}/${fyear}`;
  };

  // Handle restocking
  const handleRestock = async (product) => {
    if (!product.reorderQty || product.reorderQty === 0) {
      toast.error(`Restocking quantity not set for ${product.name}`);
      return;
    }

    setRestockingInProgress((prev) => ({ ...prev, [product._id]: true }));

    try {
      // Fetch last PO to get vendor and voucher type
      const lastPO = await fetchLastPOForVendor(product._id);
      const nextVoucherId = generateNextVoucherId(lastPO);

      // Determine vendor and voucher type
      const vendor = product.preferredVendor || lastPO?.vendor || "Default Vendor";
      const voucherType = lastPO?.voucherType || "standard";

      const poPayload = {
        branchId: currentBranch._id,
        invoiceId: nextVoucherId,
        voucherType,
        vendor,
        warehouse: lastPO?.warehouse || "",
        billingPerson: user?.id || "",
        items: [
          {
            productId: product._id,
            name: product.name,
            productGroup: product.productGroup,
            qty: product.reorderQty,
            purchasePrice: product.purchasingPrice,
            sellingPrice: product.sellingPrice,
            hsn: product.hsn || product.hsnCode,
            gst: product.gst,
            cgst: (product.gst || 0) / 2,
            sgst: (product.gst || 0) / 2,
            igst: false,
          },
        ],
        subtotal: product.reorderQty * product.purchasingPrice,
        totalTax:
          (product.reorderQty * product.purchasingPrice * product.gst) / 100,
        transportCharge: 0,
        grandTotal:
          product.reorderQty * product.purchasingPrice +
          (product.reorderQty * product.purchasingPrice * product.gst) / 100,
        status: "PLACED",
        date: new Date().toISOString(),
      };

      const res = await fetch(`${API_BASE}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(poPayload),
      });

      const data = await res.json();

      if (data.success || res.ok) {
        toast.success(
          `✅ Restocking PO Created!\nInvoice: ${nextVoucherId}\nQty: ${product.reorderQty} units`
        );
        fetchProducts(); // Refresh products
      } else {
        toast.error(data.message || "Failed to create restocking PO");
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Error creating restocking PO");
    } finally {
      setRestockingInProgress((prev) => ({ ...prev, [product._id]: false }));
    }
  };

  // Start editing product settings
  const startEditProduct = (product) => {
    setEditingProduct(product._id);
    setEditValues({
      reorderLevel: product.reorderLevel || 10,
      reorderQty: product.reorderQty || 20,
      preferredVendor: product.preferredVendor || "",
    });
  };

  // Save product configuration
  const saveProductConfig = async () => {
    if (!editingProduct) return;

    setSavingConfig(true);
    try {
      const res = await fetch(`${API_BASE}/products/${editingProduct}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      });

      const data = await res.json();
      if (data.success || res.ok) {
        toast.success("✅ Product settings updated!");
        setEditingProduct(null);
        fetchProducts(); // Refresh products
      } else {
        toast.error(data.message || "Failed to save settings");
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Error saving product settings");
    } finally {
      setSavingConfig(false);
    }
  };

  const { outOfStock, lowStock, normalStock } = categorizeProducts(products);

  const StockCategory = ({ title, products: prods, icon: Icon, bgColor, textColor, borderColor }) => (
    <div className="mb-8">
      <div className={`flex items-center gap-3 mb-4 pb-3 border-b-2 ${borderColor}`}>
        <Icon className={`text-2xl ${textColor}`} />
        <h2 className={`text-xl font-bold ${textColor}`}>{title}</h2>
        <span className={`ml-auto px-3 py-1 rounded-full text-sm font-semibold ${bgColor}`}>
          {prods.length}
        </span>
      </div>

      {prods.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No products in this category</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prods.map((product) => (
            <div
              key={product._id}
              className={`${bgColor} border-l-4 ${borderColor} p-5 rounded-lg shadow hover:shadow-lg transition`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 text-sm mb-1">
                    {product.name}
                  </h3>
                  <p className="text-xs text-gray-600">{product.units}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Stock:</span>
                  <span className="font-semibold text-gray-800">
                    {product.totalQty} {product.units}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Threshold:</span>
                  <span className="font-semibold text-gray-800">
                    {product.reorderLevel || 10}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Restock Qty:</span>
                  <span className="font-semibold text-gray-800">
                    {product.reorderQty || 20}
                  </span>
                </div>
                {product.preferredVendor && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vendor:</span>
                    <span className="font-semibold text-gray-800">
                      {product.preferredVendor}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => startEditProduct(product)}
                  className="w-full py-2 px-3 rounded font-semibold text-sm transition border-2 border-blue-500 text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2"
                >
                  ⚙️ Edit Settings
                </button>
                <button
                  onClick={() => handleRestock(product)}
                  disabled={restockingInProgress[product._id] || !product.reorderQty}
                  className={`w-full py-2 px-3 rounded font-semibold text-sm transition flex items-center justify-center gap-2 ${
                    restockingInProgress[product._id]
                      ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                      : product.reorderQty
                      ? "bg-green-500 text-white hover:bg-green-600"
                      : "bg-gray-300 text-gray-600 cursor-not-allowed"
                  }`}
                >
                  <FaArrowUp />
                  {restockingInProgress[product._id]
                    ? "Processing..."
                    : "Restock Now"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Edit Settings Modal
  const EditModal = () => {
    const product = products.find((p) => p._id === editingProduct);
    if (!product) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
          <div className="bg-blue-600 text-white p-6 rounded-t-xl">
            <h2 className="text-2xl font-bold">⚙️ Edit Restocking Settings</h2>
            <p className="text-blue-100 mt-1">{product.name}</p>
          </div>

          <div className="p-6 space-y-5">
            {/* Threshold */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reorder Threshold (Low Stock Alert)
              </label>
              <input
                type="number"
                value={editValues.reorderLevel}
                onChange={(e) =>
                  setEditValues({ ...editValues, reorderLevel: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 10"
              />
              <p className="text-xs text-gray-500 mt-1">
                Alert when stock falls below this qty
              </p>
            </div>

            {/* Restock Qty */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reorder Quantity
              </label>
              <input
                type="number"
                value={editValues.reorderQty}
                onChange={(e) =>
                  setEditValues({ ...editValues, reorderQty: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 20"
              />
              <p className="text-xs text-gray-500 mt-1">
                How much to order when threshold is reached
              </p>
            </div>

            {/* Preferred Vendor */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Preferred Vendor (Optional)
              </label>
              <input
                type="text"
                value={editValues.preferredVendor}
                onChange={(e) =>
                  setEditValues({ ...editValues, preferredVendor: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., M.B.AGENCIES"
              />
              <p className="text-xs text-gray-500 mt-1">
                Auto-used for restocking POs
              </p>
            </div>

            {/* Current Stats */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600">
                <strong>Current Stock:</strong> {product.totalQty} {product.units}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                <strong>Purchasing Price:</strong> ₹{product.purchasingPrice}
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex gap-3">
            <button
              onClick={() => setEditingProduct(null)}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={saveProductConfig}
              disabled={savingConfig}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {savingConfig ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-16 md:pl-64 px-4 md:px-6 pb-10">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="colored"
      />

      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl shadow-lg p-8 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <FaExclamationTriangle className="text-5xl opacity-80" />
            <div>
              <h1 className="text-4xl font-bold">Smart Restocking</h1>
              <p className="text-orange-100 mt-1">Automated Low Stock Alerts & Restocking</p>
            </div>
          </div>
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition disabled:opacity-50 flex items-center gap-2"
          >
            <FaSync className={loading ? "animate-spin" : ""} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* CONTENT */}
        {!branchLoaded ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="animate-pulse text-gray-500">
              ⏳ Initializing branch context...
            </div>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="animate-pulse text-gray-500">
              Loading products...
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <p className="text-gray-500">No products found for this branch</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow p-8">
            {/* OUT OF STOCK */}
            <StockCategory
              title="🔴 OUT OF STOCK"
              products={outOfStock}
              icon={FaBox}
              bgColor="bg-red-50"
              textColor="text-red-600"
              borderColor="border-red-300"
            />

            {/* LOW STOCK */}
            <StockCategory
              title="🟡 LOW STOCK - ACTION REQUIRED"
              products={lowStock}
              icon={FaExclamationCircle}
              bgColor="bg-yellow-50"
              textColor="text-yellow-700"
              borderColor="border-yellow-300"
            />

            {/* NORMAL STOCK */}
            <StockCategory
              title="🟢 NORMAL STOCK"
              products={normalStock}
              icon={FaBox}
              bgColor="bg-green-50"
              textColor="text-green-700"
              borderColor="border-green-300"
            />
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editingProduct && <EditModal />}
    </div>
  );
}
