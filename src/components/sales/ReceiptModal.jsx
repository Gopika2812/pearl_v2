import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : "https://pearls-erp-2026.onrender.com/api";

export default function ReceiptModal({ invoice, isOpen, onClose, onReceiptSuccess }) {
  const { currentBranch } = useBranch();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && invoice) {
      setAmount(invoice.pendingAmount ? invoice.pendingAmount.toString() : "");
      setPaymentMethod("CASH");
      setReference("");
      setNotes("");
    }
  }, [isOpen, invoice]);

  const handleSubmit = async () => {
    const receiptAmount = parseFloat(amount);

    if (!receiptAmount || receiptAmount <= 0) {
      toast.warning("Please enter a valid amount");
      return;
    }

    const maxAllowed = invoice.pendingAmount !== undefined ? invoice.pendingAmount : invoice.grandTotal || 0;
    
    if (maxAllowed < receiptAmount) {
      toast.warning(`Amount cannot exceed the pending balance of ₹${maxAllowed.toLocaleString()}`);
      return;
    }

    setSaving(true);
    try {
      // Create receipt
      const receiptPayload = {
        originalSalesOrderId: invoice._id,
        amount: receiptAmount,
        paymentMethod,
        reference: reference || null,
        notes: notes || null,
        status: "confirmed",
      };

      const receiptResponse = await fetch(`${API_BASE}/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(receiptPayload),
      });

      if (!receiptResponse.ok) {
        const errorData = await receiptResponse.json();
        throw new Error(errorData.message || "Failed to create receipt");
      }

      const result = await receiptResponse.json();
      const createdReceipt = result.data || {};

      toast.success(`Receipt created successfully! Amount: ₹${receiptAmount.toLocaleString()}`);
      onReceiptSuccess();
    } catch (error) {
      console.error("Error creating receipt:", error);
      toast.error(error.message || "Failed to create receipt");
    } finally {
      setSaving(false);
    }
  };



  if (!isOpen || !invoice) return null;

  const customerName =
    typeof invoice.customer === "object" ? invoice.customer.name : invoice.customer;
  const invoiceTotal = invoice.grandTotal || 0;
  const receiptAmount = parseFloat(amount) || 0;
  const maxAllowed = invoice.pendingAmount !== undefined ? invoice.pendingAmount : invoice.grandTotal || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 text-white p-6 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold">Receive Payment</h2>
            <p className="text-cyan-100 text-sm">Record customer payment for sales invoice</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-cyan-800 p-2 rounded-lg transition"
          >
            <FaTimes className="text-2xl" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* INVOICE DETAIL */}
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600 uppercase text-xs font-bold">Invoice ID</p>
                <p className="font-bold text-cyan-600">{invoice.invoiceId}</p>
              </div>
              <div>
                <p className="text-gray-600 uppercase text-xs font-bold">Customer</p>
                <p className="font-bold text-gray-800">{customerName}</p>
              </div>
              <div>
                <p className="text-gray-600 uppercase text-xs font-bold">Invoice Total</p>
                <p className="font-bold text-gray-800">₹{invoiceTotal.toLocaleString()}</p>
              </div>
              {invoice.pendingAmount !== undefined && (
                <div>
                  <p className="text-gray-600 uppercase text-xs font-bold text-red-600">Returns (CN)</p>
                  <p className="font-bold text-red-600">
                    - ₹{(invoiceTotal - (invoice.pendingAmount + (invoice.totalReceived || 0))).toLocaleString()}
                  </p>
                </div>
              )}
              <div>
                <p className="text-gray-600 uppercase text-xs font-bold">Date</p>
                <p className="font-bold text-gray-800">
                  {new Date(invoice.date || invoice.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>
              <div>
                <p className="text-gray-600 uppercase text-xs font-bold">Warehouse</p>
                <p className="font-bold text-gray-800">
                  {typeof invoice.warehouse === "object" ? invoice.warehouse?.name : invoice.warehouse}
                </p>
              </div>
            </div>
          </div>

          {/* PAYMENT FORM */}
          <div className="space-y-4">
            {/* AMOUNT */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">
                Payment Amount <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-600 font-bold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={invoiceTotal}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 font-bold text-lg"
                />
              </div>
              {amount && (
                <p className="text-xs text-gray-600 mt-1">
                  Balance: ₹{(maxAllowed - receiptAmount).toLocaleString()}
                </p>
              )}
            </div>

            {/* PAYMENT METHOD */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">
                Payment Method <span className="text-red-600">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="DEBIT_CARD">Debit Card</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* REFERENCE */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">
                {paymentMethod === "CHEQUE" ? "Cheque Number" : "Reference / Transaction ID"}
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={paymentMethod === "CHEQUE" ? "e.g., CHQ12345" : "e.g., TXN123456"}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {/* NOTES */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">
                Notes / Remarks
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes about this payment..."
                rows="3"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* PAYMENT SUMMARY */}
          {amount && (
            <div className="bg-gray-50 p-4 rounded-lg border-2 border-cyan-500">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Bill Pending:</span>
                  <span className="font-bold">₹{maxAllowed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Amount:</span>
                  <span className="font-bold text-green-600">₹{receiptAmount.toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-gray-800 font-bold">Remaining After This:</span>
                  <span className="font-black text-cyan-600">
                    ₹{(maxAllowed - receiptAmount).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !amount}
              className="px-6 py-2 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Processing..." : "Record Receipt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
