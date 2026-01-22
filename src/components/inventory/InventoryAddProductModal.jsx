import { useState } from "react";

const InventoryAddProductModal = ({ isOpen, onClose, onSave, productGroups }) => {
  const [product, setProduct] = useState({ name: "", groupId: "", rate: "", unit: "PCS", tax: "18" });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...product, id: Date.now() });
    setProduct({ name: "", groupId: "", rate: "", unit: "PCS", tax: "18" });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 font-cursive">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold">Add New Product</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-gray-700">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium">Product Name</label>
              <input type="text" required className="w-full p-2 border rounded-lg outline-primary capitalize" 
                value={product.name} onChange={(e) => setProduct({...product, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium">Select Group</label>
              <select required className="w-full p-2 border rounded-lg outline-primary"
                value={product.groupId} onChange={(e) => setProduct({...product, groupId: e.target.value})}>
                <option value="">-- Select --</option>
                {productGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Unit</label>
              <select className="w-full p-2 border rounded-lg outline-primary"
                value={product.unit} onChange={(e) => setProduct({...product, unit: e.target.value})}>
                <option value="PCS">PCS</option><option value="KG">KG</option><option value="BOX">BOX</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Rate (₹)</label>
              <input type="number" required className="w-full p-2 border rounded-lg outline-primary"
                value={product.rate} onChange={(e) => setProduct({...product, rate: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium">GST Tax (%)</label>
              <input type="number" className="w-full p-2 border rounded-lg outline-primary"
                value={product.tax} onChange={(e) => setProduct({...product, tax: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-3 mt-6 font-sans">
            <button type="button" onClick={onClose} className="flex-1 p-2 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" className="flex-1 p-2 bg-primary text-white rounded-lg hover:opacity-90">Save Product</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddProductModal;