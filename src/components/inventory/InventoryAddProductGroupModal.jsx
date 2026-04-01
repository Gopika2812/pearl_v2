import { useEffect, useState } from "react";
import { API_BASE, fetchWithAuth } from "../../api";

const InventoryAddProductGroupModal = ({ isOpen, onClose, onSave, branchId, editingItem }) => {
  const [groupName, setGroupName] = useState("");

  // Pre-fill form when editing
  useEffect(() => {
    if (editingItem) {
      setGroupName(editingItem.name || "");
    } else {
      setGroupName("");
    }
  }, [editingItem]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    if (!groupName) {
      alert("Please fill in the product group name");
      return;
    }

    onSave({
      _id: editingItem?._id,
      name: groupName.trim(),
    });

    // Reset and Close
    setGroupName("");
    onClose();
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!branchId) {
      alert("Please select a branch first");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("branchId", branchId);

    try {
      const res = await fetchWithAuth(
        `${API_BASE}/product-groups/bulk-upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Upload failed");
      }

      alert(
        `Uploaded: ${data.insertedCount}\nSkipped: ${data.skippedCount}`
      );

      onClose();
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      alert(err.message || "Upload failed");
    }
  };


  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold font-cursive"> Group / Category</h3>
        </div>

        <input
          type="file"
          accept=".xlsx,.xls"
          hidden
          id="bulkUpload"
          onChange={handleBulkUpload}
        />

        <button
          type="button"
          onClick={() => document.getElementById("bulkUpload").click()}
          className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition"
        >
          📤 Bulk Upload (Excel)
        </button>


        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 font-semibold">
              Product Group / Category Name
            </label>
            <p className="text-xs text-gray-500 mb-2">This groups products into categories for better organization</p>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none capitalize"
              placeholder="e.g. Beverages, Snacks, Dairy Products"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition font-semibold shadow-md"
            >
              Save Category
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddProductGroupModal;