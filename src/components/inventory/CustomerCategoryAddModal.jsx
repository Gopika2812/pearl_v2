import { useEffect, useState } from "react";
import { API_BASE } from "../../api";

const CustomerCategoryAddModal = ({ isOpen, onClose, onSave, branchId, editingItem }) => {
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");

  // Pre-fill form when editing
  useEffect(() => {
    if (editingItem) {
      setCategoryName(editingItem.name || "");
      setDescription(editingItem.description || "");
    } else {
      setCategoryName("");
      setDescription("");
    }
  }, [editingItem]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    if (!categoryName) {
      alert("Please fill in the customer category name");
      return;
    }

    onSave({
      _id: editingItem?._id,
      name: categoryName.trim(),
      description: description.trim(),
    });

    // Reset and Close
    setCategoryName("");
    setDescription("");
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
      const res = await fetch(
        `${API_BASE}/customer-categories/bulk-upload`,
        {
          method: "POST",
          body: formData, // ❗ DO NOT set Content-Type
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
          <h3 className="text-xl font-bold">Customer Category</h3>
        </div>

        <input
          type="file"
          accept=".xlsx,.xls"
          hidden
          id="customerCategoryBulkUpload"
          onChange={handleBulkUpload}
        />

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Single Item Input */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Category Name *
              </label>
              <input
                type="text"
                required
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g., Retail, Wholesale, Premium, Corporate"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional: Add category details"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none transition"
                rows="2"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-[#248d94] transition"
              >
                Save
              </button>
            </div>
          </form>

          {/* OR Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500 font-semibold">OR</span>
            </div>
          </div>

          {/* Bulk Upload */}
          <div
            onClick={() => document.getElementById("customerCategoryBulkUpload").click()}
            className="border-2 border-dashed border-primary rounded-lg p-6 text-center cursor-pointer hover:bg-primary/5 transition"
          >
            <p className="text-primary font-bold mb-1">📊 Bulk Upload</p>
            <p className="text-xs text-gray-600">
              Click to upload Excel file
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Format: Name, Description
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCategoryAddModal;
