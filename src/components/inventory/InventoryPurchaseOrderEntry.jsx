import React, { useState, useEffect } from "react";
import { FaPlus, FaTrash, FaPrint, FaTimes } from "react-icons/fa";
import { useInventory } from "../../context/InventoryContext";

const InventoryPurchaseOrderEntry = ({
  items,
  setItems,
  voucherTypes,
  products,
  warehouses,
  vendors,
}) => {
  // Destructure functions from Context
  const { billingPersons, agents, saveToDrafts, placeFinalOrder } = useInventory();

  // Header State
  const [voucherType, setVoucherType] = useState("");
  const [vendor, setVendor] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  
  // Item Entry State
  const [selectedItem, setSelectedItem] = useState("");
  const [qty, setQty] = useState(1);
  const [basePrice, setBasePrice] = useState(0); 
  const [displayPrice, setDisplayPrice] = useState(0); 
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);

  // Footer State
  const [transportCharge, setTransportCharge] = useState(0);
  const [billingPerson, setBillingPerson] = useState("");
  const [agent, setAgent] = useState("");

  // Invoice Modal State
  const [showInvoice, setShowInvoice] = useState(false);
  const [finalOrderData, setFinalOrderData] = useState(null);

  // Generate ID based on Voucher Type
  useEffect(() => {
    if (voucherType) {
      const year = "25-26";
      setInvoiceId(`P1 - ${voucherType} / 001 / ${year}`);
    }
  }, [voucherType]);

  // Dynamic Price Calculation: Rate * Qty
  useEffect(() => {
    setDisplayPrice(basePrice * qty);
  }, [qty, basePrice]);

  // Auto-fetch Price and Tax when product is selected
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

    setItems([...items, {
      name: selectedItem,
      qty: parseFloat(qty),
      unitPrice: basePrice,
      rowPrice: displayPrice,
      cgst, sgst,
      total: total.toFixed(2),
    }]);
    
    // Clear Input row
    setSelectedItem(""); setQty(1); setBasePrice(0); setDisplayPrice(0); setCgst(0); setSgst(0);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Totals Calculation logic
  const subtotal = items.reduce((sum, item) => sum + item.rowPrice, 0);
  const totalTax = items.reduce((sum, item) => sum + (item.rowPrice * (item.cgst + item.sgst) / 100), 0);
  const grandTotal = subtotal + totalTax + parseFloat(transportCharge || 0);

  // Function to handle Draft vs Place PO
  const handleFinalAction = (type) => {
    const orderData = {
      invoiceId, voucherType, vendor, warehouse, items,
      subtotal, totalTax, transportCharge, grandTotal,
      billingPerson, agent, date: new Date().toLocaleString()
    };

    if (type === "DRAFT") {
      saveToDrafts(orderData);
    } else {
      if (items.length === 0) return alert("Please add items before placing order!");
      placeFinalOrder(orderData);
      setFinalOrderData(orderData);
      setShowInvoice(true);
    }
  };

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary outline-none text-sm";
  const labelClass = "block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight";

  return (
    <div className="space-y-6 font-sans">
      {/* HEADER SECTION */}
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

      {/* INPUT ROW */}
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
          <div><label className={labelClass}>CGST%</label><input type="number" className={`${inputClass} bg-gray-50`} value={cgst} readOnly /></div>
          <div><label className={labelClass}>SGST%</label><input type="number" className={`${inputClass} bg-gray-50`} value={sgst} readOnly /></div>
        </div>
        <button onClick={addItem} className="bg-primary text-white h-[38px] rounded-lg font-bold flex items-center justify-center hover:bg-secondary transition shadow-lg shadow-primary/20">
          <FaPlus className="mr-2" /> ADD
        </button>
      </div>

      {/* TABLE & SUMMARY */}
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
                      <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 transition p-2"><FaTrash size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Transport Charge</label>
              <input type="number" className={`${inputClass} border-2 border-black`} value={transportCharge} onChange={(e) => setTransportCharge(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Billing Person</label>
              <select className={inputClass} value={billingPerson} onChange={(e) => setBillingPerson(e.target.value)}>
                <option value="">Select Person</option>
                {billingPersons.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Agent</label>
              <select className={inputClass} value={agent} onChange={(e) => setAgent(e.target.value)}>
                <option value="">Select Agent</option>
                {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* SUMMARY CARD */}
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-primary/5 h-fit sticky top-24">
          <h3 className="text-primary font-black uppercase text-xs tracking-widest mb-6 border-b pb-2 border-primary/10">Order Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-bold">₹{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Tax Amount</span><span className="font-bold">₹{totalTax.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm pb-4 border-b border-dashed"><span className="text-gray-500">Transport</span><span className="font-bold">₹{parseFloat(transportCharge || 0).toFixed(2)}</span></div>
            <div className="pt-2">
              <div className="flex justify-between items-center"><span className="text-gray-800 font-black text-xs uppercase">Grand Total</span><span className="text-3xl font-black text-primary italic">₹{grandTotal.toFixed(2)}</span></div>
            </div>
            <div className="grid grid-cols-1 gap-3 mt-8">
              <button onClick={() => handleFinalAction("DRAFT")} className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-bold uppercase text-[10px] hover:bg-gray-200">Save as Draft</button>
              <button onClick={() => handleFinalAction("PLACE")} className="w-full bg-primary text-white py-4 rounded-xl font-black uppercase text-xs shadow-xl shadow-primary/20">Place PO (Invoice)</button>
            </div>
          </div>
        </div>
      </div>

      {/* --- INVOICE PREVIEW MODAL --- */}
      {showInvoice && finalOrderData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-200">
            <div className="bg-primary p-6 text-white flex justify-between items-center">
              <div><h2 className="text-2xl font-black italic tracking-tighter">Pearls ERP</h2><p className="text-xs opacity-80 uppercase font-bold">Purchase Order Invoice</p></div>
              <button onClick={() => setShowInvoice(false)} className="bg-white/20 p-2 rounded-full hover:bg-white/40"><FaTimes /></button>
            </div>

            <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] bg-white">
              <div className="flex justify-between items-start border-b border-gray-100 pb-6">
                <div><p className="text-[10px] text-gray-400 font-bold uppercase">Vendor Info</p><p className="text-xl font-black text-gray-800">{finalOrderData.vendor}</p></div>
                <div className="text-right"><p className="text-[10px] text-gray-400 font-bold uppercase">Invoice Details</p><p className="text-sm font-bold text-primary">{finalOrderData.invoiceId}</p><p className="text-[12px] text-gray-500">{finalOrderData.date}</p></div>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-bold">
                  <tr><th className="px-4 py-2 text-left">Item Description</th><th className="px-4 py-2 text-center">Qty</th><th className="px-4 py-2 text-right">Total Price</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {finalOrderData.items.map((item, idx) => (
                    <tr key={idx}><td className="px-4 py-4 font-bold text-gray-700">{item.name}</td><td className="px-4 py-4 text-center">{item.qty}</td><td className="px-4 py-4 text-right font-black">₹{item.total}</td></tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-gray-100 pt-6 space-y-3">
                <div className="flex justify-between text-sm text-gray-500 font-medium"><span>Subtotal</span><span>₹{finalOrderData.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm text-gray-500 font-medium"><span>Total Tax</span><span>₹{finalOrderData.totalTax.toFixed(2)}</span></div>
                <div className="flex justify-between items-center border-t-2 border-primary pt-4">
                  <span className="text-sm font-black text-gray-400 uppercase tracking-tighter">Grand Total Amount</span>
                  <span className="text-3xl font-black text-primary italic">₹{finalOrderData.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t flex gap-4">
              <button onClick={() => window.print()} className="flex-1 bg-secondary text-gray py-3 rounded-xl font-bold flex items-center justify-center gap-2 tracking-tighter uppercase text-sm italic shadow-lg"><FaPrint /> Print Invoice</button>
              <button onClick={() => setShowInvoice(false)} className="flex-1 bg-white text-gray-500 py-3 border border-gray-200 rounded-xl font-bold">Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPurchaseOrderEntry;