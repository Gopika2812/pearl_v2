import { useEffect, useState } from "react";
import { API_BASE } from "../../api";

const InventoryAddWarehouseModal = ({ isOpen, onClose, onSave, branchId, editingItem }) => {
  const [warehouse, setWarehouse] = useState({ name: "" });
  const [loading, setLoading] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (editingItem) {
      setWarehouse({ name: editingItem.name || "" });
    } else {
      setWarehouse({ name: "" });
    }
  }, [editingItem]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      
      // If editing, use PUT; otherwise use POST
      const method = editingItem ? "PUT" : "POST";
      const url = editingItem 
        ? `${API_BASE}/warehouses/${editingItem._id}` 
        : `${API_BASE}/warehouses`;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: warehouse.name, branchId }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || `${editingItem ? "Update" : "Save"} failed`);

      alert(`Warehouse ${editingItem ? "updated" : "saved"} successfully!`);
      onSave(json.data || json);
      onClose();
      setWarehouse({ name: "" });

    } catch (err) {
      alert(`Warehouse ${editingItem ? "update" : "save"} failed: ` + err.message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 font-cursive">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        {/* Header matches the Pearls ERP theme */}
        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold uppercase tracking-tight">Add Warehouse</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
              Warehouse Name
            </label>
            <input 
              type="text" 
              required 
              placeholder="e.g. Main Godown"
              className="w-full p-3 border-b-2 border-gray-100 outline-none focus:border-primary transition-colors capitalize text-sm"
              value={warehouse.name} 
              onChange={(e) => setWarehouse({ name: e.target.value })} 
            />
          </div>

          {/* Location Selection Block Removed */}

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-400 hover:bg-gray-50 transition-all text-sm"
            >
              CANCEL
            </button>
            <button 
              type="submit" 
              className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-opacity-90 transition-all text-sm uppercase tracking-wider"
            >
              SAVE
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddWarehouseModal;