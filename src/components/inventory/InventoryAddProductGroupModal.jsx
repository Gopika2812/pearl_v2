import { useState } from "react";
import { API_BASE } from "../../api";

const InventoryAddProductGroupModal = ({ isOpen, onClose, onSave, voucherTypes }) => {
  const [groupName, setGroupName] = useState("");
  const [selectedVoucherId, setSelectedVoucherId] = useState("");

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    if (!groupName || !selectedVoucherId) {
      alert("Please fill all fields");
      return;
    }

    onSave({
      name: groupName.trim(),
      voucherId: selectedVoucherId,
    });

    // Reset and Close
    setGroupName("");
    setSelectedVoucherId("");
    onClose();
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(
        `${API_BASE}/product-groups/bulk-upload`,
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
          <h3 className="text-xl font-bold font-cursive">Create Product Group</h3>
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
          {/* Voucher Selection Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Voucher Type</label>
            <select
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white"
              value={selectedVoucherId}
              onChange={(e) => setSelectedVoucherId(e.target.value)}
            >
              <option value="">-- Choose Voucher --</option>
              {voucherTypes.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.name} ({v.prefix})
                </option>
              ))}
            </select>
          </div>

          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Group Name</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none capitalize"
              placeholder="e.g. Beverages, Snacks"
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
              Save Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddProductGroupModal;