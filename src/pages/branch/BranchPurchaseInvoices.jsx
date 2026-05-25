import React, { useEffect, useState } from "react";
import { FaChevronDown, FaFileAlt, FaSync, FaSearch } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

const BranchPurchaseInvoices = () => {
  const { currentBranch, user } = useBranch();
  
  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    // Global Super Admin or Branch Admin (local) bypass checks
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    
    const key = `purchase-invoice-list_${fieldId}`;
    return user.fieldPermissions?.[key] !== false; // Default to true if not explicitly restricted
  };
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterFromDate, setFilterFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterToDate, setFilterToDate] = useState(new Date().toISOString().split('T')[0]);

  // Search debounce logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Automatically clear default today's dates when user types a search term, and restore them when search is cleared
  useEffect(() => {
    const term = (searchTerm || "").trim();
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (term) {
      if (filterFromDate === todayStr && filterToDate === todayStr) {
        setFilterFromDate("");
        setFilterToDate("");
      }
    } else {
      if (filterFromDate === "" && filterToDate === "") {
        setFilterFromDate(todayStr);
        setFilterToDate(todayStr);
      }
    }
  }, [searchTerm]);

  const fetchInvoices = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(
        `${API_BASE}/purchase-invoices?branchId=${currentBranch._id}${debouncedSearch ? `&search=${debouncedSearch}` : ""}&fromDate=${filterFromDate}&toDate=${filterToDate}`
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
  }, [currentBranch?._id, debouncedSearch, filterFromDate, filterToDate]);

  const toggleExpanded = (invoiceId) => {
    setExpandedInvoices((prev) => ({
      ...prev,
      [invoiceId]: !prev[invoiceId],
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">


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

        {/* SEARCH & FILTERS */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search by Invoice ID, Vendor, or Product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-green-600 text-sm font-medium"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center bg-gray-50 border border-gray-100 rounded-xl px-3 py-1">
              <span className="text-[10px] font-black text-gray-400 uppercase mr-2 mt-0.5">From</span>
              <input
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-xs font-bold text-gray-700 outline-none"
              />
            </div>
            <div className="flex items-center bg-gray-50 border border-gray-100 rounded-xl px-3 py-1">
              <span className="text-[10px] font-black text-gray-400 uppercase mr-2 mt-0.5">To</span>
              <input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-xs font-bold text-gray-700 outline-none"
              />
            </div>
            <button
               onClick={() => {
                 setFilterFromDate(new Date().toISOString().split('T')[0]);
                 setFilterToDate(new Date().toISOString().split('T')[0]);
                 setSearchTerm("");
               }}
               className="text-[10px] font-black text-green-600 hover:text-green-700 uppercase tracking-wider px-2"
            >
              Reset
            </button>
          </div>
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
                    {isFieldAllowed("invoiceId") && <th className="px-6 py-4 text-left">Invoice ID</th>}
                    {isFieldAllowed("orderRef") && <th className="px-6 py-4 text-left">Order Reference</th>}
                    {isFieldAllowed("vendor") && <th className="px-6 py-4 text-left">Vendor</th>}
                    {isFieldAllowed("vendorBillNo") && <th className="px-6 py-4 text-left">Vendor Bill#</th>}
                    {isFieldAllowed("billDate") && <th className="px-6 py-4 text-center">Bill Date</th>}
                    {isFieldAllowed("grandTotal") && <th className="px-6 py-4 text-right">Grand Total</th>}
                    {isFieldAllowed("entryDate") && <th className="px-6 py-4 text-center">Entry Date</th>}
                    {isFieldAllowed("action") && <th className="px-6 py-4 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv) => (
                    <React.Fragment key={inv._id}>
                      <tr className="hover:bg-gray-50 transition">
                        {isFieldAllowed("invoiceId") && (
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
                        )}
                        {isFieldAllowed("orderRef") && (
                          <td className="px-6 py-4 text-gray-500 font-medium text-xs">
                            {inv.purchaseOrderId ? `PO Ref: ${inv.purchaseOrderId.invoiceId || inv.purchaseOrderId}` : "N/A"}
                          </td>
                        )}
                        {isFieldAllowed("vendor") && (
                          <td className="px-6 py-4 font-bold text-gray-800">{inv.vendor}</td>
                        )}
                        {isFieldAllowed("vendorBillNo") && (
                          <td className="px-6 py-4 text-xs font-bold text-blue-600 italic">
                            {inv.vendorBillNo || "N/A"}
                          </td>
                        )}
                        {isFieldAllowed("billDate") && (
                          <td className="px-6 py-4 text-center text-xs font-semibold text-gray-500">
                            {inv.vendorDate ? new Date(inv.vendorDate).toLocaleDateString("en-IN") : "N/A"}
                          </td>
                        )}
                        {isFieldAllowed("grandTotal") && (
                          <td className="px-6 py-4 text-right font-black text-green-700">₹{(inv.grandTotal || 0).toLocaleString()}</td>
                        )}
                        {isFieldAllowed("entryDate") && (
                          <td className="px-6 py-4 text-center">
                            <p className="text-xs font-bold text-gray-700">{new Date(inv.createdAt).toLocaleDateString("en-IN")}</p>
                            <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                              {new Date(inv.createdAt).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </td>
                        )}
                        {isFieldAllowed("action") && (
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={() => toast.info("Viewing details for " + inv.purchaseInvoiceId)}
                              className="text-green-600 hover:bg-green-50 p-2 rounded-lg transition"
                              title="View Details"
                            >
                              <FaFileAlt size={14} />
                            </button>
                          </td>
                        )}
                      </tr>

                      {/* EXPANDED SECTION */}
                      {expandedInvoices[inv._id] && (
                        <tr className="bg-gray-50">
                          <td colSpan="10" className="px-6 py-4">
                            <div className="space-y-6">
                              {/* INVOICE ITEMS */}
                              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                <h4 className="font-bold text-[10px] uppercase text-gray-400 mb-3 tracking-widest">Invoice Items</h4>
                                <table className="w-full text-xs">
                                  <thead className="border-b bg-gray-50/50">
                                    <tr>
                                      <th className="text-left py-2 px-2">Product</th>
                                      <th className="text-center py-2 px-2">Qty</th>
                                      <th className="text-right py-2 px-2">Price</th>
                                      <th className="text-right py-2 px-2">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {inv.items.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-gray-50/50 transition">
                                        <td className="py-2.5 px-2 font-medium text-gray-700">{item.name}</td>
                                        <td className="py-2.5 px-2 text-center font-black text-gray-900">{item.qty}</td>
                                        <td className="py-2.5 px-2 text-right text-gray-500">₹{item.purchasePrice?.toLocaleString()}</td>
                                        <td className="py-2.5 px-2 text-right font-black text-green-700">₹{item.total?.toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* EXTRA EXPENSES */}
                              {(inv.extraExpenses || []).length > 0 && (
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                  <h4 className="font-bold text-[10px] uppercase text-gray-400 mb-3 tracking-widest">Extra Expenses</h4>
                                  <table className="w-full text-xs">
                                    <thead className="border-b bg-orange-50/50">
                                      <tr className="text-orange-700">
                                        <th className="text-left py-2 px-2">Expense Name</th>
                                        <th className="text-right py-2 px-2">Base Price</th>
                                        <th className="text-right py-2 px-2">GST %</th>
                                        <th className="text-right py-2 px-2">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                      {inv.extraExpenses.map((exp, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/50 transition">
                                          <td className="py-2.5 px-2 font-medium text-gray-700">{exp.expenseName}</td>
                                          <td className="py-2.5 px-2 text-right text-gray-500">₹{(exp.basePrice || exp.amount || 0).toLocaleString()}</td>
                                          <td className="py-2.5 px-2 text-right text-blue-500">{exp.gstPercent || exp.gst || 0}%</td>
                                          <td className="py-2.5 px-2 text-right font-black text-orange-600">₹{(exp.totalPrice || 0).toLocaleString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* SUMMARY */}
                              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                  <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                                    <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest block mb-1">Subtotal</span>
                                    <p className="font-bold text-gray-900 text-lg">₹{(inv.subtotal || 0).toLocaleString()}</p>
                                  </div>
                                  <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                                    <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest block mb-1">Tax Amount</span>
                                    <p className="font-bold text-gray-900 text-lg">₹{(inv.totalTax || 0).toLocaleString()}</p>
                                  </div>
                                  <div className="bg-orange-50/50 p-3 rounded-lg border border-orange-100">
                                    <span className="text-[10px] uppercase font-black text-orange-400 tracking-widest block mb-1">Extra Charges</span>
                                    <p className="font-bold text-orange-600 text-lg">₹{(inv.extraExpenseAmount || 0).toLocaleString()}</p>
                                  </div>
                                  <div className="bg-green-50/50 p-3 rounded-lg border border-green-100">
                                    <span className="text-[10px] uppercase font-black text-green-600/60 tracking-widest block mb-1">Grand Total</span>
                                    <p className="font-bold text-green-700 text-2xl">₹{(inv.grandTotal || 0).toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
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
