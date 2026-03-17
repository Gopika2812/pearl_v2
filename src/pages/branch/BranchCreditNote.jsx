import { useEffect, useState } from "react";
import { FaChevronDown, FaChevronUp, FaFileAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import CreditNoteModal from "../../components/sales/CreditNoteModal";
import { useBranch } from "../../context/BranchContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : "https://pearls-erp-2026.onrender.com/api";

export default function BranchCreditNote() {
  const { currentBranch } = useBranch();
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [creditNoteData, setCreditNoteData] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [expandedInvoices, setExpandedInvoices] = useState({});

  useEffect(() => {
    if (currentBranch?._id) fetchSalesInvoices();
  }, [currentBranch]);

  const fetchSalesInvoices = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/sales-orders?branchId=${currentBranch._id}`, {
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      
      // Filter: only invoices (invoiceGenerated=true), exclude draft/cancelled
      let invoices = (data || [])
        .filter((si) => si.invoiceGenerated && si.status !== "CANCELLED" && si.status !== "DRAFT")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setSalesInvoices(invoices);

      // Fetch credit notes for each invoice
      for (const inv of invoices) {
        fetchCreditNotesForInvoice(inv._id);
      }
    } catch (error) {
      console.error("Error fetching sales invoices:", error);
      toast.error("Failed to load sales invoices");
    } finally {
      setLoading(false);
    }
  };

  const fetchCreditNotesForInvoice = async (invoiceId) => {
    try {
      const response = await fetch(`${API_BASE}/credit-notes/order/${invoiceId}`, {
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      const creditNotes = result.data || [];

      const totalReturned = (creditNotes || []).reduce((sum, cn) => sum + (cn.grandTotal || 0), 0);

      setCreditNoteData((prev) => ({
        ...prev,
        [invoiceId]: {
          creditNotes: creditNotes || [],
          totalReturned,
        },
      }));
    } catch (error) {
      console.error("Error fetching credit notes:", error);
    }
  };

  const toggleExpandInvoice = (invoiceId) => {
    setExpandedInvoices((prev) => ({
      ...prev,
      [invoiceId]: !prev[invoiceId],
    }));
  };

  const handleCreateCreditNote = (invoice) => {
    setSelectedInvoice(invoice);
    setShowCreditNoteModal(true);
  };

  const handleCreditNoteSuccess = () => {
    setShowCreditNoteModal(false);
    setSelectedInvoice(null);
    fetchSalesInvoices();
  };

  const getCreditNotesForInvoice = (invoiceId) => {
    return creditNoteData[invoiceId]?.creditNotes || [];
  };

  const getTotalReturnedAmount = (invoice) => {
    return creditNoteData[invoice._id]?.totalReturned || 0;
  };

  const getTotalReturnedQty = (invoice) => {
    const creditNotes = getCreditNotesForInvoice(invoice._id);
    return creditNotes.reduce((sum, cn) => {
      return sum + (cn.items?.reduce((itemSum, item) => itemSum + (item.returnedQty || 0), 0) || 0);
    }, 0);
  };

  const getReturnStatus = (invoice) => {
    const creditNotes = getCreditNotesForInvoice(invoice._id);
    if (creditNotes.length === 0) return "No Returns";
    return `${creditNotes.length} Return${creditNotes.length > 1 ? "s" : ""}`;
  };

  const getStatusColor = (invoice) => {
    const returned = getTotalReturnedAmount(invoice);
    if (returned === 0) return "bg-blue-100 text-blue-700";
    if (returned < invoice.grandTotal / 2) return "bg-orange-100 text-orange-700";
    return "bg-green-100 text-green-700";
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center gap-4">
            <FaFileAlt className="text-5xl opacity-80" />
            <div>
              <h1 className="text-4xl font-bold">Credit Note Management</h1>
              <p className="text-teal-100 mt-2">Manage product returns from customers</p>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">Loading sales invoices...</p>
            </div>
          ) : salesInvoices.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No sales invoices available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-teal-50 to-teal-100 border-b">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Expand</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Invoice ID</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Warehouse</th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">Items</th>
                    <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase">Amount</th>
                    <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase">Returned</th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">Status</th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">Date</th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {salesInvoices.map((invoice) => {
                    const invoiceCreditNotes = getCreditNotesForInvoice(invoice._id);
                    const isExpanded = expandedInvoices[invoice._id] || false;

                    return (
                      <>
                        {/* MAIN INVOICE ROW */}
                        <tr key={invoice._id} className="hover:bg-gray-50 transition">
                          <td className="px-2 py-3 text-center">
                            <button
                              onClick={() => toggleExpandInvoice(invoice._id)}
                              className="text-teal-600 hover:text-teal-700 transition"
                            >
                              {isExpanded ? (
                                <FaChevronUp />
                              ) : (
                                <FaChevronDown />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-bold text-teal-600">
                            {invoice.invoiceId}
                          </td>
                          <td className="px-4 py-3">
                            {typeof invoice.customer === "object"
                              ? invoice.customer?.name
                              : invoice.customer}
                          </td>
                          <td className="px-4 py-3">
                            {typeof invoice.warehouse === "object"
                              ? invoice.warehouse?.name
                              : invoice.warehouse}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="bg-teal-600/10 text-teal-600 px-3 py-1 rounded-full text-xs font-bold">
                              {invoice.items?.length || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            ₹{(invoice.grandTotal || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">
                            ₹{getTotalReturnedAmount(invoice).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(
                                invoice
                              )}`}
                            >
                              {getReturnStatus(invoice)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            {formatDate(invoice.date || invoice.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowCreditNoteModal(true);
                              }}
                              className="inline-flex items-center gap-2 bg-teal-600 text-white px-3 py-1 rounded-lg font-bold text-xs hover:bg-teal-700 transition"
                              title="Create Credit Note"
                            >
                              <FaFileAlt /> Return
                            </button>
                          </td>
                        </tr>

                        {/* PRODUCT DETAILS ROWS */}
                        {isExpanded && invoice.items && invoice.items.length > 0 && (
                          <tr>
                            <td colSpan="10" className="px-4 py-4 bg-gray-50">
                              <div className="ml-6">
                                <h4 className="text-teal-600 font-bold text-sm mb-3 uppercase">
                                  📦 Sales Invoice Items
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
                                      {invoice.items.map((item, idx) => (
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
                                            ₹{item.sellingPrice}
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            {item.igst
                                              ? `IGST ${item.gst}%`
                                              : `CGST ${item.cgst}% + SGST ${item.sgst}%`}
                                          </td>
                                          <td className="px-3 py-2 text-right text-gray-600">
                                            {item.hsn || "-"}
                                          </td>
                                          <td className="px-3 py-2 text-right font-bold text-teal-600">
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

        {/* CREDIT NOTE SUMMARY */}
        {salesInvoices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
              <p className="text-gray-600 text-sm uppercase font-bold mb-2">
                Total Invoices
              </p>
              <p className="text-3xl font-black text-gray-800">
                {salesInvoices.length}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
              <p className="text-gray-600 text-sm uppercase font-bold mb-2">
                Total Returned
              </p>
              <p className="text-3xl font-black text-green-600">
                ₹
                {salesInvoices
                  .reduce((sum, invoice) => sum + getTotalReturnedAmount(invoice), 0)
                  .toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500">
              <p className="text-gray-600 text-sm uppercase font-bold mb-2">
                Total Credit Notes
              </p>
              <p className="text-3xl font-black text-orange-600">
                {Object.values(creditNoteData).reduce((sum, data) => sum + (data.creditNotes?.length || 0), 0)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* CREDIT NOTE MODAL */}
      <CreditNoteModal
        invoice={selectedInvoice}
        isOpen={showCreditNoteModal}
        onClose={() => setShowCreditNoteModal(false)}
        onCreditNoteSuccess={handleCreditNoteSuccess}
      />
    </div>
  );
}
