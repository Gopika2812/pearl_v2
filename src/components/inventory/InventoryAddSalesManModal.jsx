import { useEffect, useState } from "react";

const InventoryAddSalesManModal = ({ isOpen, onClose, onSave, branchId, editingItem }) => {
  const [salesMan, setSalesMan] = useState({
    name: "",
    phone: "",
    role: "Sales Man"
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (editingItem) {
      setSalesMan({
        name: editingItem.name || "",
        phone: editingItem.phone || "",
        role: editingItem.role || "Sales Man",
      });
    } else {
      setSalesMan({ name: "", phone: "", role: "Sales Man" });
    }
  }, [editingItem]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      _id: editingItem?._id,
      ...salesMan
    });
    setSalesMan({ name: "", phone: "", role: "Sales Man" });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold">Register New Sales Man</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input
            required
            placeholder="Sales Man Name *"
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            value={salesMan.name}
            onChange={(e) => setSalesMan({ ...salesMan, name: e.target.value })}
          />

          <input
            required
            placeholder="Phone Number *"
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            value={salesMan.phone}
            onChange={(e) => setSalesMan({ ...salesMan, phone: e.target.value })}
          />

          <input
            disabled
            placeholder="Role"
            className="w-full p-2 border rounded-lg bg-gray-50"
            value={salesMan.role}
          />

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 p-2 border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" className="flex-1 p-2 bg-primary text-white rounded-lg font-bold hover:bg-primary/90">
              Save Sales Man
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddSalesManModal;
