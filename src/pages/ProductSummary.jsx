import { useEffect, useState } from "react";
import { FaBox, FaChevronLeft, FaChevronRight, FaEdit, FaFilter, FaSync, FaTrash } from "react-icons/fa";
import { API_BASE } from "../api";

const ProductSummary = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchField, setSearchField] = useState("name");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  // Group margin management states
  const [productGroups, setProductGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [marginValue, setMarginValue] = useState("");
  const [showMarginPanel, setShowMarginPanel] = useState(false);
  const [applyingMargin, setApplyingMargin] = useState(false);
  const [lastAppliedGroupId, setLastAppliedGroupId] = useState("");
  const [lastAppliedMargin, setLastAppliedMargin] = useState(null);

  // Available filter fields
  const filterFields = [
    { label: "Product Name", value: "name", type: "text" },
    { label: "Product Group", value: "productGroup", type: "text", nested: "name" },
    { label: "Units", value: "units", type: "text" },
    { label: "HSN Code", value: "hsnCode", type: "text" },
    { label: "Total Qty", value: "totalQty", type: "number" },
    { label: "Purchasing Price", value: "purchasingPrice", type: "number" },
    { label: "Selling Price", value: "sellingPrice", type: "number" },
    { label: "Margin", value: "margin", type: "number" },
    { label: "GST %", value: "gst", type: "number" },
  ];

  // Fetch products data - fetch all pages from database
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const allProducts = [];
      let page = 1;
      let hasMore = true;
      
      // Keep fetching until no more pages
      while (hasMore) {
        const response = await fetch(`${API_BASE}/products?page=${page}&limit=100`);
        const data = await response.json();

        if (!data.success || !data.data) {
          setError("Failed to fetch products");
          return;
        }

        allProducts.push(...data.data);
        
        // Check if there are more pages
        const totalPages = data.pagination?.pages || 1;
        console.log(`✅ Fetched page ${page} of ${totalPages} (${data.data.length} products on this page, ${allProducts.length} total so far)`);
        
        hasMore = page < totalPages;
        page++;
      }

      setProducts(allProducts);
      
      console.log(`✅ ✅ FINAL: Loaded ${allProducts.length} TOTAL products from database`);
      console.log("Sample product:", allProducts[0]);
      
      // Log your specific product if it exists
      const vChickProduct = allProducts.find(p => p.name && p.name.toLowerCase().includes("v chick cheese nuggets"));
      if (vChickProduct) {
        console.log("🎯 Found your product:", vChickProduct.name);
      } else {
        console.warn("⚠️ 'V Chick Cheese Nuggets' product not found in loaded products");
      }
      
      // Validate first product has expected fields
      if (allProducts.length > 0) {
        const firstProduct = allProducts[0];
        console.log("Product fields available:", Object.keys(firstProduct));
      }
    } catch (err) {
      setError(err.message || "Error fetching products");
      console.error("Fetch products error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchProductGroups();
  }, []);

  // Fetch product groups
  const fetchProductGroups = async () => {
    try {
      const response = await fetch(`${API_BASE}/product-groups`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // API returns array directly
      if (Array.isArray(data)) {
        setProductGroups(data);
        console.log(`✅ Fetched ${data.length} product groups`);
      } else if (data.data && Array.isArray(data.data)) {
        // Handle wrapped response if structure changes
        setProductGroups(data.data);
        console.log(`✅ Fetched ${data.data.length} product groups`);
      } else {
        console.error("Unexpected response structure:", data);
      }
    } catch (err) {
      console.error("❌ Error fetching product groups:", err);
      setError("Failed to load product groups");
    }
  };

  // Apply margin to all products in selected group
  const applyMarginToGroup = async () => {
    if (!selectedGroupId || marginValue === "") {
      alert("Please select a product group and enter a margin value");
      return;
    }

    setApplyingMargin(true);
    try {
      const groupProducts = products.filter(
        (p) => p.productGroup?._id === selectedGroupId
      );

      if (groupProducts.length === 0) {
        alert("No products found in this group");
        setApplyingMargin(false);
        return;
      }

      const margin = parseFloat(marginValue);
      let successCount = 0;

      // Update each product with new selling price
      for (const product of groupProducts) {
        const newMargin = margin;
        const newSellingPrice = product.purchasingPrice + newMargin;
        
        try {
          const response = await fetch(`${API_BASE}/products/${product._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              margin: newMargin,
              sellingPrice: newSellingPrice,
            }),
          });
          const result = await response.json();
          if (result.success) {
            successCount++;
          }
        } catch (err) {
          console.error(`Error updating product ${product._id}:`, err);
        }
      }

      // Refresh products list
      await fetchProducts();
      
      // Store the recently applied margin for display
      setLastAppliedGroupId(selectedGroupId);
      setLastAppliedMargin(margin);
      
      setShowMarginPanel(false);
      setSelectedGroupId("");
      setMarginValue("");
      
      alert(
        `✅ Margin ₹${margin.toFixed(2)} applied to ${successCount} out of ${groupProducts.length} products in this group`
      );
      
      // Clear the highlight after 5 seconds
      setTimeout(() => {
        setLastAppliedGroupId("");
        setLastAppliedMargin(null);
      }, 5000);
    } catch (err) {
      alert("Error applying margin: " + err.message);
    } finally {
      setApplyingMargin(false);
    }
  };

  // Handle Edit Product
  const handleEdit = (product) => {
    const calculatedMargin = product.margin !== undefined && product.margin !== null 
      ? product.margin 
      : ((product.sellingPrice || 0) - (product.purchasingPrice || 0));
    
    setEditingProduct(product);
    setEditFormData({
      name: product.name,
      perQty: product.perQty,
      units: product.units,
      totalQty: product.totalQty,
      totalQtyUnit: product.totalQtyUnit || "",
      purchasingPrice: product.purchasingPrice || 0,
      sellingPrice: product.sellingPrice || 0,
      margin: calculatedMargin || 0,
      hsnCode: product.hsnCode,
      gst: product.gst,
    });
    setShowEditModal(true);
  };

  // Handle Save Edit
  const handleSaveEdit = async () => {
    try {
      // 🛡️ HSN VALIDATION: E-Invoice requires exactly 6 or 8 digits
      const hsn = String(editFormData.hsnCode || "").trim();
      if (!/^\d{6}$|^\d{8}$/.test(hsn)) {
        alert(`Invalid HSN Code: "${hsn}". For E-Invoicing, HSN must be exactly 6 or 8 digits. (Note: 4 digits or 10 digits are not accepted by the Tax Portal).`);
        return;
      }

      const response = await fetch(`${API_BASE}/products/${editingProduct._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });
      const data = await response.json();

      if (data.success) {
        setProducts(
          products.map((p) => (p._id === editingProduct._id ? data.data : p))
        );
        setShowEditModal(false);
        setEditingProduct(null);
        alert("Product updated successfully!");
      } else {
        alert(data.message || "Failed to update product");
      }
    } catch (err) {
      alert("Error updating product: " + err.message);
    }
  };

  // Handle Delete Product
  const handleDelete = async (productId) => {
    try {
      const response = await fetch(`${API_BASE}/products/${productId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        setProducts(products.filter((p) => p._id !== productId));
        setDeleteConfirm(null);
        alert("Product deleted successfully!");
      } else {
        alert(data.message || "Failed to delete product");
      }
    } catch (err) {
      alert("Error deleting product: " + err.message);
    }
  };

  // Filter products by search value and selected field, and by selected group in margin panel
  const filteredProducts = products
    // First filter by selected product group if in margin panel
    .filter((product) => {
      if (showMarginPanel && selectedGroupId) {
        return product.productGroup?._id === selectedGroupId;
      }
      return true;
    })
    // Then apply search filter
    .filter((product) => {
      if (searchValue.trim() === "") {
        return true;
      }
      
      const currentField = filterFields.find((f) => f.value === searchField);
      let fieldValue;
      
      // Handle nested fields (e.g., productGroup.name)
      if (currentField?.nested) {
        fieldValue = product[searchField]?.[currentField.nested];
      } else {
        fieldValue = product[searchField];
      }
      
      const isNumericField = currentField?.type === "number";

      if (isNumericField) {
        // For numeric fields, do numeric comparison
        return Number(fieldValue || 0) === Number(searchValue);
      } else {
        // For text fields, do contains search (case-insensitive)
        const productValue = String(fieldValue || "").toLowerCase().trim();
        const searchLower = searchValue.toLowerCase().trim();
        const matches = productValue.includes(searchLower);
        
        // Log for debugging - show search info
        if (products.indexOf(product) === 0) {
          console.log(`🔍 Searching for: "${searchLower}" in field: "${searchField}"`);
          console.log(`📊 Total products to search: ${products.length}`);
        }
        
        return matches;
      }
    }).sort((a, b) => {
      // Sort results: exact matches first, then starts with, then other matches
      const currentField = filterFields.find((f) => f.value === searchField);
      let valueA, valueB;
      
      // Handle nested fields for sorting
      if (currentField?.nested) {
        valueA = a[searchField]?.[currentField.nested];
        valueB = b[searchField]?.[currentField.nested];
      } else {
        valueA = a[searchField];
        valueB = b[searchField];
      }
      
      const fieldA = String(valueA || "").toLowerCase().trim();
      const fieldB = String(valueB || "").toLowerCase().trim();
      const searchLower = searchValue.toLowerCase().trim();

      // Priority: exact match first
      const aIsExact = fieldA === searchLower ? 1 : 0;
      const bIsExact = fieldB === searchLower ? 1 : 0;
      if (aIsExact !== bIsExact) return bIsExact - aIsExact;

      // Priority: starts with search term
      const aStartsWith = fieldA.startsWith(searchLower) ? 1 : 0;
      const bStartsWith = fieldB.startsWith(searchLower) ? 1 : 0;
      if (aStartsWith !== bStartsWith) return bStartsWith - aStartsWith;

      // Default: keep original order
      return 0;
    });

  // Reset to page 1 when search value changes or margin panel selection changes
  useEffect(() => {
    setCurrentPage(1);
    if (showMarginPanel && selectedGroupId) {
      const groupProductCount = products.filter((p) => p.productGroup?._id === selectedGroupId).length;
      console.log(`📊 Filtered to group: showing ${groupProductCount} products`);
    }
    if (searchValue.trim() !== "") {
      console.log(`✅ Search results: ${filteredProducts.length} products found`);
    }
  }, [searchValue, searchField, selectedGroupId, showMarginPanel, filteredProducts.length]);

  // Calculate paginated products
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20 pb-8">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-16 md:top-12 z-40">
        <div className="max-w-full mx-auto px-4 md:px-6 py-4 md:py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <FaBox className="text-primary text-2xl" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                  Product Summary
                </h1>
                <p className="text-gray-600 text-xs md:text-sm mt-1">
                  {filteredProducts.length} products {searchValue.trim() !== "" ? `(searched in ${filterFields.find((f) => f.value === searchField)?.label})` : "in inventory"}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={fetchProducts}
                disabled={loading}
                className="bg-primary text-white px-3 md:px-4 py-2 rounded-lg hover:bg-primary/90 transition flex items-center gap-2 disabled:opacity-50 text-sm md:text-base"
              >
                <FaSync className={loading ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              {searchValue.trim() !== "" && (
                <button
                  onClick={() => {
                    setSearchValue("");
                    setCurrentPage(1);
                  }}
                  className="bg-red-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-2 text-sm md:text-base"
                >
                  Clear Search
                </button>
              )}
              <button
                onClick={() => setShowSearchBox(!showSearchBox)}
                className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-semibold text-sm md:text-base"
              >
                <FaFilter size={16} />
                <span className="hidden sm:inline">Add Filter</span>
              </button>
              <button
                onClick={() => setShowMarginPanel(!showMarginPanel)}
                className="bg-purple-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-purple-700 transition flex items-center gap-2 font-semibold text-sm md:text-base"
              >
                <span className="hidden sm:inline">💰</span>
                <span className="hidden sm:inline">Group Margin</span>
                <span className="sm:hidden">Margin</span>
              </button>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mt-4 md:mt-6">
            <div className="bg-gray-50 p-3 md:p-4 rounded-lg border">
              <p className="text-gray-600 text-xs font-semibold uppercase">
                Total
              </p>
              <p className="text-lg md:text-2xl font-bold text-primary mt-1">
                {products.length}
              </p>
            </div>
            <div className="bg-gray-50 p-3 md:p-4 rounded-lg border">
              <p className="text-gray-600 text-xs font-semibold uppercase">
                Qty Stock
              </p>
              <p className="text-lg md:text-2xl font-bold text-blue-600 mt-1">
                {(products.reduce((sum, p) => sum + (p.totalQty || 0), 0) / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="bg-gray-50 p-3 md:p-4 rounded-lg border">
              <p className="text-gray-600 text-xs font-semibold uppercase">
                Avg Margin
              </p>
              <p className="text-lg md:text-2xl font-bold text-purple-600 mt-1">
                {products.length > 0
                  ? (
                      products.reduce((sum, p) => sum + (p.margin || 0), 0) /
                      products.length
                    ).toFixed(1)
                  : "0.0"}
                %
              </p>
            </div>
            <div className="bg-gray-50 p-3 md:p-4 rounded-lg border">
              <p className="text-gray-600 text-xs font-semibold uppercase">
                Avg GST
              </p>
              <p className="text-lg md:text-2xl font-bold text-orange-600 mt-1">
                {products.length > 0
                  ? (
                      products.reduce((sum, p) => sum + (p.gst || 0), 0) /
                      products.length
                    ).toFixed(1)
                  : "0.0"}
                %
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Box - Appears when Add Filter is clicked */}
      {showSearchBox && (
        <div className="max-w-full mx-auto px-4 md:px-6 py-4">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 md:p-6">
            <div className="flex flex-col gap-4">
              <div className="w-full">
                <label className="text-sm font-bold text-gray-600 block mb-2">
                  Select Field to Search
                </label>
                <select
                  value={searchField}
                  onChange={(e) => {
                    setSearchField(e.target.value);
                    setSearchValue("");
                  }}
                  className="w-full p-2 md:p-3 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {filterFields.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full">
                <label className="text-sm font-bold text-gray-600 block mb-2">
                  Enter Search Value
                </label>
                <input
                  type={filterFields.find((f) => f.value === searchField)?.type === "number" ? "number" : "text"}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={
                    filterFields.find((f) => f.value === searchField)?.type === "number"
                      ? "Enter numeric value..."
                      : "Enter text to search..."
                  }
                  className="w-full p-2 md:p-3 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500 text-sm"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  {filterFields.find((f) => f.value === searchField)?.type === "number"
                    ? "Enter exact number to match"
                    : "Type to search (partial match)"}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => {
                    setShowSearchBox(false);
                    setSearchValue("");
                    setSearchField("name");
                  }}
                  className="flex-1 px-3 md:px-4 py-2 md:py-3 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-semibold text-sm"
                >
                  Close
                </button>
                {searchValue && (
                  <button
                    onClick={() => setSearchValue("")}
                    className="flex-1 px-3 md:px-4 py-2 md:py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-semibold text-sm"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Margin Application Panel */}
      {showMarginPanel && (
        <div className="max-w-full mx-auto px-4 md:px-6 py-4">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-md border border-purple-200 p-4 md:p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Apply Margin to Product Group</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-sm font-bold text-gray-600 block mb-2">
                  Select Product Group
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full p-2 md:p-3 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">-- Select a Group --</option>
                  {productGroups.map((group) => (
                    <option key={group._id} value={group._id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 block mb-2">
                  Margin Value (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={marginValue}
                  onChange={(e) => setMarginValue(e.target.value)}
                  placeholder="Enter margin amount"
                  className="w-full p-2 md:p-3 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Selling Price = Purchasing Price + Margin
                </p>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 block mb-2">
                  &nbsp;
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={applyMarginToGroup}
                    disabled={applyingMargin || !selectedGroupId || marginValue === ""}
                    className="flex-1 px-3 md:px-4 py-2 md:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {applyingMargin ? "Applying..." : "Apply Margin"}
                  </button>
                  <button
                    onClick={() => {
                      setShowMarginPanel(false);
                      setSelectedGroupId("");
                      setMarginValue("");
                    }}
                    className="px-3 md:px-4 py-2 md:py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            {selectedGroupId && (
              <div className="bg-white p-3 rounded border-l-4 border-purple-500">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">
                    {products.filter((p) => p.productGroup?._id === selectedGroupId).length}
                  </span>
                  {" "} products in this group will be updated
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-full mx-auto px-4 md:px-6 py-6 md:py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm md:text-base">
            {error}
          </div>
        )}

        {lastAppliedMargin !== null && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 px-4 py-4 rounded-lg mb-6 text-sm md:text-base flex justify-between items-center">
            <div>
              <p className="font-bold">✅ Margin Successfully Applied!</p>
              <p>Margin of <span className="font-semibold">₹{lastAppliedMargin.toFixed(2)}</span> has been applied to all products in the selected group</p>
            </div>
            <button
              onClick={() => {
                setLastAppliedGroupId("");
                setLastAppliedMargin(null);
              }}
              className="text-green-700 hover:text-green-900 text-xl font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <FaBox className="text-4xl text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 text-sm md:text-base">
              {searchValue.trim().length > 0 ? "No products match your filters" : "No products found"}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100 border-b">
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                          Product Name
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                          Group
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                          Per Qty
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                          Units
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">
                          Total Qty
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">
                          Purchase Price
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">
                          Selling Price
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">
                          Margin
                        </th>
                        <th className="px-6 py-4 text-center text-sm font-bold text-gray-700">
                          HSN Code
                        </th>
                        <th className="px-6 py-4 text-center text-sm font-bold text-gray-700">
                          GST %
                        </th>
                        <th className="px-6 py-4 text-center text-sm font-bold text-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProducts.map((product, idx) => {
                        const isRecentlyUpdated = lastAppliedGroupId && product.productGroup?._id === lastAppliedGroupId;
                        return (
                        <tr
                          key={product._id}
                          className={`border-b hover:bg-gray-50 transition ${
                            isRecentlyUpdated
                              ? "bg-green-100 border-l-4 border-l-green-500"
                              : idx % 2 === 0
                              ? "bg-white"
                              : "bg-gray-50"
                          }`}
                        >
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            {product.name}
                            {isRecentlyUpdated && (
                              <span className="ml-2 inline-block bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                                ✓ Updated
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {product.productGroup?.name || "N/A"}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {product.perQty}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {product.units}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-bold text-[#319bab]">
                            {product.availableQty}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-700">
                            ₹ {product.purchasingPrice?.toFixed(2) || "0.00"}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-700">
                            ₹ {product.sellingPrice?.toFixed(2) || "0.00"}
                            {isRecentlyUpdated && lastAppliedMargin !== null && (
                              <div className="text-xs text-green-600 font-semibold">
                                (+ ₹{lastAppliedMargin.toFixed(2)})
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-semibold">
                            <span
                              className={
                                product.margin > 0
                                  ? "text-green-600"
                                  : product.margin < 0
                                  ? "text-red-600"
                                  : "text-gray-700"
                              }
                            >
                              ₹{product.margin?.toFixed(2) || "0.00"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-center text-gray-700">
                            {product.hsnCode}
                          </td>
                          <td className="px-6 py-4 text-sm text-center font-semibold text-gray-900">
                            {product.gst}%
                          </td>
                          <td className="px-6 py-4 text-sm text-center flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(product)}
                              className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg transition flex items-center gap-1"
                              title="Edit Product"
                            >
                              <FaEdit size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(product)}
                              className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition flex items-center gap-1"
                              title="Delete Product"
                            >
                              <FaTrash size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {paginatedProducts.map((product) => {
                const isRecentlyUpdated = lastAppliedGroupId && product.productGroup?._id === lastAppliedGroupId;
                return (
                <div key={product._id} className={`border rounded-lg p-4 shadow-sm ${isRecentlyUpdated ? "bg-green-50 border-green-400 border-l-4" : "bg-white"}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">
                        {product.name}
                        {isRecentlyUpdated && (
                          <span className="ml-2 inline-block bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                            ✓ Updated
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">{product.productGroup?.name || "N/A"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded transition"
                        title="Edit"
                      >
                        <FaEdit size={12} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(product)}
                        className="bg-red-500 hover:bg-red-600 text-white p-2 rounded transition"
                        title="Delete"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div>
                      <p className="text-gray-500">Per Qty</p>
                      <p className="text-gray-900 font-semibold">{product.perQty}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Units</p>
                      <p className="text-gray-900 font-semibold">{product.units}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Qty</p>
                      <p className="text-[#319bab] font-bold">{product.availableQty}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Margin</p>
                      <p className={`font-semibold ${product.margin > 0 ? "text-green-600" : product.margin < 0 ? "text-red-600" : "text-gray-700"}`}>
                        ₹{product.margin?.toFixed(2) || "0.00"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs border-t pt-3 mb-3">
                    <div>
                      <p className="text-gray-500">Price</p>
                      <p className="text-gray-900 font-semibold">₹ {product.purchasingPrice?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Sell Price</p>
                      <p className="text-gray-900 font-semibold">
                        ₹ {product.sellingPrice?.toFixed(2) || "0.00"}
                        {isRecentlyUpdated && lastAppliedMargin !== null && (
                          <div className="text-xs text-green-600 font-semibold">
                            (+ ₹{lastAppliedMargin.toFixed(2)})
                          </div>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="border-t pt-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">HSN Code</p>
                        <p className="text-gray-900 font-semibold">{product.hsnCode}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">GST %</p>
                        <p className="text-gray-900 font-semibold">{product.gst}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>

                {/* Pagination Controls */}
                <div className="bg-gray-50 border-t px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
                  <div className="text-xs md:text-sm text-gray-600">
                    Showing {filteredProducts.length === 0 ? 0 : startIndex + 1} to{" "}
                    {Math.min(endIndex, filteredProducts.length)} of{" "}
                    {filteredProducts.length} products
                  </div>
                  <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-end">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 md:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 md:gap-2 text-xs md:text-sm"
                    >
                      <FaChevronLeft size={14} />
                      <span className="hidden sm:inline">Prev</span>
                    </button>
                    <div className="px-3 md:px-4 py-2 bg-white border rounded-lg text-xs md:text-sm font-semibold whitespace-nowrap">
                      Page {currentPage} of {totalPages || 1}
                    </div>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="px-3 md:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 md:gap-2 text-xs md:text-sm"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <FaChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="bg-gray-50 border-t px-4 md:px-6 py-3 md:py-4 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                  <div className="bg-white p-3 md:p-4 rounded-lg border">
                    <p className="text-gray-600 text-xs font-semibold uppercase">
                      Page Items
                    </p>
                    <p className="text-lg md:text-2xl font-bold text-primary mt-1">
                      {paginatedProducts.length}
                    </p>
                  </div>
                  <div className="bg-white p-3 md:p-4 rounded-lg border">
                    <p className="text-gray-600 text-xs font-semibold uppercase">
                      Stock
                    </p>
                    <p className="text-lg md:text-2xl font-bold text-blue-600 mt-1">
                      {(paginatedProducts.reduce((sum, p) => sum + (p.availableQty || 0), 0) / 1000).toFixed(1)}K
                    </p>
                  </div>
                  <div className="bg-white p-3 md:p-4 rounded-lg border">
                    <p className="text-gray-600 text-xs font-semibold uppercase">
                      Avg Margin
                    </p>
                    <p className="text-lg md:text-2xl font-bold text-green-600 mt-1">
                      {paginatedProducts.length > 0
                        ? (
                            paginatedProducts.reduce((sum, p) => sum + (p.margin || 0), 0) /
                            paginatedProducts.length
                          ).toFixed(1)
                        : "0.0"}
                      %
                    </p>
                  </div>
                  <div className="bg-white p-3 md:p-4 rounded-lg border">
                    <p className="text-gray-600 text-xs font-semibold uppercase">
                      Avg GST
                    </p>
                    <p className="text-lg md:text-2xl font-bold text-orange-600 mt-1">
                      {paginatedProducts.length > 0
                        ? (
                            paginatedProducts.reduce((sum, p) => sum + (p.gst || 0), 0) /
                            paginatedProducts.length
                          ).toFixed(1)
                        : "0.0"}
                      %
                    </p>
                  </div>
                </div>
            </>
        )}
      </div>

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-blue-500 text-white p-4 sticky top-0">
              <h3 className="text-xl font-bold">Edit Product</h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-600 mb-1 block">
                  Product Name
                </label>
                <input
                  type="text"
                  value={editFormData.name || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, name: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    Per Qty
                  </label>
                  <input
                    type="number"
                    value={editFormData.perQty || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        perQty: parseFloat(e.target.value),
                      })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    Units
                  </label>
                  <input
                    type="text"
                    value={editFormData.units || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, units: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 mb-1 block">
                  Total Qty
                </label>
                <input
                  type="number"
                  value={editFormData.totalQty || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      totalQty: parseFloat(e.target.value),
                    })
                  }
                  className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 mb-1 block">
                  Total Qty Unit
                </label>
                <input
                  type="text"
                  placeholder="e.g., kg, liter, box"
                  value={editFormData.totalQtyUnit || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      totalQtyUnit: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    Purchasing Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.purchasingPrice || ""}
                    onChange={(e) => {
                      const newPurchasingPrice = parseFloat(e.target.value) || 0;
                      const margin = editFormData.margin || 0;
                      setEditFormData({
                        ...editFormData,
                        purchasingPrice: newPurchasingPrice,
                        sellingPrice: newPurchasingPrice + margin,
                      });
                    }}
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    Margin (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.margin !== undefined ? editFormData.margin : ""}
                    onChange={(e) => {
                      const newMargin = parseFloat(e.target.value) || 0;
                      const purchasingPrice = editFormData.purchasingPrice || 0;
                      setEditFormData({
                        ...editFormData,
                        margin: newMargin,
                        sellingPrice: purchasingPrice + newMargin,
                      });
                    }}
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Adjusts Selling Price</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 mb-1 block">
                  Selling Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editFormData.sellingPrice || ""}
                  readOnly
                  className="w-full p-2 border rounded-lg bg-gray-100 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Auto-calculated from Margin</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    value={editFormData.hsnCode || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, hsnCode: e.target.value })
                    }
                    className={`w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500 ${
                      editFormData.hsnCode && !/^\d{4}$|^\d{6}$|^\d{8}$/.test(String(editFormData.hsnCode).trim())
                        ? "border-red-500 bg-red-50"
                        : ""
                    }`}
                  />
                  {editFormData.hsnCode && !/^\d{4}$|^\d{6}$|^\d{8}$/.test(String(editFormData.hsnCode).trim()) && (
                    <p className="text-[10px] text-red-600 font-bold mt-1">
                      ⚠️ Must be 4, 6, or 8 digits
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    GST %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.gst || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        gst: parseFloat(e.target.value),
                      })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="border-t p-4 flex gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingProduct(null);
                }}
                className="flex-1 p-2 border rounded-lg hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-bold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="bg-red-500 text-white p-4">
              <h3 className="text-xl font-bold">Delete Product</h3>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete this product?
              </p>
              <p className="text-lg font-bold text-gray-900 mb-4">
                {deleteConfirm.name}
              </p>
              <p className="text-sm text-red-600 font-semibold">
                ⚠️ This action cannot be undone.
              </p>
            </div>

            <div className="border-t p-4 flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 p-2 border rounded-lg hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm._id)}
                className="flex-1 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductSummary;
