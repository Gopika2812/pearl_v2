import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : "https://pearls-erp-2026.onrender.com/api";

export default function BounceChequeModal({ invoice, isOpen, onClose, onBounceSuccess }) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && invoice) {
      setAmount("");
      setNotes("");
    }
  }, [isOpen, invoice]);

  const handleSubmit = async () => {
    const bouncedAmount = parseFloat(amount);

    if (!bouncedAmount || bouncedAmount <= 0) {
      toast.warning("Please enter a valid amount to bounce");
      return;
    }

    setSaving(true);
    try {
      // Hit the new Bounce API endpoint which handles both the ledger object and the customer updates natively.
      const bounceResponse = await fetch(`${API_BASE}/receipts/bounce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalSalesOrderId: invoice._id,
          amount: bouncedAmount,
          notes: notes
        })
      });

      if (!bounceResponse.ok) {
        throw new Error("Failed to process bounce request through backend");
      }

      toast.success(`Bounced successfully! Debit explicitly increased by ₹${bouncedAmount.toLocaleString()}`);
      onBounceSuccess();
    } catch (error) {
      console.error("Error processing cheque bounce:", error);
      toast.error(error.message || "Failed to successfully process bounce request");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !invoice) return null;

  const customerName = typeof invoice.customer === "object" ? invoice.customer.name : invoice.customer;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Record Cheque Bounce</h2>
            <p className="text-red-100 text-sm">Mathematically increase customer debit/balance</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-red-800 p-2 rounded-lg transition">
            <FaTimes className="text-2xl" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex justify-between items-center">
            <div>
              <p className="text-xs text-red-600 font-bold uppercase mb-1">Customer</p>
              <p className="font-bold text-gray-800">{customerName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-red-600 font-bold uppercase mb-1">Invoice</p>
              <p className="font-bold text-gray-800">{invoice.invoiceId || invoice.invoiceNumber}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Bounced Amount (₹) <span className="text-red-600">*</span></label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500 font-bold text-lg"
              placeholder="0.00"
              min="0"
              step="0.01"
            />
            <p className="text-xs text-gray-500 mt-2">This mathematically adds to the customer's total native debit and closing balance.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Reference / Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
              placeholder="e.g. Cheque #10293 Bounced (Incl. Penalty)"
              rows="2"
            />
          </div>

          <div className="pt-4 flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition shadow-lg disabled:opacity-50"
            >
              {saving ? "Processing..." : "Confirm Bounce"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
