import { useEffect, useState } from "react";
import {
    FaCog,
    FaEdit,
    FaFileInvoice,
    FaFilter,
    FaLayerGroup,
    FaPlus,
    FaShoppingCart,
    FaSync,
    FaTrash,
    FaTruck,
    FaUser,
    FaWarehouse
} from "react-icons/fa";
import { API_BASE } from "../api";

const OthersSummary = () => {
  const [tableType, setTableType] = useState("voucher-types");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [salesOwners, setSalesOwners] = useState([]);
  const [salesMen, setSalesMen] = useState([]);
  const [deliveryMen, setDeliveryMen] = useState([]);
  const [showCommissionRuleModal, setShowCommissionRuleModal] = useState(false);
  const [commissionRuleForm, setCommissionRuleForm] = useState({
    roleType: "SalesOwner",
    personId: "",
    minimumOrderValue: 0,
    commissionPercentage: 0,
    effectiveFrom: new Date().toISOString().split("T")[0],
  });
  const tableConfigs = {
    "voucher-types": {
      label: "Voucher Type",
      icon: <FaFileInvoice />,
      fields: ["name", "orderType", "prefix", "counter", "financialYear"],
      displayFields: ["Name", "Order Type", "Prefix", "Counter", "Financial Year"],
    },
    warehouses: {
      label: "Warehouse",
      icon: <FaWarehouse />,
      fields: ["name"],
      displayFields: ["Name"],
    },
    "product-groups": {
      label: "Product Group",
      icon: <FaLayerGroup />,
      fields: ["name", "description"],
      displayFields: ["Name", "Description"],
    },
    "sales-owners": {
      label: "Sales Owner",
      icon: <FaUser />,
      fields: ["name", "phone", "commissionAmount"],
      displayFields: ["Name", "Phone", "Commission Amount (₹)"],
      isEditable: true,
    },
    "sales-men": {
      label: "Sales Man",
      icon: <FaUser />,
      fields: ["name", "phone", "commissionAmount"],
      displayFields: ["Name", "Phone", "Commission Amount (₹)"],
      isEditable: true,
    },
    "delivery-men": {
      label: "Delivery Man",
      icon: <FaTruck />,
      fields: ["name", "phone", "commissionAmount"],
      displayFields: ["Name", "Phone", "Commission Amount (₹)"],
      isEditable: true,
    },
    "commission-rules": {
      label: "Commission Rules",
      icon: <FaCog />,
      fields: ["roleType", "personName", "minimumOrderValue", "commissionPercentage", "effectiveFrom"],
      displayFields: ["Role", "Person Name", "Min. Order Value (₹)", "Commission %", "Effective From"],
      isReadOnly: false,
    },
    "sales-orders": {
      label: "Sales Order",
      icon: <FaShoppingCart />,
      fields: ["invoiceId", "customerName", "salesOwnerName", "orderValue", "closingBalance", "createdAt"],
      displayFields: ["Invoice ID", "Customer", "Sales Owner", "Order Value", "Closing Balance", "Date"],
      isReadOnly: true,
    },
  };

  // Fetch data based on table type
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      let endpoint = "";
      
      if (tableType === "voucher-types") endpoint = `${API_BASE}/voucher-types`;
      else if (tableType === "warehouses") endpoint = `${API_BASE}/warehouses`;
      else if (tableType === "product-groups") endpoint = `${API_BASE}/product-groups`;
      else if (tableType === "sales-owners") endpoint = `${API_BASE}/sales-owners`;
      else if (tableType === "sales-men") endpoint = `${API_BASE}/sales-men`;
      else if (tableType === "delivery-men") endpoint = `${API_BASE}/delivery-men`;
      else if (tableType === "commission-rules") endpoint = `${API_BASE}/commission-rules`;
      else if (tableType === "sales-orders") endpoint = `${API_BASE}/sales-orders`;

      const response = await fetch(endpoint);
      const result = await response.json();

      // Handle both response formats (with and without success wrapper)
      let dataArray = result;
      if (result.success !== undefined) {
        // Format: {success: true, data: [...]}
        if (result.success) {
          dataArray = result.data;
        } else {
          setError(`Failed to fetch ${tableConfigs[tableType].label}`);
          setLoading(false);
          return;
        }
      } else if (Array.isArray(result)) {
        // Format: [...]
        dataArray = result;
      } else if (result.message || result.error) {
        // Error response
        setError(result.message || result.error || `Failed to fetch ${tableConfigs[tableType].label}`);
        setLoading(false);
        return;
      }

      setData(dataArray || []);
    } catch (err) {
      setError(err.message || "Error fetching data");
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tableType]);

  // Fetch sales owners, sales men, and delivery men for dropdowns
  useEffect(() => {
    const fetchPersons = async () => {
      try {
        const [ownersRes, menRes, deliveryRes] = await Promise.all([
          fetch(`${API_BASE}/sales-owners`),
          fetch(`${API_BASE}/sales-men`),
          fetch(`${API_BASE}/delivery-men`),
        ]);

        const ownersData = await ownersRes.json();
        const menData = await menRes.json();
        const deliveryData = await deliveryRes.json();

        setSalesOwners(ownersData.data || ownersData || []);
        setSalesMen(menData.data || menData || []);
        setDeliveryMen(deliveryData.data || deliveryData || []);
      } catch (err) {
        console.error("Failed to fetch persons:", err);
      }
    };
    fetchPersons();
  }, []);

  // Handle table type change
  const handleTableChange = (newType) => {
    setTableType(newType);
    setSearchValue("");
    setEditingItem(null);
    setShowEditModal(false);
    setDeleteConfirm(null);
    setShowSearchBox(false);
  };

  // Handle Edit
  const handleEdit = (item) => {
    // Commissions are read-only
    if (tableType === "commissions") {
      alert("Commission records are automatically generated and read-only.");
      return;
    }
    setEditingItem(item);
    const config = tableConfigs[tableType];
    const formData = {};
    config.fields.forEach((field) => {
      formData[field] = item[field];
    });
    setEditFormData(formData);
    setShowEditModal(true);
  };

  // Handle Save Edit
  const handleSaveEdit = async () => {
    try {
      let endpoint = "";
      if (tableType === "voucher-types") endpoint = `${API_BASE}/voucher-types/${editingItem._id}`;
      else if (tableType === "warehouses") endpoint = `${API_BASE}/warehouses/${editingItem._id}`;
      else if (tableType === "product-groups") endpoint = `${API_BASE}/product-groups/${editingItem._id}`;
      else if (tableType === "sales-owners") endpoint = `${API_BASE}/sales-owners/${editingItem._id}`;
      else if (tableType === "sales-men") endpoint = `${API_BASE}/sales-men/${editingItem._id}`;
      else if (tableType === "delivery-men") endpoint = `${API_BASE}/delivery-men/${editingItem._id}`;
      else if (tableType === "commission-rules") endpoint = `${API_BASE}/commission-rules/${editingItem._id}`;

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const result = await response.json();
      
      // Handle both response formats
      let updatedItem = result;
      if (result.success !== undefined) {
        if (result.success) {
          updatedItem = result.data;
        } else {
          alert("Error: " + (result.message || "Failed to update"));
          return;
        }
      }

      setData(
        data.map((item) =>
          item._id === editingItem._id ? updatedItem : item
        )
      );
      setShowEditModal(false);
      setEditingItem(null);
      alert("Updated successfully!");
    } catch (error) {
      console.error("Error updating item:", error);
      alert("Error updating item: " + error.message);
    }
  };

  // Handle Save Commission Rule (for creating new rules)
  const handleSaveCommissionRule = async () => {
    try {
      if (!commissionRuleForm.roleType) {
        alert("Please select a Role Type");
        return;
      }
      if (!commissionRuleForm.personId) {
        alert("Please select a Person");
        return;
      }
      if (commissionRuleForm.minimumOrderValue <= 0) {
        alert("Minimum Order Value must be greater than 0");
        return;
      }
      if (commissionRuleForm.commissionPercentage <= 0) {
        alert("Commission Percentage must be greater than 0");
        return;
      }
      if (!commissionRuleForm.effectiveFrom) {
        alert("Please select an Effective From date");
        return;
      }

      const response = await fetch(`${API_BASE}/commission-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleType: commissionRuleForm.roleType,
          personId: commissionRuleForm.personId,
          minimumOrderValue: parseFloat(commissionRuleForm.minimumOrderValue),
          commissionPercentage: parseFloat(commissionRuleForm.commissionPercentage),
          effectiveFrom: commissionRuleForm.effectiveFrom,
          isActive: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setData([...data, result.data]);
        setShowCommissionRuleModal(false);
        setCommissionRuleForm({
          roleType: "SalesOwner",
          personId: "",
          minimumOrderValue: 0,
          commissionPercentage: 0,
          effectiveFrom: new Date().toISOString().split("T")[0],
        });
        alert("Commission Rule created successfully!");
      } else {
        alert("Error: " + (result.message || "Failed to create"));
      }
    } catch (error) {
      console.error("Error creating commission rule:", error);
      alert("Error creating commission rule: " + error.message);
    }
  };

  // Handle Delete
  const handleDelete = async (id) => {
    try {
      // Commissions and Sales Orders are system-generated, handle carefully
      if (tableType === "commissions") {
        alert("Commission records cannot be deleted. They are system-generated audit records.");
        return;
      }
      let endpoint = "";
      if (tableType === "voucher-types") endpoint = `${API_BASE}/voucher-types/${id}`;
      else if (tableType === "warehouses") endpoint = `${API_BASE}/warehouses/${id}`;
      else if (tableType === "product-groups") endpoint = `${API_BASE}/product-groups/${id}`;
      else if (tableType === "sales-owners") endpoint = `${API_BASE}/sales-owners/${id}`;
      else if (tableType === "sales-men") endpoint = `${API_BASE}/sales-men/${id}`;
      else if (tableType === "delivery-men") endpoint = `${API_BASE}/delivery-men/${id}`;
      else if (tableType === "commission-rules") endpoint = `${API_BASE}/commission-rules/${id}`;
      else if (tableType === "sales-orders") endpoint = `${API_BASE}/sales-orders/${id}`;

      const response = await fetch(endpoint, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const result = await response.json();
      
      // Handle both response formats
      let success = result.success !== undefined ? result.success : true;
      
      if (success) {
        setData(data.filter((item) => item._id !== id));
        setDeleteConfirm(null);
        alert("Deleted successfully!");
      } else {
        alert("Error: " + (result.message || "Failed to delete"));
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Error deleting item: " + error.message);
    }
  };

  // Filter data
  const config = tableConfigs[tableType];
  const filteredData = data.filter((item) => {
    const searchTerm = searchValue.toLowerCase();
    return config.fields.some((field) =>
      String(item[field] || "").toLowerCase().includes(searchTerm)
    );
  });

  // Format field values for display
  const formatFieldValue = (value, field) => {
    if (!value && value !== 0) return "-";
    
    // Format role type
    if (field === "roleType") {
      if (value === "SalesOwner") return "Sales Owner";
      if (value === "SalesMan") return "Sales Man";
      if (value === "DeliveryMan") return "Delivery Man";
      return value;
    }
    
    // Format currency for amount fields
    if (field === "totalCommission" || field === "grandTotalWithMargin" || field === "closingBalance" || field === "orderValue" || field === "commissionAmount") {
      return `₹${parseFloat(value).toFixed(2)}`;
    }
    
    // Format percentages
    if (field === "commissionPercentage") {
      return `${parseFloat(value).toFixed(2)}%`;
    }
    
    // Format currency for minimum order value
    if (field === "minimumOrderValue") {
      return `₹${parseFloat(value).toFixed(2)}`;
    }
    
    // Format dates
    if (field === "createdAt" || field === "effectiveFrom") {
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return value;
      }
    }
    
    return value;
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-16 md:pl-64">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl text-primary">
                {config.icon}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  {config.label}
                </h1>
                <p className="text-gray-600 text-sm mt-1">
                  Manage {config.label.toLowerCase()} data
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={fetchData}
                disabled={loading}
                className="bg-primary text-white px-3 md:px-4 py-2 rounded-lg hover:bg-primary/90 transition flex items-center gap-2 disabled:opacity-50 text-sm md:text-base font-semibold"
              >
                <FaSync className={loading ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={() => setShowSearchBox(!showSearchBox)}
                className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-semibold text-sm md:text-base"
              >
                <FaFilter size={16} />
                <span className="hidden sm:inline">Search</span>
              </button>
              {(tableType === "sales-owners" || tableType === "commission-rules") && (
                <button
                  onClick={() => setShowCommissionRuleModal(true)}
                  className="bg-green-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2 font-semibold text-sm md:text-base"
                >
                  <FaPlus size={16} />
                  <span className="hidden sm:inline">Add Commission Rule</span>
                  <span className="sm:hidden">Add</span>
                </button>
              )}
            </div>
          </div>

          {/* Table Type Selector */}
          <div className="mt-6 flex gap-2 flex-wrap">
            {Object.entries(tableConfigs).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => handleTableChange(key)}
                className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg font-semibold transition text-sm md:text-base ${
                  tableType === key
                    ? "bg-primary text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {cfg.icon}
                {cfg.label}
              </button>
            ))}
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
              <p className="text-gray-600 text-xs font-semibold uppercase">
                Total {config.label}s
              </p>
              <p className="text-2xl md:text-3xl font-bold text-primary mt-2">
                {data.length}
              </p>
            </div>
            {tableType === "voucher-types" && (
              <>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                  <p className="text-gray-600 text-xs font-semibold uppercase">
                    Unique Types
                  </p>
                  <p className="text-2xl md:text-3xl font-bold text-purple-600 mt-2">
                    {new Set(data.map((d) => d.orderType)).size}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                  <p className="text-gray-600 text-xs font-semibold uppercase">
                    Total Counter
                  </p>
                  <p className="text-2xl md:text-3xl font-bold text-orange-600 mt-2">
                    {data.reduce((sum, d) => sum + (d.counter || 0), 0)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Search/Filter Section */}
      {showSearchBox && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1">
                <label className="text-sm font-bold text-gray-600 block mb-2">
                  Search Value
                </label>
                <input
                  type="text"
                  placeholder={`Search in ${config.label.toLowerCase()}...`}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                />
              </div>
              <button
                onClick={() => {
                  setShowSearchBox(false);
                  setSearchValue("");
                }}
                className="bg-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-400 transition font-semibold text-sm md:text-base w-full sm:w-auto"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            {config.icon}
            <p className="text-gray-600 mt-3">
              {searchValue ? `No results for "${searchValue}"` : `No ${config.label.toLowerCase()} found`}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    {config.displayFields.map((field, idx) => (
                      <th
                        key={idx}
                        className="px-4 md:px-6 py-4 text-left text-sm font-bold text-gray-700"
                      >
                        {field}
                      </th>
                    ))}
                    <th className="px-4 md:px-6 py-4 text-center text-sm font-bold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item, idx) => (
                    <tr
                      key={item._id}
                      className={`border-b hover:bg-blue-50 transition ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                    >
                    {config.fields.map((field, fieldIdx) => (
                        <td
                          key={fieldIdx}
                          className="px-4 md:px-6 py-4 text-sm text-gray-900 font-medium"
                        >
                          {tableType === "sales-orders" && field === "customerName"
                            ? typeof item.customer === "object" ? item.customer?.name : item.customer
                            : tableType === "sales-orders" && field === "salesOwnerName"
                            ? typeof item.salesOwner === "object" ? item.salesOwner?.name : item.salesOwner
                            : tableType === "sales-orders" && field === "orderValue"
                            ? formatFieldValue(item.grandTotalWithMargin || item.grandTotal, "grandTotalWithMargin")
                            : formatFieldValue(item[field], field)}
                        </td>
                      ))}
                      <td className="px-4 md:px-6 py-4 text-center space-x-1 md:space-x-2">
                        {tableType !== "commissions" && tableType !== "sales-orders" ? (
                          <>
                            <button
                              onClick={() => handleEdit(item)}
                              className="bg-yellow-500 text-white px-2 md:px-3 py-1 md:py-2 rounded-lg hover:bg-yellow-600 transition inline-flex items-center gap-1 text-xs md:text-sm font-semibold"
                            >
                              <FaEdit /> Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(item._id)}
                              className="bg-red-500 text-white px-2 md:px-3 py-1 md:py-2 rounded-lg hover:bg-red-600 transition inline-flex items-center gap-1 text-xs md:text-sm font-semibold"
                            >
                              <FaTrash /> Delete
                            </button>
                          </>
                        ) : tableType === "sales-orders" ? (
                          <button
                            onClick={() => setDeleteConfirm(item._id)}
                            className="bg-red-500 text-white px-2 md:px-3 py-1 md:py-2 rounded-lg hover:bg-red-600 transition inline-flex items-center gap-1 text-xs md:text-sm font-semibold"
                          >
                            <FaTrash /> Delete
                          </button>
                        ) : (
                          <span className="text-gray-500 text-xs">Read-only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg border border-gray-200">
            <h2 className="text-xl font-bold mb-6 text-gray-900">
              Edit {config.label}
            </h2>
            {config.fields.map((field) => (
              <div key={field} className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {field.charAt(0).toUpperCase() +
                    field.slice(1).replace(/([A-Z])/g, " $1")}
                </label>
                {field === "description" ? (
                  <textarea
                    value={editFormData[field] || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        [field]: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    rows="3"
                  />
                ) : field === "commissionAmount" || field === "minimumOrderValue" ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData[field] || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        [field]: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={field === "minimumOrderValue" ? "Enter minimum order value" : "Enter commission amount in ₹"}
                  />
                ) : field === "commissionPercentage" ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={editFormData[field] || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        [field]: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter commission percentage"
                  />
                ) : field === "effectiveFrom" ? (
                  <input
                    type="date"
                    value={editFormData[field] || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        [field]: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <input
                    type="text"
                    value={editFormData[field] || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        [field]: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                )}
              </div>
            ))}
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-semibold transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              Delete {config.label}?
            </h2>
            <p className="text-gray-600 mb-6">
              {tableType === "sales-orders" 
                ? "Are you sure you want to delete this sales order? The customer's closing balance will be reverted. This action cannot be undone."
                : `Are you sure you want to delete this ${config.label.toLowerCase()}? This action cannot be undone.`
              }
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold transition"
              >
                Keep It
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold transition"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commission Rule Modal */}
      {showCommissionRuleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg border border-gray-200">
            <h2 className="text-xl font-bold mb-6 text-gray-900">
              Add Commission Rule
            </h2>
            
            {/* Role Type Selector */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Role Type
              </label>
              <select
                value={commissionRuleForm.roleType}
                onChange={(e) =>
                  setCommissionRuleForm({
                    ...commissionRuleForm,
                    roleType: e.target.value,
                    personId: "",
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="SalesOwner">Sales Owner</option>
                <option value="SalesMan">Sales Man</option>
                <option value="DeliveryMan">Delivery Man</option>
              </select>
            </div>

            {/* Person Name Dropdown (Dynamic based on Role Type) */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {commissionRuleForm.roleType === "SalesOwner" ? "Sales Owner Name" : 
                 commissionRuleForm.roleType === "SalesMan" ? "Sales Man Name" : 
                 "Delivery Man Name"}
              </label>
              <select
                value={commissionRuleForm.personId}
                onChange={(e) =>
                  setCommissionRuleForm({
                    ...commissionRuleForm,
                    personId: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select {commissionRuleForm.roleType === "SalesOwner" ? "Sales Owner" : 
                                          commissionRuleForm.roleType === "SalesMan" ? "Sales Man" : 
                                          "Delivery Man"}</option>
                {commissionRuleForm.roleType === "SalesOwner" && salesOwners.map((owner) => (
                  <option key={owner._id} value={owner._id}>
                    {owner.name}
                  </option>
                ))}
                {commissionRuleForm.roleType === "SalesMan" && salesMen.map((man) => (
                  <option key={man._id} value={man._id}>
                    {man.name}
                  </option>
                ))}
                {commissionRuleForm.roleType === "DeliveryMan" && deliveryMen.map((man) => (
                  <option key={man._id} value={man._id}>
                    {man.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Minimum Order Value */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Minimum Order Value (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={commissionRuleForm.minimumOrderValue}
                onChange={(e) =>
                  setCommissionRuleForm({
                    ...commissionRuleForm,
                    minimumOrderValue: e.target.value ? parseFloat(e.target.value) : 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., 1000"
              />
            </div>

            {/* Commission Percentage */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Commission Percentage (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={commissionRuleForm.commissionPercentage}
                onChange={(e) =>
                  setCommissionRuleForm({
                    ...commissionRuleForm,
                    commissionPercentage: e.target.value ? parseFloat(e.target.value) : 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., 10"
              />
            </div>

            {/* Effective From Date */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Effective From (Date)
              </label>
              <input
                type="date"
                value={commissionRuleForm.effectiveFrom}
                onChange={(e) =>
                  setCommissionRuleForm({
                    ...commissionRuleForm,
                    effectiveFrom: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCommissionRuleModal(false);
                  setCommissionRuleForm({
                    roleType: "SalesOwner",
                    personId: "",
                    minimumOrderValue: 0,
                    commissionPercentage: 0,
                    effectiveFrom: new Date().toISOString().split("T")[0],
                  });
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCommissionRule}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition"
              >
                Create Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OthersSummary;
