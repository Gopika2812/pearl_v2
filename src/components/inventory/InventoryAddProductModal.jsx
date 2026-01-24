import { useState } from "react";

const InventoryAddProductModal = ({ isOpen, onClose, onSave, productGroups }) => {
  const [product, setProduct] = useState({ 
    name: "", 
    groupId: "", 
    unitValue: "250",
    unitType: "gm",
    rate: "", 
    tax: "18",
    hsncode: "",
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    onSave({ 
      ...product, 
      id: Date.now(),
      unit: `${product.unitValue} ${product.unitType}`
    });

    // Reset Form
    setProduct({ 
      name: "", 
      groupId: "", 
      unitValue: "250",
      unitType: "gm",
      rate: "", 
      tax: "18",
      hsncode: ""
    });

    onClose();
  };

  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inputClass = "w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary transition-all";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        
        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold">Add New Product</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-gray-700">
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
                onChange={(e) => setProduct({ ...product, name: e.target.value })} 
              />
            </div>

            {/* Select Group */}
            <div className="col-span-2 md:col-span-1">
              <label className={labelClass}>Select Group</label>
              <select 
                required 
                className={inputClass}
                value={product.groupId} 
                onChange={(e) => setProduct({ ...product, groupId: e.target.value })}
              >
                <option value="">-- Select --</option>
                {productGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Unit Format: [ 250 ] [ gm / kg / ltr ... ] */}
            <div className="col-span-2 md:col-span-1">
              <label className={labelClass}>Unit Format</label>
              <div className="flex gap-2">
                <input 
                  type="number"
                  className={inputClass}
                  placeholder="250"
                  value={product.unitValue}
                  onChange={(e) => setProduct({ ...product, unitValue: e.target.value })}
                />

                <select 
                  className={inputClass}
                  value={product.unitType} 
                  onChange={(e) => setProduct({ ...product, unitType: e.target.value })}
                >
                  <option value="units">units</option>
                  <option value="pckts">pckts</option>
                  <option value="ltr">ltr</option>
                  <option value="ml">ml</option>
                  <option value="grm">grm</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>

            {/* Rate per Unit */}
            <div className="col-span-2 md:col-span-1">
              <label className={labelClass}>
                Rate (₹) per {product.unitType}
              </label>
              <input 
                type="number" 
                required 
                placeholder="0.00"
                className={inputClass}
                value={product.rate} 
                onChange={(e) => setProduct({ ...product, rate: e.target.value })} 
              />
            </div>

            {/* GST Tax */}
            <div className="col-span-2 md:col-span-1">
              <label className={labelClass}>GST Tax (%)</label>
              <input 
                type="number" 
                className={inputClass}
                value={product.tax} 
                onChange={(e) => setProduct({ ...product, tax: e.target.value })} 
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className={labelClass}>HSN Code</label>
              <input 
                type="number" 
                className={inputClass}
                value={product.hsncode} 
                onChange={(e) => setProduct({ ...product, tax: e.target.value })} 
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
