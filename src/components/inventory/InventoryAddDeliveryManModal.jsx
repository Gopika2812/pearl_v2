import { useEffect, useState } from "react";

const InventoryAddDeliveryManModal = ({ isOpen, onClose, onSave, branchId, editingItem }) => {
  const [deliveryMan, setDeliveryMan] = useState({
    name: "",
    phone: "",
    role: "Delivery Man"
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (editingItem) {
      setDeliveryMan({
        name: editingItem.name || "",
        phone: editingItem.phone || "",
        role: editingItem.role || "Delivery Man",
      });
    } else {
      setDeliveryMan({ name: "", phone: "", role: "Delivery Man" });
    }
  }, [editingItem]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      _id: editingItem?._id,
      ...deliveryMan
    });
    setDeliveryMan({ name: "", phone: "", role: "Delivery Man" });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold">Register New Delivery Man</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input
            required
            placeholder="Delivery Man Name *"
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            value={deliveryMan.name}
            onChange={(e) => setDeliveryMan({ ...deliveryMan, name: e.target.value })}
          />

          <input
            required
            placeholder="Phone Number *"
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            value={deliveryMan.phone}
            onChange={(e) => setDeliveryMan({ ...deliveryMan, phone: e.target.value })}
          />

          <input
            disabled
            placeholder="Role"
            className="w-full p-2 border rounded-lg bg-gray-50"
            value={deliveryMan.role}
          />

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 p-2 border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" className="flex-1 p-2 bg-primary text-white rounded-lg font-bold hover:bg-primary/90">
              Save Delivery Man
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddDeliveryManModal;
