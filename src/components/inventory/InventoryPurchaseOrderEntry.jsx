import { useEffect, useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API_BASE } from "../../api";
import { useInventory } from "../../context/InventoryContext";

const InventoryPurchaseOrderEntry = ({
  items,
  setItems,
  voucherTypes,
  products,
  vendors,
  productGroups
}) => {
  const { billingPersons, warehouses } = useInventory();

  // Header State
  const [voucherType, setVoucherType] = useState("");
  const [vendor, setVendor] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [productGroup, setProductGroup] = useState("");

  // Item Entry State
  const [selectedItem, setSelectedItem] = useState("");
  const [qty, setQty] = useState(1);
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [displayPrice, setDisplayPrice] = useState(0);
  const [hsn, setHsn] = useState("");
  const [gst, setGst] = useState(0);
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);
  const [igst, setIgst] = useState(false);

  // Footer State
  const [transportCharge, setTransportCharge] = useState(0);
  const [billingPerson, setBillingPerson] = useState("");
  const [agent, setAgent] = useState("");

  const filteredProducts = productGroup
    ? products.filter((p) => p.groupId === productGroup)
    : [];

  // Dynamic Row Price
  useEffect(() => setDisplayPrice(purchasePrice * qty), [qty, purchasePrice]);

  // Auto CGST / SGST
  useEffect(() => {
    if (igst) {
      setCgst(0);
      setSgst(0);
    } else {
      setCgst(gst / 2);
      setSgst(gst / 2);
    }
  }, [gst, igst]);

  // Reset item when Product Group changes
  useEffect(() => {
    setSelectedItem("");
    setQty(1);
    setPurchasePrice(0);
    setSellingPrice(0);
    setDisplayPrice(0);
    setHsn("");
    setGst(0);
    setIgst(false);
    setCgst(0);
    setSgst(0);
  }, [productGroup]);

  // Auto-fetch Product Price / Tax / HSN
  const handleItemSelection = (productId) => {
    setSelectedItem(productId);
    const product = products.find((p) => p._id === productId);
    if (!product) return;
    setPurchasePrice(product.rate || 0);
    setSellingPrice(product.rate || 0);
    setHsn(product.hsncode || "");
    setGst(product.tax || 0);
    if (!igst) {
      setCgst((product.tax || 0) / 2);
      setSgst((product.tax || 0) / 2);
    }
  };

  // Add Item
  const addItem = () => {
    if (!selectedItem || qty <= 0) {
      toast.error("Please select a valid item and quantity!");
      return;
    }

    const taxRate = igst ? gst : cgst + sgst;
    const rowTax = (displayPrice * taxRate) / 100;
    const total = displayPrice + rowTax;
    const product = products.find((p) => p._id === selectedItem);

    setItems((prev) => [
      ...prev,
      {
        productId: product._id,
        name: product.name,
        productGroup: product.groupId,
        qty,
        purchasePrice,
        sellingPrice,
        rowPrice: displayPrice,
        hsn,
        gst,
        cgst,
        sgst,
        igst,
        total: total.toFixed(2),
      },
    ]);

    toast.success(`${product.name} added!`);

    setSelectedItem("");
    setQty(1);
    setPurchasePrice(0);
    setSellingPrice(0);
    setDisplayPrice(0);
    setHsn("");
    setGst(0);
    setIgst(false);
    setCgst(0);
    setSgst(0);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
    toast.info("Item removed!");
  };

  // Totals
  const subtotal = items.reduce((sum, item) => sum + item.rowPrice, 0);
  const totalTax = items.reduce((sum, item) => {
    const rate = item.igst ? item.gst : item.cgst + item.sgst;
    return sum + (item.rowPrice * rate) / 100;
  }, 0);
  const grandTotal = subtotal + totalTax + parseFloat(transportCharge || 0);

  // Fetch next invoice ID from backend
  useEffect(() => {
    if (!voucherType) return setInvoiceId("");
    const fetchNextInvoice = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/purchase-orders/next-invoice/${voucherType}`
        );
        const data = await res.json();
        if (res.ok) setInvoiceId(data.nextInvoiceId);
      } catch (err) {
        console.error(err);
      }
    };
    fetchNextInvoice();
  }, [voucherType]);

  // Place Purchase Order
  const handleFinalAction = async () => {
    if (!voucherType) return toast.error("Select Voucher Type!");
    if (!vendor) return toast.error("Select Vendor!");
    if (!warehouse) return toast.error("Select Warehouse!");
    if (!billingPerson) return toast.error("Select Billing Person!");
    if (items.length === 0) return toast.error("Add at least one product!");

    const orderData = {
      voucherType,
      vendor,
      warehouse,
      items,
      subtotal,
      totalTax,
      transportCharge,
      grandTotal,
      billingPerson,
      agent,
      invoiceId,
      status: "PLACED",
    };

    try {
      const res = await fetch(`${API_BASE}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.message || "Failed to save order");

      toast.success("Purchase Order placed successfully!");
      setInvoiceId(data.order.invoiceId);
      setItems([]);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong!");
    }
  };

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#319bab] outline-none text-sm";
  const selectClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-1 focus:ring-[#319bab] outline-none text-sm appearance-none";
  const labelClass =
    "block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight";

  return (
    <div className="space-y-6 font-sans">
      <ToastContainer
        position="top-right"
        autoClose={2500}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="colored"
        toastStyle={{
          background: "rgba(49, 155, 171, 0.85)",
          color: "#fff",
          backdropFilter: "blur(6px)",
          borderRadius: "12px",
          boxShadow: "0 8px 20px rgba(49,155,171,0.25)",
        }}
      />

      {/* HEADER */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100
                grid grid-cols-1 md:grid-cols-3 gap-4">

        <div>
          <label className={labelClass}>Voucher Type</label>
          <select
            className={selectClass}
            value={voucherType}
            onChange={(e) => setVoucherType(e.target.value)}
          >
            <option value="">-- Select --</option>
            {voucherTypes.map((v) => (
              <option key={v._id} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Vendor</label>
          <select
            className={selectClass}
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          >
            <option value="">-- Select --</option>
            {vendors.map((v) => (
              <option key={v._id} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Invoice ID</label>
          <input
            type="text"
            className={`${inputClass} bg-gray-50 font-bold text-[#319bab]`}
            value={invoiceId}
            readOnly
          />
        </div>

        <div>
          <label className={labelClass}>Warehouse</label>
          <select
            className={selectClass}
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
          >
            <option value="">-- Select --</option>
            {warehouses.map((w) => (
              <option key={w._id} value={w.name}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Billing Person</label>
          <select
            className={selectClass}
            value={billingPerson}
            onChange={(e) => setBillingPerson(e.target.value)}
          >
            <option value="">-- Select --</option>
            {billingPersons.map((b) => (
              <option key={b._id} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* PRODUCT GROUP */}
       <div>
        <label className={labelClass}>Product Group</label>
        <select className={selectClass} value={productGroup} onChange={(e) => setProductGroup(e.target.value)}>
          <option value="">Select Product Group</option>
          {productGroups.map((g) => (
            <option key={g._id} value={g._id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {/* ITEM ENTRY */}
      <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-4">
        {/* ROW 1 */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className={labelClass}>Item Name</label>
            <select
              className={selectClass}
              value={selectedItem}
              onChange={(e) => handleItemSelection(e.target.value)}
              disabled={!productGroup}
            >
              <option value="">
                {productGroup
                  ? "Select Product"
                  : "Select Product Group first"}
              </option>
              {filteredProducts.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}({p.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Purchase ₹</label>
            <input
              type="number"
              className={inputClass}
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(+e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Selling ₹</label>
            <input
              type="number"
              className={inputClass}
              value={sellingPrice}
              onChange={(e) => setSellingPrice(+e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Qty</label>
            <input
              type="number"
              className={inputClass}
              value={qty}
              onChange={(e) => setQty(+e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>HSN</label>
            <input type="text" className={inputClass} value={hsn} readOnly />
          </div>

          <div>
            <label className={labelClass}>Total ₹</label>
            <input
              type="number"
              className={`${inputClass} font-bold text-[#319bab]`}
              value={displayPrice}
              readOnly
            />
          </div>
        </div>

        {/* ROW 2 */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div>
            <label className={labelClass}>GST %</label>
            <input
              type="number"
              className={inputClass}
              value={gst}
              onChange={(e) => setGst(+e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>CGST %</label>
            <input
              type="number"
              className={`${inputClass} bg-gray-50`}
              value={cgst}
              readOnly
            />
          </div>

          <div>
            <label className={labelClass}>SGST %</label>
            <input
              type="number"
              className={`${inputClass} bg-gray-50`}
              value={sgst}
              readOnly
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={igst}
              onChange={(e) => setIgst(e.target.checked)}
            />
            <span className="text-xs font-bold text-gray-600">IGST</span>
          </div>

          <div className="md:col-span-2">
            <button
              onClick={addItem}
              className="w-full bg-[#319bab] text-white h-[42px] rounded-xl font-bold flex items-center justify-center hover:bg-[#257f87] transition shadow-lg"
            >
              <FaPlus className="mr-2" /> ADD ITEM
            </button>
          </div>
        </div>
      </div>

      {/* ADDED ITEMS TABLE */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold">
              <tr>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Tax</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 font-semibold">
                    {item.name}
                    <div className="text-[10px] text-gray-400">
                      HSN: {item.hsn}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">{item.qty}</td>
                  <td className="px-4 py-3 text-right">₹{item.purchasePrice}</td>
                  <td className="px-4 py-3 text-right">
                    {item.igst
                      ? `IGST ${item.gst}%`
                      : `CGST ${item.cgst}% + SGST ${item.sgst}%`}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[#319bab]">
                    ₹{item.total}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-500 hover:text-red-700 cursor-pointer"
                      title="Delete item"
                    >
                      <FaTrash className="inline-block" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SUMMARY */}
      <div className="bg-white p-6 rounded-3xl shadow-xl border border-primary/5 h-fit sticky top-24">
        <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest mb-6 border-b pb-2 border-[#319bab]/30">
          Order Summary
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-bold">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tax Amount</span>
            <span className="font-bold">₹{totalTax.toFixed(2)}</span>
          </div>
          <div className="pt-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-800 font-black text-xs uppercase">
                Grand Total
              </span>
              <span className="text-3xl font-black text-[#319bab] italic">
                ₹{grandTotal.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 mt-8">
            <button
              onClick={handleFinalAction}
              className="w-full bg-[#319bab] text-white py-3 rounded-xl font-bold uppercase text-[10px] hover:bg-[#257f87] transition"
            >
              Place Purchase Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryPurchaseOrderEntry;
