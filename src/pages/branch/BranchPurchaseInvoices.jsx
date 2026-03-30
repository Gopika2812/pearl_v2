import React, { useEffect, useState } from "react";
import { FaChevronDown, FaFileAlt, FaSync, FaSearch } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

const BranchPurchaseInvoices = () => {
  const { currentBranch } = useBranch();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Search debounce logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchInvoices = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/purchase-invoices?branchId=${currentBranch._id}${debouncedSearch ? `&search=${debouncedSearch}` : ""}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch invoices");
      setInvoices(data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [currentBranch?._id, debouncedSearch]);

  const toggleExpanded = (invoiceId) => {
    setExpandedInvoices((prev) => ({
      ...prev,
      [invoiceId]: !prev[invoiceId],
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <ToastContainer position="top-right" autoClose={2500} theme="colored" />

      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4">
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center text-white">
                <FaFileAlt size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-800">Purchase Invoices</h1>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Finalized Records</p>
              </div>
            </div>
            <button
              onClick={fetchInvoices}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-bold text-sm"
            >
              <FaSync className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* SEARCH */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 relative">
          <FaSearch className="absolute left-8 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            placeholder="Search by Invoice ID, Vendor, or Product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-green-600 text-sm"
          />
        </div>

        {/* TABLE */}
        {loading ? (
          <div className="bg-white p-8 text-center rounded-2xl border">Loadingized invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-2xl border text-gray-500">No finalized purchase invoices found.</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold border-b">
                  <tr>
                    <th className="px-6 py-4 text-left">Invoice ID</th>
                    <th className="px-6 py-4 text-left">Order Reference</th>
                    <th className="px-6 py-4 text-left">Vendor</th>
                    <th className="px-6 py-4 text-right">Grand Total</th>
                    <th className="px-6 py-4 text-center">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv) => (
                    <React.Fragment key={inv._id}>
                      <tr className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                               onClick={() => toggleExpanded(inv._id)}
                               className="text-green-600 p-1"
                            >
                              <FaChevronDown className={`transition-transform ${expandedInvoices[inv._id] ? "rotate-180" : ""}`} />
                            </button>
                            <span className="font-black text-green-700">{inv.purchaseInvoiceId}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-500 font-medium text-xs">
                          {inv.purchaseOrderId ? `PO Ref: ${inv.purchaseOrderId.invoiceId || inv.purchaseOrderId}` : "N/A"}
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-800">{inv.vendor}</td>
                        <td className="px-6 py-4 text-right font-black text-green-700">₹{(inv.grandTotal || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-center text-xs text-gray-500">
                           {new Date(inv.createdAt).toLocaleDateString("en-IN")}
                        </td>
                      </tr>

                      {/* EXPANDED SECTION */}
                      {expandedInvoices[inv._id] && (
                        <tr className="bg-gray-50">
                          <td colSpan="5" className="px-6 py-4">
                            <div className="bg-white p-4 rounded-xl border">
                              <h4 className="font-bold text-xs uppercase text-gray-400 mb-2">Invoice Items</h4>
                              <table className="w-full text-xs">
                                <thead className="border-b">
                                  <tr>
                                    <th className="text-left py-2">Product</th>
                                    <th className="text-center py-2">Qty</th>
                                    <th className="text-right py-2">Price</th>
                                    <th className="text-right py-2">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {inv.items.map((item, idx) => (
                                    <tr key={idx} className="border-b last:border-0">
                                      <td className="py-2">{item.name}</td>
                                      <td className="py-2 text-center font-bold">{item.qty}</td>
                                      <td className="py-2 text-right">₹{item.purchasePrice}</td>
                                      <td className="py-2 text-right font-bold">₹{item.total?.toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BranchPurchaseInvoices;
