import React, { useState, useEffect } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { useInventory } from "../../context/InventoryContext";

const InventoryPurchaseOrderEntry = ({
  items,
  setItems,
  voucherTypes,
  products,
  warehouses,
  vendors,
}) => {
  // Context-ல் இருந்து Billing Person மற்றும் Agent விவரங்களைப் பெறுதல்
  const { billingPersons, agents } = useInventory();

  // Form States
  const [voucherType, setVoucherType] = useState("");
  const [vendor, setVendor] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  
  // Item Entry States
  const [selectedItem, setSelectedItem] = useState("");
  const [qty, setQty] = useState(1);
  const [basePrice, setBasePrice] = useState(0); 
  const [displayPrice, setDisplayPrice] = useState(0); 
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);

  // Bottom Fields
  const [transportCharge, setTransportCharge] = useState(0);
  const [billingPerson, setBillingPerson] = useState("");
  const [agent, setAgent] = useState("");

  // 1. Invoice ID உருவாக்கம்
  useEffect(() => {
    if (voucherType) {
      const year = "25-26";
      setInvoiceId(`P1 - ${voucherType} / 001 / ${year}`);
    }
  }, [voucherType]);

  // 2. Qty அல்லது Base Price மாறும்போது விலையைக் கணக்கிடும் முறை:
  // Price = Base Rate * Qty
  useEffect(() => {
    const calculatedPrice = basePrice * qty;
    setDisplayPrice(calculatedPrice);
  }, [qty, basePrice]);

  // 3. பொருளைத் தேர்ந்தெடுக்கும்போது அசல் விலை மற்றும் வரியைப் பெறுதல்
  const handleItemSelection = (itemName) => {
    setSelectedItem(itemName);
    const product = products.find((p) => p.name === itemName);
    if (product) {
      const rate = parseFloat(product.rate) || 0;
      setBasePrice(rate);
      setCgst((parseFloat(product.tax) || 0) / 2);
      setSgst((parseFloat(product.tax) || 0) / 2);
    }
  };

  const addItem = () => {
    if (!selectedItem || qty <= 0) return;
    
    const rowTax = (displayPrice * (cgst + sgst)) / 100;
    const total = displayPrice + rowTax;

    const newItem = {
      name: selectedItem,
      qty: parseFloat(qty),
      unitPrice: basePrice,
      rowPrice: displayPrice,
      cgst: parseFloat(cgst),
      sgst: parseFloat(sgst),
      total: total.toFixed(2),
    };
    
    setItems([...items, newItem]);
    
    // இன்புட் கட்டங்களை ரீசெட் செய்தல்
    setSelectedItem("");
    setQty(1);
    setBasePrice(0);
    setDisplayPrice(0);
    setCgst(0);
    setSgst(0);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // 4. மொத்தத் தொகைக் கணக்கீடுகள்
  const subtotal = items.reduce((sum, item) => sum + item.rowPrice, 0);
  const totalTax = items.reduce((sum, item) => sum + (item.rowPrice * (item.cgst + item.sgst) / 100), 0);
  const grandTotal = subtotal + totalTax + parseFloat(transportCharge || 0);

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm transition-all";
  const labelClass = "block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight";

  return (
    <div className="space-y-6">
      {/* மேல் பகுதி: வவுச்சர் மற்றும் வெண்டர் விவரங்கள் */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className={labelClass}>Voucher Type</label>
          <select className={inputClass} value={voucherType} onChange={(e) => setVoucherType(e.target.value)}>
            <option value="">-- Select --</option>
            {voucherTypes.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Vendor</label>
          <select className={inputClass} value={vendor} onChange={(e) => setVendor(e.target.value)}>
            <option value="">-- Select --</option>
            {vendors.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Invoice ID</label>
          <input type="text" className={`${inputClass} bg-gray-50 font-bold text-primary`} value={invoiceId} readOnly />
        </div>
        <div>
          <label className={labelClass}>Warehouse</label>
          <select className={inputClass} value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
            <option value="">-- Select --</option>
            {warehouses.map((w) => <option key={w.id} value={w.name}>{w.name}</option>)}
          </select>
        </div>
      </div>

      {/* நடுப்பகுதி: பொருள் உள்ளீடு */}
      <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <label className={labelClass}>Item Name</label>
          <select className={inputClass} value={selectedItem} onChange={(e) => handleItemSelection(e.target.value)}>
            <option value="">Select Product</option>
            {products.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Qty</label>
          <input type="number" className={inputClass} value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Price (Calculated)</label>
          <input type="number" className={`${inputClass} font-bold text-primary`} value={displayPrice} readOnly />
        </div>
        <div className="flex gap-2">
          <div>
            <label className={labelClass}>CGST%</label>
            <input type="number" className={`${inputClass} bg-gray-50`} value={cgst} readOnly />
          </div>
          <div>
            <label className={labelClass}>SGST%</label>
            <input type="number" className={`${inputClass} bg-gray-50`} value={sgst} readOnly />
          </div>
        </div>
        <button onClick={addItem} className="bg-primary text-white h-[38px] rounded-lg font-bold flex items-center justify-center hover:bg-secondary transition shadow-lg shadow-primary/20">
          <FaPlus className="mr-2" /> ADD
        </button>
      </div>

      {/* அட்டவணை மற்றும் சுருக்கம் */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-right">Price (Row Total)</th>
                  <th className="px-4 py-3 text-center">GST %</th>
                  <th className="px-4 py-3 text-right">Final Total</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 font-medium text-gray-700">{item.name}</td>
                    <td className="px-4 py-3 text-center">{item.qty}</td>
                    <td className="px-4 py-3 text-right">₹{item.rowPrice}</td>
                    <td className="px-4 py-3 text-center">{item.cgst + item.sgst}%</td>
                    <td className="px-4 py-3 text-right font-bold text-primary">₹{item.total}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 transition p-2">
                        <FaTrash size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* இதர விவரங்கள்: Transport, Billing Person & Agent */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Transport Charge</label>
              <input type="number" className={`${inputClass} border-2 border-black`} value={transportCharge} onChange={(e) => setTransportCharge(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Billing Person</label>
              <select className={inputClass} value={billingPerson} onChange={(e) => setBillingPerson(e.target.value)}>
                <option value="">Select Person</option>
                {billingPersons && billingPersons.map((p) => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Agent</label>
              <select className={inputClass} value={agent} onChange={(e) => setAgent(e.target.value)}>
                <option value="">Select Agent</option>
                {agents && agents.map((a) => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ஆர்டர் சுருக்கம் கார்டு */}
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-primary/5 h-fit sticky top-24">
          <h3 className="text-primary font-black uppercase text-xs tracking-widest mb-6 border-b pb-2 border-primary/10">Order Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Subtotal</span>
              <span className="font-bold text-gray-800">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Tax Amount</span>
              <span className="font-bold text-gray-800">₹{totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm pb-4 border-b border-dashed border-gray-200">
              <span className="text-gray-500 font-medium">Transport</span>
              <span className="font-bold text-gray-800">₹{parseFloat(transportCharge || 0).toFixed(2)}</span>
            </div>
            <div className="pt-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-800 font-black text-xs uppercase tracking-tighter">Grand Total</span>
                <span className="text-3xl font-black text-primary underline underline-offset-8">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 mt-8">
              <button className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-bold uppercase text-[10px] hover:bg-gray-200 transition">Save as Draft</button>
              <button className="w-full bg-primary text-white py-4 rounded-xl font-black uppercase text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all">Place PO (Invoice)</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryPurchaseOrderEntry;