import axios from "axios";
import { useEffect, useState } from "react";
import { FaArrowLeft, FaChevronDown, FaChevronLeft, FaChevronRight, FaChevronUp, FaEdit, FaSearch, FaTimes, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../api";
import { useBranch } from "../context/BranchContext";

const QuickLinksDataManager = ({ type, onCancel, onEdit }) => {
  const { currentBranch } = useBranch();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const branchId = currentBranch?._id;

  // Group margin state
  const [showGroupMargin, setShowGroupMargin] = useState(false);
  const [groupMarginData, setGroupMarginData] = useState({
    type: "group", // "group" or "category"
    selectedGroupId: "",
    selectedCategoryId: "",
    marginPercentage: "",
  });
  const [productGroups, setProductGroups] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [applyingMargin, setApplyingMargin] = useState(false);

  const resourceConfig = {
    voucher_type: {
      label: "Voucher Type",
      endpoint: "/voucher-types",
      displayFields: ["name", "orderType", "prefix", "counter"],
      editableFields: ["name", "orderType", "prefix", "counter"],
    },
    warehouse: {
      label: "Warehouse",
      endpoint: "/warehouses",
      displayFields: ["name"],
      editableFields: ["name"],
    },
    product_group: {
      label: "Product Group",
      endpoint: "/product-groups",
      displayFields: ["name", "description"],
      editableFields: ["name", "description"],
    },
    product_category: {
      label: "Product Category",
      endpoint: "/product-categories",
      displayFields: ["name", "description"],
      editableFields: ["name", "description"],
    },
    product: {
      label: "Product",
      endpoint: "/products",
      displayFields: ["name", "sellingPrice", "productGroup", "productCategories", "warehouse"],
      editableFields: ["name", "sellingPrice", "marginPercentage", "productGroup", "productCategories", "warehouse"],
    },
    customer_category: {
      label: "Customer Category",
      endpoint: "/customer-categories",
      displayFields: ["name", "description"],
      editableFields: ["name", "description"],
    },
    customer_group: {
      label: "Customer Group",
      endpoint: "/customer-groups",
      displayFields: ["name", "description"],
      editableFields: ["name", "description"],
    },
    customer: {
      label: "Customer",
      endpoint: "/customers",
      displayFields: ["name", "whatsapp", "email", "salesOwner", "customerCategory"],
      editableFields: ["name", "whatsapp", "email"],
    },
    vendor: {
      label: "Vendor",
      endpoint: "/vendors",
      displayFields: ["name", "gstin", "email", "phone"],
      editableFields: ["name", "gstin", "email"],
    },
    sales_owner: {
      label: "Sales Owner",
      endpoint: "/sales-owners",
      displayFields: ["name", "phone", "email"],
      editableFields: ["name", "phone", "email"],
    },
    sales_man: {
      label: "Sales Man",
      endpoint: "/sales-men",
      displayFields: ["name", "phone", "email", "commissionPercentage"],
      editableFields: ["name", "phone", "email"],
    },
    delivery_man: {
      label: "Delivery Man",
      endpoint: "/delivery-men",
      displayFields: ["name", "phone", "email", "vehicleNumber"],
      editableFields: ["name", "phone", "email"],
    },
  };

  const config = resourceConfig[type];

  // If config is not found, show error state
  if (!config) {
    return (
      <div className="mt-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition font-semibold"
          >
            <FaArrowLeft /> Back
          </button>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-orange-50 border-l-4 border-red-500 rounded-lg p-8 text-center shadow-md">
          <p className="text-red-700 font-bold text-2xl">⚠️ Data Type Not Found</p>
          <p className="text-gray-600 text-sm mt-3 leading-relaxed">This data type is not configured for viewing. Please contact support if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  // Helper function to format margin display
  const formatMarginDisplay = (item) => {
    if (item.marginPercentage) {
      const roundedMargin = Math.round(item.margin || 0);
      return `${Math.round(item.marginPercentage)} % - ${roundedMargin}`;
    }
    return "-";
  };

  useEffect(() => {
    if (branchId) {
      fetchData();
    }
  }, [branchId, type]);

  // Fetch product groups and categories for group margin
  useEffect(() => {
    if (type === "product" && showGroupMargin && branchId) {
      fetchProductGroupsAndCategories();
    }
  }, [showGroupMargin, type, branchId]);

  const fetchProductGroupsAndCategories = async () => {
    try {
      const [groupsRes, categsRes] = await Promise.all([
        axios.get(`${API_BASE}/product-groups`, { params: { branchId, limit: 1000 } }),
        axios.get(`${API_BASE}/product-categories`, { params: { branchId, limit: 1000 } })
      ]);
      setProductGroups(Array.isArray(groupsRes.data) ? groupsRes.data : groupsRes.data.data || []);
      setProductCategories(Array.isArray(categsRes.data) ? categsRes.data : categsRes.data.data || []);
    } catch (error) {
      console.error("Error fetching groups/categories:", error);
      toast.error("Failed to fetch product groups and categories");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}${config.endpoint}`, {
        params: { branchId, limit: 10000 }, // Request up to 10000 records
      });
      setData(Array.isArray(response.data) ? response.data : response.data.data || []);
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      toast.error(`Failed to fetch ${config.label}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    try {
      await axios.delete(`${API_BASE}${config.endpoint}/${id}`);
      setData(data.filter(item => item._id !== id));
      toast.success("Deleted successfully");
      fetchData();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete");
    }
  };

  const handleEdit = (item) => {
    onEdit(item);
  };

  const applyGroupMargin = async () => {
    if (!groupMarginData.marginPercentage || groupMarginData.marginPercentage === "") {
      toast.error("Please enter a margin percentage");
      return;
    }

    if (groupMarginData.type === "group" && !groupMarginData.selectedGroupId) {
      toast.error("Please select a product group");
      return;
    }

    if (groupMarginData.type === "category" && !groupMarginData.selectedCategoryId) {
      toast.error("Please select a product category");
      return;
    }

    setApplyingMargin(true);
    try {
      const payload = {
        branchId,
        marginPercentage: parseFloat(groupMarginData.marginPercentage),
      };

      if (groupMarginData.type === "group") {
        payload.productGroupId = groupMarginData.selectedGroupId;
      } else {
        payload.productCategoryId = groupMarginData.selectedCategoryId;
      }

      const response = await axios.post(`${API_BASE}/products/apply-group-margin`, payload);
      
      if (response.data.success) {
        toast.success(response.data.message);
        // Refresh the product data
        await fetchData();
        setShowGroupMargin(false);
        // Reset form
        setGroupMarginData({
          type: "group",
          selectedGroupId: "",
          selectedCategoryId: "",
          marginPercentage: "",
        });
      }
    } catch (error) {
      console.error("Apply margin error:", error);
      toast.error(error.response?.data?.message || "Failed to apply group margin");
    } finally {
      setApplyingMargin(false);
    }
  };

  // Filter data based on search query
  const filteredData = data.filter(item => {
    if (!searchQuery.trim()) return true;
    
    const searchLower = searchQuery.toLowerCase();
    
    // Search across all displayable fields including nested names
    return config.displayFields.some(field => {
      const value = item[field];
      if (value === null || value === undefined) return false;
      
      // Handle nested objects and arrays
      let searchableText = "";
      if (typeof value === "object") {
        if (Array.isArray(value)) {
          // For arrays, extract all names and join them
          searchableText = value
            .map(v => (typeof v === "object" && v.name ? v.name : String(v)))
            .join(" ");
        } else {
          // For single objects, extract the name
          searchableText = value.name ? value.name : String(value);
        }
      } else {
        searchableText = String(value);
      }
      
      return searchableText.toLowerCase().includes(searchLower);
    });
  });

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  // Handle page navigation
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      setExpandedId(null);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      setExpandedId(null);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-6 pb-6 border-b-2 border-gray-200">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition font-semibold"
        >
          <FaArrowLeft /> Back
        </button>
        <h2 className="text-3xl font-bold text-gray-900">{config.label} Records</h2>
        {type === "product" && (
          <button
            onClick={() => setShowGroupMargin(true)}
            className="ml-auto flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-5 py-2 rounded-lg transition font-semibold shadow-md"
          >
            💰 Group Margin
          </button>
        )}
      </div>

      {/* Search Filter */}
      <div className="mb-6">
        <div className="relative">
          <FaSearch className="absolute left-4 top-4 text-gray-400 text-lg" />
          <input
            type="text"
            placeholder={`Search by ${config.displayFields.join(", ")}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-12 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-lg"
            >
              <FaTimes />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-sm text-gray-600 mt-2">
            Found {filteredData.length} of {data.length} {config.label.toLowerCase()} records
          </p>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg p-8 text-center shadow-sm">
          <p className="text-gray-700 text-lg font-semibold">📭 No {config.label.toLowerCase()} records</p>
          <p className="text-gray-600 text-sm mt-2">Create your first record using the + button in Quick Actions</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 rounded-lg p-8 text-center shadow-sm">
          <p className="text-gray-700 text-lg font-semibold">🔍 No matches found</p>
          <p className="text-gray-600 text-sm mt-2">Try adjusting your search terms</p>
        </div>
      ) : (
        <div>
          {/* Pagination Info - Simple */}
          <div className="mb-4 p-2 bg-blue-50 rounded-lg text-center">
            <p className="text-xs text-gray-700">
              Showing <span className="font-bold">{startIndex + 1}</span>-<span className="font-bold">{Math.min(endIndex, filteredData.length)}</span> of <span className="font-bold">{filteredData.length}</span> records (Page <span className="font-bold">{currentPage}</span>/<span className="font-bold">{totalPages}</span>)
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {paginatedData.map((item) => (
            <div
              key={item._id}
              className="border-b border-gray-200 hover:bg-gray-50 transition"
            >
              <div
                onClick={() => setExpandedId(expandedId === item._id ? null : item._id)}
                className="flex items-center justify-between p-4 cursor-pointer"
              >
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-600">
                    {config.displayFields
                      .filter(f => f !== "name")
                      .map(f => {
                        const value = item[f];
                        // Extract name from populated objects (show only names, not IDs)
                        let displayValue = "-";
                        
                        // Special formatting for margin
                        if (f === "margin" || f === "marginPercentage") {
                          displayValue = formatMarginDisplay(item);
                        } else if (typeof value === "object" && value !== null) {
                          if (Array.isArray(value)) {
                            displayValue = value
                              .map(v => (v && v.name ? v.name : ""))
                              .filter(Boolean)
                              .join(", ");
                          } else if (value.name) {
                            displayValue = value.name;
                          }
                        } else if (typeof value === "number") {
                          // Round numbers to remove floating points
                          displayValue = Math.round(value);
                        } else {
                          displayValue = value || "-";
                        }
                        return `${f}: ${displayValue}`;
                      })
                      .join(" | ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(item);
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition"
                  >
                    <FaEdit /> Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item._id);
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition"
                  >
                    <FaTrash /> Delete
                  </button>
                  <button className="text-gray-600">
                    {expandedId === item._id ? <FaChevronUp /> : <FaChevronDown />}
                  </button>
                </div>
              </div>

              {expandedId === item._id && (
                <div className="bg-gray-50 p-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(item).map(([key, value]) => (
                      key !== "_id" &&
                      key !== "branchId" &&
                      key !== "__v" &&
                      !key.includes("createdAt") &&
                      !key.includes("updatedAt") && (
                        <div key={key}>
                          <label className="block text-sm font-semibold text-gray-700 capitalize">
                            {key.replace(/([A-Z])/g, " $1")}
                          </label>
                          <p className="text-gray-600 text-sm break-words">
                            {(() => {
                              // Special formatting for margin fields
                              if (key === "margin" || key === "marginPercentage") {
                                return formatMarginDisplay(item);
                              }
                              
                              if (typeof value === "object" && value !== null) {
                                if (Array.isArray(value)) {
                                  return value
                                    .map(v => (v && v.name ? v.name : ""))
                                    .filter(Boolean)
                                    .join(", ");
                                } else {
                                  return value.name || JSON.stringify(value);
                                }
                              }
                              
                              // Round numbers to remove floating points
                              if (typeof value === "number") {
                                return Math.round(value);
                              }
                              
                              return String(value);
                            })()}
                          </p>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
            </div>

          {/* Pagination Controls - Simplified */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-primary hover:bg-[#248d94] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition font-semibold"
            >
              <FaChevronLeft size={16} /> Prev
            </button>

            <div className="flex items-center gap-2">
              <span className="text-gray-700 font-bold">{currentPage}</span>
              <span className="text-gray-500">/</span>
              <span className="text-gray-700 font-bold">{totalPages}</span>
            </div>

            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-primary hover:bg-[#248d94] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition font-semibold"
            >
              Next <FaChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Group Margin Modal */}
      {showGroupMargin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Apply Group Margin</h3>
            
            {/* Margin Type Toggle */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Apply to:</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="group"
                    checked={groupMarginData.type === "group"}
                    onChange={(e) =>
                      setGroupMarginData({
                        ...groupMarginData,
                        type: e.target.value,
                        selectedGroupId: "",
                        selectedCategoryId: "",
                      })
                    }
                    className="cursor-pointer"
                  />
                  <span>Product Group</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="category"
                    checked={groupMarginData.type === "category"}
                    onChange={(e) =>
                      setGroupMarginData({
                        ...groupMarginData,
                        type: e.target.value,
                        selectedGroupId: "",
                        selectedCategoryId: "",
                      })
                    }
                    className="cursor-pointer"
                  />
                  <span>Product Category</span>
                </label>
              </div>
            </div>

            {/* Select Group or Category */}
            {groupMarginData.type === "group" ? (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Group:</label>
                <select
                  value={groupMarginData.selectedGroupId}
                  onChange={(e) =>
                    setGroupMarginData({
                      ...groupMarginData,
                      selectedGroupId: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- Select a product group --</option>
                  {productGroups.map((group) => (
                    <option key={group._id} value={group._id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Category:</label>
                <select
                  value={groupMarginData.selectedCategoryId}
                  onChange={(e) =>
                    setGroupMarginData({
                      ...groupMarginData,
                      selectedCategoryId: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- Select a product category --</option>
                  {productCategories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Margin Percentage Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Margin Percentage (%):</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={groupMarginData.marginPercentage}
                onChange={(e) =>
                  setGroupMarginData({
                    ...groupMarginData,
                    marginPercentage: e.target.value,
                  })
                }
                placeholder="e.g., 25.50"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowGroupMargin(false)}
                className="flex-1 px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg transition font-semibold"
              >
                <FaTimes className="inline mr-2" /> Cancel
              </button>
              <button
                onClick={applyGroupMargin}
                disabled={applyingMargin}
                className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white rounded-lg transition font-semibold"
              >
                {applyingMargin ? "Applying..." : "Apply Margin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickLinksDataManager;
