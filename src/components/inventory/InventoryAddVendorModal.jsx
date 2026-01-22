import { useState } from "react";

const InventoryAddVendorModal = ({ isOpen, onClose, onSave }) => {
  const [vendor, setVendor] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    gst: ""
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...vendor, id: Date.now() });
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
            onChange={(e) => setVendor({ ...vendor, name: e.target.value })}
          />

          <input
            placeholder="Phone"
            className="w-full p-2 border rounded-lg"
            onChange={(e) => setVendor({ ...vendor, phone: e.target.value })}
          />

          <input
            type="email"
            placeholder="Email"
            className="w-full p-2 border rounded-lg"
            onChange={(e) => setVendor({ ...vendor, email: e.target.value })}
          />

          <textarea
            placeholder="Address"
            className="w-full p-2 border rounded-lg"
            onChange={(e) => setVendor({ ...vendor, address: e.target.value })}
          />

          <input
            placeholder="GST Number"
            className="w-full p-2 border rounded-lg"
            onChange={(e) => setVendor({ ...vendor, gst: e.target.value })}
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
