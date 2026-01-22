import { useState } from "react";

const InventoryAddAgentModal = ({ isOpen, onClose, onSave }) => {
  const [agent, setAgent] = useState({ name: "", phone: "", email: "" });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...agent, id: Date.now() });
    setAgent({ name: "", phone: "", email: "" });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 font-cursive">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold">Add New Agent</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
            <input 
              type="text" required className="w-full px-4 py-2 border rounded-lg outline-primary capitalize"
              placeholder="e.g. John Doe"
              value={agent.name} 
              onChange={(e) => setAgent({...agent, name: e.target.value})} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact No</label>
              <input 
                type="tel" required className="w-full px-4 py-2 border rounded-lg outline-primary"
                placeholder="9876543210"
                value={agent.phone} 
                onChange={(e) => setAgent({...agent, phone: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email (Opt)</label>
              <input 
                type="email" className="w-full px-4 py-2 border rounded-lg outline-primary"
                placeholder="agent@example.com"
                value={agent.email} 
                onChange={(e) => setAgent({...agent, email: e.target.value})} 
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-lg">Cancel</button>
            <button type="submit" className="flex-1 py-2 bg-primary text-white rounded-lg shadow-md">Save Agent</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddAgentModal;