import axios from "axios";
import React, { useEffect, useState, Fragment } from "react";
import { FaEdit, FaTrash, FaCheck, FaTimes, FaPlus, FaPlusCircle, FaSync, FaSave, FaExclamationTriangle, FaBox, FaArrowLeft, FaEye, FaArrowRight, FaLink, FaExternalLinkAlt, FaImage, FaChevronDown, FaChevronLeft, FaChevronRight, FaChevronUp, FaSearch, FaFileExport } from "react-icons/fa";
import * as XLSX from 'xlsx';
import { toast } from "react-toastify";
import { API_BASE, apiWithAuth } from "../api";
import { QUICK_LINKS_CONFIG } from "../utils/quickLinksConfig";
import { useBranch } from "../context/BranchContext";

const QuickLinksDataManager = ({ type, onCancel, onEdit }) => {
  const { currentBranch, user } = useBranch();
  const fieldPermissions = user?.fieldPermissions || {};
  const actionPermissions = user?.actionPermissions || {};
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" }); // New sorting state
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

  const resourceConfig = QUICK_LINKS_CONFIG;

  // 🛡️ Filter config based on permissions
  const config = { ...resourceConfig[type] };
  
  // 🛡️ SECURITY: Even if they manually got to this type, block if not in allowedQuickLinks
  const isAllowedType = !user?.allowedQuickLinks || user.allowedQuickLinks.length === 0 || user.allowedQuickLinks.includes(type);
  if (!isAllowedType) {
    return (
      <div className="mt-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <p className="text-red-700 font-bold">Access Denied</p>
          <p className="text-red-600 text-sm">You do not have permission to view {type.replace(/_/g, " ")} records.</p>
        </div>
      </div>
    );
  }

  if (config && config.displayFields) {
    config.displayFields = config.displayFields.filter(field => {
      const granularKey = `${type}_${field}`;
      
      // 🛡️ Priority 1: Granular Key (explicitly set)
      if (fieldPermissions[granularKey] === false) return false;
      if (fieldPermissions[granularKey] === true) return true;

      // 🛡️ Priority 2: Global Keys (fallback)
      if (field === "purchasingPrice" && fieldPermissions.purchasingPrice === false) return false;
      if (field === "adminMargin" && fieldPermissions.adminMargin === false) return false;
      if (["margin", "marginPercentage", "gst"].includes(field) && fieldPermissions.margin === false) return false;
      if (["totalQty", "totalQtyUnit"].includes(field) && fieldPermissions.totalQty === false) return false;
      
      return true;
    });
  }
  if (config && config.detailedFields) {
    config.detailedFields = config.detailedFields.filter(field => {
      const granularKey = `${type}_${field}`;
      
      if (fieldPermissions[granularKey] === false) return false;
      if (fieldPermissions[granularKey] === true) return true;

      if (field === "purchasingPrice" && fieldPermissions.purchasingPrice === false) return false;
      if (field === "adminMargin" && fieldPermissions.adminMargin === false) return false;
      if (["margin", "marginPercentage", "gst"].includes(field) && fieldPermissions.margin === false) return false;
      if (["totalQty", "totalQtyUnit"].includes(field) && fieldPermissions.totalQty === false) return false;
      
      return true;
    });
  }

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
  const formatMarginDisplay = (item, key) => {
    if (key === "marginPercentage" || key === "adminMargin") {
      const val = item[key];
      return (val !== undefined && val !== null) ? `${val}%` : "-";
    }
    
    // Absolute Margin (₹)
    if (key === "margin") {
      if (typeof item.margin === 'number' && item.margin !== 0) {
        return `₹${item.margin.toFixed(2)}`;
      }
      return (item.margin !== undefined && item.margin !== null) ? item.margin : "-";
    }
    
    // Fallback for special combined display if needed
    if (item.marginPercentage && item.margin !== undefined && item.margin !== null) {
      return `${Math.round(item.marginPercentage)}% - ₹${Math.round(item.margin)}`;
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
        apiWithAuth.get(`/product-groups`, { params: { branchId, limit: 1000 } }),
        apiWithAuth.get(`/product-categories`, { params: { branchId, limit: 1000 } })
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
      const response = await apiWithAuth.get(config.endpoint, {
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
      await apiWithAuth.delete(`${config.endpoint}/${id}`);
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

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
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

      const response = await apiWithAuth.post(`/products/apply-group-margin`, payload);
      
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

  const handleExportExcel = () => {
    try {
      if (!sortedData || sortedData.length === 0) {
        toast.info("No records to export.");
        return;
      }

      const exportData = sortedData.map(item => {
        const row = {};
        // Use displayFields for basic columns
        config.displayFields.forEach(field => {
          let value = item[field];
          let label = field.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
          
          if (field === "margin" || field === "marginPercentage" || field === "adminMargin") {
            row[label] = formatMarginDisplay(item, field);
          } else if (typeof value === "object" && value !== null) {
            if (Array.isArray(value)) {
              row[label] = value.map(v => v.name || v._id || "").filter(Boolean).join(", ");
            } else {
              row[label] = value.name || value._id || "-";
            }
          } else {
            row[label] = value || "-";
          }
        });

        // Also add detailedFields if they aren't already in displayFields
        if (config.detailedFields) {
           config.detailedFields.forEach(field => {
             let label = field.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
             if (row[label] === undefined) {
                let value = item[field];
                if (typeof value === "object" && value !== null) {
                  row[label] = Array.isArray(value) ? value.map(v => v.name || v._id || "").filter(Boolean).join(", ") : (value.name || value._id || "-");
                } else {
                  row[label] = value || "-";
                }
             }
           });
        }
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, config.label);

      XLSX.writeFile(workbook, `${config.label}_Records_${new Date().toLocaleDateString()}.xlsx`);
      toast.success(`${config.label} records exported successfully!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export Excel");
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

  // Sort the filtered data
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const key = sortConfig.key;
    let valA = a[key];
    let valB = b[key];

    // Handle nested objects (extract name)
    if (valA && typeof valA === "object") valA = valA.name || String(valA);
    if (valB && typeof valB === "object") valB = valB.name || String(valB);

    // Convert to lowercase for string comparison
    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();

    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Reset to page 1 when search query or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortConfig]);

  // Calculate pagination based on sorted data
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, endIndex);

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
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg transition font-semibold shadow-md active:scale-95"
          >
            <FaFileExport /> Export Excel
          </button>
          {type === "product" && (
            <button
              onClick={() => setShowGroupMargin(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-5 py-2 rounded-lg transition font-semibold shadow-md"
            >
              💰 Group Margin
            </button>
          )}
        </div>
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
              Showing <span className="font-bold">{startIndex + 1}</span>-<span className="font-bold">{Math.min(endIndex, sortedData.length)}</span> of <span className="font-bold">{sortedData.length}</span> records (Page <span className="font-bold">{currentPage}</span>/<span className="font-bold">{totalPages}</span>)
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {config.displayFields.map((field) => (
                      <th 
                        key={field} 
                        onClick={() => handleSort(field)}
                        className="p-4 font-bold text-gray-700 uppercase text-xs tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {field.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
                          {sortConfig.key === field ? (
                            sortConfig.direction === "asc" ? <FaChevronUp className="text-primary" /> : <FaChevronDown className="text-primary" />
                          ) : (
                            <FaChevronDown className="text-gray-300 opacity-50" />
                          )}
                        </div>
                      </th>
                    ))}
                    {(actionPermissions.edit !== false || actionPermissions.delete !== false) && (
                      <th className="p-4 font-bold text-gray-700 uppercase text-xs tracking-wider text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedData.map((item) => (
                    <React.Fragment key={item._id}>
                      <tr 
                        onClick={() => setExpandedId(expandedId === item._id ? null : item._id)}
                        className={`hover:bg-blue-50/50 transition cursor-pointer group ${expandedId === item._id ? 'bg-blue-50/80' : ''}`}
                      >
                        {config.displayFields.map((field, idx) => {
                          const value = item[field];
                          let displayValue = "-";

                          if (field === "margin" || field === "marginPercentage" || field === "adminMargin") {
                            displayValue = formatMarginDisplay(item, field);
                          } else if (typeof value === "object" && value !== null) {
                            if (Array.isArray(value)) {
                              displayValue = value
                                .map((v) => (v && v.name ? v.name : (v && v._id ? v._id : "")))
                                .filter(Boolean)
                                .join(", ");
                            } else if (value.name) {
                              displayValue = value.name;
                            } else if (value._id) {
                              displayValue = value._id;
                            }
                          } else if (typeof value === "number") {
                            displayValue = Math.round(value * 100) / 100;
                            if (field === "debit" || field === "credit" || field === "sellingPrice" || field === "purchasingPrice") {
                              displayValue = `₹${displayValue.toFixed(2)}`;
                            }
                          } else if (typeof value === "string" && !isNaN(parseFloat(value)) && isFinite(value)) {
                            // Handle numeric strings
                            const num = parseFloat(value);
                            displayValue = Math.round(num * 100) / 100;
                            if (field === "debit" || field === "credit" || field === "sellingPrice" || field === "purchasingPrice") {
                              displayValue = `₹${displayValue.toFixed(2)}`;
                            }
                          } else if (field === "totalQty") {
                            displayValue = value !== undefined && value !== null ? value : "-";
                            if (item.totalQtyUnit) {
                              displayValue = `${displayValue} ${item.totalQtyUnit}`;
                            }
                          } else {
                            displayValue = value || "-";
                          }

                          return (
                            <td key={field} className="p-4 text-sm text-gray-700 font-medium">
                              <div className="flex items-center gap-2">
                                {idx === 0 && (
                                  <span className="text-gray-400">
                                    {expandedId === item._id ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                                  </span>
                                )}
                                {displayValue}
                              </div>
                            </td>
                          );
                        })}
                        {(actionPermissions.edit !== false || actionPermissions.delete !== false) && (
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2 px-2">
                              {actionPermissions.edit !== false && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(item);
                                  }}
                                  className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                                  title="Edit"
                                >
                                  <FaEdit size={14} />
                                </button>
                              )}
                              {actionPermissions.delete !== false && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(item._id);
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition"
                                  title="Delete"
                                >
                                  <FaTrash size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      {expandedId === item._id && (
                        <tr className="bg-gray-50/80 animate-in fade-in duration-300">
                          <td colSpan={config.displayFields.length + ((actionPermissions.edit !== false || actionPermissions.delete !== false) ? 1 : 0)} className="p-6">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                              {config.detailedFields ? (
                                config.detailedFields.map((key) => {
                                  const value = item[key];
                                  return (
                                    <div key={key} className="space-y-1">
                                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                                        {key.replace(/([A-Z])/g, " $1")}
                                      </label>
                                      <p className="text-xs text-gray-700 font-semibold break-words">
                                        {(() => {
                                          if (key === "margin" || key === "marginPercentage" || key === "adminMargin") return formatMarginDisplay(item, key);
                                          if (typeof value === "object" && value !== null) {
                                            return Array.isArray(value) ? value.map(v => v.name || v._id || "-").join(", ") : (value.name || value._id || "-");
                                          }
                                          return String(value === null || value === undefined ? "-" : value);
                                        })()}
                                      </p>
                                    </div>
                                  );
                                })
                              ) : (
                                Object.entries(item).map(([key, value]) => (
                                  key !== "_id" &&
                                  key !== "branchId" &&
                                  key !== "__v" &&
                                  !key.includes("createdAt") &&
                                  !key.includes("updatedAt") && (
                                    <div key={key} className="space-y-1">
                                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                                        {key.replace(/([A-Z])/g, " $1")}
                                      </label>
                                      <p className="text-xs text-gray-700 font-semibold break-words">
                                        {(() => {
                                          if (key === "margin" || key === "marginPercentage" || key === "adminMargin") return formatMarginDisplay(item, key);
                                          if (typeof value === "object" && value !== null) {
                                            return Array.isArray(value) ? value.map(v => v.name || v._id || "-").join(", ") : (value.name || v._id || "-");
                                          }
                                          return String(value === null || value === undefined ? "-" : value);
                                        })()}
                                      </p>
                                    </div>
                                  )
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
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
