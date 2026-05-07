import { useEffect, useState } from "react";
import { FaChevronDown, FaChevronUp, FaCreditCard, FaDollarSign, FaPlus, FaSyncAlt, FaHistory, FaSearch, FaCalendarAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../api";
import POPaymentModal from "../../components/inventory/POPaymentModal";
import VendorCreditPaymentModal from "../../components/inventory/VendorCreditPaymentModal";
import { useBranch } from "../../context/BranchContext";

export default function BranchPOPayment() {
  const { currentBranch, user } = useBranch();
  const navigate = useNavigate();

  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    // Global Super Admin or Branch Admin (local) bypass checks
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    
    const key = `payment-po_${fieldId}`;
    return user.fieldPermissions?.[key] !== false; // Default to true if not explicitly restricted
  };
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showVendorPaymentModal, setShowVendorPaymentModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [paymentData, setPaymentData] = useState({});
  const [expandedPOs, setExpandedPOs] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  // Fetch all purchase orders
  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        branchId: currentBranch?._id,
        status: "INVOICED",
        page: page,
        limit: 50,
        search: searchTerm,
        fromDate: startDate,
        toDate: endDate
      });

      const response = await fetch(`${API_BASE}/purchase-orders?${queryParams}`);
      const result = await response.json();

      if (result.success) {
        let poData = result.data || [];
        setPagination(result.pagination || { total: 0, pages: 1 });
        
        // Apply granular voucher authorization (client-side for now as it's role-based)
        if (user?.allowedVoucherTypes && user.allowedVoucherTypes.length > 0) {
          poData = poData.filter(po => user.allowedVoucherTypes.includes(po.voucherTypeId || po.voucherType?._id || po.voucherType));
        }

        setPurchaseOrders(poData);

        // Fetch payment info for each PO
        for (const po of poData) {
          fetchPaymentInfoForPO(po._id);
        }
      }
    } catch (err) {
      console.error("Error fetching POs:", err);
      toast.error("Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  // Fetch payment info for specific PO
  const fetchPaymentInfoForPO = async (poId) => {
    try {
      const response = await fetch(`${API_BASE}/payments/po/${poId}`);
      const data = await response.json();
      const payments = data.data || [];

      const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

      setPaymentData((prev) => ({
        ...prev,
        [poId]: {
          payments,
          totalPaid,
        },
      }));
    } catch (err) {
      console.error(`Error fetching payments for PO ${poId}:`, err);
    }
  };

  useEffect(() => {
    if (currentBranch?._id) fetchPurchaseOrders();
  }, [currentBranch, page, startDate, endDate]);

  // Handle search refresh
  useEffect(() => {
    if (!searchTerm && currentBranch?._id) fetchPurchaseOrders();
  }, [searchTerm]);

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    fetchPurchaseOrders(); // Refresh all data
  };

  const toggleExpandPO = (poId) => {
    setExpandedPOs((prev) => ({
      ...prev,
      [poId]: !prev[poId],
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getPendingBalance = (po) => {
    const paid = paymentData[po._id]?.totalPaid || 0;
    return Math.max(0, (po.grandTotal || 0) - paid);
  };

  const getStatusColor = (po) => {
    const pending = getPendingBalance(po);
    if (pending === 0) return "bg-green-100 text-green-700";
    if (pending < po.grandTotal / 2) return "bg-blue-100 text-blue-700";
    return "bg-orange-100 text-orange-700";
  };

  const getStatusText = (po) => {
    const pending = getPendingBalance(po);
    if (pending === 0) return "✅ Paid";
    return `₹${pending.toLocaleString()} Pending`;
  };

  const filteredPurchaseOrders = purchaseOrders; // Now handled server-side

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full max-w-full mx-auto px-3 sm:px-6 py-4">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-[#257f87] to-[#319bab] text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FaDollarSign className="text-5xl opacity-80" />
              <h1 className="text-4xl font-bold">PO Payment 💳</h1>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => navigate("/branch/payment-records")}
                className="flex items-center gap-2 bg-[#1a5b61] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#13464a] transition shadow-lg border border-[#48c9d1]"
              >
                <FaHistory /> View Records
              </button>
              <button
                onClick={() => setShowVendorPaymentModal(true)}
                className="flex items-center gap-2 bg-white text-[#257f87] px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition shadow-lg"
                title="Record Vendor Payment"
              >
                <FaPlus /> Vendor Payment
              </button>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8 border border-[#319bab]/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            {/* Search */}
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest pl-2">Lookup Invoice / Vendor</label>
              <div className="relative">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#319bab]" />
                <input
                  type="text"
                  placeholder="Search by ID or Vendor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-[#319bab]/5 border border-[#319bab]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#319bab] transition-all font-medium text-gray-700"
                  onKeyDown={(e) => e.key === "Enter" && fetchPurchaseOrders()}
                />
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest pl-2">Start Date</label>
              <div className="relative">
                <FaCalendarAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-[#319bab] opacity-50" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-[#319bab]/5 border border-[#319bab]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#319bab] text-gray-700 font-medium"
                />
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest pl-2">End Date</label>
              <div className="relative">
                <FaCalendarAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-[#319bab] opacity-50" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-[#319bab]/5 border border-[#319bab]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#319bab] text-gray-700 font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        {/* LOADING OR RECORDS */}
        <div className="bg-white rounded-3xl shadow-xl border border-primary/5 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[#319bab] font-black uppercase text-xs tracking-widest border-b pb-2 border-[#319bab]/30">
              📋 Outstanding Purchase Orders
            </h2>
            <button
              onClick={fetchPurchaseOrders}
              disabled={loading}
              className="text-[#319bab] hover:text-[#257f87] transition disabled:opacity-50"
              title="Refresh"
            >
              <FaSyncAlt
                className={`inline-block text-xl ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {loading && purchaseOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">Loading purchase orders...</p>
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">No purchase orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b-2 border-[#319bab]/20">
                  <tr>
                    <th className="px-2 py-3 text-center font-bold text-[#319bab]"></th>
                    {isFieldAllowed("invoiceId") && <th className="px-4 py-3 text-left font-bold text-[#319bab]">Invoice ID</th>}
                    {isFieldAllowed("vendor") && <th className="px-4 py-3 text-left font-bold text-[#319bab]">Vendor</th>}
                    {isFieldAllowed("warehouse") && <th className="px-4 py-3 text-left font-bold text-[#319bab]">Warehouse</th>}
                    {isFieldAllowed("items") && <th className="px-4 py-3 text-right font-bold text-[#319bab]">Items</th>}
                    {isFieldAllowed("totalAmount") && <th className="px-4 py-3 text-right font-bold text-[#319bab]">Total Amount</th>}
                    {isFieldAllowed("paidAmount") && <th className="px-4 py-3 text-right font-bold text-[#319bab]">Paid Amount</th>}
                    {isFieldAllowed("status") && <th className="px-4 py-3 text-center font-bold text-[#319bab]">Status</th>}
                    {isFieldAllowed("poDate") && <th className="px-4 py-3 text-center font-bold text-[#319bab]">PO Date</th>}
                    {isFieldAllowed("action") && <th className="px-4 py-3 text-center font-bold text-[#319bab]">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredPurchaseOrders.map((po) => {
                    const paid = paymentData[po._id]?.totalPaid || 0;
                    const pending = getPendingBalance(po);
                    const isExpanded = expandedPOs[po._id] || false;

                    return (
                      <>
                        {/* MAIN PO ROW */}
                        <tr key={po._id} className="hover:bg-gray-50 transition">
                          <td className="px-2 py-3 text-center">
                            <button
                              onClick={() => toggleExpandPO(po._id)}
                              className="text-[#319bab] hover:text-[#257f87] transition"
                            >
                              {isExpanded ? (
                                <FaChevronUp />
                              ) : (
                                <FaChevronDown />
                              )}
                            </button>
                          </td>
                          {isFieldAllowed("invoiceId") && (
                            <td className="px-4 py-3 font-bold text-[#319bab]">
                              {po.invoiceId}
                            </td>
                          )}
                          {isFieldAllowed("vendor") && (
                            <td className="px-4 py-3">
                              {typeof po.vendor === "object"
                                ? po.vendor?.name
                                : po.vendor}
                            </td>
                          )}
                          {isFieldAllowed("warehouse") && (
                            <td className="px-4 py-3">
                              {typeof po.warehouse === "object"
                                ? po.warehouse?.name
                                : po.warehouse}
                            </td>
                          )}
                          {isFieldAllowed("items") && (
                            <td className="px-4 py-3 text-right">
                              <span className="bg-[#319bab]/10 text-[#319bab] px-3 py-1 rounded-full text-xs font-bold">
                                {po.items?.length || 0}
                              </span>
                            </td>
                          )}
                          {isFieldAllowed("totalAmount") && (
                            <td className="px-4 py-3 text-right font-bold">
                              ₹{(po.grandTotal || 0).toLocaleString()}
                            </td>
                          )}
                          {isFieldAllowed("paidAmount") && (
                            <td className="px-4 py-3 text-right font-bold text-green-600">
                              ₹{paid.toLocaleString()}
                            </td>
                          )}
                          {isFieldAllowed("status") && (
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(
                                  po
                                )}`}
                              >
                                {getStatusText(po)}
                              </span>
                            </td>
                          )}
                          {isFieldAllowed("poDate") && (
                            <td className="px-4 py-3 text-center text-gray-600">
                              {formatDate(po.date || po.createdAt)}
                            </td>
                          )}
                          {isFieldAllowed("action") && (
                            <td className="px-4 py-3 text-center">
                              {pending > 0 && (
                                <button
                                  onClick={() => {
                                    setSelectedPO(po);
                                    setShowPaymentModal(true);
                                  }}
                                  className="inline-flex items-center gap-2 bg-green-600 text-white px-3 py-1 rounded-lg font-bold text-xs hover:bg-green-700 transition"
                                  title="Record Payment"
                                >
                                  <FaCreditCard /> Pay
                                </button>
                              )}
                              {pending === 0 && (
                                <span className="text-green-600 font-bold text-xs">
                                  ✅ Settled
                                </span>
                              )}
                            </td>
                          )}
                        </tr>

                        {/* PRODUCT DETAILS ROWS */}
                        {isExpanded && po.items && po.items.length > 0 && (
                          <tr>
                            <td colSpan="10" className="px-4 py-4 bg-gray-50">
                              <div className="ml-6">
                                <h4 className="text-[#319bab] font-bold text-sm mb-3 uppercase">
                                  📦 Purchased Items
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs bg-white rounded-lg border border-slate-100">
                                    <thead>
                                      <tr className="bg-slate-50">
                                        <th className="px-3 py-2 text-left font-bold text-gray-700">Product Name</th>
                                        <th className="px-3 py-2 text-center font-bold text-gray-700">Qty</th>
                                        <th className="px-3 py-2 text-center font-bold text-gray-700">Package</th>
                                        <th className="px-3 py-2 text-right font-bold text-gray-700">Unit Price</th>
                                        <th className="px-3 py-2 text-right font-bold text-gray-700">GST</th>
                                        <th className="px-3 py-2 text-right font-bold text-gray-700">HSN</th>
                                        <th className="px-3 py-2 text-right font-bold text-gray-700">Item Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {po.items.map((item, idx) => (
                                        <tr key={idx} className="bg-white hover:bg-gray-50">
                                          <td className="px-3 py-2 font-semibold text-gray-800">{item.name}</td>
                                          <td className="px-3 py-2 text-center font-bold">{item.qty}</td>
                                          <td className="px-3 py-2 text-center text-gray-600">{item.perQty || "-"} {item.units || ""}</td>
                                          <td className="px-3 py-2 text-right">₹{item.purchasePrice}</td>
                                          <td className="px-3 py-2 text-right">{item.igst ? `IGST ${item.gst}%` : `CGST ${item.cgst}% + SGST ${item.sgst}%`}</td>
                                          <td className="px-3 py-2 text-right text-gray-600">{item.hsn || "-"}</td>
                                          <td className="px-3 py-2 text-right font-bold text-[#319bab]">₹{item.total}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>

                                {paymentData[po._id]?.payments?.length > 0 && (
                                  <div className="mt-8">
                                    <h4 className="text-green-600 font-bold text-sm mb-3 uppercase flex items-center gap-2">
                                      <FaCreditCard /> Payment History
                                    </h4>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs bg-white rounded-lg border border-green-100">
                                        <thead>
                                          <tr className="bg-green-50/50">
                                            <th className="px-4 py-2 text-left font-bold text-gray-700">Payment ID</th>
                                            <th className="px-4 py-2 text-left font-bold text-gray-700">Date</th>
                                            <th className="px-4 py-2 text-center font-bold text-gray-700">Method</th>
                                            <th className="px-4 py-2 text-right font-bold text-gray-700">Amount</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-green-50">
                                          {paymentData[po._id].payments.map((p, pidx) => (
                                            <tr key={pidx} className="hover:bg-green-50/20">
                                              <td className="px-4 py-2 text-gray-600 font-medium">{p.paymentId || "-"}</td>
                                              <td className="px-4 py-2 text-gray-500">{formatDate(p.paymentDate || p.createdAt)}</td>
                                              <td className="px-4 py-2 text-center">
                                                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-black uppercase text-[9px]">
                                                  {p.paymentMethod}
                                                </span>
                                              </td>
                                              <td className="px-4 py-2 text-right font-bold text-gray-800">₹{p.amount?.toLocaleString()}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PAGINATION CONTROLS */}
        {pagination.pages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-6 py-2 bg-white border border-[#319bab]/20 rounded-xl font-bold text-[#319bab] disabled:opacity-30 hover:bg-[#319bab]/5 transition shadow-sm"
            >
              Previous
            </button>
            <span className="text-sm font-black text-gray-500 uppercase tracking-widest">
              Page {page} of {pagination.pages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="px-6 py-2 bg-white border border-[#319bab]/20 rounded-xl font-bold text-[#319bab] disabled:opacity-30 hover:bg-[#319bab]/5 transition shadow-sm"
            >
              Next
            </button>
          </div>
        )}

        {/* PAYMENT SUMMARY */}
        {purchaseOrders.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
              <p className="text-gray-600 text-sm uppercase font-bold mb-2">
                Total POs
              </p>
              <p className="text-3xl font-black text-gray-800">
                {purchaseOrders.length}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
              <p className="text-gray-600 text-sm uppercase font-bold mb-2">
                Total Paid
              </p>
              <p className="text-3xl font-black text-green-600">
                ₹
                {filteredPurchaseOrders
                  .reduce((sum, po) => sum + (paymentData[po._id]?.totalPaid || 0), 0)
                  .toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-red-500">
              <p className="text-gray-600 text-sm uppercase font-bold mb-2">
                Total Pending
              </p>
              <p className="text-3xl font-black text-red-600">
                ₹
                {filteredPurchaseOrders
                  .reduce((sum, po) => sum + getPendingBalance(po), 0)
                  .toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* PAYMENT MODAL */}
      <POPaymentModal
        po={selectedPO}
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* VENDOR CREDIT PAYMENT MODAL */}
      <VendorCreditPaymentModal
        isOpen={showVendorPaymentModal}
        onClose={() => setShowVendorPaymentModal(false)}
        onPaymentSuccess={() => {
          setShowVendorPaymentModal(false);
          fetchPurchaseOrders();
        }}
      />
    </div>
  );
}
