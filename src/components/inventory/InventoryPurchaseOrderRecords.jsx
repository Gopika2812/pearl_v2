import { useEffect, useState } from "react";
import { FaCreditCard, FaEye, FaSyncAlt, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import POPaymentModal from "./POPaymentModal";

const InventoryPurchaseOrderRecords = ({ refreshTrigger }) => {
  const { currentBranch } = useBranch();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPOForPayment, setSelectedPOForPayment] = useState(null);

  // Fetch all purchase orders
  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${API_BASE}/purchase-orders`);
      const data = await response.json();

      if (data.success || Array.isArray(data.data || data)) {
        // Filter by current branch if needed
        const poData = data.data || data;
        const filtered = poData.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setRecords(filtered);
      }
    } catch (err) {
      console.error("Error fetching POs:", err);
      toast.error("Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setSelectedPOForPayment(null);
    fetchRecords(); // Refresh to get updated payment info
  };

  useEffect(() => {
    fetchRecords();
  }, [refreshTrigger]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this PO?")) return;

    try {
      const response = await fetchWithAuth(`${API_BASE}/purchase-orders/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Purchase Order deleted");
        fetchRecords();
      } else {
        toast.error("Failed to delete PO");
      }
    } catch (err) {
      console.error("Error deleting PO:", err);
      toast.error("Error deleting PO");
    }
  };

  return (
    <div className="mt-8 bg-white p-6 rounded-3xl shadow-xl border border-primary/5">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest border-b pb-2 border-[#319bab]/30">
          📋 Purchase Order Records
        </h3>
        <button
          onClick={fetchRecords}
          disabled={loading}
          className="text-[#319bab] hover:text-[#257f87] transition disabled:opacity-50"
          title="Refresh"
        >
          <FaSyncAlt className={`inline-block ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !records.length ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No purchase orders yet. Create one above.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b-2 border-[#319bab]/20">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-[#319bab]">
                    Invoice ID
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-[#319bab]">
                    Vendor
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-[#319bab]">
                    Warehouse
                  </th>
                  <th className="px-4 py-3 text-center font-bold text-[#319bab]">
                    Items
                  </th>
                  <th className="px-4 py-3 text-right font-bold text-[#319bab]">
                    Grand Total
                  </th>
                  <th className="px-4 py-3 text-center font-bold text-[#319bab]">
                    Date
                  </th>
                  <th className="px-4 py-3 text-center font-bold text-[#319bab]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center font-bold text-[#319bab]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((po) => (
                  <tr key={po._id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-bold text-[#319bab]">
                      {po.invoiceId}
                    </td>
                    <td className="px-4 py-3">
                      {typeof po.vendor === "object" ? po.vendor?.name : po.vendor}
                    </td>
                    <td className="px-4 py-3">
                      {typeof po.warehouse === "object" 
                        ? po.warehouse?.name 
                        : po.warehouse}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-[#319bab]/10 text-[#319bab] px-3 py-1 rounded-full text-xs font-bold">
                        {po.items?.length || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      ₹{(po.grandTotal || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {formatDate(po.date || po.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          po.status === "PLACED"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {po.status || "PLACED"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => {
                            setSelectedPO(po);
                            setShowDetails(true);
                          }}
                          className="text-blue-500 hover:text-blue-700 transition"
                          title="View Details"
                        >
                          <FaEye />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPOForPayment(po);
                            setShowPaymentModal(true);
                          }}
                          className="text-green-500 hover:text-green-700 transition"
                          title="Pay Creditors"
                        >
                          <FaCreditCard />
                        </button>
                        <button
                          onClick={() => handleDelete(po._id)}
                          className="text-red-500 hover:text-red-700 transition"
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* DETAILS MODAL */}
          {showDetails && selectedPO && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
                <div className="sticky top-0 bg-gradient-to-r from-[#319bab] to-[#257f87] text-white p-6 flex justify-between items-center">
                  <h2 className="text-xl font-bold">
                    PO Details: {selectedPO.invoiceId}
                  </h2>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="text-2xl hover:opacity-75"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Header Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">
                        Vendor
                      </p>
                      <p className="text-lg font-bold text-gray-800">
                        {typeof selectedPO.vendor === "object"
                          ? selectedPO.vendor?.name
                          : selectedPO.vendor}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">
                        Warehouse
                      </p>
                      <p className="text-lg font-bold text-gray-800">
                        {typeof selectedPO.warehouse === "object"
                          ? selectedPO.warehouse?.name
                          : selectedPO.warehouse}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">
                        Invoice ID
                      </p>
                      <p className="text-lg font-bold text-[#319bab]">
                        {selectedPO.invoiceId}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">
                        Date
                      </p>
                      <p className="text-lg font-bold text-gray-800">
                        {formatDate(selectedPO.date || selectedPO.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div>
                    <h4 className="font-bold text-[#319bab] mb-3 uppercase text-xs">
                      Items
                    </h4>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left">Item</th>
                            <th className="px-3 py-2 text-center">Qty</th>
                            <th className="px-3 py-2 text-right">Rate</th>
                            <th className="px-3 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {selectedPO.items?.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 font-semibold">
                                {item.name}
                                <div className="text-[10px] text-gray-400">
                                  HSN: {item.hsn}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                {item.qty}
                              </td>
                              <td className="px-3 py-2 text-right">
                                ₹{item.purchasePrice}
                              </td>
                              <td className="px-3 py-2 text-right font-bold">
                                ₹{item.total}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-bold">
                        ₹{(selectedPO.subtotal || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax:</span>
                      <span className="font-bold">
                        ₹{(selectedPO.totalTax || 0).toFixed(2)}
                      </span>
                    </div>
                    {selectedPO.transportCharge > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Transport Charge:</span>
                        <span className="font-bold">
                          ₹{(selectedPO.transportCharge || 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Grand Total:</span>
                      <span className="text-[#319bab]">
                        ₹{(selectedPO.grandTotal || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Additional Info */}
                  {(selectedPO.billingPerson || selectedPO.agent) && (
                    <div className="border-t pt-4 space-y-2 text-sm">
                      {selectedPO.billingPerson && (
                        <div>
                          <span className="text-gray-500">Billing Person: </span>
                          <span className="font-bold">
                            {selectedPO.billingPerson}
                          </span>
                        </div>
                      )}
                      {selectedPO.agent && (
                        <div>
                          <span className="text-gray-500">Agent: </span>
                          <span className="font-bold">{selectedPO.agent}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Close Button */}
                  <div className="border-t pt-4">
                    <button
                      onClick={() => setShowDetails(false)}
                      className="w-full bg-[#319bab] text-white py-2 rounded-lg font-bold hover:bg-[#257f87] transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PAYMENT MODAL */}
          <POPaymentModal
            po={selectedPOForPayment}
            isOpen={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            onPaymentSuccess={handlePaymentSuccess}
          />
        </>
      )}
    </div>
  );
};

export default InventoryPurchaseOrderRecords;
