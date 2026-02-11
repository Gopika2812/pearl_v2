import { Fragment, useEffect, useState } from "react";
import { FaBox, FaChevronDown, FaEdit, FaFilter, FaSync, FaTrash } from "react-icons/fa";
import { API_BASE } from "../api";

const CustomerSummary = () => {
  const [customers, setCustomers] = useState([]);
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

  // Available search fields
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

  // Fetch customers data
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/customers`);
      const data = await response.json();

      if (data.success) {
        setCustomers(data.data);
      } else {
        setError("Failed to fetch customers");
      }
    } catch (err) {
      setError(err.message || "Error fetching customers");
      console.error("Fetch customers error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Handle Edit Customer
  const handleEdit = (customer) => {
    setEditingCustomer(customer);
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
      salesOwner: customer.salesOwner,
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
    }
  };

  // Filter customers by search value and selected field
  const filteredCustomers = searchValue.trim() === ""
    ? customers
    : customers.filter((customer) => {
        const fieldValue = customer[searchField];
        const currentField = filterFields.find((f) => f.value === searchField);
        const isNumericField = currentField?.type === "number";

        if (isNumericField) {
          // For numeric fields, do numeric comparison
          return Number(fieldValue || 0) === Number(searchValue);
        } else {
          // For text fields, do contains search
          return String(fieldValue || "")
            .toLowerCase()
            .includes(searchValue.toLowerCase());
        }
      });

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-16 md:pl-64">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaBox className="text-primary text-2xl" />
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  Customer Summary
                </h1>
                <p className="text-gray-600 text-sm mt-1">
                  {filteredCustomers.length} customers {searchValue.trim() !== "" ? `(searched in ${filterFields.find((f) => f.value === searchField)?.label})` : "in database"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchCustomers}
                disabled={loading}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition flex items-center gap-2 disabled:opacity-50"
              >
                <FaSync className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
              <button
                onClick={() => setShowSearchBox(!showSearchBox)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-semibold"
              >
                <FaFilter size={16} />
                Add Filter
              </button>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-gray-600 text-xs font-semibold uppercase">
                Total Customers
              </p>
              <p className="text-2xl font-bold text-primary mt-1">
                {customers.length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-gray-600 text-xs font-semibold uppercase">
                Total Closing Balance
              </p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                ₹ {customers.reduce((sum, c) => sum + (c.closingBalance || 0), 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-gray-600 text-xs font-semibold uppercase">
                Avg Margin
              </p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {customers.length > 0
                  ? (
                      customers.reduce((sum, c) => sum + (c.margin || 0), 0) /
                      customers.length
                    ).toFixed(2)
                  : "0.00"}
                %
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-gray-600 text-xs font-semibold uppercase">
                States Covered
              </p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {new Set(customers.map((c) => c.state).filter(Boolean)).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Box - Appears when Add Filter is clicked */}
      {showSearchBox && (
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="text-sm font-bold text-gray-600 block mb-2">
                  Select Field to Search
                </label>
                <select
                  value={searchField}
                  onChange={(e) => {
                    setSearchField(e.target.value);
                    setSearchValue(""); // Reset search when field changes
                  }}
                  className="w-full p-3 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  {filterFields.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
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
                  className="w-full p-3 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  {filterFields.find((f) => f.value === searchField)?.type === "number"
                    ? "Enter exact number to match"
                    : "Type to search (partial match)"}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setShowSearchBox(false);
                    setSearchValue("");
                    setSearchField("name");
                  }}
                  className="px-4 py-3 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-semibold whitespace-nowrap"
                >
                  Close
                </button>
                {searchValue && (
                  <button
                    onClick={() => setSearchValue("")}
                    className="px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-semibold whitespace-nowrap"
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
      <div className="max-w-full mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
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
            <p className="text-gray-600">
              {searchValue.trim() !== "" ? "No customers match your search" : "No customers found"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                      Customer Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                      WhatsApp
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                      State
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                      District
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                      GSTIN
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">
                      Closing Balance
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">
                      Margin
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                      Sales Owner
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-gray-700">
                      Details
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer, idx) => (
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
                        {customer.salesOwner || "-"}
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

            {/* Summary Stats */}
            <div className="bg-gray-50 border-t px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-gray-600 text-xs font-semibold uppercase">
                  Displayed
                </p>
                <p className="text-2xl font-bold text-primary mt-1">
                  {filteredCustomers.length}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-gray-600 text-xs font-semibold uppercase">
                  Total Balance
                </p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  ₹ {filteredCustomers.reduce((sum, c) => sum + (c.closingBalance || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-gray-600 text-xs font-semibold uppercase">
                  Avg Margin
                </p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {filteredCustomers.length > 0
                    ? (
                        filteredCustomers.reduce((sum, c) => sum + (c.margin || 0), 0) /
                        filteredCustomers.length
                      ).toFixed(2)
                    : "0.00"}
                  %
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-gray-600 text-xs font-semibold uppercase">
                  States
                </p>
                <p className="text-2xl font-bold text-orange-600 mt-1">
                  {new Set(filteredCustomers.map((c) => c.state).filter(Boolean)).size}
                </p>
              </div>
            </div>
          </div>
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
                  <input
                    type="text"
                    value={editFormData.salesOwner || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, salesOwner: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
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
                    Margin %
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
