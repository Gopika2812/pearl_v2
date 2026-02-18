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

  // Available filter fields
  const filterFields = [
    { label: "Product Name", value: "name", type: "text" },
    { label: "Units", value: "units", type: "text" },
    { label: "HSN Code", value: "hsnCode", type: "text" },
    { label: "Total Qty", value: "totalQty", type: "number" },
    { label: "Purchasing Price", value: "purchasingPrice", type: "number" },
    { label: "Selling Price", value: "sellingPrice", type: "number" },
    { label: "Margin", value: "margin", type: "number" },
    { label: "GST %", value: "gst", type: "number" },
  ];

  // Fetch products data - fetch all pages
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First fetch to get total pages
      const firstResponse = await fetch(`${API_BASE}/products?page=1&limit=50`);
      const firstData = await firstResponse.json();

      if (!firstData.success) {
        setError("Failed to fetch products");
        return;
      }

      let allProducts = [...firstData.data];
      const totalPages = firstData.pagination?.pages || 1;

      // Fetch remaining pages
      if (totalPages > 1) {
        const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
        
        const pageRequests = remainingPages.map(page =>
          fetch(`${API_BASE}/products?page=${page}&limit=100`).then(res => res.json())
        );

        const results = await Promise.all(pageRequests);
        
        results.forEach(result => {
          if (result.success && result.data) {
            allProducts = [...allProducts, ...result.data];
          }
        });
      }

      setProducts(allProducts);
    } catch (err) {
      setError(err.message || "Error fetching products");
      console.error("Fetch products error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Handle Edit Product
  const handleEdit = (product) => {
    setEditingProduct(product);
    setEditFormData({
      name: product.name,
      perQty: product.perQty,
      units: product.units,
      totalQty: product.totalQty,
      purchasingPrice: product.purchasingPrice,
      sellingPrice: product.sellingPrice,
      hsnCode: product.hsnCode,
      gst: product.gst,
    });
    setShowEditModal(true);
  };

  // Handle Save Edit
  const handleSaveEdit = async () => {
    try {
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

  // Filter products by search value and selected field
  const filteredProducts = searchValue.trim() === ""
    ? products
    : products.filter((product) => {
        const fieldValue = product[searchField];
        const currentField = filterFields.find((f) => f.value === searchField);
        const isNumericField = currentField?.type === "number";

        if (isNumericField) {
          // For numeric fields, do numeric comparison
          return Number(fieldValue || 0) === Number(searchValue);
        } else {
          // For text fields, do contains search
          return String(fieldValue || "")
            .toLowerCase()
            .trim()
            .includes(searchValue.toLowerCase().trim());
        }
      }).sort((a, b) => {
        // Sort results: exact matches first, then starts with, then other matches
        const fieldA = String(a[searchField] || "").toLowerCase().trim();
        const fieldB = String(b[searchField] || "").toLowerCase().trim();
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

  // Reset to page 1 when search value changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue, searchField]);

  // Calculate paginated products
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-16 md:pl-64 pb-8">
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
              <button
                onClick={() => setShowSearchBox(!showSearchBox)}
                className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-semibold text-sm md:text-base"
              >
                <FaFilter size={16} />
                <span className="hidden sm:inline">Add Filter</span>
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

      {/* Main Content */}
      <div className="max-w-full mx-auto px-4 md:px-6 py-6 md:py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm md:text-base">
            {error}
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
                      {paginatedProducts.map((product, idx) => (
                        <tr
                          key={product._id}
                          className={`border-b hover:bg-gray-50 transition ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }`}
                        >
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            {product.name}
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
                          <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                            {product.totalQty}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-700">
                            ₹ {product.purchasingPrice?.toFixed(2) || "0.00"}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-700">
                            ₹ {product.sellingPrice?.toFixed(2) || "0.00"}
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
                              {product.margin?.toFixed(2) || "0.00"}%
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
                      ))}
                    </tbody>
                  </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {paginatedProducts.map((product) => (
                <div key={product._id} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{product.name}</h3>
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
                      <p className="text-gray-500">Stock Qty</p>
                      <p className="text-gray-900 font-semibold">{product.totalQty}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Margin</p>
                      <p className={`font-semibold ${product.margin > 0 ? "text-green-600" : product.margin < 0 ? "text-red-600" : "text-gray-700"}`}>
                        {product.margin?.toFixed(1) || "0.0"}%
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
                      <p className="text-gray-900 font-semibold">₹ {product.sellingPrice?.toFixed(2) || "0.00"}</p>
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
              ))}
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
                      {(paginatedProducts.reduce((sum, p) => sum + (p.totalQty || 0), 0) / 1000).toFixed(1)}K
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    Purchasing Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.purchasingPrice || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        purchasingPrice: parseFloat(e.target.value),
                      })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    Selling Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.sellingPrice || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        sellingPrice: parseFloat(e.target.value),
                      })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
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
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
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
