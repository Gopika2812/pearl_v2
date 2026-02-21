import { useEffect, useState } from "react";
import { FaCopy, FaSearch, FaUser, FaWhatsapp } from "react-icons/fa";
import { API_BASE } from "../api";

export default function CRMPage() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState("orders");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(null);

  // Fetch customers and sales orders
  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/customers`);
      const data = await response.json();

      if (Array.isArray(data)) {
        setCustomers(data);
        if (data.length > 0 && !selectedCustomer) {
          setSelectedCustomer(data[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.whatsapp?.includes(search.replace(/\D/g, ""))
  );

  // Get first sale order for selected customer
  const firstSaleOrder = selectedCustomer?.sales?.[0] || null;

  // Generate invoice link
  const generateInvoiceLink = (invoiceId) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/invoice/${invoiceId}`;
  };

  // Generate CRM link
  const generateCRMLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/customer-login`;
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(type);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const sendWhatsappMessage = (phone, invoiceLink, crmLink) => {
    const message = `Hello ${selectedCustomer.name},\n\nHere are your links:\n\n📄 Invoice: ${invoiceLink}\n🛒 Pearls Shopping: ${crmLink}`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/91${phone.replace(/\D/g, "")}?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pl-64 px-4 sm:px-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

        {/* CUSTOMER LIST */}
        <div className="bg-white rounded-2xl shadow border p-4 md:col-span-1">
          <div className="relative mb-3">
            <FaSearch className="absolute left-3 top-3 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search Customer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border rounded-lg pl-9 pr-3 py-2 w-full text-sm focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {filteredCustomers.map((c) => (
              <div
                key={c._id}
                onClick={() => setSelectedCustomer(c)}
                className={`p-3 rounded-xl border cursor-pointer transition ${
                  selectedCustomer?._id === c._id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-primary text-sm">{c.name}</div>
                  <div
                    className={`text-xs px-2 py-1 rounded-full ${
                      c.closingBalance > 0
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {c.closingBalance > 0 ? "Due" : "Paid"}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {c.whatsapp && `📱 ${c.whatsapp}`}
                </div>
                <div className="text-xs text-gray-600 mt-1">Balance: ₹{c.closingBalance || 0}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CUSTOMER PROFILE + TABS */}
        <div className="bg-white rounded-2xl shadow border p-5 md:col-span-3">
          {selectedCustomer ? (
            <>
              {/* HEADER */}
              <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                    <FaUser /> {selectedCustomer.name}
                  </h2>
                  <div className="text-sm text-gray-500 mt-1">
                    {selectedCustomer.whatsapp && `📱 ${selectedCustomer.whatsapp}`}
                    {selectedCustomer.email && ` | ${selectedCustomer.email}`}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const phone = selectedCustomer.whatsapp || "";
                      const invoiceLink = firstSaleOrder ? generateInvoiceLink(firstSaleOrder.invoiceId) : "#";
                      const crmLink = generateCRMLink();
                      sendWhatsappMessage(phone, invoiceLink, crmLink);
                    }}
                    className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow hover:bg-green-600"
                  >
                    <FaWhatsapp /> Send Links
                  </button>
                </div>
              </div>

              {/* FIRST SALE ORDER INFO */}
              {firstSaleOrder && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <h3 className="font-bold text-blue-900 mb-3">📦 First Sale Order</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-gray-600">Order No</p>
                      <p className="font-bold text-blue-900">{firstSaleOrder.invoiceId}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Date</p>
                      <p className="font-bold text-blue-900">
                        {new Date(firstSaleOrder.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Amount</p>
                      <p className="font-bold text-blue-900">₹{firstSaleOrder.grandTotal}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Status</p>
                      <p className={`font-bold ${firstSaleOrder.invoiceGenerated ? "text-green-600" : "text-yellow-600"}`}>
                        {firstSaleOrder.invoiceGenerated ? "Invoiced" : "Pending"}
                      </p>
                    </div>
                  </div>

                  {/* INVOICE AND CRM LINKS */}
                  <div className="mt-4 space-y-2 border-t pt-4">
                    {/* INVOICE LINK */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">Invoice Link</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={generateInvoiceLink(firstSaleOrder.invoiceId)}
                          readOnly
                          className="flex-1 px-3 py-2 border rounded-lg text-sm bg-gray-50"
                        />
                        <button
                          onClick={() => copyToClipboard(generateInvoiceLink(firstSaleOrder.invoiceId), "invoice")}
                          className="bg-primary text-white px-3 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2"
                        >
                          <FaCopy size={14} />
                          {copiedLink === "invoice" ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>

                    {/* CRM LINK */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">Pearls Shopping Link</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={generateCRMLink()}
                          readOnly
                          className="flex-1 px-3 py-2 border rounded-lg text-sm bg-gray-50"
                        />
                        <button
                          onClick={() => copyToClipboard(generateCRMLink(), "crm")}
                          className="bg-primary text-white px-3 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2"
                        >
                          <FaCopy size={14} />
                          {copiedLink === "crm" ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TABS */}
              <div className="flex gap-4 border-b mb-4">
                {[
                  { key: "orders", label: "Orders" },
                  { key: "details", label: "Details" },
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
                {activeTab === "orders" && (
                  <div className="overflow-x-auto">
                    {selectedCustomer.sales && selectedCustomer.sales.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead className="bg-primary/10 text-primary">
                          <tr>
                            <th className="px-3 py-2 text-left">Order No</th>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            <th className="px-3 py-2 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCustomer.sales.map((order) => (
                            <tr key={order._id} className="border-t hover:bg-gray-50">
                              <td className="px-3 py-2 font-semibold">{order.invoiceId}</td>
                              <td className="px-3 py-2">{new Date(order.createdAt).toLocaleDateString()}</td>
                              <td className="px-3 py-2 text-right">₹{order.grandTotal}</td>
                              <td className="px-3 py-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${order.invoiceGenerated ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {order.invoiceGenerated ? "Invoiced" : "Pending"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-gray-500 text-sm">No orders found</p>
                    )}
                  </div>
                )}

                {activeTab === "details" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-700">Customer Name</p>
                        <p className="text-sm text-gray-900">{selectedCustomer.name}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">WhatsApp Number</p>
                        <p className="text-sm text-gray-900">{selectedCustomer.whatsapp}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">Email</p>
                        <p className="text-sm text-gray-900">{selectedCustomer.email || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">Current Balance</p>
                        <p className="text-sm text-gray-900 font-bold">₹{selectedCustomer.closingBalance || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">Address</p>
                        <p className="text-sm text-gray-900">{selectedCustomer.address || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">GSTIN</p>
                        <p className="text-sm text-gray-900">{selectedCustomer.gstin || "-"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              {loading ? "Loading customers..." : "Select a customer to view details"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
