import { useState } from "react";
import { API_BASE } from "../../api";

const InventoryAddProductModal = ({ isOpen, onClose, productGroups }) => {
  const [product, setProduct] = useState({
    name: "",
    productGroup: "",
    perQty: "",
    units: "kg",
    totalQty: "",
    purchasingPrice: "",
    sellingPrice: "",
    hsnCode: "",
    gst: "",
  });

  if (!isOpen) return null;

  const margin = (product.sellingPrice || 0) - (product.purchasingPrice || 0);

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/products/bulk-upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Bulk upload failed");
      }

      alert(
        `Uploaded: ${data.insertedCount}\nSkipped: ${data.skippedCount}`
      );

      console.log("Bulk upload response:", data);
      onClose();
    } catch (err) {
      console.error("Bulk upload error:", err);
      alert(err.message || "Bulk upload failed");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!product.name || !product.productGroup || !product.perQty || !product.units || !product.hsnCode) {
      alert("Please fill in all required fields");
      return;
    }

    // Validate prices
    if (Number(product.sellingPrice) < Number(product.purchasingPrice)) {
      alert("Selling price cannot be less than purchasing price");
      return;
    }

    const payload = {
      name: product.name,
      productGroup: product.productGroup,
      perQty: Number(product.perQty),
      units: product.units,
      totalQty: Number(product.totalQty || 0),
      purchasingPrice: Number(product.purchasingPrice || 0),
      sellingPrice: Number(product.sellingPrice || 0),
      hsnCode: product.hsnCode,
      gst: Number(product.gst || 0),
    };

    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Save failed");

      alert("Product saved successfully!");
      console.log("Saved:", data);

      setProduct({
        name: "",
        productGroup: "",
        perQty: "",
        units: "kg",
        totalQty: "",
        purchasingPrice: "",
        sellingPrice: "",
        hsnCode: "",
        gst: "",
      });

      onClose();
    } catch (error) {
      console.error("Product save error:", error.message);
      alert("Product save failed: " + error.message);
    }
  };



  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inputClass = "w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary transition-all";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">

        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold">Add New Product</h3>
        </div>

        <input
          type="file"
          accept=".xlsx,.xls"
          hidden
          id="productBulkUpload"
          onChange={handleBulkUpload}
        />

        <button
          type="button"
          onClick={() => document.getElementById("productBulkUpload").click()}
          className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition"
        >
          📤 Bulk Upload Products (Excel)
        </button>


        <form onSubmit={handleSubmit} className="p-6 text-gray-700">
          {/* Product Name - Full Width */}
          <div className="mb-4">
            <label className={labelClass}>Product Name *</label>
            <input
              type="text"
              required
              className={`${inputClass} capitalize`}
              placeholder="Enter product name"
              value={product.name}
              onChange={(e) => setProduct({ ...product, name: e.target.value })}
            />
          </div>

          {/* Product Group - Full Width */}
          <div className="mb-4">
            <label className={labelClass}>Product Group *</label>
            <select
              required
              className={inputClass}
              value={product.productGroup}
              onChange={(e) => setProduct({ ...product, productGroup: e.target.value })}
            >
              <option value="">-- Select --</option>
              {productGroups.map(g => (
                <option key={g._id} value={g._id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* 2-Column Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Per Qty */}
            <div>
              <label className={labelClass}>Per Qty (250) *</label>
              <input
                type="number"
                required
                className={inputClass}
                placeholder="e.g., 250"
                value={product.perQty}
                onChange={(e) => setProduct({ ...product, perQty: e.target.value })}
              />
            </div>

            {/* Units */}
            <div>
              <label className={labelClass}>Units (kg) *</label>
              <select
                required
                className={inputClass}
                value={product.units}
                onChange={(e) => setProduct({ ...product, units: e.target.value })}
              >
                <option value="kg">kg</option>
                <option value="gm">gm</option>
                <option value="ltr">ltr</option>
                <option value="ml">ml</option>
                <option value="pcs">pcs</option>
                <option value="pckts">pckts</option>
                <option value="units">units</option>
              </select>
            </div>
          </div>

          {/* 2-Column Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Total Qty */}
            <div>
              <label className={labelClass}>Total Qty (50pkts)</label>
              <input
                type="number"
                className={inputClass}
                placeholder="e.g., 50"
                value={product.totalQty}
                onChange={(e) => setProduct({ ...product, totalQty: e.target.value })}
              />
            </div>

            {/* Purchasing Price */}
            <div>
              <label className={labelClass}>Purchasing Price</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                placeholder="Enter purchasing price"
                value={product.purchasingPrice}
                onChange={(e) => setProduct({ ...product, purchasingPrice: e.target.value })}
              />
            </div>
          </div>

          {/* 2-Column Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Selling Price */}
            <div>
              <label className={labelClass}>Selling Price</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                placeholder="Enter selling price"
                value={product.sellingPrice}
                onChange={(e) => setProduct({ ...product, sellingPrice: e.target.value })}
              />
            </div>

            {/* HSN Code */}
            <div>
              <label className={labelClass}>HSN Code *</label>
              <input
                type="text"
                required
                className={inputClass}
                placeholder="Enter HSN code"
                value={product.hsnCode}
                onChange={(e) => setProduct({ ...product, hsnCode: e.target.value })}
              />
            </div>
          </div>

          {/* 2-Column Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Margin (Auto-calculated) */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <label className={labelClass}>Margin (Auto-Calculated)</label>
              <div className="text-2xl font-bold text-blue-600">
                {margin.toFixed(2)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Selling - Purchasing</p>
            </div>

            {/* GST */}
            <div>
              <label className={labelClass}>GST (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="28"
                className={inputClass}
                placeholder="Enter GST %"
                value={product.gst}
                onChange={(e) => setProduct({ ...product, gst: e.target.value })}
              />
            </div>
          </div>

          {/* Action Buttons - Full Width */}
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
