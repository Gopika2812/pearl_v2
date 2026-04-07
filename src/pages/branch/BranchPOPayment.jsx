import { useEffect, useState } from "react";
import { FaChevronDown, FaChevronUp, FaCreditCard, FaDollarSign, FaPlus, FaSyncAlt, FaHistory } from "react-icons/fa";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../api";
import POPaymentModal from "../../components/inventory/POPaymentModal";
import VendorCreditPaymentModal from "../../components/inventory/VendorCreditPaymentModal";
import { useBranch } from "../../context/BranchContext";

export default function BranchPOPayment() {
  const { currentBranch, user } = useBranch();
  const navigate = useNavigate();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showVendorPaymentModal, setShowVendorPaymentModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [paymentData, setPaymentData] = useState({});
  const [expandedPOs, setExpandedPOs] = useState({});

  // Fetch all purchase orders
  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/purchase-orders`);
      const data = await response.json();

      if (data.success || Array.isArray(data.data || data)) {
        let poData = data.data || data;
        
        // Strictly filter to only INVOICED purchase orders for the active branch
        const branchIdStr = currentBranch?._id?.toString();
        poData = poData.filter(po => {
           const poBranchId = po.branchId?.$oid || po.branchId?.toString();
           return poBranchId === branchIdStr && po.status === "INVOICED";
        });

        // Apply granular voucher authorization
        if (user?.allowedVoucherTypes && user.allowedVoucherTypes.length > 0) {
          poData = poData.filter(po => user.allowedVoucherTypes.includes(po.voucherTypeId || po.voucherType?._id || po.voucherType));
        }

        // Sort by latest first
        const sorted = poData.sort((a, b) =>
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setPurchaseOrders(sorted);

        // Fetch payment info for each PO
        for (const po of sorted) {
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
    fetchPurchaseOrders();
  }, []);

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

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4">
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
                    <th className="px-4 py-3 text-left font-bold text-[#319bab]">
                      Invoice ID
                    </th>
                    <th className="px-4 py-3 text-left font-bold text-[#319bab]">
                      Vendor
                    </th>
                    <th className="px-4 py-3 text-left font-bold text-[#319bab]">
                      Warehouse
                    </th>
                    <th className="px-4 py-3 text-right font-bold text-[#319bab]">
                      Items
                    </th>
                    <th className="px-4 py-3 text-right font-bold text-[#319bab]">
                      Total Amount
                    </th>
                    <th className="px-4 py-3 text-right font-bold text-[#319bab]">
                      Paid Amount
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-[#319bab]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-[#319bab]">
                      PO Date
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-[#319bab]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {purchaseOrders.map((po) => {
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
                          <td className="px-4 py-3 font-bold text-[#319bab]">
                            {po.invoiceId}
                          </td>
                          <td className="px-4 py-3">
                            {typeof po.vendor === "object"
                              ? po.vendor?.name
                              : po.vendor}
                          </td>
                          <td className="px-4 py-3">
                            {typeof po.warehouse === "object"
                              ? po.warehouse?.name
                              : po.warehouse}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="bg-[#319bab]/10 text-[#319bab] px-3 py-1 rounded-full text-xs font-bold">
                              {po.items?.length || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            ₹{(po.grandTotal || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">
                            ₹{paid.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(
                                po
                              )}`}
                            >
                              {getStatusText(po)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            {formatDate(po.date || po.createdAt)}
                          </td>
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
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-white">
                                        <th className="px-3 py-2 text-left font-bold text-gray-700">
                                          Product Name
                                        </th>
                                        <th className="px-3 py-2 text-center font-bold text-gray-700">
                                          Qty
                                        </th>
                                        <th className="px-3 py-2 text-center font-bold text-gray-700">
                                          Package
                                        </th>
                                        <th className="px-3 py-2 text-right font-bold text-gray-700">
                                          Unit Price
                                        </th>
                                        <th className="px-3 py-2 text-right font-bold text-gray-700">
                                          GST
                                        </th>
                                        <th className="px-3 py-2 text-right font-bold text-gray-700">
                                          HSN Code
                                        </th>
                                        <th className="px-3 py-2 text-right font-bold text-gray-700">
                                          Item Total
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {po.items.map((item, idx) => (
                                        <tr
                                          key={idx}
                                          className="bg-white hover:bg-gray-50"
                                        >
                                          <td className="px-3 py-2 font-semibold text-gray-800">
                                            {item.name}
                                          </td>
                                          <td className="px-3 py-2 text-center font-bold">
                                            {item.qty}
                                          </td>
                                          <td className="px-3 py-2 text-center text-gray-600">
                                            {item.perQty || "-"} {item.units || ""}
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            ₹{item.purchasePrice}
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            {item.igst
                                              ? `IGST ${item.gst}%`
                                              : `CGST ${item.cgst}% + SGST ${item.sgst}%`}
                                          </td>
                                          <td className="px-3 py-2 text-right text-gray-600">
                                            {item.hsn || "-"}
                                          </td>
                                          <td className="px-3 py-2 text-right font-bold text-[#319bab]">
                                            ₹{item.total}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
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
                {purchaseOrders
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
                {purchaseOrders
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
