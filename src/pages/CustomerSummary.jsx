import { Fragment, useEffect, useState } from "react";
import { FaBox, FaChevronDown, FaChevronLeft, FaChevronRight, FaEdit, FaFilter, FaSync, FaTrash } from "react-icons/fa";
import { API_BASE } from "../api";

const CustomerSummary = () => {
  const [customers, setCustomers] = useState([]);
  const [salesOwners, setSalesOwners] = useState([]);
  const [customerGroups, setCustomerGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchField, setSearchField] = useState("name");
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const filterFields = [
    { label: "Customer Name", value: "name", type: "text" },
    { label: "WhatsApp", value: "whatsapp", type: "text" },
    { label: "Email", value: "email", type: "text" },
    { label: "District", value: "district", type: "text" },
    { label: "State", value: "state", type: "text" },
    { label: "GSTIN", value: "gstin", type: "text" },
    { label: "Sales Owner", value: "salesOwner", type: "text" },
    { label: "Closing Balance", value: "closingBalance", type: "number" },
    { label: "Margin", value: "margin", type: "number" },
  ];

  // Fetch customers data - fetch all pages
  const fetchCustomers = async () => {
    if (!currentBranch?._id) return;
    try {
      setLoading(true);
      setError(null);
      
      // First fetch to get total pages
      const firstResponse = await apiWithAuth.get(`customers?branchId=${currentBranch._id}&page=1&limit=100`);
      const firstData = firstResponse.data;

      if (!firstData.success) {
        setError("Failed to fetch customers");
        return;
      }

      let allCustomers = [...firstData.data];
      const totalPages = firstData.pagination?.pages || 1;

      // Fetch remaining pages
      if (totalPages > 1) {
        const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
        
        const pageRequests = remainingPages.map(page =>
          apiWithAuth.get(`customers?branchId=${currentBranch._id}&page=${page}&limit=100`).then(res => res.data)
        );

        const results = await Promise.all(pageRequests);
        
        results.forEach(result => {
          if (result.success && result.data) {
            allCustomers = [...allCustomers, ...result.data];
          }
        });
      }

      setCustomers(allCustomers);
    } catch (err) {
      setError(err.message || "Error fetching customers");
      console.error("Fetch customers error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch sales owners
  const fetchSalesOwners = async () => {
    if (!currentBranch?._id) return;
    try {
      const response = await apiWithAuth.get(`sales-owners?branchId=${currentBranch._id}`);
      const data = response.data;

      if (data.success) {
        setSalesOwners(data.data);
      }
    } catch (err) {
      console.error("Fetch sales owners error:", err);
    }
  };

  // Fetch customer groups
  const fetchCustomerGroups = async () => {
    if (!currentBranch?._id) return;
    try {
      const response = await apiWithAuth.get(`customer-groups?branchId=${currentBranch._id}`);
      const data = response.data;

      if (data.success) {
        setCustomerGroups(data.data);
      }
    } catch (err) {
      console.error("Fetch customer groups error:", err);
    }
  };

  useEffect(() => {
    if (currentBranch?._id) {
      fetchCustomers();
      fetchSalesOwners();
      fetchCustomerGroups();
    }
  }, [currentBranch]);

  // Force refresh after a short delay to ensure data is fresh
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Handle Edit Customer
  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    const salesOwnerId = typeof customer.salesOwner === 'object' ? customer.salesOwner?._id : customer.salesOwner;
    const customerGroupId = typeof customer.customerGroup === 'object' ? customer.customerGroup?._id : customer.customerGroup;
    setEditFormData({
      name: customer.name,
      whatsapp: customer.whatsapp,
      email: customer.email,
      address: customer.address,
      district: customer.district,
      state: customer.state,
      pincode: customer.pincode,
      country: customer.country,
      gstin: customer.gstin,
      closingBalance: customer.closingBalance,
      margin: customer.margin,
      salesOwner: salesOwnerId || "",
      customerGroup: customerGroupId || "",
      accountHolder: customer.accountHolder,
      accountNumber: customer.accountNumber,
      ifsc: customer.ifsc,
      branch: customer.branch,
      upi: customer.upi,
    });
    setShowEditModal(true);
  };

  // Handle Save Edit
  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`${API_BASE}/customers/${editingCustomer._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("PUT Error:", response.status, errorText);
        alert(`Failed to update customer: ${response.status} ${response.statusText}`);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setCustomers(
          customers.map((c) => (c._id === editingCustomer._id ? data.data : c))
        );
        setShowEditModal(false);
        setEditingCustomer(null);
        alert("Customer updated successfully!");
      } else {
        alert(data.message || "Failed to update customer");
      }
    } catch (err) {
      alert("Error updating customer: " + err.message);
      console.error("Edit error:", err);
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = (customerId) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(customerId)) {
      newExpandedRows.delete(customerId);
    } else {
      newExpandedRows.add(customerId);
    }
    setExpandedRows(newExpandedRows);
  };

  // Handle Delete Customer
  const handleDelete = async (customerId) => {
    try {
      const response = await fetch(`${API_BASE}/customers/${customerId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("DELETE Error:", response.status, errorText);
        alert(`Failed to delete customer: ${response.status} ${response.statusText}`);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setCustomers(customers.filter((c) => c._id !== customerId));
        setDeleteConfirm(null);
        alert("Customer deleted successfully!");
      } else {
        alert(data.message || "Failed to delete customer");
      }
    } catch (err) {
      alert("Error deleting customer: " + err.message);
      console.error("Delete error:", err);
    }
  };

  // Filter customers by search value and selected field
  const filteredCustomers = searchValue.trim() === ""
    ? customers
    : customers.filter((customer) => {
        let fieldValue = customer[searchField];
        
        // Handle salesOwner object - extract name
        if (searchField === "salesOwner" && typeof fieldValue === "object") {
          fieldValue = fieldValue?.name || "";
        }
        
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
        let fieldA = a[searchField];
        let fieldB = b[searchField];
        
        // Handle salesOwner object
        if (searchField === "salesOwner") {
          fieldA = typeof fieldA === "object" ? fieldA?.name || "" : fieldA;
          fieldB = typeof fieldB === "object" ? fieldB?.name || "" : fieldB;
        }
        
        fieldA = String(fieldA || "").toLowerCase().trim();
        fieldB = String(fieldB || "").toLowerCase().trim();
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

  // Calculate paginated customers
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

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
                  Customer Summary
                </h1>
                <p className="text-gray-600 text-xs md:text-sm mt-1">
                  {filteredCustomers.length} customers {searchValue.trim() !== "" ? `(searched in ${filterFields.find((f) => f.value === searchField)?.label})` : "in database"}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={fetchCustomers}
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
                {customers.length}
              </p>
            </div>
            <div className="bg-gray-50 p-3 md:p-4 rounded-lg border">
              <p className="text-gray-600 text-xs font-semibold uppercase">
                Balance
              </p>
              <p className="text-lg md:text-2xl font-bold text-blue-600 mt-1">
                ₹ {(customers.reduce((sum, c) => sum + (c.closingBalance || 0), 0) / 1000).toFixed(0)}K
              </p>
            </div>
            <div className="bg-gray-50 p-3 md:p-4 rounded-lg border">
              <p className="text-gray-600 text-xs font-semibold uppercase">
                Avg Margin
              </p>
              <p className="text-lg md:text-2xl font-bold text-purple-600 mt-1">
                {customers.length > 0
                  ? (
                      customers.reduce((sum, c) => sum + (c.margin || 0), 0) /
                      customers.length
                    ).toFixed(1)
                  : "0.0"}
                %
              </p>
            </div>
            <div className="bg-gray-50 p-3 md:p-4 rounded-lg border">
              <p className="text-gray-600 text-xs font-semibold uppercase">
                States
              </p>
              <p className="text-lg md:text-2xl font-bold text-orange-600 mt-1">
                {new Set(customers.map((c) => c.state).filter(Boolean)).size}
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
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <FaBox className="text-4xl text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 text-sm md:text-base">
              {searchValue.trim() !== "" ? "No customers match your search" : "No customers found"}
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
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700">
                        Customer Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700">
                        WhatsApp
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700">
                        State
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700">
                        District
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700">
                        GSTIN
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700">
                        Balance
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700">
                        Margin
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700">
                        Sales Owner
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700">
                        Details
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                <tbody>
                  {paginatedCustomers.map((customer, idx) => (
                    <Fragment key={customer._id}>
                    <tr
                      className={`border-b hover:bg-gray-50 transition ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {customer.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {customer.whatsapp || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {customer.email || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {customer.state || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {customer.district || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {customer.gstin || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold">
                        <span
                          className={
                            customer.closingBalance > 0
                              ? "text-green-600"
                              : customer.closingBalance < 0
                              ? "text-red-600"
                              : "text-gray-700"
                          }
                        >
                          ₹ {customer.closingBalance?.toFixed(2) || "0.00"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">
                        {customer.margin?.toFixed(2) || "0.00"}%
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {(() => {
                          // Handle different salesOwner formats
                          if (!customer.salesOwner) return "-";
                          if (typeof customer.salesOwner === "string") return customer.salesOwner;
                          if (typeof customer.salesOwner === "object" && customer.salesOwner.name) {
                            return customer.salesOwner.name;
                          }
                          if (typeof customer.salesOwner === "object" && customer.salesOwner._id) {
                            // If it's an object but no name, try to find from salesOwners list
                            const owner = salesOwners.find(so => so._id === customer.salesOwner._id);
                            return owner?.name || customer.salesOwner._id;
                          }
                          return customer.salesOwner || "-";
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm text-center flex items-center justify-center gap-2">
                        <button
                          onClick={() => toggleRowExpansion(customer._id)}
                          className="text-blue-600 hover:text-blue-800 transition p-1"
                          title="View Bank Details"
                        >
                          <FaChevronDown
                            size={16}
                            className={`transition-transform ${
                              expandedRows.has(customer._id) ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-center flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg transition flex items-center gap-1"
                          title="Edit Customer"
                        >
                          <FaEdit size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(customer)}
                          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition flex items-center gap-1"
                          title="Delete Customer"
                        >
                          <FaTrash size={14} />
                        </button>
                      </td>
                    </tr>
                    {/* Expandable Bank Details Row */}
                    {expandedRows.has(customer._id) && (
                      <tr className="bg-blue-50 border-b hover:bg-blue-50">
                        <td colSpan="11" className="px-6 py-4">
                          <div className="space-y-3">
                            <h4 className="font-bold text-gray-800 text-sm mb-3">
                              🏦 Bank Account Details
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <p className="text-xs font-semibold text-gray-500 uppercase">
                                  Account Holder
                                </p>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  {customer.accountHolder || "-"}
                                </p>
                              </div>
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <p className="text-xs font-semibold text-gray-500 uppercase">
                                  Account Number
                                </p>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  {customer.accountNumber || "-"}
                                </p>
                              </div>
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <p className="text-xs font-semibold text-gray-500 uppercase">
                                  IFSC Code
                                </p>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  {customer.ifsc || "-"}
                                </p>
                              </div>
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <p className="text-xs font-semibold text-gray-500 uppercase">
                                  Branch
                                </p>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  {customer.branch || "-"}
                                </p>
                              </div>
                              <div className="bg-white p-3 rounded border border-gray-200 lg:col-span-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase">
                                  UPI
                                </p>
                                <p className="text-sm font-semibold text-gray-900 mt-1">
                                  {customer.upi || "-"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {paginatedCustomers.map((customer) => (
                <div key={customer._id} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{customer.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{customer.district || "N/A"}, {customer.state || "N/A"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(customer)}
                        className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded transition"
                        title="Edit"
                      >
                        <FaEdit size={12} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(customer)}
                        className="bg-red-500 hover:bg-red-600 text-white p-2 rounded transition"
                        title="Delete"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div>
                      <p className="text-gray-500">WhatsApp</p>
                      <p className="text-gray-900 font-semibold">{customer.whatsapp || "-"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Email</p>
                      <p className="text-gray-900 font-semibold truncate">{customer.email || "-"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">GSTIN</p>
                      <p className="text-gray-900 font-semibold">{customer.gstin || "-"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Owner Margin</p>
                      <p className={`font-semibold ${customer.margin > 0 ? "text-green-600" : customer.margin < 0 ? "text-red-600" : "text-gray-700"}`}>
                        {customer.margin?.toFixed(1) || "0.0"}%
                      </p>
                    </div>
                  </div>
                  
                  <div className="border-t pt-3">
                    <p className="text-gray-500 text-xs">Balance</p>
                    <p className={`text-sm font-bold ${customer.closingBalance > 0 ? "text-green-600" : customer.closingBalance < 0 ? "text-red-600" : "text-gray-700"}`}>
                      ₹ {customer.closingBalance?.toFixed(2) || "0.00"}
                    </p>
                  </div>
                  
                  <div className="border-t mt-3 pt-3">
                    <p className="text-gray-500 text-xs">Sales Owner</p>
                    <p className="text-gray-900 font-semibold text-xs">
                      {typeof customer.salesOwner === "object" ? customer.salesOwner?.name : customer.salesOwner || "-"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="bg-gray-50 border-t px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
              <div className="text-xs md:text-sm text-gray-600">
                Showing {filteredCustomers.length === 0 ? 0 : startIndex + 1} to{" "}
                {Math.min(endIndex, filteredCustomers.length)} of{" "}
                {filteredCustomers.length} customers
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
                  {paginatedCustomers.length}
                </p>
              </div>
              <div className="bg-white p-3 md:p-4 rounded-lg border">
                <p className="text-gray-600 text-xs font-semibold uppercase">
                  Balance
                </p>
                <p className="text-lg md:text-2xl font-bold text-blue-600 mt-1">
                  ₹ {(paginatedCustomers.reduce((sum, c) => sum + (c.closingBalance || 0), 0) / 1000).toFixed(1)}K
                </p>
              </div>
              <div className="bg-white p-3 md:p-4 rounded-lg border">
                <p className="text-gray-600 text-xs font-semibold uppercase">
                  Avg Margin
                </p>
                <p className="text-lg md:text-2xl font-bold text-green-600 mt-1">
                  {paginatedCustomers.length > 0
                    ? (
                        paginatedCustomers.reduce((sum, c) => sum + (c.margin || 0), 0) /
                        paginatedCustomers.length
                      ).toFixed(1)
                    : "0.0"}
                  %
                </p>
              </div>
              <div className="bg-white p-3 md:p-4 rounded-lg border">
                <p className="text-gray-600 text-xs font-semibold uppercase">
                  States
                </p>
                <p className="text-lg md:text-2xl font-bold text-orange-600 mt-1">
                  {new Set(paginatedCustomers.map((c) => c.state).filter(Boolean)).size}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-blue-500 text-white p-4 sticky top-0">
              <h3 className="text-xl font-bold">Edit Customer</h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-600 mb-1 block">
                  Customer Name
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
                    WhatsApp
                  </label>
                  <input
                    type="text"
                    value={editFormData.whatsapp || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, whatsapp: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editFormData.email || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, email: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 mb-1 block">
                  Address
                </label>
                <textarea
                  value={editFormData.address || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, address: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  rows="3"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    State
                  </label>
                  <input
                    type="text"
                    value={editFormData.state || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, state: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    District
                  </label>
                  <input
                    type="text"
                    value={editFormData.district || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, district: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={editFormData.pincode || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, pincode: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={editFormData.gstin || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, gstin: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    Sales Owner
                  </label>
                  <select
                    value={editFormData.salesOwner || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, salesOwner: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- Select Sales Owner --</option>
                    {salesOwners.map((owner) => (
                      <option key={owner._id} value={owner._id}>
                        {owner.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    Customer Group
                  </label>
                  <select
                    value={editFormData.customerGroup || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, customerGroup: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- Select Customer Group --</option>
                    {customerGroups.map((group) => (
                      <option key={group._id} value={group._id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    Closing Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.closingBalance || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        closingBalance: parseFloat(e.target.value),
                      })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    Owner Margin %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.margin || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        margin: parseFloat(e.target.value),
                      })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    Account Holder
                  </label>
                  <input
                    type="text"
                    value={editFormData.accountHolder || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, accountHolder: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={editFormData.accountNumber || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, accountNumber: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    IFSC
                  </label>
                  <input
                    type="text"
                    value={editFormData.ifsc || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, ifsc: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    Branch
                  </label>
                  <input
                    type="text"
                    value={editFormData.branch || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, branch: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600 mb-1 block">
                    UPI
                  </label>
                  <input
                    type="text"
                    value={editFormData.upi || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, upi: e.target.value })
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
                  setEditingCustomer(null);
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
              <h3 className="text-xl font-bold">Delete Customer</h3>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete this customer?
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

export default CustomerSummary;
