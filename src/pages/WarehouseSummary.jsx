import { useEffect, useState } from "react";
import { FaEdit, FaSync, FaTrash, FaWarehouse } from "react-icons/fa";
import { API_BASE } from "../api";

const WarehouseSummary = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/warehouses`);
      const data = await response.json();

      if (data.success) {
        setWarehouses(data.data);
      } else {
        setError("Failed to fetch warehouses");
      }
    } catch (err) {
      setError(err.message || "Error fetching warehouses");
      console.error("Fetch warehouses error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  // Handle Edit
  const handleEdit = (warehouse) => {
    setEditingWarehouse(warehouse);
    setEditFormData({
      name: warehouse.name,
      address: warehouse.address,
      location: warehouse.location,
    });
    setShowEditModal(true);
  };

  // Handle Save Edit
  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`${API_BASE}/warehouses/${editingWarehouse._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });
      const data = await response.json();

      if (data.success) {
        setWarehouses(warehouses.map(w => w._id === editingWarehouse._id ? data.data : w));
        setShowEditModal(false);
        setEditingWarehouse(null);
      }
    } catch (error) {
      console.error("Error updating warehouse:", error);
    }
  };

  // Handle Delete
  const handleDelete = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/warehouses/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        setWarehouses(warehouses.filter(w => w._id !== id));
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error("Error deleting warehouse:", error);
    }
  };

  // Filter warehouses
  const filteredWarehouses = warehouses.filter(w =>
    w.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    (w.location && w.location.toLowerCase().includes(searchValue.toLowerCase()))
  );

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (error) return <div className="p-6 text-center text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <FaWarehouse className="text-yellow-500" />
          Warehouse Summary
        </h1>
        <button
          onClick={() => {
            setShowSearchBox(!showSearchBox);
            setSearchValue("");
          }}
          className="ml-auto flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
        >
          <FaSync /> Refresh
        </button>
      </div>

      {showSearchBox && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search warehouse..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-gray-800 font-semibold">Name</th>
              <th className="px-6 py-3 text-left text-gray-800 font-semibold">Location</th>
              <th className="px-6 py-3 text-left text-gray-800 font-semibold">Address</th>
              <th className="px-6 py-3 text-center text-gray-800 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredWarehouses.map((w) => (
              <tr key={w._id} className="border-t hover:bg-gray-50">
                <td className="px-6 py-4">{w.name}</td>
                <td className="px-6 py-4">{w.location || "-"}</td>
                <td className="px-6 py-4">{w.address || "-"}</td>
                <td className="px-6 py-4 text-center space-x-2">
                  <button
                    onClick={() => handleEdit(w)}
                    className="bg-yellow-500 text-white px-3 py-1 rounded-lg hover:bg-yellow-600 inline-flex items-center gap-1"
                  >
                    <FaEdit /> Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(w._id)}
                    className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 inline-flex items-center gap-1"
                  >
                    <FaTrash /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg">
            <h2 className="text-xl font-bold mb-4">Edit Warehouse</h2>
            <input
              type="text"
              placeholder="Name"
              value={editFormData.name || ""}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Location"
              value={editFormData.location || ""}
              onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              placeholder="Address"
              value={editFormData.address || ""}
              onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg">
            <h2 className="text-xl font-bold mb-4">Delete Warehouse</h2>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this warehouse?</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
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

export default WarehouseSummary;
