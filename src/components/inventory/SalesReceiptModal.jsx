import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API_BASE } from "../../api";

const SalesReceiptModal = ({ isOpen, onClose, onSave, salesOrder }) => {
  const [formData, setFormData] = useState({
    amount: 0,
    paymentMethod: "cash",
    paymentDate: new Date().toISOString().split("T")[0],
    referenceNo: "",
    remarks: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !salesOrder) return null;

  const remainingBalance = salesOrder.closingBalance || 0;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "amount") {
      const amount = parseFloat(value) || 0;
      if (amount > remainingBalance) {
        toast.warning(`Amount cannot exceed closing balance (₹${remainingBalance.toFixed(2)})`);
        return;
      }
    }
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.amount || formData.amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (formData.amount > remainingBalance) {
      toast.error(`Amount cannot exceed closing balance (₹${remainingBalance.toFixed(2)})`);
      return;
    }

    if (!formData.paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    try {
      setIsSubmitting(true);

      // Create a payment record for this sales order
      const response = await fetch(`${API_BASE}/sales-orders/${salesOrder._id}/record-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          paymentMethod: formData.paymentMethod,
          paymentDate: formData.paymentDate,
          referenceNo: formData.referenceNo,
          remarks: formData.remarks,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Receipt created successfully. New balance: ₹${data.newClosingBalance.toFixed(2)}`);
        setFormData({
          amount: 0,
          paymentMethod: "cash",
          paymentDate: new Date().toISOString().split("T")[0],
          referenceNo: "",
          remarks: "",
        });
        onSave(data.data);
        setTimeout(() => onClose(), 1500);
      } else {
        toast.error(data.message || "Failed to record payment");
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Error recording payment: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const newBalance = Math.max(0, remainingBalance - (parseFloat(formData.amount) || 0));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 flex justify-between items-center rounded-t-2xl">
          <div>
            <h3 className="text-xl font-bold">Record Payment</h3>
            <p className="text-sm text-green-100 mt-1">Invoice: {salesOrder.invoiceId}</p>
          </div>
          <button onClick={onClose} className="hover:bg-green-600 p-2 rounded-lg transition">
            <FaTimes size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Customer Info */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Customer</p>
            <p className="text-lg font-semibold text-gray-900">
              {typeof salesOrder.customer === "object" ? salesOrder.customer?.name : salesOrder.customer}
            </p>
          </div>

          {/* Balance Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
              <p className="text-xs text-gray-600 font-semibold">Current Balance</p>
              <p className="text-lg font-bold text-red-600">₹{remainingBalance.toFixed(2)}</p>
            </div>
            <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
              <p className="text-xs text-gray-600 font-semibold">New Balance</p>
              <p className="text-lg font-bold text-green-600">₹{newBalance.toFixed(2)}</p>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Payment Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="amount"
              step="0.01"
              min="0"
              max={remainingBalance}
              value={formData.amount}
              onChange={handleInputChange}
              placeholder={`Max: ₹${remainingBalance.toFixed(2)}`}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-base"
              required
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="credit_card">Credit Card</option>
              <option value="upi">UPI</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Payment Date
            </label>
            <input
              type="date"
              name="paymentDate"
              value={formData.paymentDate}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Reference Number */}
          {(formData.paymentMethod === "check" || formData.paymentMethod === "bank_transfer") && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reference Number
              </label>
              <input
                type="text"
                name="referenceNo"
                value={formData.referenceNo}
                onChange={handleInputChange}
                placeholder={formData.paymentMethod === "check" ? "Check number" : "Bank reference/UTR"}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Remarks (Optional)
            </label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleInputChange}
              placeholder="Add any notes..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              rows="2"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || !formData.amount}
            >
              {isSubmitting ? "Processing..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SalesReceiptModal;
