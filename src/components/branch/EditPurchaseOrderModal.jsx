import { useEffect, useState } from "react";
import { FaPlus, FaSave, FaTimes, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import SearchableSelect from "../common/SearchableSelect";

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

  const [invoiceId, setInvoiceId] = useState("");
  const [vendors, setVendors] = useState([]);
  const [vendorSearch, setVendorSearch] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);

  const [customDiscount, setCustomDiscount] = useState("");
  const [customDiscountType, setCustomDiscountType] = useState("amount");

  const [voucherTypes, setVoucherTypes] = useState([]);
  const [selectedVoucherType, setSelectedVoucherType] = useState("");

  // Initialize items from order
  useEffect(() => {
    if (order) {
      setInvoiceId(order.invoiceId || "");
      setSelectedVoucherType(order.voucherType || "");
      setItems(order.items || []);
      setWarehouse(order.warehouse || "");
      setSelectedVendor(order.vendor || "");
      setVendorSearch(order.vendor || "");
      setCustomDiscount(order.totalDiscount !== undefined && order.totalDiscount !== null ? String(order.totalDiscount) : "");
      setCustomDiscountType("amount");
      fetchProducts();
      fetchVendors();
      fetchVoucherTypes();
    }
  }, [order, branchId]);

  const fetchVoucherTypes = async () => {
    try {
      const branch = order?.branchId || branchId;
      if (!branch) return;
      const res = await fetchWithAuth(`${API_BASE}/voucher-types?branchId=${branch}`);
      if (res.ok) {
        const data = await res.json();
        const poVouchers = (data.data || []).filter(v => v.orderType === "PO");
        setVoucherTypes(poVouchers);
      }
    } catch (err) {
      console.error("Error fetching voucher types:", err);
    }
  };

  const handleVoucherTypeChange = async (e) => {
    const vType = e.target.value;
    setSelectedVoucherType(vType);
    if (!vType) return;
    
    try {
      const branch = order?.branchId || branchId;
      const res = await fetchWithAuth(`${API_BASE}/purchase-orders/next-invoice/${encodeURIComponent(vType)}?branchId=${branch}`);
      if (res.ok) {
        const data = await res.json();
        if (data.nextInvoiceId) {
          setInvoiceId(data.nextInvoiceId);
        }
      }
    } catch (err) {
      console.error("Error fetching next invoice id:", err);
    }
  };

  const fetchVendors = async () => {
    try {
      const branch = order?.branchId || branchId;
      if (!branch) return;

      const url = `${API_BASE}/vendors?branchId=${branch}&limit=1000`;
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      
      const data = await res.json();
      setVendors(data.data || []);
    } catch (err) {
      console.error("Error fetching vendors:", err);
    }
  };

  // Fetch available products
  const fetchProducts = async () => {
    try {
      const branch = order?.branchId || branchId;
      if (!branch) return;

      const url = `${API_BASE}/products?branchId=${branch}&limit=10000`;
      const res = await fetchWithAuth(url);
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
    let calculatedDiscount = 0;

    items.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.purchasePrice) || 0;
      const sub = qty * price;
      const dPercent = parseFloat(item.discountPercent) || 0;
      const dAmount = sub * (dPercent / 100);

      subtotal += sub;
      calculatedDiscount += dAmount;
    });

    let totalDiscount = calculatedDiscount;
    if (customDiscount !== "") {
      const val = parseFloat(customDiscount) || 0;
      if (customDiscountType === "percentage") {
        totalDiscount = (subtotal * val) / 100;
      } else {
        totalDiscount = val;
      }
    }

    const discountRatio = subtotal > 0 ? (totalDiscount / subtotal) : 0;
    const isCustomDiscountApplied = customDiscount !== "";

    let totalTax = 0;
    items.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.purchasePrice) || 0;
      const rowPrice = qty * price;
      const dPercent = parseFloat(item.discountPercent) || 0;
      const dAmount = rowPrice * (dPercent / 100);

      const netTaxable = isCustomDiscountApplied ? rowPrice * (1 - discountRatio) : (rowPrice - dAmount);
      const gstRate = parseFloat(item.gst) || 0;
      const tax = netTaxable * (gstRate / 100);
      totalTax += tax;
    });

    const extra = order?.extraExpenseAmount || 0;
    const grandTotal = subtotal - totalDiscount + totalTax;

    return {
      subtotal: Math.round(subtotal),
      totalTax: Math.min(Math.round(totalTax), grandTotal), // Safety cap
      totalDiscount: Math.round(totalDiscount),
      extraExpenseAmount: Math.round(extra),
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
    const val = price === "" ? "" : parseFloat(price);
    updated[index].purchasePrice = val;
    
    // ⚡ AUTO-RECALCULATE SELLING PRICE (using margin from products list)
    const product = products.find(p => p._id === updated[index].productId);
    if (product && product.marginPercentage > 0 && val > 0) {
      updated[index].sellingPrice = Math.round((val + (val * product.marginPercentage / 100)) * 100) / 100;
    }

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
        invoiceId,
        voucherType: selectedVoucherType,
        items,
        warehouse,
        vendor: selectedVendor,
        ...totals,
        totalDiscount: customDiscount ? Number(customDiscount) : 0,
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="sticky top-0 bg-gradient-to-r from-[#319bab] to-[#257f87] text-white p-6 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold">Edit Purchase Order</h2>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-blue-100 text-sm">Voucher:</span>
                <select
                  value={selectedVoucherType}
                  onChange={handleVoucherTypeChange}
                  className="bg-white bg-opacity-20 text-white border border-blue-300 border-opacity-30 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <option value="" className="text-black">Select Voucher</option>
                  {voucherTypes.map((v) => (
                    <option key={v._id} value={v.name} className="text-black">{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-100 text-sm">Invoice ID:</span>
                <input
                  type="text"
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                  className="bg-white bg-opacity-20 text-white placeholder-blue-200 border border-blue-300 border-opacity-30 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-white min-w-[150px]"
                />
              </div>
            </div>
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
             <div className="relative">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Vendor</label>
                <input 
                  type="text" 
                  value={vendorSearch} 
                  onChange={(e) => {
                    setVendorSearch(e.target.value);
                    setShowVendorDropdown(true);
                  }}
                  onFocus={() => setShowVendorDropdown(true)}
                  onBlur={() => setTimeout(() => setShowVendorDropdown(false), 200)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-[#319bab] outline-none font-semibold text-gray-800"
                  placeholder="Type to search vendor..."
                />
                {showVendorDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-[99] max-h-48 overflow-y-auto w-full">
                    {vendors
                      .filter(v => v.name.toLowerCase().includes(vendorSearch.toLowerCase()))
                      .map((v) => (
                        <div
                          key={v._id}
                          onMouseDown={() => {
                            setSelectedVendor(v.name);
                            setVendorSearch(v.name);
                            setShowVendorDropdown(false);
                          }}
                          className="px-3 py-2 hover:bg-[#319bab]/10 cursor-pointer border-b text-sm font-semibold text-gray-800"
                        >
                          {v.name}
                        </div>
                      ))}
                  </div>
                )}
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
                      <td className="px-4 py-3 font-semibold text-gray-800 min-w-[250px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <SearchableSelect
                              options={products.map(p => ({
                                label: `${p.name} ${p.hsn ? `(HSN: ${p.hsn})` : ''}`,
                                value: p._id,
                                product: p
                              }))}
                              value={item.productId || ""}
                              onChange={(val) => {
                                const selectedProd = products.find(p => String(p._id) === String(val));
                                if (selectedProd) {
                              const updated = [...items];
                              updated[idx] = {
                                ...updated[idx],
                                productId: selectedProd._id,
                                // name: selectedProd.name, // 🚨 Do NOT overwrite! We want to keep the original PO item name so the backend can rename the local product to this.
                                hsn: selectedProd.hsn || updated[idx].hsn,
                                gst: selectedProd.taxRate || selectedProd.gst || updated[idx].gst,
                                unit: selectedProd.unit || updated[idx].unit,
                                igst: Boolean(selectedProd.igst),
                                cgst: selectedProd.igst ? 0 : ((selectedProd.taxRate || selectedProd.gst || updated[idx].gst) / 2),
                                sgst: selectedProd.igst ? 0 : ((selectedProd.taxRate || selectedProd.gst || updated[idx].gst) / 2),
                              };
                              updated[idx].total = calculateItemTotal(updated[idx]);
                              setItems(updated);
                            }
                          }}
                              placeholder={item.name || "Search Product"}
                            />
                          </div>
                          {item.productId && (
                            <span className="text-green-500 text-lg flex-shrink-0" title="Product Mapped Successfully">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </td>
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
                        <div className="relative group">
                          {/* 🚩 Price Intelligence Tooltip/Badge */}
                          {(() => {
                            const product = products.find(p => p._id === item.productId);
                            if (!product) return null;
                            const prev = product.purchasingPrice || 0;
                            const curr = Number(item.purchasePrice) || 0;
                            if (prev === 0 || curr === prev) return null;
                            return (
                              <div className={`absolute -top-6 right-0 text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-sm whitespace-nowrap z-10 ${
                                curr > prev ? "bg-red-500 text-white" : "bg-green-500 text-white"
                              }`}>
                                {curr > prev ? `📈 Increase (+₹${(curr-prev).toFixed(0)})` : `📉 Decrease (-₹${(prev-curr).toFixed(0)})`}
                              </div>
                            );
                          })()}

                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-gray-400">₹</span>
                            <input
                              type="number"
                              value={item.purchasePrice}
                              onChange={(e) => handlePriceChange(idx, e.target.value)}
                              className={`w-full border rounded px-2 py-1 text-right font-bold transition-all ${
                                (() => {
                                  const prod = products.find(p => p._id === item.productId);
                                  const p = prod?.purchasingPrice || 0;
                                  const c = Number(item.purchasePrice) || 0;
                                  if (p > 0 && c > p) return "border-red-300 bg-red-50 text-red-700";
                                  if (p > 0 && c < p) return "border-green-300 bg-green-50 text-green-700";
                                  return "border-gray-200 text-[#319bab]";
                                })()
                              }`}
                              step="0.01"
                            />
                          </div>
                          {(() => {
                            const product = products.find(p => p._id === item.productId);
                            if (product && product.purchasingPrice) {
                              return <div className="text-[9px] text-gray-400 mt-0.5">Prev: ₹{product.purchasingPrice}</div>;
                            }
                          })()}
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
                        <select
                          value={item.igst ? 'igst' : 'gst'}
                          onChange={(e) => {
                            const isIgst = e.target.value === 'igst';
                            const updated = [...items];
                            updated[idx].igst = isIgst;
                            updated[idx].cgst = isIgst ? 0 : (item.gst / 2);
                            updated[idx].sgst = isIgst ? 0 : (item.gst / 2);
                            setItems(updated);
                          }}
                          className="border border-gray-200 rounded px-1 py-1 text-center font-bold outline-none focus:border-[#319bab] bg-white text-[10px]"
                        >
                          <option value="gst">GST {item.gst}%</option>
                          <option value="igst">IGST {item.gst}%</option>
                        </select>
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
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase">Purchase Price</label>
                      {(() => {
                        const product = products.find(p => p._id === newItem.productId);
                        if (product) return <span className="text-[9px] text-gray-400">Prev: ₹{product.purchasingPrice}</span>;
                      })()}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={newItem.purchasePrice}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                          const product = products.find(p => p._id === newItem.productId);
                          let newS = newItem.sellingPrice;
                          if (product && product.marginPercentage > 0 && val > 0) {
                            newS = Math.round((val + (val * product.marginPercentage / 100)) * 100) / 100;
                          }
                          setNewItem({ ...newItem, purchasePrice: val, sellingPrice: newS });
                        }}
                        className={`w-full border rounded-lg px-4 py-2 text-sm outline-none transition-all font-bold ${
                          (() => {
                            const prod = products.find(p => p._id === newItem.productId);
                            const p = prod?.purchasingPrice || 0;
                            const c = Number(newItem.purchasePrice) || 0;
                            if (p > 0 && c > p) return "border-red-300 bg-red-50 text-red-700";
                            if (p > 0 && c < p) return "border-green-300 bg-green-50 text-green-700";
                            return "border-gray-200 text-[#319bab]";
                          })()
                        }`}
                      />
                      {(() => {
                        const prod = products.find(p => p._id === newItem.productId);
                        const p = prod?.purchasingPrice || 0;
                        const c = Number(newItem.purchasePrice) || 0;
                        if (p > 0 && c !== p) {
                          return (
                            <div className={`absolute -top-6 right-0 text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-sm ${
                              c > p ? "bg-red-500 text-white" : "bg-green-500 text-white"
                            }`}>
                              {c > p ? "📈 Rate Increased" : "📉 Rate Decreased"}
                            </div>
                          );
                        }
                      })()}
                    </div>
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
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">GST Type & %</label>
                    <div className="flex gap-1 border border-gray-200 rounded-lg p-1 bg-white focus-within:border-green-500 transition-all">
                      <select
                        value={newItem.igst ? 'igst' : 'gst'}
                        onChange={(e) => {
                          const isIgst = e.target.value === 'igst';
                          setNewItem({
                            ...newItem,
                            igst: isIgst,
                            cgst: isIgst ? 0 : (newItem.gst / 2),
                            sgst: isIgst ? 0 : (newItem.gst / 2)
                          });
                        }}
                        className="w-full bg-transparent text-sm outline-none font-bold text-gray-700"
                        disabled={!newItem.productId}
                      >
                        <option value="gst">GST</option>
                        <option value="igst">IGST</option>
                      </select>
                      <input
                        type="number"
                        value={newItem.gst}
                        readOnly
                        className="w-12 bg-gray-100 rounded px-1 py-1 text-sm outline-none font-bold text-gray-500 text-center"
                      />
                    </div>
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
                {(() => {
                  const calculatedDiscount = items.reduce((sum, item) => {
                    const qty = parseFloat(item.qty) || 0;
                    const price = parseFloat(item.purchasePrice) || 0;
                    const dPercent = parseFloat(item.discountPercent) || 0;
                    return sum + (qty * price * (dPercent / 100));
                  }, 0);

                  return (
                    <div className="flex justify-between items-center text-xs font-bold text-red-500 uppercase">
                      <span>Total Discount</span>
                      <div className="flex items-center gap-1 bg-white p-1 rounded border border-gray-200">
                        <div className="flex rounded bg-gray-100 p-0.5 border border-gray-200">
                          <button
                            type="button"
                            onClick={() => {
                              setCustomDiscountType("amount");
                              if (customDiscount !== "") {
                                const val = parseFloat(customDiscount) || 0;
                                const converted = ((currentTotals.subtotal * val) / 100).toFixed(2);
                                setCustomDiscount(converted);
                              }
                            }}
                            className={`px-1.5 py-0.5 text-[8px] font-black rounded transition-all ${
                              customDiscountType === "amount" ? "bg-[#319bab] text-white shadow-sm" : "text-gray-500 hover:bg-gray-200"
                            }`}
                          >
                            ₹
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomDiscountType("percentage");
                              if (customDiscount !== "" && currentTotals.subtotal > 0) {
                                const val = parseFloat(customDiscount) || 0;
                                const converted = ((val / currentTotals.subtotal) * 100).toFixed(2);
                                setCustomDiscount(converted);
                              }
                            }}
                            className={`px-1.5 py-0.5 text-[8px] font-black rounded transition-all ${
                              customDiscountType === "percentage" ? "bg-[#319bab] text-white shadow-sm" : "text-gray-500 hover:bg-gray-200"
                            }`}
                          >
                            %
                          </button>
                        </div>
                        <input
                          type="number"
                          step="any"
                          value={customDiscount}
                          onChange={(e) => setCustomDiscount(e.target.value)}
                          placeholder={
                            customDiscountType === "amount"
                              ? calculatedDiscount.toFixed(2)
                              : ((calculatedDiscount / (currentTotals.subtotal || 1)) * 100).toFixed(2)
                          }
                          className="w-20 px-1 py-0.5 text-right font-bold text-xs text-red-600 focus:outline-none focus:ring-1 focus:ring-[#319bab] placeholder-red-300"
                        />
                      </div>
                    </div>
                  );
                })()}
                {customDiscount !== "" && (
                  <div className="text-[9px] text-right text-gray-400 -mt-2">
                    {customDiscountType === "percentage" ? (
                      <span>Equivalent to -₹{((currentTotals.subtotal * (parseFloat(customDiscount) || 0)) / 100).toFixed(2)}</span>
                    ) : (
                      currentTotals.subtotal > 0 && (
                        <span>Equivalent to -{(((parseFloat(customDiscount) || 0) / currentTotals.subtotal) * 100).toFixed(2)}%</span>
                      )
                    )}
                  </div>
                )}
                
                <div className="flex justify-between items-center text-xs font-bold text-emerald-600 uppercase border-t border-gray-100 pt-2">
                    <span>Discounted Value</span>
                    <span className="text-emerald-800 text-sm font-semibold">₹{(currentTotals.subtotal - currentTotals.totalDiscount).toLocaleString()}</span>
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
