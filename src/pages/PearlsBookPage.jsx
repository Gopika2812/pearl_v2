import { useState } from "react";
import { FaFilter, FaPlus, FaSearch } from "react-icons/fa";

/* ---------------- SAMPLE DATA ---------------- */
const sampleLedger = [
  { id: 1, type: "sales", ref: "SO-102", date: "2026-01-18", party: "Rahul", warehouse: "Main", qty: 7, amount: 34000, status: "Invoiced" },
  { id: 2, type: "purchase", ref: "PO-44", date: "2026-01-17", party: "Kannan Traders", warehouse: "Main", qty: 10, amount: 21000, status: "Received" },
  { id: 3, type: "credit", ref: "TXN-09", date: "2026-01-16", party: "IDFC Bank", warehouse: "-", qty: 0, amount: 18000, status: "Success" },
  { id: 4, type: "debit", ref: "TXN-10", date: "2026-01-16", party: "IOB Bank", warehouse: "-", qty: 0, amount: 12000, status: "Success" },
  { id: 5, type: "return", ref: "RET-03", date: "2026-01-15", party: "Rahul", warehouse: "Main", qty: 2, amount: 3200, status: "HR Pending" },
];

export default function PearlsBookPage() {
  const [records] = useState(sampleLedger);
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showReturnModal, setShowReturnModal] = useState(false);

  /* ---------------- FILTER LOGIC ---------------- */
  const filtered = records.filter((r) => {
    const matchType = filterType === "all" || r.type === filterType;

    const matchSearch =
      r.ref.toLowerCase().includes(search.toLowerCase()) ||
      r.party.toLowerCase().includes(search.toLowerCase());

    const recordDate = new Date(r.date).getTime();
    const matchFrom = fromDate ? recordDate >= new Date(fromDate).getTime() : true;
    const matchTo = toDate ? recordDate <= new Date(toDate).getTime() : true;

    return matchType && matchSearch && matchFrom && matchTo;
  });

  /* ---------------- SUMMARY ---------------- */
  const totalSales = filtered.filter(r => r.type === "sales").reduce((s, r) => s + r.amount, 0);
  const totalPurchase = filtered.filter(r => r.type === "purchase").reduce((s, r) => s + r.amount, 0);
  const credits = filtered.filter(r => r.type === "credit").reduce((s, r) => s + r.amount, 0);
  const debits = filtered.filter(r => r.type === "debit").reduce((s, r) => s + r.amount, 0);
  const balance = credits - debits;

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pl-64 px-4 sm:px-6 space-y-6">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Pearls Book</h1>
          <p className="text-sm text-gray-500">Unified ledger of all business transactions</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-2xl shadow border">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
          >
            <option value="all">All</option>
            <option value="sales">Sales</option>
            <option value="purchase">Purchase</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
            <option value="return">Return</option>
          </select>

          <div className="relative">
            <FaSearch className="absolute left-3 top-3 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search Ref / Party"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border rounded-lg pl-9 pr-3 py-2 w-full text-sm focus:ring-2 focus:ring-primary"
            />
          </div>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
          />

          <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm shadow hover:bg-primary/90 transition flex items-center justify-center gap-2">
            <FaFilter /> Apply
          </button>

        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <SummaryCard title="Sales" value={totalSales} />
        <SummaryCard title="Purchase" value={totalPurchase} />
        <SummaryCard title="Credits" value={credits} />
        <SummaryCard title="Debits" value={debits} />
        <SummaryCard title="Balance" value={balance} highlight />
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden md:block bg-white rounded-2xl shadow border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-primary/10 text-primary">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Ref No</th>
              <th className="px-4 py-3 text-left">Party</th>
              <th className="px-4 py-3 text-left">Warehouse</th>
              <th className="px-4 py-3 text-center">Qty</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50 transition">
                <td className="px-4 py-3">{r.date}</td>
                <td className="px-4 py-3 font-semibold text-primary">{r.type.toUpperCase()}</td>
                <td className="px-4 py-3">{r.ref}</td>
                <td className="px-4 py-3">{r.party}</td>
                <td className="px-4 py-3">{r.warehouse}</td>
                <td className="px-4 py-3 text-center">{r.qty}</td>
                <td className="px-4 py-3 text-right font-medium">₹{r.amount.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold">
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button className="text-primary underline text-sm">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARDS */}
      <div className="md:hidden space-y-3">
        {filtered.map((r) => (
          <div key={r.id} className="bg-white rounded-xl shadow border p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">{r.date}</span>
              <span className="text-xs font-bold text-primary">{r.type.toUpperCase()}</span>
            </div>

            <div className="font-semibold">{r.ref}</div>
            <div className="text-sm text-gray-600">{r.party}</div>

            <div className="grid grid-cols-2 text-sm gap-2">
              <div><span className="text-gray-500">Warehouse:</span> {r.warehouse}</div>
              <div><span className="text-gray-500">Qty:</span> {r.qty}</div>
              <div><span className="text-gray-500">Amount:</span> ₹{r.amount.toFixed(2)}</div>
              <div><span className="text-gray-500">Status:</span> {r.status}</div>
            </div>

            <button className="text-primary underline text-sm">View</button>
          </div>
        ))}
      </div>

      {/* FLOATING RETURN BUTTON */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowReturnModal(true)}
          className="bg-primary text-white lg:w-64 h-12 p-5 rounded-xl shadow-xl hover:bg-primary/90 transition flex items-center justify-center"
        >
          <FaPlus /> Add Return Products
        </button>
      </div>

      {/* RETURN MODAL */}
      {showReturnModal && <ReturnModal onClose={() => setShowReturnModal(false)} />}
    </div>
  );
}

/* ---------------- SUMMARY CARD ---------------- */
const SummaryCard = ({ title, value, highlight }) => (
  <div className={`bg-white rounded-2xl shadow border p-5 ${highlight ? "border-primary" : ""}`}>
    <div className="text-sm text-gray-500">{title}</div>
    <div className="text-xl font-bold text-primary mt-1">₹{value.toFixed(2)}</div>
  </div>
);

/* ---------------- RETURN MODAL ---------------- */
const ReturnModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-primary p-4 text-white font-bold text-lg">Return Product</div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input placeholder="Voucher Type" className="border rounded-lg p-2 focus:ring-2 focus:ring-primary" />
          <input placeholder="Product Group" className="border rounded-lg p-2 focus:ring-2 focus:ring-primary" />
          <input placeholder="Warehouse" className="border rounded-lg p-2 focus:ring-2 focus:ring-primary" />
          <input placeholder="Item Name" className="border rounded-lg p-2 focus:ring-2 focus:ring-primary" />
          <input type="number" placeholder="Qty" className="border rounded-lg p-2 focus:ring-2 focus:ring-primary" />
          <input type="number" placeholder="Returned Qty" className="border rounded-lg p-2 focus:ring-2 focus:ring-primary" />
          <input type="number" placeholder="Refundable Amount" className="border rounded-lg p-2 col-span-1 sm:col-span-2 focus:ring-2 focus:ring-primary" />

          <select className="border rounded-lg p-2 col-span-1 sm:col-span-2 focus:ring-2 focus:ring-primary">
            <option value="no">HR Permission - No</option>
            <option value="yes">HR Permission - Yes</option>
          </select>
        </div>

        <div className="flex gap-3 p-4 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg p-2 hover:bg-gray-50">
            Cancel
          </button>
          <button className="flex-1 bg-primary text-white rounded-lg p-2 font-bold hover:bg-primary/90">
            Save Return
          </button>
        </div>
      </div>
    </div>
  );
};
