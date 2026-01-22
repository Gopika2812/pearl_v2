import { useState } from "react";

const InventoryAddBillingPersonModal = ({ isOpen, onClose, onSave }) => {
  const [person, setPerson] = useState({ name: "", designation: "" });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...person, id: Date.now() });
    setPerson({ name: "", designation: "" }); // Reset form
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 font-cursive">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold">Add Billing Person</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Person Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Person Name</label>
            <input 
              type="text" 
              required 
              className="w-full px-4 py-2 border rounded-lg outline-primary capitalize"
              placeholder="e.g. Ramesh Kumar"
              value={person.name} 
              onChange={(e) => setPerson({...person, name: e.target.value})} 
            />
          </div>

          {/* Designation Dropdown - இப்போது மாற்றப்பட்டுள்ளது */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
            <select 
              required 
              className="w-full px-4 py-2 border rounded-lg outline-primary bg-white cursor-pointer"
              value={person.designation} 
              onChange={(e) => setPerson({...person, designation: e.target.value})}
            >
              <option value="">-- Select Designation --</option>
              <option value="Billing">Billing</option>
              <option value="Agent">Agent</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2 font-sans">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-2 border rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-2 bg-primary text-white rounded-lg shadow-md hover:opacity-90 transition font-bold"
            >
              Save Person
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddBillingPersonModal;