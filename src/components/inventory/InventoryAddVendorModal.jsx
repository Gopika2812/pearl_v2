import { useEffect, useState } from "react";

const InventoryAddVendorModal = ({ isOpen, onClose, onSave, branchId, editingItem }) => {
  const [vendor, setVendor] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    gstin: ""
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (editingItem) {
      setVendor({
        name: editingItem.name || "",
        phone: editingItem.phone || "",
        email: editingItem.email || "",
        address: editingItem.address || "",
        gstin: editingItem.gstin || "",
      });
    } else {
      setVendor({ name: "", phone: "", email: "", address: "", gstin: "" });
    }
  }, [editingItem]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    // ✅ Pass _id if editing for context to handle PUT
    onSave({
      _id: editingItem?._id,
      ...vendor
    });

    // Reset form
    setVendor({ name: "", phone: "", email: "", address: "", gstin: "" });

    // Close modal
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold">Register New Vendor</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input
            required
            placeholder="Vendor Name *"
            className="w-full p-2 border rounded-lg"
            value={vendor.name}
            onChange={(e) => setVendor({ ...vendor, name: e.target.value })}
          />

          <input
            placeholder="Phone"
            className="w-full p-2 border rounded-lg"
            value={vendor.phone}
            onChange={(e) => setVendor({ ...vendor, phone: e.target.value })}
          />

          <input
            type="email"
            placeholder="Email"
            className="w-full p-2 border rounded-lg"
            value={vendor.email}
            onChange={(e) => setVendor({ ...vendor, email: e.target.value })}
          />

          <textarea
            placeholder="Address"
            className="w-full p-2 border rounded-lg"
            value={vendor.address}
            onChange={(e) => setVendor({ ...vendor, address: e.target.value })}
          />

          <input
            placeholder="GSTIN Number"
            className="w-full p-2 border rounded-lg"
            value={vendor.gstin}
            onChange={(e) => setVendor({ ...vendor, gstin: e.target.value })}
          />

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 p-2 border rounded-lg">
              Cancel
            </button>
            <button type="submit" className="flex-1 p-2 bg-primary text-white rounded-lg font-bold">
              Save Vendor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddVendorModal;
