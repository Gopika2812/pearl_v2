import { useState } from "react";

const InventoryAddCustomerModal = ({ isOpen, onClose, onSave }) => {
  // புதிய வங்கி விவரங்களுடன் கூடிய ஸ்டேட்
  const [customer, setCustomer] = useState({
    name: "", whatsapp: "", email: "", address: "", district: "", state: "", pincode: "",
    accountHolder: "", ifsc: "", branch: "", upi: ""
  }); 

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...customer, id: Date.now() });
    // ஃபார்ம் ரீசெட்
    setCustomer({
      name: "", whatsapp: "", email: "", address: "", district: "", state: "", pincode: "",
      accountHolder: "", ifsc: "", branch: "", upi: ""
    });
    onClose();
  };

  const labelClass = "text-sm font-bold text-gray-600 mb-1 block";
  const inputClass = "w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 font-sans">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        
        <div className="bg-primary p-4 text-white font-cursive">
          <h3 className="text-xl font-bold">Register New Customer</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
          
          {/* கஸ்டமர் அடிப்படை விவரங்கள் */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Customer Name *</label>
              <input type="text" required className={inputClass} 
                value={customer.name}
                onChange={(e) => setCustomer({...customer, name: e.target.value})} />
            </div>
            <div>
              <label className={labelClass}>WhatsApp Number *</label>
              <input type="tel" required className={inputClass} 
                value={customer.whatsapp}
                onChange={(e) => setCustomer({...customer, whatsapp: e.target.value})} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" className={inputClass} 
                value={customer.email}
                onChange={(e) => setCustomer({...customer, email: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Address</label>
              <textarea className={`${inputClass} h-20`} 
                value={customer.address}
                onChange={(e) => setCustomer({...customer, address: e.target.value})} />
            </div>
            <div>
              <label className={labelClass}>District</label>
              <input type="text" className={inputClass} 
                value={customer.district}
                onChange={(e) => setCustomer({...customer, district: e.target.value})} />
            </div>
            <div>
              <label className={labelClass}>Pincode</label>
              <input type="text" className={inputClass} 
                value={customer.pincode}
                onChange={(e) => setCustomer({...customer, pincode: e.target.value})} />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* வங்கி விவரங்கள் (Bank Details Section) */}
          <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
            <h4 className="text-primary font-bold text-sm uppercase tracking-wider">Bank Details</h4>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className={labelClass}>Account Holder Name *</label>
                <input type="text" required className={inputClass} 
                  placeholder="As per bank passbook"
                  value={customer.accountHolder}
                  onChange={(e) => setCustomer({...customer, accountHolder: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>IFSC CODE *</label>
                  <input type="text" required className={`${inputClass} uppercase`} 
                    placeholder="e.g. SBIN0001234"
                    value={customer.ifsc}
                    onChange={(e) => setCustomer({...customer, ifsc: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>Branch Name *</label>
                  <input type="text" required className={inputClass} 
                    placeholder="Branch name"
                    value={customer.branch}
                    onChange={(e) => setCustomer({...customer, branch: e.target.value})} />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-50 px-2 text-gray-400 font-bold italic">And / Or</span>
                </div>
              </div>

              <div>
                <label className={labelClass}>UPI Code / ID *</label>
                <input type="text" required className={inputClass} 
                  placeholder="e.g. mobile@upi or mobile@paytm"
                  value={customer.upi}
                  onChange={(e) => setCustomer({...customer, upi: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 sticky bottom-0 bg-white">
            <button type="button" onClick={onClose} className="flex-1 p-2 border rounded-lg hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" className="flex-1 p-2 bg-primary text-white rounded-lg font-bold shadow-lg hover:opacity-90 transition">Save Customer</button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default InventoryAddCustomerModal;