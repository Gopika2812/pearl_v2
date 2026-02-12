import { useEffect, useState } from "react";
import { FaEdit, FaLayerGroup, FaSync, FaTrash } from "react-icons/fa";
import { API_BASE } from "../api";

const ProductGroupSummary = () => {
  const [productGroups, setProductGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingProductGroup, setEditingProductGroup] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Fetch product groups data
  const fetchProductGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/product-groups`);
      const data = await response.json();

      if (data.success) {
        setProductGroups(data.data);
      } else {
        setError("Failed to fetch product groups");
      }
    } catch (err) {
      setError(err.message || "Error fetching product groups");
      console.error("Fetch product groups error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductGroups();
  }, []);

  // Handle Edit
  const handleEdit = (productGroup) => {
    setEditingProductGroup(productGroup);
    setEditFormData({
      name: productGroup.name,
      description: productGroup.description,
    });
    setShowEditModal(true);
  };

  // Handle Save Edit
  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`${API_BASE}/product-groups/${editingProductGroup._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });
      const data = await response.json();

      if (data.success) {
        setProductGroups(productGroups.map(pg => pg._id === editingProductGroup._id ? data.data : pg));
        setShowEditModal(false);
        setEditingProductGroup(null);
      }
    } catch (error) {
      console.error("Error updating product group:", error);
    }
  };

  // Handle Delete
  const handleDelete = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/product-groups/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        setProductGroups(productGroups.filter(pg => pg._id !== id));
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error("Error deleting product group:", error);
    }
  };

  // Filter product groups
  const filteredProductGroups = productGroups.filter(pg =>
    pg.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    (pg.description && pg.description.toLowerCase().includes(searchValue.toLowerCase()))
  );

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (error) return <div className="p-6 text-center text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <FaLayerGroup className="text-purple-500" />
          Product Group Summary
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
            placeholder="Search product group..."
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
              <th className="px-6 py-3 text-left text-gray-800 font-semibold">Description</th>
              <th className="px-6 py-3 text-center text-gray-800 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProductGroups.map((pg) => (
              <tr key={pg._id} className="border-t hover:bg-gray-50">
                <td className="px-6 py-4">{pg.name}</td>
                <td className="px-6 py-4">{pg.description || "-"}</td>
                <td className="px-6 py-4 text-center space-x-2">
                  <button
                    onClick={() => handleEdit(pg)}
                    className="bg-yellow-500 text-white px-3 py-1 rounded-lg hover:bg-yellow-600 inline-flex items-center gap-1"
                  >
                    <FaEdit /> Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(pg._id)}
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
            <h2 className="text-xl font-bold mb-4">Edit Product Group</h2>
            <input
              type="text"
              placeholder="Name"
              value={editFormData.name || ""}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              placeholder="Description"
              value={editFormData.description || ""}
              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
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
            <h2 className="text-xl font-bold mb-4">Delete Product Group</h2>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this product group?</p>
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

export default ProductGroupSummary;
