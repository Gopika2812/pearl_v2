import React, { useEffect, useState } from "react";
import { FaChevronDown, FaChevronUp, FaFileAlt, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import CustomerDebitReceiptModal from "../../components/sales/CustomerDebitReceiptModal";
import ReceiptModal from "../../components/sales/ReceiptModal";
import BounceChequeModal from "../../components/sales/BounceChequeModal";
import { useBranch } from "../../context/BranchContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : "https://pearls-erp-2026.onrender.com/api";

export default function BranchReceipt() {
  const { currentBranch } = useBranch();
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [receiptData, setReceiptData] = useState({});
  const [loading, setLoading] = useState(true);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showDebitReceiptModal, setShowDebitReceiptModal] = useState(false);
  const [showBounceModal, setShowBounceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedBounceInvoice, setSelectedBounceInvoice] = useState(null);
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

      // Fetch receipts for each invoice
      for (const inv of invoices) {
        fetchReceiptsForInvoice(inv._id);
      }
    } catch (error) {
      console.error("Error fetching sales invoices:", error);
      toast.error("Failed to load sales invoices");
    } finally {
      setLoading(false);
    }
  };

  const fetchReceiptsForInvoice = async (invoiceId) => {
    try {
      const response = await fetch(`${API_BASE}/receipts/order/${invoiceId}`, {
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      const receipts = result.data || [];

      const totalReceived = (receipts || []).reduce((sum, r) => {
        return r.paymentMethod === "BOUNCED" ? sum - (r.amount || 0) : sum + (r.amount || 0);
      }, 0);

      setReceiptData((prev) => ({
        ...prev,
        [invoiceId]: {
          receipts: receipts || [],
          totalReceived,
        },
      }));
    } catch (error) {
      console.error("Error fetching receipts:", error);
    }
  };

  const toggleExpandInvoice = (invoiceId) => {
    setExpandedInvoices((prev) => ({
      ...prev,
      [invoiceId]: !prev[invoiceId],
    }));
  };

  const handleReceivePayment = (invoice, pending) => {
    setSelectedInvoice({ ...invoice, pendingAmount: pending });
    setShowReceiptModal(true);
  };

  const handleReceiptSuccess = () => {
    setShowReceiptModal(false);
    setSelectedInvoice(null);
    fetchSalesInvoices();
  };

  const handleBounceClick = (invoice) => {
    setSelectedBounceInvoice(invoice);
    setShowBounceModal(true);
  };

  const handleBounceSuccess = () => {
    setShowBounceModal(false);
    setSelectedBounceInvoice(null);
    fetchSalesInvoices();
  };

  const getReceiptsForInvoice = (invoiceId) => {
    return receiptData[invoiceId]?.receipts || [];
  };

  const getTotalReceivedAmount = (invoice) => {
    return receiptData[invoice._id]?.totalReceived || 0;
  };

  const getReceiptStatus = (invoice) => {
    const receipts = getReceiptsForInvoice(invoice._id);
    if (receipts.length === 0) return "No Receipts";
    return `${receipts.length} Receipt${receipts.length > 1 ? "s" : ""}`;
  };

  const getStatusColor = (invoice) => {
    const received = getTotalReceivedAmount(invoice);
    const balance = invoice.grandTotal || 0;
    if (received === 0) return "bg-blue-100 text-blue-700";
    if (received < balance / 2) return "bg-orange-100 text-orange-700";
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
        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FaFileAlt className="text-5xl opacity-80" />
              <div>
                <h1 className="text-4xl font-bold">Receipt Management</h1>
                <p className="text-cyan-100 mt-2">Receive payments from customers</p>
              </div>
            </div>
            <button
              onClick={() => setShowDebitReceiptModal(true)}
              className="flex items-center gap-2 bg-white text-cyan-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition shadow-lg"
              title="Create Customer Debit Receipt"
            >
              <FaPlus /> Debit Receipt
            </button>
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
                <thead className="bg-gradient-to-r from-cyan-50 to-cyan-100 border-b">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Expand</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Invoice ID</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Warehouse</th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">Items</th>
                    <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase">Invoice Amount</th>
                    <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase">Received</th>
                    <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase">Pending</th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">Status</th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">Date</th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {salesInvoices.map((invoice) => {
                    const invoiceReceipts = getReceiptsForInvoice(invoice._id);
                    const isExpanded = expandedInvoices[invoice._id] || false;
                    const received = getTotalReceivedAmount(invoice);
                    const pending = Math.max(0, (invoice.grandTotal || 0) - received);

                    return (
                      <React.Fragment key={invoice._id}>
                        {/* MAIN INVOICE ROW */}
                        <tr className="hover:bg-gray-50 transition">
                          <td className="px-2 py-3 text-center">
                            <button
                              onClick={() => toggleExpandInvoice(invoice._id)}
                              className="text-cyan-600 hover:text-cyan-700 transition"
                            >
                              {isExpanded ? (
                                <FaChevronUp />
                              ) : (
                                <FaChevronDown />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-bold text-cyan-600">
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
                            <span className="bg-cyan-600/10 text-cyan-600 px-3 py-1 rounded-full text-xs font-bold">
                              {invoice.items?.length || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            ₹{(invoice.grandTotal || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">
                            ₹{received.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-orange-600">
                            ₹{pending.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(
                                invoice
                              )}`}
                            >
                              {getReceiptStatus(invoice)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            {formatDate(invoice.date || invoice.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-2">
                              {pending > 0 ? (
                                <button
                                  onClick={() => handleReceivePayment(invoice, pending)}
                                  className="inline-flex items-center gap-2 bg-cyan-600 text-white px-3 py-1 rounded-lg font-bold text-xs hover:bg-cyan-700 transition"
                                  title="Receive Payment"
                                >
                                  <FaFileAlt /> Receive
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 border border-gray-200 px-3 py-1 rounded-lg font-bold text-xs cursor-not-allowed" title="Fully Paid">
                                  ✓ Paid
                                </span>
                              )}
                              <button
                                onClick={() => handleBounceClick(invoice)}
                                className="inline-flex items-center gap-2 bg-red-100 text-red-600 border border-red-200 px-3 py-1 rounded-lg font-bold text-xs hover:bg-red-200 transition"
                                title="Record Bounced Cheque"
                              >
                                Bounce
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* PRODUCT DETAILS ROWS */}
                        {isExpanded && invoice.items && invoice.items.length > 0 && (
                          <tr>
                            <td colSpan="11" className="px-4 py-4 bg-gray-50">
                              <div className="ml-6">
                                <h4 className="text-cyan-600 font-bold text-sm mb-3 uppercase">
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
                                          <td className="px-3 py-2 text-right font-bold text-cyan-600">
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
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RECEIPT SUMMARY */}
        {salesInvoices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
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
                Total Received
              </p>
              <p className="text-3xl font-black text-green-600">
                ₹
                {salesInvoices
                  .reduce((sum, invoice) => sum + getTotalReceivedAmount(invoice), 0)
                  .toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500">
              <p className="text-gray-600 text-sm uppercase font-bold mb-2">
                Total Pending
              </p>
              <p className="text-3xl font-black text-orange-600">
                ₹
                {salesInvoices
                  .reduce((sum, invoice) => {
                    const total = invoice.grandTotal || 0;
                    const received = getTotalReceivedAmount(invoice);
                    return sum + Math.max(0, total - received);
                  }, 0)
                  .toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-500">
              <p className="text-gray-600 text-sm uppercase font-bold mb-2">
                Total Receipts
              </p>
              <p className="text-3xl font-black text-purple-600">
                {Object.values(receiptData).reduce((sum, data) => sum + (data.receipts?.length || 0), 0)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* RECEIPT MODAL */}
      <ReceiptModal
        invoice={selectedInvoice}
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        onReceiptSuccess={handleReceiptSuccess}
      />

      {/* CUSTOMER DEBIT RECEIPT MODAL */}
      <CustomerDebitReceiptModal
        isOpen={showDebitReceiptModal}
        onClose={() => setShowDebitReceiptModal(false)}
        onReceiptSuccess={() => {
          setShowDebitReceiptModal(false);
          fetchSalesInvoices();
        }}
      />

      {/* CHEQUE BOUNCED MODAL */}
      <BounceChequeModal
        invoice={selectedBounceInvoice}
        isOpen={showBounceModal}
        onClose={() => setShowBounceModal(false)}
        onBounceSuccess={handleBounceSuccess}
      />
    </div>
  );
}
