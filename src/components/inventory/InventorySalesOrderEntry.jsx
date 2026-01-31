import { useEffect, useMemo, useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import { API_BASE } from "../../api";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#319bab] outline-none text-sm";
const selectClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-1 focus:ring-[#319bab] outline-none text-sm appearance-none";
const labelClass =
  "block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight";


export default function InventorySalesOrderEntry({
  voucherTypes = [],
  warehouses = [],
  billingPersons = [],
  agents = [],
  products = [],
  customers = []
}) {
  const [voucherType, setVoucherType] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [billingPerson, setBillingPerson] = useState("");

  const [productGroup, setProductGroup] = useState("");
  const [selectedItem, setSelectedItem] = useState("");

  const [sellingPrice, setSellingPrice] = useState(0);
  const [qty, setQty] = useState(1);
  const [gst, setGst] = useState(0);
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);
  const [igst, setIgst] = useState(false);
  const [hsn, setHsn] = useState("");

  const [items, setItems] = useState([]);

  const [transportCharge, setTransportCharge] = useState(0);
  const [agent, setAgent] = useState("");
  const [enableEway, setEnableEway] = useState(false);
  const [ewayBillNo, setEwayBillNo] = useState("");

  const [ewayDate, setEwayDate] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [transportMode, setTransportMode] = useState("Road");
  const [transporterName, setTransporterName] = useState("");
  const [poItems, setPoItems] = useState([]);
  const [discountType, setDiscountType] = useState("PERCENT");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmountInput, setDiscountAmountInput] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);


  useEffect(() => {
    if (!voucherType) {
      setInvoiceId("");
      return;
    }

    const fetchPreview = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/sales-orders/preview/${voucherType}`
        );
        const data = await res.json();

        if (!res.ok) throw new Error(data.message);

        setInvoiceId(data.invoiceId);
      } catch (err) {
        toast.error("Failed to generate invoice number");
        setInvoiceId("");
      }
    };

    fetchPreview();
  }, [voucherType]);




  useEffect(() => {
    const loadPoItems = async () => {
      try {
        const res = await fetch(`${API_BASE}/purchase-orders/items`);
        const data = await res.json();
        if (!res.ok) throw new Error();
        setPoItems(data);
      } catch {
        toast.error("Failed to load purchase data");
      }
    };

    loadPoItems();
  }, []);



  const filteredProducts = useMemo(() => {
    return productGroup
      ? products.filter((p) => p.groupId === productGroup)
      : [];
  }, [products, productGroup]);

  const productsWithStock = useMemo(() => {
  return filteredProducts.map((p) => {
    const po = poItems.find(
      x =>
        String(x.productId) === String(p._id) && // ✅ MATCH BY PRODUCT ID
        x.warehouse === warehouse
    );

    return {
      ...p,
      availableQty: po ? po.qty : 0,
      poSellingPrice: po?.sellingPrice || 0,
      poGst: po?.gst || 0,
      poHsn: po?.hsn || "",
    };
  });
}, [filteredProducts, poItems, warehouse]);


  const handleItemSelection = (id) => {
    const product = productsWithStock.find(p => p._id === id);
    if (!product) return;

    setSelectedItem(id);
    setQty(1);

    setSellingPrice(product.poSellingPrice);
    setGst(product.poGst);
    setCgst(product.poGst / 2);
    setSgst(product.poGst / 2);
    setIgst(false);
    setHsn(product.poHsn);
  };



  const displayPrice = useMemo(() => {
    const base = sellingPrice * qty;

    const discountAmount =
      discountType === "PERCENT"
        ? (base * discountPercent) / 100
        : discountAmountInput;

    const safeDiscount = Math.min(discountAmount, base);
    const taxable = base - safeDiscount;
    const tax = (taxable * gst) / 100;

    return taxable + tax;
  }, [sellingPrice, qty, gst, discountType, discountPercent, discountAmountInput]);

  const handleCustomerSelect = (id) => {
    setCustomerId(id);
    const customer = customers.find(c => c._id === id);
    setSelectedCustomer(customer || null);

    setTransportCharge(0);
  };



  const addItem = () => {
    if (!selectedItem) {
      toast.warning("Select item");
      return;
    }

    const p = products.find((x) => x._id === selectedItem);
    if (!p) return;

    // 1️⃣ BASE AMOUNT
    const baseAmount = Number(sellingPrice) * Number(qty);

    // 2️⃣ DISCOUNT (₹ or %)
    const calculatedDiscount =
      discountType === "PERCENT"
        ? (baseAmount * Number(discountPercent)) / 100
        : Number(discountAmountInput);

    const discountAmount = Math.min(calculatedDiscount, baseAmount);

    // 3️⃣ TAXABLE AMOUNT
    const taxableAmount = baseAmount - discountAmount;

    // 4️⃣ GST AMOUNT
    const taxAmount = (taxableAmount * Number(gst)) / 100;

    // 5️⃣ GST BREAKUP
    const taxBreakup = igst
      ? {
        igst: Number(gst),
        cgst: 0,
        sgst: 0,
      }
      : {
        igst: 0,
        cgst: Number(gst) / 2,
        sgst: Number(gst) / 2,
      };

    // 6️⃣ FINAL TOTAL (ITEM LEVEL)
    const totalAmount = taxableAmount + taxAmount;

    // 7️⃣ PUSH ITEM (STORE EVERYTHING CLEANLY)
    setItems((prev) => [
      ...prev,
      {
        productId: p._id,
        name: p.name,
        hsn,
        qty: Number(qty),
        sellingPrice: Number(sellingPrice),

        baseAmount,
        discountType,
        discountPercent: Number(discountPercent),
        discountAmount,

        taxableAmount,
        gst: Number(gst),
        ...taxBreakup,
        taxAmount,

        total: totalAmount,
      },
    ]);

    // 8️⃣ RESET FORM
    setSelectedItem("");
    setSellingPrice(0);
    setQty(1);
    setDiscountPercent(0);
    setDiscountAmountInput(0);
    setGst(0);
    setIgst(false);
    setHsn("");
  };

  const removeItem = (i) => {
    setItems(items.filter((_, idx) => idx !== i));
  };

  const subtotal = items.reduce(
    (s, i) => s + i.qty * i.sellingPrice,
    0
  );

  const totalDiscount = items.reduce(
    (sum, item) => sum + (item.discountAmount || 0),
    0
  );

  const totalTax = items.reduce((s, i) => {
    const base = i.qty * i.sellingPrice;
    const taxable = base - (i.discountAmount || 0);
    return s + (taxable * i.gst) / 100;
  }, 0);

  const grandTotal =
    subtotal - totalDiscount + totalTax + Number(transportCharge || 0);


  const payload = {
    voucherType,
    customer: selectedCustomer
      ? {
        id: selectedCustomer._id,
        name: selectedCustomer.name,
        whatsapp: selectedCustomer.whatsapp,
        address: selectedCustomer.address,
        district: selectedCustomer.district,
        state: selectedCustomer.state,
        pincode: selectedCustomer.pincode,
      }
      : null,
    agent,
    warehouse,
    billingPerson,
    items,
    transportCharge,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
    ewayEnabled: enableEway,
    ewayDetails: enableEway
      ? {
        ewayBillNo,
        ewayDate,
        vehicleNo,
        transportMode,
        transporterName,
      }
      : null,
  };

  const handleFinalAction = async () => {
    if (!voucherType || !warehouse || !billingPerson || items.length === 0) {
      return toast.error("Fill all required fields");
    }

    if (!customerId) {
      return toast.error("Please select a customer"); // ✅ ADD
    }

    try {
      const res = await fetch(`${API_BASE}/sales-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      toast.success(`Sales Order Created: ${data.invoiceId}`);
      setInvoiceId(data.invoiceId);
    } catch (err) {
      toast.error(err.message || "Failed to save Sales Order");
    }
  };



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
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className={labelClass}>Voucher Type</label>
          <select className={selectClass} value={voucherType} onChange={(e) => setVoucherType(e.target.value)}>
            <option value="">-- Select --</option>
            {voucherTypes.map((v) => (
              <option key={v._id} value={v.name}>{v.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Invoice ID</label>
          <input className={`${inputClass} bg-gray-50 font-bold text-[#319bab]`} value={invoiceId} readOnly />
        </div>

        <div>
          <label className={labelClass}>Warehouse</label>
          <select className={selectClass} value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
            <option value="">-- Select --</option>
            {warehouses.map((w) => (
              <option key={w._id} value={w.name}>{w.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Billing Person</label>
          <select className={selectClass} value={billingPerson} onChange={(e) => setBillingPerson(e.target.value)}>
            <option value="">-- Select --</option>
            {billingPersons.map((b) => (
              <option key={b._id} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Agent</label>
          <select className={selectClass} value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="">-- Select --</option>
            {agents.map((a) => (
              <option key={a._id} value={a.name}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* PRODUCT GROUP */}
      <div>
        <label className={labelClass}>Product Group</label>
        <select className={selectClass} value={productGroup} onChange={(e) => setProductGroup(e.target.value)}>
          <option value="">Select Product Group</option>
          {[...new Set(products.map((p) => p.groupId))].map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      {/* ITEM ENTRY */}
      <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-4">

        <div className="grid grid-cols-1 md:grid-cols-8 gap-3">
          <div>
            <label className={labelClass}>Item Name</label>
            <select
              className={selectClass}
              value={selectedItem}
              onChange={(e) => handleItemSelection(e.target.value)}
              disabled={!productGroup || !warehouse} // ✅ ADD warehouse
            >

              <option value="">
                {!warehouse
                  ? "Select warehouse first"
                  : productGroup
                    ? "Select Product"
                    : "Select Product Group first"}
              </option>

              {productsWithStock.map((p) => (
                <option
                  key={p._id}
                  value={p._id}
                  disabled={p.availableQty === 0}
                >
                  {p.name} ({p.unit}) — Qty: {p.availableQty}
                </option>
              ))}

            </select>
          </div>

          <div>
            <label className={labelClass}>HSN</label>
            <input className={inputClass} value={hsn} readOnly />
          </div>

          <div>
            <label className={labelClass}>Selling ₹</label>
            <input type="number" className={inputClass} value={sellingPrice} onChange={(e) => setSellingPrice(+e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>Qty</label>
            <input
              type="number"
              className={inputClass}
              value={qty}
              min={1}
              max={
                productsWithStock.find(p => p._id === selectedItem)?.availableQty || 1
              }
              onChange={(e) => setQty(+e.target.value)}
            />

          </div>

          <div>
            <label className={labelClass}>GST %</label>
            <input type="number" className={inputClass} value={gst} onChange={(e) => setGst(+e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>Discount Type</label>
            <select
              className={selectClass}
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
            >
              <option value="PERCENT">%</option>
              <option value="AMOUNT">₹</option>
            </select>
          </div>

          {discountType === "PERCENT" ? (
            <div>
              <label className={labelClass}>Discount %</label>
              <input
                type="number"
                className={inputClass}
                value={discountPercent}
                min="0"
                max="100"
                onChange={(e) => setDiscountPercent(+e.target.value)}
              />
            </div>
          ) : (
            <div>
              <label className={labelClass}>Discount ₹</label>
              <input
                type="number"
                className={inputClass}
                value={discountAmountInput}
                min="0"
                onChange={(e) => setDiscountAmountInput(+e.target.value)}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>Total ₹</label>
            <input className={`${inputClass} font-bold text-[#319bab]`} value={displayPrice.toFixed(2)} readOnly />
          </div>

          <div className="flex items-end">
            <button onClick={addItem} className="w-full bg-[#319bab] text-white h-[42px] rounded-xl font-bold flex items-center justify-center hover:bg-[#257f87] transition shadow-lg">
              <FaPlus className="mr-2" /> ADD
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
            <input type="checkbox" checked={igst} onChange={(e) => setIgst(e.target.checked)} /> IGST
          </label>
          {!igst && (
            <>
              <span className="text-xs font-bold text-gray-600">CGST {gst / 2}%</span>
              <span className="text-xs font-bold text-gray-600">SGST {gst / 2}%</span>
            </>
          )}
        </div>

      </div>

      {/* TABLE */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold">
              <tr>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Discount</th>
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
                    <div className="text-[10px] text-gray-400">HSN: {item.hsn}</div>
                  </td>
                  <td className="px-4 py-3 text-center">{item.qty}</td>
                  <td className="px-4 py-3 text-right">₹{item.sellingPrice}</td>
                  <td className="px-4 py-3 text-right text-red-500">
                    ₹{item.discountAmount.toFixed(2)}
                  </td>


                  <td className="px-4 py-3 text-right">
                    {item.igst
                      ? `IGST ${item.gst}%`
                      : `CGST ${item.cgst}% + SGST ${item.sgst}%`}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[#319bab]">₹{item.total.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CUSTOMER DETAILS */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest">
          Customer Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>Customer</label>
            <select
              className={selectClass}
              value={customerId}
              onChange={(e) => handleCustomerSelect(e.target.value)}
            >
              <option value="">-- Select Customer --</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.whatsapp})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>WhatsApp</label>
            <input className={inputClass} value={selectedCustomer?.whatsapp || ""} readOnly />
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input className={inputClass} value={selectedCustomer?.email || ""} readOnly />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Address</label>
            <textarea
              className={`${inputClass} h-16`}
              value={selectedCustomer?.address || ""}
              readOnly
            />
          </div>

          <div>
            <label className={labelClass}>District</label>
            <input className={inputClass} value={selectedCustomer?.district || ""} readOnly />
          </div>

          <div>
            <label className={labelClass}>State</label>
            <input className={inputClass} value={selectedCustomer?.state || ""} readOnly />
          </div>

          <div>
            <label className={labelClass}>Pincode</label>
            <input className={inputClass} value={selectedCustomer?.pincode || ""} readOnly />
          </div>
        </div>
      </div>


      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest">
            E-Way Bill Details
          </h3>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enableEway}
              onChange={(e) => setEnableEway(e.target.checked)}
            />
            <span className="text-xs font-bold text-gray-600">
              Enable E-Way
            </span>
          </div>
        </div>

        {enableEway && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className={labelClass}>E-Way Bill No</label>
              <input
                type="text"
                className={inputClass}
                value={ewayBillNo}
                onChange={(e) => setEwayBillNo(e.target.value)}
                placeholder="Enter E-Way No"
              />
            </div>

            <div>
              <label className={labelClass}>E-Way Date</label>
              <input
                type="date"
                className={inputClass}
                value={ewayDate}
                onChange={(e) => setEwayDate(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Vehicle No</label>
              <input
                type="text"
                className={inputClass}
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="TN09AB1234"
              />
            </div>

            <div>
              <label className={labelClass}>Transport Mode</label>
              <select
                className={selectClass}
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value)}
              >
                <option value="Road">Road</option>
                <option value="Rail">Rail</option>
                <option value="Air">Air</option>
                <option value="Ship">Ship</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Transporter</label>
              <input
                type="text"
                className={inputClass}
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                placeholder="ABC Logistics"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500">Transport Charge</span>
        <input
          type="number"
          min="0"
          className="w-32 border border-gray-300 rounded-lg px-2 py-1 text-right font-bold"
          value={transportCharge}
          onChange={(e) => setTransportCharge(+e.target.value || 0)}
        />
      </div>


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
            <span className="text-gray-500">Discount</span>
            <span className="font-bold text-red-500">
              -₹{totalDiscount.toFixed(2)}
            </span>
          </div>


          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tax Amount</span>
            <span className="font-bold">₹{totalTax.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Transport</span>
            <span className="font-bold">₹{Number(transportCharge || 0).toFixed(2)}</span>
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
            <button onClick={handleFinalAction} className="w-full bg-[#319bab] text-white py-3 rounded-xl font-bold uppercase text-[10px] hover:bg-[#257f87] transition">
              Place Sales Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
