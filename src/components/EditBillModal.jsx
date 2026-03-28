import { useEffect, useState } from "react";
import { FaPlus, FaSave, FaTimes, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

const EditBillModal = ({ order, branchId, onClose, onSave }) => {
  const [items, setItems] = useState([]);
  const [sampleItems, setSampleItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [newItem, setNewItem] = useState({
    productId: "",
    name: "",
    hsn: "",
    qty: "",
    sellingPrice: 0,
    gst: 0,
    cgst: 0,
    sgst: 0,
    igst: false,
    discountAmount: 0,
  });

  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Initialize items from order
  useEffect(() => {
    if (order) {
      setItems(order.items || []);
      setSampleItems(order.sampleItems || []);
      fetchProducts();
    }
  }, [order]);

  // Fetch available products
  const fetchProducts = async () => {
    try {
      // Get branchId from order or from prop
      const branch = order?.branchId || branchId;
      
      if (!branch) {
        console.warn("⚠️ branchId not found in order or props");
        toast.error("Unable to load products - branch information missing");
        return;
      }

      const url = `${API_BASE}/products?branchId=${branch}&limit=10000`;
      console.log(`📦 Fetching products from: ${url}`);
      
      const res = await fetch(url);
      
      if (!res.ok) {
        const errorData = await res.text();
        console.error(`❌ Product fetch failed with status ${res.status}:`, errorData);
        throw new Error(`Server error: ${res.status}`);
      }
      
      const data = await res.json();
      const productList = data.data || data.products || (Array.isArray(data) ? data : []);
      console.log(`✅ Fetched ${productList.length} products`);
      setProducts(productList);
    } catch (err) {
      console.error("❌ Error fetching products:", err);
      toast.error("Failed to load products. Check console for details.");
      setProducts([]);
    }
  };

  // Calculate item total
  const calculateItemTotal = (item) => {
    const subtotal = item.qty * item.sellingPrice;
    const discounted = subtotal - (item.discountAmount || 0);
    const taxAmount = item.igst
      ? discounted * (item.gst || 0) / 100
      : discounted * ((item.cgst || 0) + (item.sgst || 0)) / 100;
    return discounted + taxAmount;
  };

  // Calculate grand total accounting for expenses, transport and common discount
  const calculateGrandTotal = () => {
    const itemsTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    const transport = order?.transportCharge || 0;
    const extra = order?.extraExpenseAmount || 0;
    const commDiscount = order?.commonDiscount || 0;
    return itemsTotal + transport + extra - commDiscount;
  };

  // Handle quantity change
  const handleQtyChange = (index, qty) => {
    const updated = [...items];
    updated[index].qty = Math.max(1, parseInt(qty) || 1);
    updated[index].total = calculateItemTotal(updated[index]);
    setItems(updated);
  };

  // Handle price change
  const handlePriceChange = (index, price) => {
    const updated = [...items];
    updated[index].sellingPrice = parseFloat(price) || 0;
    updated[index].total = calculateItemTotal(updated[index]);
    setItems(updated);
  };

  // Handle discount change
  const handleDiscountChange = (index, discount) => {
    const updated = [...items];
    updated[index].discountAmount = parseFloat(discount) || 0;
    updated[index].total = calculateItemTotal(updated[index]);
    setItems(updated);
  };

  // Delete item
  const handleDeleteItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    toast.info("Item removed from bill");
  };

  // Delete sample item
  const handleDeleteSampleItem = (index) => {
    const updated = sampleItems.filter((_, i) => i !== index);
    setSampleItems(updated);
    toast.info("Sample item removed");
  };

  // Add new item
  const handleAddItem = () => {
    if (!newItem.productId || newItem.qty < 1 || newItem.sellingPrice <= 0) {
      toast.warning("Please fill all required fields");
      return;
    }

    const product = products.find((p) => p._id === newItem.productId);
    if (!product) {
      toast.error("Product not found");
      return;
    }

    const itemToAdd = {
      ...newItem,
      productId: newItem.productId,
      name: product.name || newItem.name,
      hsn: product.hsn || product.hsnCode || newItem.hsn,
      total: calculateItemTotal(newItem),
    };

    setItems([...items, itemToAdd]);
    setNewItem({
      productId: "",
      name: "",
      hsn: "",
      qty: "",
      sellingPrice: 0,
      gst: 0,
      cgst: 0,
      sgst: 0,
      igst: false,
      discountAmount: 0,
    });
    setProductSearch("");
    setShowAddItemForm(false);
    toast.success("Item added to bill");
  };

  // Handle product selection for new item
  const handleProductSelect = (productId) => {
    const product = products.find((p) => p._id === productId);
    console.log("🔍 Selected product for new item:", product);
    
    if (product) {
      const gstRate = product.gst || 0;
      const isIgst = Boolean(product.igst || false);
      const price = product.sellingPrice || product.mrp || 0;
      
      setNewItem({
        ...newItem,
        productId: product._id,
        name: product.name,
        hsn: product.hsn || product.hsnCode || "",
        sellingPrice: price,
        gst: gstRate,
        cgst: isIgst ? 0 : gstRate / 2,
        sgst: isIgst ? 0 : gstRate / 2,
        igst: isIgst,
      });
      console.log("✅ New item state updated with price:", price);
    }
  };

  // Filter products based on search term
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes((productSearch || "").toLowerCase())
  );

  // Save changes
  const handleSave = async () => {
    try {
      setLoading(true);
      
      const newItemsTotal = calculateGrandTotal();
      const updatedOrder = {
        ...order,
        items,
        sampleItems,
        subtotal: items.reduce((sum, item) => sum + (item.qty * item.sellingPrice), 0),
        totalTax: items.reduce((sum, item) => {
          const sub = item.qty * item.sellingPrice;
          const discounted = sub - (item.discountAmount || 0);
          const tax = item.igst ? discounted * (item.gst || 0) / 100 : discounted * ((item.cgst || 0) + (item.sgst || 0)) / 100;
          return sum + tax;
        }, 0),
        totalDiscount: items.reduce((sum, item) => sum + (item.discountAmount || 0), 0),
        commonDiscount: order?.commonDiscount || 0,
        grandTotal: Math.round(newItemsTotal),
      };

      // Call onSave callback with updated order
      await onSave(updatedOrder);
      toast.success("Bill updated successfully");
      onClose();
    } catch (err) {
      console.error("Error saving bill:", err);
      toast.error("Failed to save bill");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="sticky top-0 bg-gradient-to-r from-[#319bab] to-[#257f87] text-white p-6 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold">Edit Bill</h2>
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
          {/* REGULAR ITEMS */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4">📦 Order Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-gray-700">
                      Product
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-gray-700">
                      HSN
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-gray-700">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">
                      Discount
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-gray-700">
                      Tax
                    </th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">
                      Total
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-gray-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold">{item.name}</td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {item.hsn}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => handleQtyChange(idx, e.target.value)}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-center focus:ring-2 focus:ring-[#319bab] outline-none"
                          min="1"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">₹</span>
                          <input
                            type="number"
                            value={item.sellingPrice}
                            onChange={(e) => handlePriceChange(idx, e.target.value)}
                            className="w-24 border border-gray-300 rounded px-2 py-1 text-right focus:ring-2 focus:ring-[#319bab] outline-none"
                            step="0.01"
                            min="0"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">₹</span>
                          <input
                            type="number"
                            value={item.discountAmount || 0}
                            onChange={(e) => handleDiscountChange(idx, e.target.value)}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-right focus:ring-2 focus:ring-[#319bab] outline-none"
                            step="0.01"
                            min="0"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {item.igst ? (
                          <span>IGST {item.gst}%</span>
                        ) : (
                          <span>
                            CGST {item.cgst}% +<br />
                            SGST {item.sgst}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#319bab]">
                        ₹{calculateItemTotal(item).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDeleteItem(idx)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition"
                          title="Delete item"
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

          {/* SAMPLE ITEMS */}
          {sampleItems.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4 text-yellow-700">
                🎁 Sample Items
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-yellow-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-gray-700">
                        Product
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-gray-700">
                        HSN
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-gray-700">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right font-bold text-gray-700">
                        Rate
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-gray-700">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sampleItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-yellow-50 bg-yellow-50">
                        <td className="px-4 py-3 font-semibold">{item.name}</td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {item.hsn}
                        </td>
                        <td className="px-4 py-3 text-center">{item.qty}</td>
                        <td className="px-4 py-3 text-right">
                          ₹{item.sellingPrice?.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteSampleItem(idx)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition"
                            title="Delete sample item"
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
          )}

          {/* ADD NEW ITEM FORM */}
          <div className="border-t pt-6">
            {!showAddItemForm ? (
              <button
                onClick={() => setShowAddItemForm(true)}
                className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition font-semibold"
              >
                <FaPlus /> Add Item
              </button>
            ) : (
              <div className="bg-green-50 p-6 rounded-lg border-2 border-green-200">
                <h4 className="font-bold text-gray-800 mb-4">Add New Item</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">
                       Product *
                     </label>
                     <div className="relative">
                       <input
                         type="text"
                         placeholder="Search product..."
                         value={productSearch}
                         onChange={(e) => {
                           setProductSearch(e.target.value);
                           setShowProductDropdown(true);
                           if (e.target.value === "") {
                             setNewItem({ ...newItem, productId: "", name: "" }); // Reset if cleared
                           }
                         }}
                         onFocus={() => setShowProductDropdown(true)}
                         onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                         className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                       />
                       {showProductDropdown && (
                         <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded mt-1 max-h-48 overflow-y-auto shadow-lg">
                           {filteredProducts.length > 0 ? (
                             filteredProducts.map((prod) => (
                               <li
                                 key={prod._id}
                                 className="px-3 py-2 hover:bg-green-50 cursor-pointer text-sm"
                                 onMouseDown={(e) => {
                                   e.preventDefault(); // Prevent blur
                                   handleProductSelect(prod._id);
                                   setProductSearch(prod.name);
                                   setShowProductDropdown(false);
                                 }}
                               >
                                 {prod.name}
                               </li>
                             ))
                           ) : (
                             <li className="px-3 py-2 text-gray-500 text-sm">No products found</li>
                           )}
                         </ul>
                       )}
                     </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">
                      Qty *
                    </label>
                    <input
                      type="number"
                      value={newItem.qty}
                      onChange={(e) =>
                        setNewItem({ 
                          ...newItem, 
                          qty: e.target.value === "" ? "" : parseInt(e.target.value)
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">
                      Rate *
                    </label>
                    <input
                      type="number"
                      value={newItem.sellingPrice}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          sellingPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">
                      Discount
                    </label>
                    <input
                      type="number"
                      value={newItem.discountAmount}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          discountAmount: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddItem}
                    className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition font-semibold"
                  >
                    Add Item
                  </button>
                  <button
                    onClick={() => setShowAddItemForm(false)}
                    className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* TOTALS */}
          <div className="border-t pt-6 flex justify-end">
            <div className="bg-blue-50 rounded-lg p-6 w-full md:w-96">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold">
                    ₹
                    {items
                      .reduce((sum, item) => sum + item.qty * item.sellingPrice, 0)
                      .toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Discount:</span>
                  <span className="text-red-500 font-semibold">
                    -₹
                    {items
                      .reduce((sum, item) => sum + (item.discountAmount || 0), 0)
                      .toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                  </span>
                </div>
                {order?.commonDiscount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Special Discount:</span>
                    <span className="text-red-500 font-semibold">
                      -₹{order.commonDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {order?.transportCharge > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Transport:</span>
                    <span className="text-gray-800 font-semibold">
                      ₹{order.transportCharge.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {order?.extraExpenseAmount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Extra Charges:</span>
                    <span className="text-gray-800 font-semibold">
                      ₹{order.extraExpenseAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between items-center text-lg font-bold">
                  <span className="text-[#319bab]">Grand Total:</span>
                  <span className="text-[#319bab]">
                    ₹
                    {calculateGrandTotal().toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="sticky bottom-0 bg-gray-100 p-6 flex gap-4 justify-end rounded-b-2xl border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-[#319bab] text-white rounded-lg hover:bg-[#257f87] transition font-semibold disabled:opacity-50"
          >
            <FaSave /> {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditBillModal;
