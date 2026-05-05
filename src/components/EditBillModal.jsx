import { useEffect, useState } from "react";
import { FaPlus, FaSave, FaTimes, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../api";
import { useInventory } from "../context/InventoryContext";

const EditBillModal = ({ order, branchId, onClose, onSave }) => {
  const { searchProducts, searchCustomers } = useInventory();
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
    sellingPrice: "",
    gst: 0,
    cgst: 0,
    sgst: 0,
    igst: false,
    discountPercent: "",
    unitConversion: {
      value: "",
      unit: "",
      altValue: "",
      altUnit: ""
    },
    altQty: 0,
    altUnit: "",
  });

  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [transportCharge, setTransportCharge] = useState(0);
  const [transportGstPercent, setTransportGstPercent] = useState(0);
  const [commonDiscount, setCommonDiscount] = useState(0);
  const [orderDate, setOrderDate] = useState("");


  // Initialize items from order
  useEffect(() => {
    if (order) {
      // Ensure all items have discountPercent calculated if they only have discountAmount
      const initializedItems = (order.items || []).map(item => {
        const subtotal = (item.qty || 0) * (item.sellingPrice || 0);
        const percent = item.discountPercent || 
          (subtotal > 0 ? (item.discountAmount / subtotal) * 100 : 0);
        
        return {
          ...item,
          discountPercent: parseFloat(percent.toFixed(2))
        };
      });

      setItems(initializedItems);
      setSampleItems(order.sampleItems || []);
      
      // Fix: Ensure transportCharge is picked up from either transportCharge or invoiceTransportCharge
      const tCharge = order.transportCharge ?? order.invoiceTransportCharge ?? 0;
      setTransportCharge(tCharge);
      
      setTransportGstPercent(order.transportGstPercent || 0);
      setCommonDiscount(order.commonDiscount || order.invoiceCommonDiscount || 0);
      setSelectedCustomer(order.customer);
      setCustomerSearch(order.customer?.name || "");
      
      // Initialize orderDate from order
      if (order.orderDate) {
        setOrderDate(new Date(order.orderDate).toISOString().split("T")[0]);
      } else if (order.createdAt) {
        setOrderDate(new Date(order.createdAt).toISOString().split("T")[0]);
      }
      
      fetchProducts();
      fetchCustomers();
    }
  }, [order]);

  // Fetch all customers for the branch
  const fetchCustomers = async () => {
    try {
      const branchIdToUse = order?.branchId || branchId;
      if (!branchIdToUse) return;

      const res = await fetchWithAuth(`${API_BASE}/customers?branchId=${branchIdToUse}&limit=10000`);
      const data = await res.json();
      setCustomers(data.data || []);
    } catch (err) {
      console.error("Error fetching customers:", err);
    }
  };


  // Fetch available products (LEGACY - but kept as empty shell for now to avoid breaking other parts)
  const fetchProducts = async () => {
    // We now use searchProducts live
  };

  // Save Product Conversion from Modal
  const saveProductConversion = async () => {
    if (!newItem.productId) {
      toast.warning("Please select a product first");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/products/${newItem.productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          unitConversion: {
            value: newItem.unitConversion?.value || 1,
            unit: newItem.unitConversion?.unit || newItem.unit || "",
            altValue: newItem.unitConversion?.altValue || 1,
            altUnit: newItem.unitConversion?.altUnit || newItem.altUnit || ""
          }
        })
      });
      if (res.ok) {
        toast.success("Product unit conversion saved!");
        // Update local products list to reflect the change
        fetchProducts();
      }
    } catch (err) {
      toast.error("Failed to save conversion");
    }
  };

  // Calculate item total
  const calculateItemTotal = (item) => {
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(item.sellingPrice) || 0;
    const subtotal = qty * price;
    const discountPercent = parseFloat(item.discountPercent) || 0;
    const discountAmount = subtotal * (discountPercent / 100);
    const discounted = subtotal - discountAmount;
    const taxAmount = item.igst
      ? discounted * (item.gst || 0) / 100
      : discounted * ((item.cgst || 0) + (item.sgst || 0)) / 100;
    return discounted + taxAmount;
  };

  // Handle HSN change
  const handleHsnChange = (index, hsn, isSample = false) => {
    if (isSample) {
      const updated = [...sampleItems];
      updated[index].hsn = hsn;
      setSampleItems(updated);
    } else {
      const updated = [...items];
      updated[index].hsn = hsn;
      setItems(updated);
    }
  };

  // Calculate grand total accounting for expenses, transport and common discount
  const calculateGrandTotal = () => {
    const itemsTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    const transport = Number(transportCharge) || 0;
    const transportGst = (transport * (Number(transportGstPercent) || 0)) / 100;
    const extra = order?.extraExpenseAmount || 0;
    const commDiscount = Number(commonDiscount) || 0;
    return itemsTotal + transport + transportGst + extra - commDiscount;
  };

  // Handle quantity change
  const handleQtyChange = (index, qty) => {
    const updated = [...items];
    const newQty = Math.max(1, parseInt(qty) || 1);
    updated[index].qty = newQty;
    
    // Recalculate alternate quantity if conversion is present
    if (updated[index].unitConversion) {
      const conv = updated[index].unitConversion;
      const val = parseFloat(conv.value) || 1;
      const altVal = parseFloat(conv.altValue) || 1;
      updated[index].altQty = parseFloat(((newQty * altVal) / val).toFixed(2));
    }
    
    updated[index].total = calculateItemTotal(updated[index]);
    setItems(updated);
  };

  // Handle unit change
  const handleUnitChange = (index, unit) => {
    const updated = [...items];
    updated[index].unit = unit;
    setItems(updated);
  };

  // Handle price change
  const handlePriceChange = (index, price) => {
    const updated = [...items];
    updated[index].sellingPrice = price === "" ? "" : parseFloat(price);
    updated[index].total = calculateItemTotal(updated[index]);
    setItems(updated);
  };

  // Handle discount change (now in percentage)
  const handleDiscountChange = (index, discount) => {
    const updated = [...items];
    updated[index].discountPercent = discount === "" ? "" : parseFloat(discount);
    const qty = parseFloat(updated[index].qty) || 0;
    const price = parseFloat(updated[index].sellingPrice) || 0;
    const dPercent = parseFloat(updated[index].discountPercent) || 0;
    updated[index].discountAmount = (qty * price) * (dPercent / 100);
    updated[index].total = calculateItemTotal(updated[index]);
    setItems(updated);
  };

  // Handle flat discount amount change
  const handleDiscountAmountChange = (index, amount) => {
    const updated = [...items];
    const value = amount === "" ? 0 : parseFloat(amount);
    updated[index].discountAmount = value;
    const qty = parseFloat(updated[index].qty) || 0;
    const price = parseFloat(updated[index].sellingPrice) || 0;
    const subtotal = qty * price;
    if (subtotal > 0) {
      updated[index].discountPercent = parseFloat(((value / subtotal) * 100).toFixed(2));
    } else {
      updated[index].discountPercent = 0;
    }
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
    if (!newItem.productId || newItem.qty < 1) {
      toast.warning("Please select a product and enter quantity");
      return;
    }

    // 🛡️ BLOCK ZERO PRICE ADDITION
    if (Number(newItem.sellingPrice) <= 0) {
      toast.error("Add Item Blocked: Selling price cannot be ₹0. Please set a price.");
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
      sellingPrice: "",
      gst: 0,
      cgst: 0,
      sgst: 0,
      igst: false,
      discountPercent: "",
    });
    setProductSearch("");
    setShowAddItemForm(false);
    toast.success("Item added to bill");
  };

  // Handle product selection for new item
  const handleProductSelect = async (productId) => {
    const product = products.find((p) => p._id === productId);
    console.log("🔍 Selected product for new item:", product);
    
    if (product) {
      const gstRate = product.gst || 0;
      const isIgst = Boolean(product.igst || false);
      let price = product.sellingPrice || product.mrp || 0;

      // FETCH LOCKED PRICE FOR CUSTOMER
      try {
        const customerId = order?.customer?.customerId || order?.customer?._id || order?.customer?.id;
        const branch = order?.branchId || branchId;
        
        console.log(`🔍 Checking locked price: Customer=${customerId}, Product=${productId}, Branch=${branch}`);

        if (customerId && branch) {
          const res = await fetchWithAuth(`${API_BASE}/customer-locked-prices/${customerId}/${productId}?branchId=${branch}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data?.lockedPrice) {
              price = data.data.lockedPrice;
              console.log(`✅ Using LOCKED PRICE for customer: ₹${price}`);
              toast.info(`Using allocated selling price: ₹${price}`);
            } else {
              console.log("ℹ️ No locked price entry found for this combination");
            }
          } else {
            console.log(`ℹ️ Locked price fetch status: ${res.status}`);
          }
        } else {
          console.warn("⚠️ Missing customerId or branchId for locked price check");
        }
      } catch (err) {
        console.warn("⚠️ Failed to fetch locked price (non-blocking):", err);
      }
      
      const conv = product.unitConversion || null;
      const initialAltQty = conv ? parseFloat(((1 * (conv.altValue || 1)) / (conv.value || 1)).toFixed(2)) : 0;
      
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
        unit: product.units || "",
        unitConversion: conv,
        altQty: initialAltQty,
        altUnit: conv?.altUnit || "",
      });
      console.log("✅ New item state updated with price and GST:", { price, gstRate });
      
      // 🛡️ ALERT ON ZERO PRICE
      if (price <= 0) {
        toast.warning(`Selling Price Alert: "${product.name}" has no selling price (₹0). Please enter it manually.`);
      }
    }
  };

  // Debounced Search for Products
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (productSearch.length >= 2) {
        const results = await searchProducts(productSearch);
        setProducts(results);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [productSearch]);

  // Debounced Search for Customers
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (customerSearch.length >= 2) {
        const results = await searchCustomers(customerSearch);
        setCustomers(results);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [customerSearch]);

  // Save changes
  const handleSave = async () => {
    try {
      // 🛡️ HSN VALIDATION PRE-CHECK
      for (const item of items) {
        const hsn = String(item.hsn || "").trim();
        if (!/^\d{4}$|^\d{6}$|^\d{8}$/.test(hsn)) {
          toast.error(`Invalid HSN "${hsn}" for product "${item.name}". HSN must be 4, 6, or 8 digits.`);
          return;
        }
      }

      setLoading(true);
      
      const newItemsTotal = calculateGrandTotal();
      const updatedOrder = {
        ...order,
        items: items.map(item => {
          const qty = parseFloat(item.qty) || 0;
          const price = parseFloat(item.sellingPrice) || 0;
          const dPercent = parseFloat(item.discountPercent) || 0;
          return {
            ...item,
            discountAmount: (qty * price) * (dPercent / 100),
            discountType: "PERCENT"
          };
        }),
        sampleItems,
        subtotal: items.reduce((sum, item) => sum + ((parseFloat(item.qty) || 0) * (parseFloat(item.sellingPrice) || 0)), 0),
        totalTax: Math.round(items.reduce((sum, item) => {
          const qty = parseFloat(item.qty) || 0;
          const price = parseFloat(item.sellingPrice) || 0;
          const dPercent = parseFloat(item.discountPercent) || 0;
          const sub = qty * price;
          const discounted = sub - (sub * (dPercent / 100));
          const tax = item.igst ? discounted * (item.gst || 0) / 100 : discounted * ((item.cgst || 0) + (item.sgst || 0)) / 100;
          return sum + tax;
        }, 0)),
        totalDiscount: Math.round(items.reduce((sum, item) => {
          const qty = parseFloat(item.qty) || 0;
          const price = parseFloat(item.sellingPrice) || 0;
          const dPercent = parseFloat(item.discountPercent) || 0;
          return sum + (qty * price * (dPercent / 100));
        }, 0)),
        commonDiscount: Math.round(Number(commonDiscount) || 0),
        roundOff: Math.round(newItemsTotal) - newItemsTotal,
        transportCharge: Math.round(Number(transportCharge) || 0),
        transportGstPercent: Number(transportGstPercent) || 0,
        transportGstAmount: Math.round((Number(transportCharge) || 0) * (Number(transportGstPercent) || 0) / 100),
        grandTotal: Math.round(newItemsTotal),
        updatedByUsername: localStorage.getItem("username") || "System",
        customer: selectedCustomer ? {
          id: selectedCustomer.customerId || selectedCustomer._id,
          name: selectedCustomer.name,
          whatsapp: selectedCustomer.whatsapp,
          address: selectedCustomer.address,
          district: selectedCustomer.district,
          state: selectedCustomer.state,
          stateCode: selectedCustomer.stateCode,
          pincode: selectedCustomer.pincode,
        } : order.customer,
        orderDate: orderDate
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
          {/* CUSTOMER SELECTION */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-tight mb-3">👤 Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-xs font-bold text-gray-600 mb-1">Select Customer</label>
                <input
                  type="text"
                  placeholder="Search and change customer..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#319bab] outline-none font-semibold text-gray-800"
                />
                {showCustomerDropdown && (
                  <ul className="absolute z-20 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-xl">
                    {customers
                      .map((c) => (
                        <li
                          key={c._id}
                          className="px-4 py-3 hover:bg-[#319bab]/10 cursor-pointer border-b last:border-0 flex justify-between items-center"
                          onMouseDown={() => {
                            setSelectedCustomer({
                              ...c,
                              customerId: c._id // Harmonize ID field names
                            });
                            setCustomerSearch(c.name);
                            setShowCustomerDropdown(false);
                            toast.info(`Customer changed to: ${c.name}`);
                          }}
                        >
                          <div>
                            <p className="font-bold text-gray-800">{c.name}</p>
                            <p className="text-xs text-gray-500">{c.whatsapp || "No phone"}</p>
                          </div>
                          <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded font-bold text-gray-400">SELECT</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Order Date</label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#319bab] outline-none font-semibold text-gray-800"
                />
              </div>
            </div>
            {selectedCustomer && (
              <div className="mt-3 flex gap-4 text-xs text-gray-600 italic">
                <span>📍 {selectedCustomer.address || "No address"}</span>
                <span>📱 {selectedCustomer.whatsapp || "No phone"}</span>
              </div>
            )}
          </div>

          {/* TRANSPORT CHARGE */}
          <div className="bg-[#319bab]/5 p-4 rounded-xl border border-[#319bab]/20">
            <h3 className="text-sm font-bold text-[#319bab] uppercase tracking-tight mb-3">🚚 Transport & Logistics</h3>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-600 mb-1">Transport Charge (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 font-bold">₹</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={transportCharge}
                    onChange={(e) => setTransportCharge(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-[#319bab] outline-none font-bold text-gray-800"
                  />
                </div>
              </div>
              <div className="w-full md:w-1/4">
                <label className="block text-xs font-bold text-gray-600 mb-1">Transport GST (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="18"
                    value={transportGstPercent}
                    onChange={(e) => setTransportGstPercent(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pr-8 pl-3 py-2 focus:ring-2 focus:ring-[#319bab] outline-none font-bold text-gray-800 text-center"
                  />
                  <span className="absolute right-3 top-2.5 text-gray-400 font-bold">%</span>
                </div>
              </div>
            </div>
          </div>


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
                    <th className="px-4 py-3 text-center font-bold text-gray-700">
                      Unit
                    </th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">
                      Discount (% / ₹)
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
                      <td className="px-4 py-3">
                        <div className="font-semibold">{item.name}</div>
                        {item.altQty > 0 && (
                          <div className="text-[10px] text-[#319bab] font-bold">
                            ({item.altQty} {item.altUnit || "Alt"})
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="text"
                          value={item.hsn}
                          onChange={(e) => handleHsnChange(idx, e.target.value)}
                          className={`w-24 border rounded px-2 py-1 text-center focus:ring-2 focus:ring-[#319bab] outline-none text-xs font-mono ${
                            item.hsn && !/^\d{6}$|^\d{8}$/.test(String(item.hsn).trim())
                              ? "border-red-500 bg-red-50"
                              : "border-gray-300"
                          }`}
                          placeholder="HSN"
                        />
                        {item.hsn && !/^\d{6}$|^\d{8}$/.test(String(item.hsn).trim()) && (
                          <p className="text-[9px] text-red-600 font-bold mt-1" title="E-Invoice requires 6 or 8 digits">Invalid</p>
                        )}
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
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleUnitChange(idx, e.target.value)}
                          placeholder="kg"
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-center focus:ring-2 focus:ring-[#319bab] outline-none uppercase text-xs font-bold"
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
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={item.discountPercent}
                              onChange={(e) => handleDiscountChange(idx, e.target.value)}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-right focus:ring-1 focus:ring-[#319bab] outline-none text-[11px]"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="0"
                            />
                            <span className="text-[10px] text-gray-400 font-bold">%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={item.discountAmount || ""}
                              onChange={(e) => handleDiscountAmountChange(idx, e.target.value)}
                              className="w-20 border border-gray-200 bg-gray-50 rounded px-2 py-1 text-right focus:ring-1 focus:ring-blue-300 outline-none text-[10px] text-gray-600"
                              placeholder="Amt ₹"
                            />
                          </div>
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
                        <td className="px-4 py-3 text-center">
                          <input
                            type="text"
                            value={item.hsn}
                            onChange={(e) => handleHsnChange(idx, e.target.value, true)}
                            className={`w-20 border rounded px-2 py-1 text-center focus:ring-2 focus:ring-yellow-500 outline-none text-xs font-mono ${
                              item.hsn && !/^\d{4}$|^\d{6}$|^\d{8}$/.test(String(item.hsn).trim())
                                ? "border-red-500 bg-red-50"
                                : "border-gray-200"
                            }`}
                            placeholder="HSN"
                          />
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
                         <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
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
                            {products.length > 0 ? (
                              products.map((prod) => (
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
                                  <div className="flex justify-between items-center">
                                    <span className="font-semibold">{prod.name}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                      (prod.availableQty || 0) > 0 
                                      ? "bg-green-100 text-green-700" 
                                      : "bg-red-100 text-red-700"
                                    }`}>
                                      Qty: {prod.availableQty || 0}
                                    </span>
                                  </div>
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
                  <div className="md:col-span-2">
                    <div className="bg-[#319bab]/5 p-3 rounded-lg border border-[#319bab]/20 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-[#319bab] uppercase tracking-widest leading-none">Unit Conversion</span>
                        <button 
                          onClick={saveProductConversion}
                          className="text-[9px] bg-[#319bab] text-white px-2 py-0.5 rounded hover:bg-[#257f87] transition font-bold"
                        >
                          SAVE AS DEFAULT
                        </button>
                      </div>
                    <div className="flex gap-2 items-center">
                      <div className="w-16">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full border border-gray-300 rounded px-2 py-1 text-center text-xs focus:ring-1 focus:ring-[#319bab] outline-none"
                          value={newItem.unitConversion?.value || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              const numVal = parseFloat(val) || 1;
                              const altQty = parseFloat(((newItem.qty || 1) * (newItem.unitConversion?.altValue || 1) / numVal).toFixed(2));
                              setNewItem({
                                ...newItem,
                                unitConversion: { ...newItem.unitConversion, value: val },
                                altQty
                              });
                            }
                          }}
                          placeholder="Val"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] text-gray-500 font-bold uppercase truncate block text-center border-b border-gray-100">{newItem.unit || "Unit"}</span>
                      </div>
                      <div className="text-center font-bold text-[#319bab]">=</div>
                      <div className="w-24">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full border border-gray-300 rounded px-2 py-1 text-center text-xs focus:ring-1 focus:ring-[#319bab] outline-none"
                          value={newItem.unitConversion?.altValue || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              const numAltVal = parseFloat(val) || 1;
                              const altQty = parseFloat(((newItem.qty || 1) * numAltVal / (newItem.unitConversion?.value || 1)).toFixed(2));
                              setNewItem({
                                ...newItem,
                                unitConversion: { ...newItem.unitConversion, altValue: val },
                                altQty
                              });
                            }
                          }}
                          placeholder="Alt"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] text-gray-500 font-bold uppercase truncate block text-center border-b border-gray-100">{newItem.altUnit || "Alt"}</span>
                      </div>
                    </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">
                      Unit (Base)
                    </label>
                    <input
                      type="text"
                      value={newItem.unit}
                      onChange={(e) =>
                        setNewItem({ ...newItem, unit: e.target.value })
                      }
                      placeholder="pcs"
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none uppercase font-bold text-xs"
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
                          sellingPrice: e.target.value === "" ? "" : parseFloat(e.target.value),
                        })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                      step="0.01"
                      min="0"
                      placeholder="Enter rate..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">
                      Discount (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={newItem.discountPercent}
                        onChange={(e) =>
                          setNewItem({
                            ...newItem,
                            discountPercent: e.target.value === "" ? "" : parseFloat(e.target.value),
                          })
                        }
                        className="w-full border border-gray-300 rounded px-3 py-2 pr-8 focus:ring-2 focus:ring-green-500 outline-none"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">
                       HSN Code
                    </label>
                    <input
                      type="text"
                      value={newItem.hsn}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          hsn: e.target.value,
                        })
                      }
                      placeholder="4, 6, 8 digits"
                      className={`w-full border rounded px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none text-sm font-mono ${
                        newItem.hsn && !/^\d{4}$|^\d{6}$|^\d{8}$/.test(String(newItem.hsn).trim())
                          ? "border-red-500 bg-red-50"
                          : "border-gray-300"
                      }`}
                    />
                    {newItem.hsn && !/^\d{4}$|^\d{6}$|^\d{8}$/.test(String(newItem.hsn).trim()) && (
                      <p className="text-[9px] text-red-600 font-bold mt-1">4, 6, 8 digits only</p>
                    )}
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
                  <span className="font-semibold text-gray-800">
                    ₹{items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0) * (parseFloat(item.sellingPrice) || 0), 0)
                      .toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                  </span>
                </div>

                {/* MERGED TAX CALCULATION */}
                {(() => {
                  let cgst = 0;
                  let sgst = 0;
                  let igst = 0;
                  let hasIgst = false;

                  // 1. Calculate tax from items
                  items.forEach(item => {
                    const qty = parseFloat(item.qty) || 0;
                    const price = parseFloat(item.sellingPrice) || 0;
                    const dPercent = parseFloat(item.discountPercent) || 0;
                    const discounted = (qty * price) - (qty * price * (dPercent / 100));
                    
                    if (item.igst) {
                      igst += discounted * (item.gst || 0) / 100;
                      hasIgst = true;
                    } else {
                      cgst += discounted * (item.cgst || 0) / 100;
                      sgst += discounted * (item.sgst || 0) / 100;
                    }
                  });

                  // 2. Add transport GST to the common lines
                  const tCharge = Number(transportCharge) || 0;
                  const tGstPercent = Number(transportGstPercent) || 0;
                  const tGstAmount = (tCharge * tGstPercent) / 100;

                  if (hasIgst) {
                    igst += tGstAmount;
                  } else {
                    cgst += tGstAmount / 2;
                    sgst += tGstAmount / 2;
                  }

                  if (hasIgst) {
                    return (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">IGST:</span>
                        <span className="font-semibold text-blue-600">₹{igst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                    );
                  } else {
                    return (
                      <>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">CGST:</span>
                          <span className="font-semibold text-blue-600">₹{cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">SGST:</span>
                          <span className="font-semibold text-blue-600">₹{sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    );
                  }
                })()}

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Item Discount:</span>
                  <span className="text-red-500 font-semibold">
                    -₹{items.reduce((sum, item) => {
                        const qty = parseFloat(item.qty) || 0;
                        const price = parseFloat(item.sellingPrice) || 0;
                        const dPercent = parseFloat(item.discountPercent) || 0;
                        return sum + (qty * price * (dPercent / 100));
                      }, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Special Discount:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-red-500 font-semibold">-₹</span>
                    <input
                      type="number"
                      value={commonDiscount}
                      onChange={(e) => setCommonDiscount(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      className="w-24 border border-gray-300 rounded px-2 py-1 text-right focus:ring-2 focus:ring-red-500 outline-none text-red-500 font-semibold"
                      placeholder="0"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Transport:</span>
                  <span className="text-gray-800 font-semibold">
                    ₹{parseFloat(transportCharge || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {order?.extraExpenseAmount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Extra Charges:</span>
                    <span className="text-gray-800 font-semibold">
                      ₹{order.extraExpenseAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="border-t pt-2 mt-2 flex justify-between items-center">
                  <span className="text-lg font-bold text-[#319bab]">GRAND TOTAL</span>
                  <span className="text-2xl font-black text-[#319bab]">
                    ₹{Math.round(calculateGrandTotal()).toLocaleString()}
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
