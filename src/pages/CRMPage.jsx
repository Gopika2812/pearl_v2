import { useState } from "react";
import { FaFileInvoice, FaPlus, FaSearch, FaUser, FaWhatsapp } from "react-icons/fa";

/* ---------------- SAMPLE CLIENT DATA ---------------- */
const sampleClients = [
  { id: 1, name: "Rahul Kumar", phone: "+91 9876543210", email: "rahul@gmail.com", balance: 12400 },
  { id: 2, name: "Kannan Traders", phone: "+91 9887766554", email: "kannan@gmail.com", balance: 0 },
];

const sampleLedger = [
  { id: 1, clientId: 1, date: "2026-01-18", ref: "SO-102", type: "Sales", debit: 34000, credit: 0, balance: 12400 },
  { id: 2, clientId: 1, date: "2026-01-16", ref: "TXN-09", type: "Payment", debit: 0, credit: 18000, balance: -5600 },
  { id: 3, clientId: 2, date: "2026-01-17", ref: "SO-88", type: "Sales", debit: 21000, credit: 0, balance: 0 },
];

const sampleOrders = [
  { id: 1, clientId: 1, orderNo: "SO-102", date: "2026-01-18", qty: 7, amount: 34000, status: "Invoiced" },
  { id: 2, clientId: 2, orderNo: "SO-88", date: "2026-01-17", qty: 5, amount: 21000, status: "Paid" },
];

export default function CRMPage() {
  const [clients] = useState(sampleClients);
  const [selectedClient, setSelectedClient] = useState(sampleClients[0]);
  const [activeTab, setActiveTab] = useState("ledger");
  const [search, setSearch] = useState("");

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const clientLedger = sampleLedger.filter((l) => l.clientId === selectedClient.id);
  const clientOrders = sampleOrders.filter((o) => o.clientId === selectedClient.id);

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pl-64 px-4 sm:px-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

        {/* CLIENT LIST */}
        <div className="bg-white rounded-2xl shadow border p-4 md:col-span-1">
          <div className="relative mb-3">
            <FaSearch className="absolute left-3 top-3 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search Client"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border rounded-lg pl-9 pr-3 py-2 w-full text-sm focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {filteredClients.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedClient(c)}
                className={`p-3 rounded-xl border cursor-pointer transition ${
                  selectedClient.id === c.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-primary">{c.name}</div>
                  <div
                    className={`text-xs px-2 py-1 rounded-full ${
                      c.balance > 0
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {c.balance > 0 ? "Due" : "Paid"}
                  </div>
                </div>
                <div className="text-sm text-gray-500 mt-1">Balance: ₹{c.balance}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CLIENT PROFILE + TABS */}
        <div className="bg-white rounded-2xl shadow border p-5 md:col-span-3">
          {/* HEADER */}
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                <FaUser /> {selectedClient.name}
              </h2>
              <div className="text-sm text-gray-500 mt-1">
                {selectedClient.phone} | {selectedClient.email}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow">
                <FaWhatsapp /> WhatsApp
              </button>
              <button className="border px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                <FaFileInvoice /> Invoice
              </button>
              <button className="bg-primary/10 text-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                <FaPlus /> Order
              </button>
            </div>
          </div>

          {/* TABS */}
          <div className="flex gap-4 mt-6 border-b">
            {[
              { key: "ledger", label: "Ledger" },
              { key: "orders", label: "Orders" },
              { key: "invoices", label: "Invoices" },
              { key: "messages", label: "Messages" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-2 px-2 font-semibold text-sm transition ${
                  activeTab === tab.key
                    ? "border-b-2 border-primary text-primary"
                    : "text-gray-500 hover:text-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB CONTENT */}
          <div className="mt-4">
            {activeTab === "ledger" && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary/10 text-primary">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Ref</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Credit</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientLedger.map((l) => (
                      <tr key={l.id} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2">{l.date}</td>
                        <td className="px-3 py-2">{l.ref}</td>
                        <td className="px-3 py-2">{l.type}</td>
                        <td className="px-3 py-2 text-right">₹{l.debit}</td>
                        <td className="px-3 py-2 text-right">₹{l.credit}</td>
                        <td className="px-3 py-2 text-right font-semibold">₹{l.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "orders" && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary/10 text-primary">
                    <tr>
                      <th className="px-3 py-2">Order No</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientOrders.map((o) => (
                      <tr key={o.id} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2">{o.orderNo}</td>
                        <td className="px-3 py-2">{o.date}</td>
                        <td className="px-3 py-2 text-center">{o.qty}</td>
                        <td className="px-3 py-2 text-right">₹{o.amount}</td>
                        <td className="px-3 py-2">
                          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold">
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "invoices" && (
              <div className="text-sm text-gray-500 p-4">No invoices yet.</div>
            )}

            {activeTab === "messages" && (
              <div className="text-sm text-gray-500 p-4">WhatsApp logs will appear here.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
