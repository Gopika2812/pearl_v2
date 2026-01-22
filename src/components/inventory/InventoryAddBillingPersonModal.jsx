import { useState } from "react";

const InventoryAddBillingPersonModal = ({ isOpen, onClose, onSave }) => {
  const [person, setPerson] = useState({ name: "", designation: "" });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...person, id: Date.now() });
    setPerson({ name: "", designation: "" });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 font-cursive">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold">Add Billing Person</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Person Name</label>
            <input 
              type="text" required className="w-full px-4 py-2 border rounded-lg outline-primary capitalize"
              placeholder="e.g. Ramesh Kumar"
              value={person.name} 
              onChange={(e) => setPerson({...person, name: e.target.value})} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
            <input 
              type="text" required className="w-full px-4 py-2 border rounded-lg outline-primary"
              placeholder="e.g. Accounts Manager"
              value={person.designation} 
              onChange={(e) => setPerson({...person, designation: e.target.value})} 
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg">Cancel</button>
            <button type="submit" className="flex-1 py-2 bg-primary text-white rounded-lg shadow-md">Save Person</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddBillingPersonModal;