import { useEffect, useState } from "react";
import { FaArrowUp, FaBox, FaExclamationCircle, FaExclamationTriangle, FaList, FaSync, FaThLarge } from "react-icons/fa";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [bulkRestockingInProgress, setBulkRestockingInProgress] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0, limit: 50 });
  const [viewMode, setViewMode] = useState("card"); // "card" or "table"
  const [selectedProductGroup, setSelectedProductGroup] = useState("All"); // Filter by group
  const [allProducts, setAllProducts] = useState([]); // Store all products for group filtering
  const [allProductGroups, setAllProductGroups] = useState([]); // Store all unique product groups

  // Fetch all products to get all product groups available
  const fetchAllProductsForGroups = async () => {
    if (!currentBranch?._id) return;

    try {
      const branchId = currentBranch._id;
      let allProductsData = [];
      let page = 1;
      let hasMore = true;

      console.log("🔄 Starting to fetch all products for groups...");

      // Fetch all pages until we get all products
      while (hasMore) {
        const url = `${API_BASE}/products?branchId=${branchId}&page=${page}&limit=500`; // Increased limit
        
        console.log(`📄 Fetching page ${page} from: ${url}`);
        
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`⚠️ API returned status ${res.status}, stopping fetch`);
          break;
        }
        
        const data = await res.json();
        console.log(`📦 Page ${page} response:`, data);
        
        let productList = [];
        let pagination = null;

        if (data?.data && Array.isArray(data.data)) {
          productList = data.data;
          pagination = data.pagination;
          console.log(`✨ Extracted ${productList.length} products from data.data`);
        } else if (Array.isArray(data)) {
          productList = data;
          console.log(`✨ Response is direct array with ${productList.length} products`);
          hasMore = false;
        } else if (data?.products && Array.isArray(data.products)) {
          productList = data.products;
          pagination = data.pagination;
          console.log(`✨ Extracted ${productList.length} products from data.products`);
        } else {
          console.warn("⚠️ No products array found in response");
          hasMore = false;
        }

        if (productList.length === 0) {
          console.log("📭 Empty product list, stopping fetch");
          hasMore = false;
        } else {
          allProductsData = [...allProductsData, ...productList];
          console.log(`📊 Total products so far: ${allProductsData.length}`);

          // Check if there are more pages
          if (pagination) {
            console.log(`📄 Pagination info:`, pagination);
            if (page >= (pagination.pages || 1)) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }

        page++;

        // Safety limit to prevent infinite loops
        if (page > 100) {
          console.warn("⚠️ Reached max pages (100), stopping");
          hasMore = false;
        }
      }

      console.log(`✅ FINAL: Fetched ${allProductsData.length} total products`);
      console.log("📋 All products:", allProductsData);

      // Store all products and extract unique groups
      setAllProducts(allProductsData);

      // Extract unique product groups
      const groups = new Set(
        allProductsData
          .map((p) => {
            if (p.productGroup && typeof p.productGroup === 'object') {
              return p.productGroup.name || p.productGroup._id;
            }
            return p.productGroup;
          })
          .filter(Boolean)
      );
      
      const finalGroups = ["All", ...Array.from(groups).sort()];
      console.log("🏷️ Unique product groups:", finalGroups);
      setAllProductGroups(finalGroups);
    } catch (err) {
      console.error("❌ Error fetching all product groups:", err);
    }
  };

  const fetchProducts = async (page = 1, search = "") => {
    if (!currentBranch?._id) {
      console.warn("⚠️  Branch not yet loaded in context");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const branchId = currentBranch._id;
      let url = `${API_BASE}/products?branchId=${branchId}&page=${page}&limit=50`;
      
      // Add search parameter if search term exists
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }
      
      console.log("🔍 Fetching products from:", url);
      console.log("📄 Page:", page || 1);
      console.log("📌 Branch ID:", branchId);
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("📦 Full API Response:", data);
      
      let productList = [];
      let paginationInfo = { total: 0, pages: 0, limit: 2000 };
      
      // API returns { success, data: [...], pagination: {...} }
      if (data?.data && Array.isArray(data.data)) {
        productList = data.data;
        paginationInfo = data.pagination || paginationInfo;
        console.log("✨ Extracted products from data.data:", productList.length, "items");
        console.log("📊 Pagination:", paginationInfo);
      } else if (Array.isArray(data)) {
        productList = data;
        console.log("✨ Response is direct array:", productList.length, "items");
      } else if (data?.products && Array.isArray(data.products)) {
        productList = data.products;
        paginationInfo = data.pagination || paginationInfo;
        console.log("✨ Extracted products from data.products:", productList.length, "items");
      } else {
        console.warn("⚠️  No products array found in response");
      }
      
      console.log("✅ Final product list:", productList);
      setProducts(productList);
      setPagination(paginationInfo);
      
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

  // Fetch pending sales orders (not yet converted to invoice)
  const fetchPendingSales = async () => {
    if (!currentBranch?._id) return null;

    try {
      const res = await fetch(`${API_BASE}/sales-orders?branchId=${currentBranch._id}`);
      if (!res.ok) return null;

      const data = await res.json();
      let salesOrders = [];

      if (data?.data && Array.isArray(data.data)) {
        salesOrders = data.data;
      } else if (Array.isArray(data)) {
        salesOrders = data;
      }

      // Filter only pending (not invoiced) orders
      const pendingOrders = salesOrders.filter((so) => !so.invoiceGenerated);

      // Create a map of productId -> total pending qty
      const pendingMap = {};
      pendingOrders.forEach((order) => {
        if (Array.isArray(order.items)) {
          order.items.forEach((item) => {
            const prodId = item.productId?._id || item.productId;
            pendingMap[prodId] = (pendingMap[prodId] || 0) + (item.qty || 0);
          });
        }
      });

      console.log("📊 Pending Sales Map:", pendingMap);
      return pendingMap;
    } catch (err) {
      console.error("❌ Error fetching pending sales:", err);
      return null;
    }
  };

  const [pendingSalesMap, setPendingSalesMap] = useState(null);

  // Fetch both products and pending sales
  const fetchAllData = async (page = 1, search = "") => {
    await fetchProducts(page, search);
    const pendingMap = await fetchPendingSales();
    setPendingSalesMap(pendingMap || {});
  };

  // Handle search - reset to page 1
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  useEffect(() => {
    if (currentBranch?._id) {
      console.log("✅ Branch loaded:", currentBranch.name);
      setBranchLoaded(true);
      fetchAllData(currentPage, searchTerm);
      fetchAllProductsForGroups(); // Fetch all groups on load
    } else {
      setBranchLoaded(false);
    }
  }, [currentBranch?._id]);

  // Handle page and search changes
  useEffect(() => {
    if (currentBranch?._id && branchLoaded) {
      fetchAllData(currentPage, searchTerm);
    }
  }, [currentPage, searchTerm]);

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
            gst: product.gst || 0,
            cgst: (product.gst || 0) / 2,
            sgst: (product.gst || 0) / 2,
            igst: false,
            subtotal: product.reorderQty * product.purchasingPrice,
            tax: (product.reorderQty * product.purchasingPrice * (product.gst || 0)) / 100,
            total: product.reorderQty * product.purchasingPrice + (product.reorderQty * product.purchasingPrice * (product.gst || 0)) / 100,
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
        fetchAllData(currentPage, searchTerm); // Refresh products and pending sales
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
        // Update local state immediately for real-time bucket changes
        setProducts((prevProducts) =>
          prevProducts.map((p) =>
            p._id === editingProduct
              ? { ...p, ...editValues }
              : p
          )
        );
        
        toast.success("✅ Product settings updated! Bucket updated immediately.");
        setEditingProduct(null);
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

  // Toggle product selection for bulk restocking
  const toggleProductSelection = (productId) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  // Bulk restock selected products - CREATE SINGLE PO
  const handleBulkRestock = async () => {
    if (selectedProducts.size === 0) {
      toast.error("Please select at least one product");
      return;
    }

    // Use allProducts if available (includes products from all groups), otherwise fall back to products
    const sourceProducts = allProducts.length > 0 ? allProducts : products;
    const selectedProds = sourceProducts.filter((p) => selectedProducts.has(p._id));

    // Validate we found all selected products
    if (selectedProds.length === 0) {
      toast.error("❌ Selected products not found in database");
      console.error("Selected IDs:", Array.from(selectedProducts));
      console.error("Source products:", sourceProducts.map(p => p._id));
      return;
    }

    if (selectedProds.length !== selectedProducts.size) {
      console.warn(`⚠️ Only found ${selectedProds.length} of ${selectedProducts.size} selected products`);
    }

    // Validate all products have same vendor
    const vendors = new Set(selectedProds.map((p) => p.preferredVendor || "Default Vendor"));
    if (vendors.size > 1) {
      toast.error("⚠️ All selected products must be from the SAME vendor for single PO");
      return;
    }

    // Check all products have reorder qty
    const productsWithoutQty = selectedProds.filter((p) => !p.reorderQty || p.reorderQty === 0);
    if (productsWithoutQty.length > 0) {
      toast.error(`Missing restock qty for: ${productsWithoutQty.map((p) => p.name).join(", ")}`);
      return;
    }

    setBulkRestockingInProgress(true);

    try {
      // Fetch last PO to generate next voucher ID
      const lastPOResponse = await fetch(
        `${API_BASE}/purchase-orders?branchId=${currentBranch._id}&limit=1&sort=-date`
      );
      const lastPOData = await lastPOResponse.json();
      const lastPO = lastPOData && Array.isArray(lastPOData) ? lastPOData[0] : null;
      const nextVoucherId = generateNextVoucherId(lastPO);

      // Get vendor from first product (all validated to be same)
      const vendor = selectedProds[0].preferredVendor || lastPO?.vendor || "Default Vendor";
      const voucherType = lastPO?.voucherType || "standard";

      // Build items array with all selected products and calculate totals per item
      let subtotal = 0;
      let totalTax = 0;

      const items = selectedProds.map((product) => {
        const itemSubtotal = product.reorderQty * product.purchasingPrice;
        const itemTax = (itemSubtotal * (product.gst || 0)) / 100;
        const itemTotal = itemSubtotal + itemTax;

        subtotal += itemSubtotal;
        totalTax += itemTax;

        return {
          productId: product._id,
          name: product.name,
          productGroup: product.productGroup,
          qty: product.reorderQty,
          purchasePrice: product.purchasingPrice,
          sellingPrice: product.sellingPrice,
          hsn: product.hsn || product.hsnCode,
          gst: product.gst || 0,
          cgst: (product.gst || 0) / 2,
          sgst: (product.gst || 0) / 2,
          igst: false,
          subtotal: itemSubtotal, // Add item subtotal
          tax: itemTax, // Add item tax
          total: itemTotal, // Add item total
        };
      });

      const grandTotal = subtotal + totalTax;

      // Create SINGLE purchase order with all items
      const poPayload = {
        branchId: currentBranch._id,
        invoiceId: nextVoucherId,
        voucherType,
        vendor,
        warehouse: lastPO?.warehouse || "",
        billingPerson: user?.id || "",
        items, // All items in single array
        subtotal,
        totalTax,
        transportCharge: 0,
        grandTotal,
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
          `✅ Grouped Restocking PO Created!\nInvoice: ${nextVoucherId}\nItems: ${selectedProds.length}\nTotal: ₹${grandTotal.toFixed(2)}`
        );
        setSelectedProducts(new Set());
        fetchAllData(currentPage, searchTerm);
      } else {
        toast.error(data.message || "Failed to create restocking PO");
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Error creating restocking PO");
    } finally {
      setBulkRestockingInProgress(false);
    }
  };

  // API already filters by search term, so just categorize the products
  const { outOfStock, lowStock, normalStock } = categorizeProducts(products);

  // Use allProducts when filtering by group, otherwise use paginated products
  const productsForFiltering = selectedProductGroup !== "All" ? allProducts : products;

  // Filter products by selected group (handle both string and object cases)
  const filteredProducts = selectedProductGroup === "All" 
    ? products 
    : productsForFiltering.filter((p) => {
        const groupName = p.productGroup && typeof p.productGroup === 'object' 
          ? (p.productGroup.name || p.productGroup._id)
          : p.productGroup;
        return groupName === selectedProductGroup;
      });

  const { outOfStock: filteredOutOfStock, lowStock: filteredLowStock, normalStock: filteredNormalStock } = categorizeProducts(filteredProducts);

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
              className={`${bgColor} border-l-4 ${borderColor} p-5 rounded-lg shadow hover:shadow-lg transition relative`}
            >
              {/* Checkbox for bulk selection */}
              <div className="absolute top-4 right-4">
                <input
                  type="checkbox"
                  checked={selectedProducts.has(product._id)}
                  onChange={() => toggleProductSelection(product._id)}
                  className="w-5 h-5 cursor-pointer"
                />
              </div>

              <div className="flex justify-between items-start mb-3 pr-8">
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

                {/* Pending Sales (Not Invoiced) */}
                {pendingSalesMap && pendingSalesMap[product._id] > 0 && (
                  <div className="flex justify-between bg-yellow-50 p-2 rounded border-l-2 border-yellow-400">
                    <span className="text-yellow-700 font-medium">⏳ Pending Sales:</span>
                    <span className="font-semibold text-yellow-800">
                      {pendingSalesMap[product._id]} {product.units}
                    </span>
                  </div>
                )}

                {/* Available Qty */}
                {pendingSalesMap && pendingSalesMap[product._id] > 0 && (
                  <div className="flex justify-between bg-blue-50 p-2 rounded border-l-2 border-blue-400">
                    <span className="text-blue-700 font-medium">✓ Available:</span>
                    <span className="font-semibold text-blue-800">
                      {Math.max(0, product.totalQty - (pendingSalesMap[product._id] || 0))} {product.units}
                    </span>
                  </div>
                )}

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
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <FaExclamationTriangle className="text-5xl opacity-80" />
              <div>
                <h1 className="text-4xl font-bold">Smart Restocking</h1>
                <p className="text-orange-100 mt-1">Automated Low Stock Alerts & Restocking</p>
              </div>
            </div>
            <button
              onClick={() => fetchAllData(currentPage, searchTerm)}
              disabled={loading}
              className="bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition disabled:opacity-50 flex items-center gap-2"
            >
              <FaSync className={loading ? "animate-spin" : ""} />
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {/* Search and Bulk Restock Bar */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="🔍 Search products by name..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full px-4 py-2 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>

            {/* Product Group Filter */}
            <select
              value={selectedProductGroup}
              onChange={(e) => {
                setSelectedProductGroup(e.target.value);
                setSelectedProducts(new Set()); // Clear selection when changing group
              }}
              className="px-4 py-2 rounded-lg text-gray-800 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-300 font-semibold"
            >
              {allProductGroups.map((group) => (
                <option key={String(group)} value={String(group)}>
                  {String(group)} {group !== "All" ? `(${allProducts.filter((p) => {
                    const groupName = p.productGroup && typeof p.productGroup === 'object' 
                      ? (p.productGroup.name || p.productGroup._id)
                      : p.productGroup;
                    return groupName === group;
                  }).length})` : `(${allProducts.length})`}
                </option>
              ))}
            </select>

            {/* View Toggle */}
            <div className="flex gap-2 bg-white/30 p-1 rounded-lg">
              <button
                onClick={() => setViewMode("card")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium ${
                  viewMode === "card"
                    ? "bg-white text-orange-600 shadow-md"
                    : "text-white hover:bg-white/20"
                }`}
              >
                <FaThLarge size={16} /> Card
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium ${
                  viewMode === "table"
                    ? "bg-white text-orange-600 shadow-md"
                    : "text-white hover:bg-white/20"
                }`}
              >
                <FaList size={16} /> Table
              </button>
            </div>

            {selectedProducts.size > 0 && (
              <button
                onClick={handleBulkRestock}
                disabled={bulkRestockingInProgress}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 whitespace-nowrap"
              >
                ✓ Restock {selectedProducts.size} Product{selectedProducts.size !== 1 ? "s" : ""} (1 PO)
              </button>
            )}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-4 px-4 py-3 bg-white rounded-lg">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">Page {pagination.pages > 0 ? currentPage : 0} of {pagination.pages || 0}</span>
              <span className="ml-3">Total: <strong>{pagination.total}</strong> products</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || loading}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              
              <div className="flex items-center gap-2 px-3">
                {Array.from({ length: Math.min(5, pagination.pages) }).map((_, idx) => {
                  let pageNum;
                  if (pagination.pages <= 5) {
                    pageNum = idx + 1;
                  } else if (currentPage <= 3) {
                    pageNum = idx + 1;
                  } else if (currentPage >= pagination.pages - 2) {
                    pageNum = pagination.pages - 4 + idx;
                  } else {
                    pageNum = currentPage - 2 + idx;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 rounded-lg font-semibold transition ${
                        currentPage === pageNum
                          ? "bg-orange-500 text-white"
                          : "border border-gray-300 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(pagination.pages, currentPage + 1))}
                disabled={currentPage === pagination.pages || pagination.pages === 0 || loading}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
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
        ) : viewMode === "card" ? (
          /* CARD VIEW */
          <div className="bg-white rounded-2xl shadow p-8">
            {/* OUT OF STOCK */}
            <StockCategory
              title="🔴 OUT OF STOCK"
              products={filteredOutOfStock}
              icon={FaBox}
              bgColor="bg-red-50"
              textColor="text-red-600"
              borderColor="border-red-300"
            />

            {/* LOW STOCK */}
            <StockCategory
              title="🟡 LOW STOCK - ACTION REQUIRED"
              products={filteredLowStock}
              icon={FaExclamationCircle}
              bgColor="bg-yellow-50"
              textColor="text-yellow-700"
              borderColor="border-yellow-300"
            />

            {/* NORMAL STOCK */}
            <StockCategory
              title="🟢 NORMAL STOCK"
              products={filteredNormalStock}
              icon={FaBox}
              bgColor="bg-green-50"
              textColor="text-green-700"
              borderColor="border-green-300"
            />
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="bg-white rounded-2xl shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold">
                    <input
                      type="checkbox"
                      checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                      onChange={() => {
                        if (selectedProducts.size === filteredProducts.length) {
                          setSelectedProducts(new Set());
                        } else {
                          setSelectedProducts(new Set(filteredProducts.map(p => p._id)));
                        }
                      }}
                      className="w-5 h-5 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Product Name</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Units</th>
                  <th className="px-4 py-3 text-right text-sm font-bold">Current Stock</th>
                  <th className="px-4 py-3 text-right text-sm font-bold">⏳ Pending Sales</th>
                  <th className="px-4 py-3 text-right text-sm font-bold">✓ Available</th>
                  <th className="px-4 py-3 text-right text-sm font-bold">Threshold</th>
                  <th className="px-4 py-3 text-right text-sm font-bold">Restock Qty</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Preferred Vendor</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product, index) => {
                  const stockStatus = 
                    product.totalQty === 0 ? "🔴 Out of Stock" :
                    product.totalQty < (product.reorderLevel || 10) ? "🟡 Low Stock" :
                    "🟢 Normal";
                  
                  const pendingQty = pendingSalesMap?.[product._id] || 0;
                  const availableQty = Math.max(0, product.totalQty - pendingQty);
                  
                  return (
                    <tr
                      key={product._id}
                      className={`${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                      } border-b border-gray-200 hover:bg-orange-50/30 transition`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product._id)}
                          onChange={() => toggleProductSelection(product._id)}
                          className="w-5 h-5 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 text-sm">
                        {product.name}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">
                        {product.units}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 text-sm">
                        {product.totalQty}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {pendingQty > 0 ? (
                          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-semibold">
                            {pendingQty}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-700 text-sm">
                        {availableQty}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800 text-sm">
                        {product.reorderLevel || 10}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 text-sm">
                        {product.reorderQty || 20}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">
                        {product.preferredVendor || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {stockStatus}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => startEditProduct(product)}
                            className="px-3 py-1 bg-blue-500 text-white rounded font-semibold text-xs hover:bg-blue-600 transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRestock(product)}
                            disabled={restockingInProgress[product._id] || !product.reorderQty}
                            className={`px-3 py-1 rounded font-semibold text-xs transition ${
                              restockingInProgress[product._id]
                                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                                : product.reorderQty
                                ? "bg-green-500 text-white hover:bg-green-600"
                                : "bg-gray-300 text-gray-600 cursor-not-allowed"
                            }`}
                          >
                            {restockingInProgress[product._id] ? "..." : "Restock"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editingProduct && <EditModal />}
    </div>
  );
}
