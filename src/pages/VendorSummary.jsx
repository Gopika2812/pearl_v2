import { useEffect, useState } from "react";
import { FaBox, FaEdit, FaFilter, FaSync, FaTrash } from "react-icons/fa";
import { API_BASE } from "../api";

const VendorSummary = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingVendor, setEditingVendor] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchField, setSearchField] = useState("name");
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Available search fields
  const filterFields = [
    { label: "Vendor Name", value: "name", type: "text" },
    { label: "Phone", value: "phone", type: "text" },
    { label: "Email", value: "email", type: "text" },
    { label: "Address", value: "address", type: "text" },
    { label: "GSTIN", value: "gstin", type: "text" },
  ];

  // Get branchId from localStorage
  const getBranchId = () => {
    // Try to get from user data
    const user = localStorage.getItem("user");
    if (user) {
      try {
        const userData = JSON.parse(user);
        if (userData.branchId) return userData.branchId;
      } catch (e) {
        console.error("Failed to parse user data:", e);
      }
    }

    // Try to get from currentBranch
    const currentBranch = localStorage.getItem("currentBranch");
    if (currentBranch) {
      try {
        const branchData = JSON.parse(currentBranch);
        return branchData._id || branchData.id;
      } catch (e) {
        console.error("Failed to parse currentBranch data:", e);
      }
    }

    return null;
  };

  // Fetch vendors data
  const fetchVendors = async () => {
    try {
      setLoading(true);
      setError(null);

      const branchId = getBranchId();
      if (!branchId) {
        setError("Branch ID not found. Please login again.");
        setLoading(false);
        return;
      }

      const url = `${API_BASE}/vendors?branchId=${branchId}`;
      console.log("Fetching vendors from:", url);
      const response = await fetch(url);
      console.log("Response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Vendors data received:", data);

      // Handle both response structures
      if (data.success) {
        setVendors(data.data || []);
      } else if (Array.isArray(data)) {
        // Direct array response (backwards compatibility)
        setVendors(data);
      } else if (data.data && Array.isArray(data.data)) {
        setVendors(data.data);
      } else {
        setError("Failed to fetch vendors: Unexpected response structure");
        console.error("Unexpected response structure:", data);
      }
    } catch (err) {
      setError(err.message || "Error fetching vendors");
      console.error("Fetch vendors error:", err);
      console.error("Make sure the backend server is running. Check your VITE_API_BASE_URL in .env configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  // Handle Edit Vendor
  const handleEdit = (vendor) => {
    setEditingVendor(vendor);
    setEditFormData({
      name: vendor.name,
      phone: vendor.phone,
      email: vendor.email,
      address: vendor.address,
      gstin: vendor.gstin,
      isActive: vendor.isActive,
    });
    setShowEditModal(true);
  };

  // Handle Save Edit
  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`${API_BASE}/vendors/${editingVendor._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });
      const data = await response.json();

      if (data.success) {
        setVendors(
          vendors.map((v) => (v._id === editingVendor._id ? data.data : v))
        );
        setShowEditModal(false);
        setEditingVendor(null);
        alert("Vendor updated successfully!");
      } else {
        alert(data.message || "Failed to update vendor");
      }
    } catch (err) {
      alert("Error updating vendor: " + err.message);
    }
  };

  // Handle Delete Vendor
  const handleDelete = async (vendorId) => {
    try {
      const response = await fetch(`${API_BASE}/vendors/${vendorId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        setVendors(vendors.filter((v) => v._id !== vendorId));
        setDeleteConfirm(null);
        alert("Vendor deleted successfully!");
      } else {
        alert(data.message || "Failed to delete vendor");
      }
    } catch (err) {
      alert("Error deleting vendor: " + err.message);
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = (vendorId) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(vendorId)) {
      newExpandedRows.delete(vendorId);
    } else {
      newExpandedRows.add(vendorId);
    }
    setExpandedRows(newExpandedRows);
  };

  // Filter vendors by search value and selected field
  const filteredVendors = searchValue.trim() === ""
    ? vendors
    : vendors.filter((vendor) => {
        const fieldValue = vendor[searchField];
        const currentField = filterFields.find((f) => f.value === searchField);
        const isNumericField = currentField?.type === "number";

        if (isNumericField) {
          return Number(fieldValue || 0) === Number(searchValue);
        } else {
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
                  Vendor Summary
                </h1>
                <p className="text-gray-600 text-sm mt-1">
                  {filteredVendors.length} vendors {searchValue.trim() !== "" ? `(searched in ${filterFields.find((f) => f.value === searchField)?.label})` : "in database"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchVendors}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-gray-600 text-xs font-semibold uppercase">
                Total Vendors
              </p>
              <p className="text-2xl font-bold text-primary mt-1">
                {vendors.length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-gray-600 text-xs font-semibold uppercase">
                Active Vendors
              </p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {vendors.filter((v) => v.isActive).length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-gray-600 text-xs font-semibold uppercase">
                Inactive Vendors
              </p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {vendors.filter((v) => !v.isActive).length}
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
                    setSearchValue("");
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
        ) : filteredVendors.length === 0 ? (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <FaBox className="text-4xl text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">
              {searchValue.trim() !== "" ? "No vendors match your search" : "No vendors found"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                      Vendor Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                      Phone
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                      Address
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">
                      GSTIN
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-gray-700">
                      Status
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.map((vendor, idx) => (
                    <tr
                      key={vendor._id}
                      className={`border-b hover:bg-gray-50 transition ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {vendor.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {vendor.phone || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {vendor.email || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {vendor.address || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {vendor.gstin || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            vendor.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {vendor.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-center flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(vendor)}
                          className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg transition flex items-center gap-1"
                          title="Edit Vendor"
                        >
                          <FaEdit size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(vendor)}
                          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition flex items-center gap-1"
                          title="Delete Vendor"
                        >
                          <FaTrash size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Stats */}
            <div className="bg-gray-50 border-t px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-gray-600 text-xs font-semibold uppercase">
                  Displayed
                </p>
                <p className="text-2xl font-bold text-primary mt-1">
                  {filteredVendors.length}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-gray-600 text-xs font-semibold uppercase">
                  Active Count
                </p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {filteredVendors.filter((v) => v.isActive).length}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-gray-600 text-xs font-semibold uppercase">
                  Inactive Count
                </p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {filteredVendors.filter((v) => !v.isActive).length}
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
              <h3 className="text-xl font-bold">Edit Vendor</h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-600 mb-1 block">
                  Vendor Name
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
                    Phone
                  </label>
                  <input
                    type="text"
                    value={editFormData.phone || ""}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, phone: e.target.value })
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
                    Status
                  </label>
                  <select
                    value={editFormData.isActive ? "active" : "inactive"}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        isActive: e.target.value === "active",
                      })
                    }
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t p-4 flex gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingVendor(null);
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
              <h3 className="text-xl font-bold">Delete Vendor</h3>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete this vendor?
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

export default VendorSummary;
