import { useState } from "react";

const sampleVouchers = [
  { id: 1, name: "SO-Direct" },
  { id: 2, name: "SO-Online" },
];

const sampleGroups = [
  { id: 1, name: "Pearls" },
  { id: 2, name: "Jewellery" },
];

const sampleWarehouses = [
  { id: 1, name: "Main Warehouse" },
  { id: 2, name: "Chennai Warehouse" },
];

const sampleProducts = [
  { id: 1, name: "Akoya Pearl", price: 1200, gst: 18 },
  { id: 2, name: "South Sea Pearl", price: 2200, gst: 18 },
];

const sampleAgents = [
  { id: 1, name: "Ravi" },
  { id: 2, name: "Suresh" },
];

const sampleDeliveryPersons = [
  { id: 1, name: "Kumar" },
  { id: 2, name: "Manoj" },
];

export default function SalesOrderPage() {
  const [voucher, setVoucher] = useState("");
  const [group, setGroup] = useState("");
  const [warehouse, setWarehouse] = useState("");

  const [item, setItem] = useState({
    productId: "",
    qty: 1,
    price: 0,
    gst: 0,
    cgst: 0,
    sgst: 0,
    total: 0,
  });

  const [items, setItems] = useState([]);
  const [transportCharge, setTransportCharge] = useState(0);
  const [agent, setAgent] = useState("");
  const [deliveryPerson, setDeliveryPerson] = useState("");

  const handleProductChange = (id) => {
    const p = sampleProducts.find((x) => x.id === Number(id));
    if (!p) return;

    const gstAmount = (p.price * p.gst) / 100;
    const cgst = gstAmount / 2;
    const sgst = gstAmount / 2;

    const total = p.price + gstAmount;

    setItem({
      productId: id,
      qty: 1,
      price: p.price,
      gst: p.gst,
      cgst,
      sgst,
      total,
    });
  };

  const handleQtyChange = (qty) => {
    const q = Number(qty) || 1;
    const base = q * item.price;
    const gstAmount = (base * item.gst) / 100;
    const cgst = gstAmount / 2;
    const sgst = gstAmount / 2;
    const total = base + gstAmount;

    setItem({ ...item, qty: q, cgst, sgst, total });
  };

  const addItem = () => {
    if (!item.productId) return alert("Select product");
    setItems([...items, { ...item, id: Date.now() }]);
    setItem({ productId: "", qty: 1, price: 0, gst: 0, cgst: 0, sgst: 0, total: 0 });
  };

  const subTotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const taxTotal = items.reduce((s, i) => s + i.cgst + i.sgst, 0);
  const grandTotal = subTotal + taxTotal + Number(transportCharge || 0);

  return (
    <div className="pt-4 md:pt-0 md:pl-34 px-3 sm:px-6 space-y-5">
      {/* Common Bar */}
      <div className="bg-white rounded-xl shadow border p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select value={voucher} onChange={(e) => setVoucher(e.target.value)} className="border rounded px-3 py-2">
          <option value="">Voucher Type</option>
          {sampleVouchers.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>

        <select value={group} onChange={(e) => setGroup(e.target.value)} className="border rounded px-3 py-2">
          <option value="">Product Group</option>
          {sampleGroups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className="border rounded px-3 py-2">
          <option value="">Warehouse</option>
          {sampleWarehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* Add Item */}
      <div className="bg-white rounded-xl shadow border p-4 grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
        <select value={item.productId} onChange={(e) => handleProductChange(e.target.value)} className="border rounded px-3 py-2 md:col-span-2">
          <option value="">Item Name</option>
          {sampleProducts.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <input type="number" value={item.qty} onChange={(e) => handleQtyChange(e.target.value)} className="border rounded px-3 py-2" placeholder="Qty" />

        <input type="number" value={item.price} disabled className="border rounded px-3 py-2 bg-gray-100" placeholder="Unit Price" />

        <input type="number" value={item.gst} disabled className="border rounded px-3 py-2 bg-gray-100" placeholder="GST %" />

        <input type="number" value={item.cgst.toFixed(2)} disabled className="border rounded px-3 py-2 bg-gray-100" placeholder="CGST" />

        <input type="number" value={item.sgst.toFixed(2)} disabled className="border rounded px-3 py-2 bg-gray-100" placeholder="SGST" />

        <button onClick={addItem} className="bg-primary text-white rounded px-4 py-2">Add</button>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl shadow border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">CGST</th>
              <th className="px-3 py-2">SGST</th>
              <th className="px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="px-3 py-2">{sampleProducts.find(p => p.id === Number(i.productId))?.name}</td>
                <td className="px-3 py-2 text-center">{i.qty}</td>
                <td className="px-3 py-2 text-right">₹{i.price.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">₹{i.cgst.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">₹{i.sgst.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-semibold">₹{i.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-white rounded-xl shadow border p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input type="number" value={transportCharge} onChange={(e) => setTransportCharge(e.target.value)} className="border rounded px-3 py-2" placeholder="Transport Charge" />

        <select value={deliveryPerson} onChange={(e) => setDeliveryPerson(e.target.value)} className="border rounded px-3 py-2">
          <option value="">Delivery Person</option>
          {sampleDeliveryPersons.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <select value={agent} onChange={(e) => setAgent(e.target.value)} className="border rounded px-3 py-2">
          <option value="">Agent</option>
          {sampleAgents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Totals + Actions */}
      <div className="bg-white rounded-xl shadow border p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="space-y-1 text-sm">
          <div>Subtotal: ₹{subTotal.toFixed(2)}</div>
          <div>Tax: ₹{taxTotal.toFixed(2)}</div>
          <div className="font-bold text-primary text-lg">Grand Total: ₹{grandTotal.toFixed(2)}</div>
        </div>

        <div className="flex gap-3">
          <button className="bg-gray-200 px-5 py-2 rounded">Save Order</button>
          <button className="bg-primary text-white px-5 py-2 rounded">Place Order</button>
        </div>
      </div>
    </div>
  );
}
