import { useEffect, useState } from "react";
import { FaChevronDown, FaChevronUp, FaFileAlt, FaSyncAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";
import DebitNoteModal from "../../components/inventory/DebitNoteModal";
import { useBranch } from "../../context/BranchContext";

export default function BranchDebitNote() {
  const { currentBranch } = useBranch();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [debitNoteData, setDebitNoteData] = useState({});
  const [loading, setLoading] = useState(false);
  const [showDebitNoteModal, setShowDebitNoteModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [expandedPOs, setExpandedPOs] = useState({});

  // Fetch all purchase orders
  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/purchase-orders`);
      const data = await response.json();

      if (data.success || Array.isArray(data.data || data)) {
        const poData = data.data || data;
        // Sort by latest first
        const validPOs = poData.filter((po) => po.status !== "CANCELLED" && po.status !== "DRAFT");
        const sorted = validPOs.sort((a, b) =>
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setPurchaseOrders(sorted);

        // Fetch debit notes for each PO
        for (const po of sorted) {
          fetchDebitNotesForPO(po._id);
        }
      }
    } catch (err) {
      console.error("Error fetching POs:", err);
      toast.error("Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  // Fetch debit notes for specific PO
  const fetchDebitNotesForPO = async (poId) => {
    try {
      const response = await fetch(`${API_BASE}/debit-notes`);
      const data = await response.json();
      const allDebitNotes = data.data || [];

      // Filter debit notes for this PO
      const poDebitNotes = allDebitNotes.filter(
        (dn) => dn.originalPurchaseOrderId === poId || dn.originalPurchaseOrderId?._id === poId
      );

      const totalReturned = poDebitNotes.reduce((sum, dn) => sum + (dn.grandTotal || 0), 0);

      setDebitNoteData((prev) => ({
        ...prev,
        [poId]: {
          debitNotes: poDebitNotes,
          totalReturned,
        },
      }));
    } catch (err) {
      console.error(`Error fetching debit notes for PO ${poId}:`, err);
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  const handleDebitNoteSuccess = () => {
    setShowDebitNoteModal(false);
    setSelectedPO(null);
    fetchPurchaseOrders();
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

  const getTotalReturnedQty = (po) => {
    const debitNotes = debitNoteData[po._id]?.debitNotes || [];
    let totalQty = 0;
    debitNotes.forEach((dn) => {
      (dn.items || []).forEach((item) => {
        totalQty += item.returnedQty || 0;
      });
    });
    return totalQty;
  };

  const getTotalReturnedAmount = (po) => {
    return debitNoteData[po._id]?.totalReturned || 0;
  };

  const getReturnStatus = (po) => {
    const debitNotes = debitNoteData[po._id]?.debitNotes || [];
    if (debitNotes.length === 0) return "No Returns";
    return `${debitNotes.length} Return${debitNotes.length > 1 ? "s" : ""}`;
  };

  const getStatusColor = (po) => {
    const returned = getTotalReturnedAmount(po);
    if (returned === 0) return "bg-blue-100 text-blue-700";
    if (returned < po.grandTotal / 2) return "bg-orange-100 text-orange-700";
    return "bg-red-100 text-red-700";
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FaFileAlt className="text-5xl opacity-80" />
              <h1 className="text-4xl font-bold">Debit Notes 📄</h1>
            </div>
          </div>
        </div>

        {/* LOADING OR RECORDS */}
        <div className="bg-white rounded-3xl shadow-xl border border-red-100/20 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-red-600 font-black uppercase text-xs tracking-widest border-b pb-2 border-red-600/30">
              📋 Purchase Orders Management
            </h2>
            <button
              onClick={fetchPurchaseOrders}
              disabled={loading}
              className="text-red-600 hover:text-red-700 transition disabled:opacity-50"
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
                <thead className="bg-gray-50 border-b-2 border-red-600/20">
                  <tr>
                    <th className="px-2 py-3 text-center font-bold text-red-600"></th>
                    <th className="px-4 py-3 text-left font-bold text-red-600">
                      Invoice ID
                    </th>
                    <th className="px-4 py-3 text-left font-bold text-red-600">
                      Vendor
                    </th>
                    <th className="px-4 py-3 text-left font-bold text-red-600">
                      Warehouse
                    </th>
                    <th className="px-4 py-3 text-right font-bold text-red-600">
                      Items
                    </th>
                    <th className="px-4 py-3 text-right font-bold text-red-600">
                      Total Amount
                    </th>
                    <th className="px-4 py-3 text-right font-bold text-red-600">
                      Returned Amount
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-red-600">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-red-600">
                      PO Date
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-red-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {purchaseOrders.map((po) => {
                    const returned = getTotalReturnedAmount(po);
                    const isExpanded = expandedPOs[po._id] || false;

                    return (
                      <>
                        {/* MAIN PO ROW */}
                        <tr key={po._id} className="hover:bg-gray-50 transition">
                          <td className="px-2 py-3 text-center">
                            <button
                              onClick={() => toggleExpandPO(po._id)}
                              className="text-red-600 hover:text-red-700 transition"
                            >
                              {isExpanded ? (
                                <FaChevronUp />
                              ) : (
                                <FaChevronDown />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-bold text-red-600">
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
                            <span className="bg-red-600/10 text-red-600 px-3 py-1 rounded-full text-xs font-bold">
                              {po.items?.length || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            ₹{(po.grandTotal || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-red-600">
                            ₹{returned.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(
                                po
                              )}`}
                            >
                              {getReturnStatus(po)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            {formatDate(po.date || po.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedPO(po);
                                setShowDebitNoteModal(true);
                              }}
                              className="inline-flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-lg font-bold text-xs hover:bg-red-700 transition"
                              title="Create Debit Note"
                            >
                              <FaFileAlt /> Return
                            </button>
                          </td>
                        </tr>

                        {/* PRODUCT DETAILS ROWS */}
                        {isExpanded && po.items && po.items.length > 0 && (
                          <tr>
                            <td colSpan="10" className="px-4 py-4 bg-gray-50">
                              <div className="ml-6">
                                <h4 className="text-red-600 font-bold text-sm mb-3 uppercase">
                                  📦 Purchase Order Items
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
                                          <td className="px-3 py-2 text-right font-bold text-red-600">
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

        {/* DEBIT NOTE SUMMARY */}
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

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-red-500">
              <p className="text-gray-600 text-sm uppercase font-bold mb-2">
                Total Returned
              </p>
              <p className="text-3xl font-black text-red-600">
                ₹
                {purchaseOrders
                  .reduce((sum, po) => sum + getTotalReturnedAmount(po), 0)
                  .toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500">
              <p className="text-gray-600 text-sm uppercase font-bold mb-2">
                Total Debit Notes
              </p>
              <p className="text-3xl font-black text-orange-600">
                {Object.values(debitNoteData).reduce((sum, data) => sum + (data.debitNotes?.length || 0), 0)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* DEBIT NOTE MODAL */}
      <DebitNoteModal
        po={selectedPO}
        isOpen={showDebitNoteModal}
        onClose={() => setShowDebitNoteModal(false)}
        onDebitNoteSuccess={handleDebitNoteSuccess}
      />
    </div>
  );
}
