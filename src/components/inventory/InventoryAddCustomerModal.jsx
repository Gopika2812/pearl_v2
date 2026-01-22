//so
import { useState } from "react";

const InventoryAddCustomerModal = ({ isOpen, onClose, onSave }) => {
  const [customer, setCustomer] = useState({
    name: "", whatsapp: "", email: "", address: "", district: "", state: "", pincode: ""
  }); 

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...customer, id: Date.now() });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 font-sans">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="bg-primary p-4 text-white font-cursive">
          <h3 className="text-xl font-bold">Register New Customer</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-bold text-gray-600">Customer Name *</label>
              <input type="text" required className="w-full p-2 border rounded-lg outline-primary" 
                onChange={(e) => setCustomer({...customer, name: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-600">WhatsApp Number * </label>
              <input type="tel" required className="w-full p-2 border rounded-lg outline-primary" 
                onChange={(e) => setCustomer({...customer, whatsapp: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-600">Email </label>
              <input type="email" className="w-full p-2 border rounded-lg outline-primary" 
                onChange={(e) => setCustomer({...customer, email: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-bold text-gray-600">Address </label>
              <textarea className="w-full p-2 border rounded-lg outline-primary" 
                onChange={(e) => setCustomer({...customer, address: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-600">District </label>
              <input type="text" className="w-full p-2 border rounded-lg outline-primary" 
                onChange={(e) => setCustomer({...customer, district: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-600">Pincode </label>
              <input type="text" className="w-full p-2 border rounded-lg outline-primary" 
                onChange={(e) => setCustomer({...customer, pincode: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 p-2 border rounded-lg">Cancel</button>
            <button type="submit" className="flex-1 p-2 bg-primary text-white rounded-lg font-bold">Save Customer</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddCustomerModal;