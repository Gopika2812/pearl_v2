import { useEffect, useState } from "react";
import { FaPlus, FaSave, FaTimes, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";

const EditPurchaseOrderModal = ({ order, branchId, onClose, onSave }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [warehouse, setWarehouse] = useState(order?.warehouse || "");
  
  const [newItem, setNewItem] = useState({
    productId: "",
    name: "",
    hsn: "",
    qty: "",
    purchasePrice: "",
    sellingPrice: "",
    gst: 0,
    cgst: 0,
    sgst: 0,
    igst: false,
    discountPercent: 0,
  });

  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Initialize items from order
  useEffect(() => {
    if (order) {
      setItems(order.items || []);
      setWarehouse(order.warehouse || "");
      fetchProducts();
    }
  }, [order, branchId]);

  // Fetch available products
  const fetchProducts = async () => {
    try {
      const branch = order?.branchId || branchId;
      if (!branch) return;

      const url = `${API_BASE}/products?branchId=${branch}&limit=10000`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      
      const data = await res.json();
      setProducts(data.data || []);
    } catch (err) {
      console.error("Error fetching products:", err);
      toast.error("Failed to load products");
    }
  };

  // Calculate item total
  const calculateItemTotal = (item) => {
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(item.purchasePrice) || 0;
    const subtotal = qty * price;
    const discountPercent = parseFloat(item.discountPercent) || 0;
    const discountAmount = subtotal * (discountPercent / 100);
    const discounted = subtotal - discountAmount;
    
    const gstRate = parseFloat(item.gst) || 0;
    const taxAmount = discounted * (gstRate / 100);
    
    return discounted + taxAmount;
  };

  // Calculate grand total 
  const calculateTotals = () => {
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    items.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.purchasePrice) || 0;
      const sub = qty * price;
      const dPercent = parseFloat(item.discountPercent) || 0;
      const dAmount = sub * (dPercent / 100);
      const discounted = sub - dAmount;
      const tax = discounted * ((parseFloat(item.gst) || 0) / 100);

      subtotal += sub;
      totalTax += tax;
      totalDiscount += dAmount;
    });

    const transport = order?.transportCharge || 0;
    const grandTotal = subtotal - totalDiscount + totalTax + transport;

    return {
      subtotal: Math.round(subtotal),
      totalTax: Math.round(totalTax),
      totalDiscount: Math.round(totalDiscount),
      grandTotal: Math.round(grandTotal),
    };
  };

  // Handle quantity change
  const handleQtyChange = (index, qty) => {
    const updated = [...items];
    updated[index].qty = qty === "" ? "" : parseFloat(qty);
    updated[index].total = calculateItemTotal(updated[index]);
    setItems(updated);
  };

  // Handle price change
  const handlePriceChange = (index, price) => {
    const updated = [...items];
    updated[index].purchasePrice = price === "" ? "" : parseFloat(price);
    updated[index].total = calculateItemTotal(updated[index]);
    setItems(updated);
  };

  // Delete item
  const handleDeleteItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  // Add new item
  const handleAddItem = () => {
    if (!newItem.productId || !newItem.qty || newItem.purchasePrice === "") {
      toast.warning("Please fill all required fields");
      return;
    }

    const product = products.find((p) => p._id === newItem.productId);
    const itemToAdd = {
      ...newItem,
      name: product?.name || newItem.name,
      hsn: product?.hsn || "",
      total: calculateItemTotal(newItem),
    };

    setItems([...items, itemToAdd]);
    setNewItem({
      productId: "",
      name: "",
      hsn: "",
      qty: "",
      purchasePrice: "",
      sellingPrice: "",
      gst: 0,
      cgst: 0,
      sgst: 0,
      igst: false,
      discountPercent: 0,
    });
    setProductSearch("");
    setShowAddItemForm(false);
  };

  // Handle product selection
  const handleProductSelect = (productId) => {
    const product = products.find((p) => p._id === productId);
    if (product) {
      setNewItem({
        ...newItem,
        productId: product._id,
        name: product.name,
        hsn: product.hsn || "",
        purchasePrice: product.purchasingPrice || 0,
        sellingPrice: product.sellingPrice || 0,
        gst: product.gst || 0,
        cgst: product.igst ? 0 : (product.gst / 2),
        sgst: product.igst ? 0 : (product.gst / 2),
        igst: Boolean(product.igst),
      });
    }
  };

  // Save changes
  const handleSave = async () => {
    try {
      setLoading(true);
      const totals = calculateTotals();
      
      const payload = {
        items,
        warehouse,
        ...totals,
        transportCharge: order?.transportCharge || 0,
      };

      const res = await fetchWithAuth(`${API_BASE}/purchase-orders/${order._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update order");

      toast.success("Purchase Order updated successfully");
      onSave(); // Trigger refresh in parent
      onClose();
    } catch (err) {
      console.error("Error saving PO:", err);
      toast.error(err.message || "Failed to save changes");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const currentTotals = calculateTotals();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="sticky top-0 bg-gradient-to-r from-[#319bab] to-[#257f87] text-white p-6 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold">Edit Purchase Order</h2>
            <p className="text-blue-100 text-sm">Invoice: {order?.invoiceId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
          >
            <FaTimes size={24} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Vendor (Read Only)</label>
                <input 
                  type="text" 
                  value={order?.vendor || ""} 
                  readOnly 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 outline-none"
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Warehouse</label>
                <input 
                  type="text" 
                  value={warehouse} 
                  onChange={(e) => setWarehouse(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-[#319bab] outline-none"
                />
             </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4 font-black uppercase">📦 Purchase Items</h3>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold">
                  <tr>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-center">HSN</th>
                    <th className="px-4 py-3 text-center w-24">Qty</th>
                    <th className="px-4 py-3 text-right w-32">Purchase Price</th>
                    <th className="px-4 py-3 text-right w-24">Discount %</th>
                    <th className="px-4 py-3 text-center">Tax</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-800">{item.name}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{item.hsn}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => handleQtyChange(idx, e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-center font-bold text-[#319bab]"
                          min="1"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-gray-400">₹</span>
                          <input
                            type="number"
                            value={item.purchasePrice}
                            onChange={(e) => handlePriceChange(idx, e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-right font-bold text-[#319bab]"
                            step="0.01"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          value={item.discountPercent || 0}
                          onChange={(e) => {
                            const updated = [...items];
                            updated[idx].discountPercent = e.target.value === "" ? 0 : parseFloat(e.target.value);
                            updated[idx].total = calculateItemTotal(updated[idx]);
                            setItems(updated);
                          }}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-right font-bold text-red-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-600 font-semibold">
                        {item.gst}%
                      </td>
                      <td className="px-4 py-3 text-right font-black text-gray-800">
                        ₹{calculateItemTotal(item).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDeleteItem(idx)}
                          className="text-red-500 hover:bg-red-50 p-2 rounded transition"
                        >
                          <FaTrash size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ADD ITEM FORM */}
          <div className="pt-4">
            {!showAddItemForm ? (
              <button
                onClick={() => setShowAddItemForm(true)}
                className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition font-bold text-sm shadow-md shadow-green-200"
              >
                <FaPlus /> Add New Item
              </button>
            ) : (
              <div className="bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-green-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Product</label>
                    <input
                      type="text"
                      placeholder="Search product..."
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setShowProductDropdown(true);
                      }}
                      onFocus={() => setShowProductDropdown(true)}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-green-500 transition-all font-semibold"
                    />
                    {showProductDropdown && (
                      <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-xl">
                        {filteredProducts.map((prod) => (
                          <li
                            key={prod._id}
                            className="px-4 py-2 hover:bg-green-50 cursor-pointer text-sm font-medium border-b border-gray-50 last:border-0"
                            onMouseDown={() => {
                              handleProductSelect(prod._id);
                              setProductSearch(prod.name);
                              setShowProductDropdown(false);
                            }}
                          >
                            {prod.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Qty</label>
                    <input
                      type="number"
                      value={newItem.qty}
                      onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-green-500 font-bold text-[#319bab]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Purchase Price</label>
                    <input
                      type="number"
                      value={newItem.purchasePrice}
                      onChange={(e) => setNewItem({ ...newItem, purchasePrice: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-green-500 font-bold text-[#319bab]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Discount %</label>
                    <input
                      type="number"
                      value={newItem.discountPercent}
                      onChange={(e) => setNewItem({ ...newItem, discountPercent: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-green-500 font-bold text-red-500"
                      placeholder="0"
                    />
                  </div>
                   <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">GST %</label>
                    <input
                      type="number"
                      value={newItem.gst}
                      readOnly
                      className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none font-bold text-gray-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddItem} className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 font-bold text-sm">Confirm Item</button>
                  <button onClick={() => setShowAddItemForm(false)} className="bg-gray-300 text-white px-6 py-2 rounded-lg hover:bg-gray-400 font-bold text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* TOTALS */}
          <div className="flex justify-end pt-6 border-t border-gray-100">
            <div className="bg-gray-50 rounded-2xl p-6 w-full md:w-80 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase">
                    <span>Subtotal</span>
                    <span className="text-gray-800 text-sm">₹{currentTotals.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase">
                    <span>Tax</span>
                    <span className="text-gray-800 text-sm">₹{currentTotals.totalTax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center border-t border-gray-200 pt-3 text-sm font-black text-[#319bab] uppercase">
                    <span>Grand Total</span>
                    <span className="text-lg">₹{currentTotals.grandTotal.toLocaleString()}</span>
                </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="sticky bottom-0 bg-white p-6 flex gap-4 justify-end rounded-b-2xl border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition font-bold text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-10 py-2.5 bg-[#319bab] text-white rounded-xl hover:bg-[#257f87] transition font-bold text-sm shadow-lg shadow-[#319bab]/20 disabled:opacity-50"
          >
            <FaSave /> {loading ? "Updating..." : "Update Order"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPurchaseOrderModal;
