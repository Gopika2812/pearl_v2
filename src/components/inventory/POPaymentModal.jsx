import { useEffect, useState } from "react";
import { FaCreditCard, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

const POPaymentModal = ({ po, isOpen, onClose, onPaymentSuccess }) => {
  const { currentBranch } = useBranch();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [referenceNo, setReferenceNo] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [existingPayments, setExistingPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  // Fetch existing payments for this PO
  useEffect(() => {
    if (isOpen && po) {
      fetchExistingPayments();
    }
  }, [isOpen, po]);

  const fetchExistingPayments = async () => {
    try {
      setLoadingPayments(true);
      const response = await fetchWithAuth(
        `${API_BASE}/payments/po/${po._id}`
      );
      const data = await response.json();
      setExistingPayments(data.data || []);
    } catch (err) {
      console.error("Error fetching payments:", err);
    } finally {
      setLoadingPayments(false);
    }
  };

  const calculatePaidAmount = () => {
    return existingPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  };

  const calculatePendingBalance = () => {
    return Math.max(0, (po?.grandTotal || 0) - calculatePaidAmount());
  };

  // Update vendor credit after payment
  const updateVendorCredit = async (vendorName, paymentAmount, branchId) => {
    try {
      // Fetch all vendors for the branch
      const vendorResponse = await fetchWithAuth(
        `${API_BASE}/vendors?branchId=${branchId}`
      );
      const vendorData = await vendorResponse.json();
      const vendors = vendorData.data || [];

      // Find the vendor by name
      const vendor = vendors.find((v) => v.name === vendorName);
      if (!vendor) {
        console.warn(`Vendor not found: ${vendorName}`);
        return;
      }

      // Calculate new credit (reduce by payment amount)
      const newCredit = Math.max(0, vendor.credit - paymentAmount);

      // Update vendor's credit in database
      const updateResponse = await fetchWithAuth(`${API_BASE}/vendors/${vendor._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credit: newCredit,
          debit: vendor.debit,
          name: vendor.name,
          phone: vendor.phone,
          email: vendor.email,
          address: vendor.address,
          stateName: vendor.stateName,
          gstRegistrationType: vendor.gstRegistrationType,
          gstin: vendor.gstin,
          isActive: vendor.isActive,
        }),
      });

      if (updateResponse.ok) {
        console.log(
          `✅ Vendor credit updated: ${vendorName} (₹${vendor.credit} → ₹${newCredit})`
        );
      } else {
        console.error("Failed to update vendor credit");
      }
    } catch (err) {
      console.error("Error updating vendor credit:", err);
    }
  };

  const handlePayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      return toast.error("Enter a valid payment amount!");
    }

    const paidAmount = calculatePaidAmount();
    const totalAmount = po.grandTotal || 0;
    const remainingAfterPayment = totalAmount - paidAmount - parseFloat(paymentAmount);

    if (remainingAfterPayment < 0 && parseFloat(paymentAmount) > calculatePendingBalance()) {
      return toast.error(
        `Payment exceeds pending balance of ₹${calculatePendingBalance().toFixed(2)}`
      );
    }

    setSaving(true);

    try {
      const response = await fetchWithAuth(`${API_BASE}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: currentBranch?._id || currentBranch?.id,
          paymentType: "vendor_payment",
          vendor: {
            vendorId: po.vendorId || null,
            name: po.vendor,
          },
          purchaseOrder: {
            poId: po._id,
            invoiceId: po.invoiceId,
          },
          amount: parseFloat(paymentAmount),
          paymentMethod,
          referenceNo: referenceNo || "",
          description: description || `Payment for PO ${po.invoiceId}`,
          paymentDate: new Date(),
          status: "completed",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update vendor credit after successful payment
        await updateVendorCredit(
          po.vendor,
          parseFloat(paymentAmount),
          currentBranch?._id || currentBranch?.id
        );

        toast.success("Payment recorded successfully!");
        setPaymentAmount("");
        setReferenceNo("");
        setDescription("");
        fetchExistingPayments();
        onPaymentSuccess?.();
      } else {
        toast.error(data.message || "Failed to record payment");
      }
    } catch (err) {
      console.error("Payment error:", err);
      toast.error("Error recording payment");
    } finally {
      setSaving(false);
    }
  };

  const paidAmount = calculatePaidAmount();
  const pendingBalance = calculatePendingBalance();
  const isFullyPaid = pendingBalance === 0;

  if (!isOpen || !po) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-[#319bab] to-[#257f87] text-white p-6 flex justify-between items-center">
          <h2 className="text-xl font-bold">
            Payment for {po.invoiceId}
          </h2>
          <button
            onClick={onClose}
            className="text-2xl hover:opacity-75 transition"
          >
            <FaTimes />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* PAYMENT SUMMARY */}
          <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                Total Amount
              </p>
              <p className="text-2xl font-black text-gray-800">
                ₹{(po.grandTotal || 0).toLocaleString()}
              </p>
            </div>
            <div className="text-center border-l border-r border-gray-300">
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                Paid Amount
              </p>
              <p className="text-2xl font-black text-green-600">
                ₹{paidAmount.toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                {isFullyPaid ? "✅ Fully Paid" : "Pending Balance"}
              </p>
              <p className={`text-2xl font-black ${isFullyPaid ? "text-green-600" : "text-red-600"}`}>
                ₹{pendingBalance.toLocaleString()}
              </p>
            </div>
          </div>

          {/* VENDOR & PO INFO */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                  Vendor
                </p>
                <p className="font-bold text-gray-800">{po.vendor}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                  Warehouse
                </p>
                <p className="font-bold text-gray-800">{po.warehouse}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                  Invoice ID
                </p>
                <p className="font-bold text-[#319bab]">{po.invoiceId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                  PO Date
                </p>
                <p className="font-bold text-gray-800">
                  {new Date(po.date).toLocaleDateString("en-IN")}
                </p>
              </div>
            </div>
          </div>

          {/* PAYMENT FORM */}
          {!isFullyPaid && (
            <div className="border-t pt-6">
              <h3 className="font-bold text-[#319bab] mb-4 uppercase text-sm">
                Record New Payment
              </h3>
              <div className="space-y-4">
                {/* Payment Amount */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">
                    Payment Amount (Max: ₹{pendingBalance.toFixed(2)})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) =>
                        setPaymentAmount(
                          Math.min(e.target.value, pendingBalance).toString()
                        )
                      }
                      max={pendingBalance}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 pl-8 focus:ring-2 focus:ring-[#319bab] outline-none"
                    />
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#319bab] outline-none"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="check">Check</option>
                    <option value="cash">Cash</option>
                    <option value="credit">Credit</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Reference Number */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">
                    {paymentMethod === "check"
                      ? "Check Number"
                      : "Reference Number (Optional)"}
                  </label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="e.g., CHQ123456 or Transaction ID"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#319bab] outline-none text-sm"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">
                    Description (Optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Additional notes about this payment"
                    rows="3"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#319bab] outline-none text-sm resize-none"
                  />
                </div>

                {/* Pay Button */}
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button
                    onClick={onClose}
                    className="w-full border-2 border-gray-300 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePayment}
                    disabled={saving || !paymentAmount}
                    className="w-full bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <FaCreditCard />
                    {saving ? "Processing..." : `Pay ₹${parseFloat(paymentAmount || 0).toFixed(2)}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PAYMENT HISTORY */}
          {existingPayments.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="font-bold text-[#319bab] mb-4 uppercase text-sm">
                Payment History
              </h3>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Method</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-left">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {existingPayments.map((payment) => (
                      <tr key={payment._id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          {new Date(payment.paymentDate).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-3 py-2 capitalize">
                          {payment.paymentMethod?.replace("_", " ")}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-green-600">
                          ₹{payment.amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {payment.referenceNo || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* FULLY PAID MESSAGE */}
          {isFullyPaid && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-4 text-center">
              <p className="text-green-700 font-bold">
                ✅ Payment Fully Completed
              </p>
              <p className="text-green-600 text-sm mt-1">
                No pending balance for this purchase order.
              </p>
            </div>
          )}

          {/* CLOSE BUTTON */}
          <div className="border-t pt-4">
            <button
              onClick={onClose}
              className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg font-bold hover:bg-gray-300 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POPaymentModal;
