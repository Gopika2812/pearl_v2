import { useState } from "react";

const InventoryAddProductModal = ({ isOpen, onClose, onSave, productGroups }) => {
  // 'quantity' நீக்கப்பட்டு ஸ்டேட் எளிமையாக்கப்பட்டுள்ளது
  const [product, setProduct] = useState({ 
    name: "", 
    groupId: "", 
    unit: "kg", 
    rate: "", 
    tax: "18" 
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...product, id: Date.now() });
    // Reset Form
    setProduct({ name: "", groupId: "", unit: "kg", rate: "", tax: "18" });
    onClose();
  };

  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inputClass = "w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary transition-all";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 font-cursive">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        
        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold">Add New Product</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-gray-700 font-sans">
          <div className="grid grid-cols-2 gap-4">
            
            {/* Product Name */}
            <div className="col-span-2">
              <label className={labelClass}>Product Name</label>
              <input 
                type="text" 
                required 
                className={`${inputClass} capitalize`}
                placeholder="Enter product name"
                value={product.name} 
                onChange={(e) => setProduct({...product, name: e.target.value})} 
              />
            </div>

            {/* Select Group */}
            <div className="col-span-2 md:col-span-1">
              <label className={labelClass}>Select Group</label>
              <select 
                required 
                className={inputClass}
                value={product.groupId} 
                onChange={(e) => setProduct({...product, groupId: e.target.value})}
              >
                <option value="">-- Select --</option>
                {productGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            {/* Unit Selection */}
            <div className="col-span-2 md:col-span-1">
              <label className={labelClass}>Unit</label>
              <select 
                className={inputClass}
                value={product.unit} 
                onChange={(e) => setProduct({...product, unit: e.target.value})}
              >
                <option value="gm">gm</option>
                <option value="kg">kg</option>
                <option value="l">l</option>
                <option value="ml">ml</option>
                <option value="Pieces">Pieces</option>
                <option value="Packets">Packets</option>
                <option value="Box">Box</option>
              </select>
            </div>

            {/* Rate per 1 Unit - உங்கள் விருப்பப்படி மாற்றப்பட்டுள்ளது */}
            <div className="col-span-2 md:col-span-1">
              <label className={labelClass}>
                Rate (₹) per {product.unit}
              </label>
              <input 
                type="number" 
                required 
                placeholder="0.00"
                className={inputClass}
                value={product.rate} 
                onChange={(e) => setProduct({...product, rate: e.target.value})} 
              />
            </div>

            {/* GST Tax */}
            <div className="col-span-2 md:col-span-1">
              <label className={labelClass}>GST Tax (%)</label>
              <input 
                type="number" 
                className={inputClass}
                value={product.tax} 
                onChange={(e) => setProduct({...product, tax: e.target.value})} 
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 p-2 border rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 p-2 bg-primary text-white rounded-lg hover:opacity-90 transition-all font-bold shadow-md"
            >
              Save Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddProductModal;