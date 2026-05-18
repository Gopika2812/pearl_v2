import axios from "axios";
import React, { useEffect, useState, Fragment } from "react";
import { FaEdit, FaTrash, FaCheck, FaTimes, FaPlus, FaPlusCircle, FaSync, FaSave, FaHistory, FaExclamationTriangle, FaBox, FaArrowLeft, FaEye, FaArrowRight, FaLink, FaExternalLinkAlt, FaImage, FaChevronDown, FaChevronLeft, FaChevronRight, FaChevronUp, FaSearch, FaFileExport, FaColumns, FaFilter, FaLayerGroup, FaTags } from "react-icons/fa";
import * as XLSX from 'xlsx';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-toastify";
import { API_BASE, apiWithAuth } from "../api";
import { QUICK_LINKS_CONFIG } from "../utils/quickLinksConfig";
import { useBranch } from "../context/BranchContext";

const QuickLinksDataManager = ({ type, onCancel, onEdit }) => {
  const { currentBranch, user } = useBranch();
  const fieldPermissions = user?.fieldPermissions || {};
  const actionPermissions = user?.actionPermissions || {};
  
  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    const granularKey = `${type}_${fieldId}`;
    return user.fieldPermissions?.[granularKey] !== false;
  };

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400); // 400ms debounce
    return () => clearTimeout(handler);
  }, [searchQuery]);

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
  
  // New Filters for Product
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  
  // Column Selection for Export
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState([]);

  const resourceConfig = QUICK_LINKS_CONFIG;

  // 🛡️ Filter config based on permissions - Memoized to prevent re-renders and state resets
  const config = React.useMemo(() => {
    const baseConfig = { ...resourceConfig[type] };
    if (!baseConfig) return null;

    if (baseConfig.displayFields) {
      baseConfig.displayFields = baseConfig.displayFields.filter(field => {
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

    if (baseConfig.detailedFields) {
      baseConfig.detailedFields = baseConfig.detailedFields.filter(field => {
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

    return baseConfig;
  }, [type, JSON.stringify(fieldPermissions)]);

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
  }, [branchId, type, selectedGroup, selectedCategory, debouncedSearchQuery]);

  // Initialize export columns ONLY when data type actually changes
  useEffect(() => {
    if (config) {
      if (type === "product") {
        // Default to only Name and Selling Price for products as requested
        setSelectedExportColumns(["name", "sellingPrice"]);
      } else {
        const allFields = Array.from(new Set([
          ...(config.displayFields || []), 
          ...(config.detailedFields || [])
        ]));
        setSelectedExportColumns(allFields);
      }
    }
  }, [type]); // ONLY depend on type, not config object

  // Fetch product groups and categories for filters and group margin
  useEffect(() => {
    if (type === "product" && branchId) {
      fetchProductGroupsAndCategories();
    }
  }, [type, branchId]);

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
      const params = { branchId, limit: 1000 };
      
      if (debouncedSearchQuery.trim()) {
        params.search = debouncedSearchQuery.trim();
      }
      
      if (type === "product") {
        params.mini = true; // Use optimized fast-loading mode
        if (selectedGroup !== "All") params.productGroup = selectedGroup;
        if (selectedCategory !== "All") params.productCategory = selectedCategory;
      }

      const response = await apiWithAuth.get(config.endpoint, { params });
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

  const handleExportPDF = () => {
    try {
      if (!sortedData || sortedData.length === 0) {
        toast.info("No records to export.");
        return;
      }

      const doc = new jsPDF();
      const branchName = currentBranch?.name || "PEARL AGENCY";
      const timestamp = new Date().toLocaleString("en-IN");

      // Set Title
      doc.setFontSize(18);
      doc.setTextColor(30, 64, 175);
      doc.text(`${config.label} Report`, 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Branch: ${branchName} | Generated: ${timestamp}`, 14, 30);
      
      // Horizontal Line
      doc.setDrawColor(200);
      doc.line(14, 34, 196, 34);

      if (type === "product") {
        // Group data by product group name
        const groupedData = sortedData.reduce((acc, item) => {
          const groupName = item.productGroup?.name || "Uncategorized";
          if (!acc[groupName]) acc[groupName] = [];
          acc[groupName].push(item);
          return acc;
        }, {});

        let currentY = 42;

        Object.entries(groupedData).forEach(([groupName, products]) => {
          // Check for space before adding group header and table
          if (currentY > 230) {
            doc.addPage();
            currentY = 20;
          }

          doc.setFontSize(11);
          doc.setTextColor(50);
          doc.setFont(undefined, 'bold');
          doc.text(`PRODUCT GROUP: ${groupName.toUpperCase()}`, 14, currentY);
          
          autoTable(doc, {
            startY: currentY + 4,
            head: [["Product Name", "Purchasing Price", "Selling Price"]],
            body: products.map(p => [
              p.name,
              `Rs. ${(p.purchasingPrice || 0).toFixed(2)}`,
              `Rs. ${(p.sellingPrice || 0).toFixed(2)}`
            ]),
            theme: 'striped',
            headStyles: { fillColor: [190, 18, 60], textColor: 255 }, // Crimson/Adobe Red
            styles: { fontSize: 9, cellPadding: 3 },
            margin: { left: 14, right: 14 },
          });

          currentY = doc.lastAutoTable.finalY + 12;
        });
      } else {
        // Generic export for other types
        const headers = config.displayFields.map(f => f.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()));
        const body = sortedData.map(item => config.displayFields.map(f => {
          const val = item[f];
          if (typeof val === 'object' && val !== null) return val.name || val._id || "-";
          return val || "-";
        }));

        autoTable(doc, {
          startY: 42,
          head: [headers],
          body: body,
          theme: 'grid',
          headStyles: { fillColor: [30, 64, 175], textColor: 255 },
          styles: { fontSize: 8 }
        });
      }

      doc.save(`${config.label}_Report_${new Date().toLocaleDateString()}.pdf`);
      toast.success(`${config.label} PDF exported successfully!`);
    } catch (error) {
      console.error("PDF Export error:", error);
      toast.error("Failed to export PDF");
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
        
        // Use selectedExportColumns instead of hardcoded display/detailed fields
        selectedExportColumns.forEach(field => {
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
          } else if (typeof value === "number") {
             // Round to 2 decimal places if it's a number
             row[label] = Math.round(value * 100) / 100;
          } else {
            row[label] = value || "-";
          }
        });

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
  }).filter(item => {
    // Apply Product Group and Category Filters
    if (type !== "product") return true;
    
    const groupMatch = selectedGroup === "All" || 
      (item.productGroup && (item.productGroup._id === selectedGroup || item.productGroup.name === selectedGroup));
    
    const categoryMatch = selectedCategory === "All" || 
      (item.productCategories && item.productCategories.some(cat => cat._id === selectedCategory || cat.name === selectedCategory));
      
    return groupMatch && categoryMatch;
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
          {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || actionPermissions.export !== false) && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (type === "product" && selectedExportColumns.length === 0) {
                    // Pre-select Name and Selling Price ONLY if nothing is selected yet
                    setSelectedExportColumns(["name", "sellingPrice"]);
                  }
                  setShowColumnSelector(true);
                }}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg transition font-semibold shadow-sm"
                title="Select Columns for Export"
              >
                <FaColumns /> Columns
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg transition font-semibold shadow-md active:scale-95"
              >
                <FaFileExport /> Export Excel
              </button>
            </div>
          )}
          {type === "product" && (
            <>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-lg transition font-semibold shadow-md active:scale-95"
              >
                <FaFileExport /> Export PDF
              </button>
              <button
                onClick={() => setShowGroupMargin(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-5 py-2 rounded-lg transition font-semibold shadow-md"
              >
                💰 Group Margin
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search & Advanced Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
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
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg"
            >
              <FaTimes />
            </button>
          )}
        </div>

        {type === "product" && (
          <div className="flex items-center gap-3">
            <div className="relative min-w-[200px]">
              <select
                className="w-full appearance-none bg-white border-2 border-gray-300 focus:border-primary rounded-lg pl-10 pr-10 py-3 text-sm font-bold text-gray-700 outline-none cursor-pointer transition-all shadow-sm"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                <option value="All">All Groups</option>
                {productGroups.map(g => (
                  <option key={g._id} value={g._id}>{g.name}</option>
                ))}
              </select>
              <FaLayerGroup className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
              <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={12} />
            </div>

            <div className="relative min-w-[200px]">
              <select
                className="w-full appearance-none bg-white border-2 border-gray-300 focus:border-primary rounded-lg pl-10 pr-10 py-3 text-sm font-bold text-gray-700 outline-none cursor-pointer transition-all shadow-sm"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                {productCategories.map(cat => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
              <FaTags className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
              <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={12} />
            </div>
          </div>
        )}
      </div>

      {searchQuery || selectedGroup !== "All" || selectedCategory !== "All" ? (
        <p className="text-sm text-gray-600 mt-2 mb-4">
          Found {filteredData.length} of {data.length} {config.label.toLowerCase()} records
        </p>
      ) : null}

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
                    {(actionPermissions.edit !== false || actionPermissions.delete !== false || isFieldAllowed("action_edit") || isFieldAllowed("action_delete")) && (
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
                          } else if (
                            typeof value === "string" && 
                            !isNaN(parseFloat(value)) && 
                            isFinite(value) &&
                            !["hsnCode", "hsn", "pincode", "stateCode", "whatsapp", "phone"].includes(field)
                          ) {
                            // Handle numeric strings (Prices, amounts, etc.) but skip identifiers
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
                        {(actionPermissions.edit !== false || actionPermissions.delete !== false || isFieldAllowed("action_edit") || isFieldAllowed("action_delete")) && (
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2 px-2">
                              {(actionPermissions.edit !== false && isFieldAllowed("action_edit")) && (
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
                              {(actionPermissions.delete !== false && isFieldAllowed("action_delete")) && (
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
                          <td colSpan={config.displayFields.length + ((actionPermissions.edit !== false || actionPermissions.delete !== false || isFieldAllowed("action_edit") || isFieldAllowed("action_delete")) ? 1 : 0)} className="p-6">
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
                                  !key.includes("updatedAt") && 
                                  isFieldAllowed(key) && (
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
                                  )
                                ))
                              )}
                            </div>

                            {/* 📈 PRICE HISTORY SECTION (FOR PRODUCTS ONLY) */}
                            {type === "product" && item.priceHistory && item.priceHistory.length > 0 && (
                              <div className="mt-8 border-t border-gray-200 pt-6">
                                <div className="flex items-center gap-2 mb-4">
                                  <div className="bg-indigo-100 p-2 rounded-lg">
                                    <FaHistory className="text-indigo-600 text-sm" />
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight">Price & GST History</h4>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Historical Changes & Effective Dates</p>
                                  </div>
                                </div>
                                <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
                                  <table className="w-full text-left text-[11px] border-collapse">
                                    <thead>
                                      <tr className="bg-gray-50 text-gray-500 font-black uppercase tracking-widest border-b border-gray-200">
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Voucher</th>
                                        <th className="px-4 py-3 text-right">Old P</th>
                                        <th className="px-4 py-3 text-right">New P</th>
                                        <th className="px-4 py-3 text-right">Old S</th>
                                        <th className="px-4 py-3 text-right">New S</th>
                                        <th className="px-4 py-3 text-center">Old GST</th>
                                        <th className="px-4 py-3 text-center">New GST</th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Note</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                      {[...item.priceHistory].reverse().map((history, hIdx) => (
                                        <tr key={hIdx} className="hover:bg-gray-50/80 transition-colors">
                                          <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-600">
                                            {new Date(history.effectiveDate).toLocaleDateString()}
                                            <div className="text-[9px] text-gray-400 font-medium">
                                              {new Date(history.effectiveDate).toLocaleTimeString()}
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 font-black text-indigo-600">{history.sourceVoucher || "-"}</td>
                                          <td className="px-4 py-3 text-right text-gray-400">₹{(history.oldPurchasingPrice || 0).toFixed(2)}</td>
                                          <td className="px-4 py-3 text-right font-bold text-gray-800">₹{(history.newPurchasingPrice || 0).toFixed(2)}</td>
                                          <td className="px-4 py-3 text-right text-gray-400">₹{(history.oldSellingPrice || 0).toFixed(2)}</td>
                                          <td className="px-4 py-3 text-right font-bold text-[#319bab]">₹{(history.newSellingPrice || 0).toFixed(2)}</td>
                                          <td className="px-4 py-3 text-center text-gray-500">{history.oldGst ?? "-"}%</td>
                                          <td className="px-4 py-3 text-center font-bold text-gray-800">{history.newGst ?? "-"}%</td>
                                          <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                              history.type === 'INCREASE' ? 'bg-red-50 text-red-600' : 
                                              history.type === 'DECREASE' ? 'bg-green-50 text-green-600' : 
                                              'bg-blue-50 text-blue-600'
                                            }`}>
                                              {history.type}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-gray-500 font-medium">{history.note}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
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
      {/* Column Selection Modal */}
      {showColumnSelector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                  <FaColumns className="text-primary" /> Select Export Columns
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Choose which data fields to include in Excel</p>
              </div>
              <button 
                onClick={() => setShowColumnSelector(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const allFields = Array.from(new Set([...(config.displayFields || []), ...(config.detailedFields || [])]));
                      setSelectedExportColumns(allFields);
                    }}
                    className="px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-primary/20 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedExportColumns([])}
                    className="px-3 py-1.5 bg-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {selectedExportColumns.length} Fields Selected
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {Array.from(new Set([...(config.displayFields || []), ...(config.detailedFields || [])])).map(field => (
                  <div 
                    key={field} 
                    onClick={() => {
                      if (selectedExportColumns.includes(field)) {
                        setSelectedExportColumns(prev => prev.filter(f => f !== field));
                      } else {
                        setSelectedExportColumns(prev => [...prev, field]);
                      }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer group ${
                      selectedExportColumns.includes(field) 
                        ? 'border-primary/50 bg-primary/5 text-primary shadow-sm' 
                        : 'border-gray-50 bg-gray-50 text-gray-500 hover:border-gray-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      selectedExportColumns.includes(field)
                        ? 'bg-primary border-primary'
                        : 'bg-white border-gray-300 group-hover:border-primary/30'
                    }`}>
                      {selectedExportColumns.includes(field) && <FaCheck className="text-white text-[10px]" />}
                    </div>
                    <span className="text-xs font-bold capitalize">
                      {field.replace(/([A-Z])/g, " $1")}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setShowColumnSelector(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-all font-black uppercase tracking-widest text-[11px]"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowColumnSelector(false);
                    handleExportExcel();
                  }}
                  disabled={selectedExportColumns.length === 0}
                  className="flex-1 px-6 py-3 bg-primary hover:bg-[#248d94] disabled:bg-gray-300 text-white rounded-xl transition-all font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20"
                >
                  Export Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickLinksDataManager;
