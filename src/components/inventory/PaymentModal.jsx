import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

const PaymentModal = ({ isOpen, onClose, onSave, vendors = [], purchaseOrders = [], salesOwners = [], salesMen = [] }) => {
  const { selectedBranch } = useBranch();
  const [formData, setFormData] = useState({
    paymentType: "vendor_payment",
    amount: 0,
    paymentMethod: "cash",
    paymentDate: new Date().toISOString().split("T")[0],
    vendor: { vendorId: "", name: "" },
    purchaseOrder: { poId: "", invoiceId: "" },
    loanDetails: { bankName: "", loanAmount: 0 },
    expenseDetails: { type: "salary", description: "", personName: "" },
    description: "",
    referenceNo: "",
    billingPerson: "",
  });

  const handlePaymentTypeChange = (type) => {
    setFormData({
      ...formData,
      paymentType: type,
      amount: 0,
      description: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.paymentMethod) {
      alert("Please fill all required fields");
      return;
    }

    const payload = { ...formData, branchId: selectedBranch?._id };

    try {
      const response = await fetchWithAuth(`${API_BASE}/payments`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        alert("Payment recorded successfully");
        onSave(data.data);
        setFormData({
          paymentType: "vendor_payment",
          amount: 0,
          paymentMethod: "cash",
          paymentDate: new Date().toISOString().split("T")[0],
          vendor: { vendorId: "", name: "" },
          purchaseOrder: { poId: "", invoiceId: "" },
          loanDetails: { bankName: "", loanAmount: 0 },
          expenseDetails: { type: "salary", description: "", personName: "" },
          description: "",
          referenceNo: "",
          billingPerson: "",
        });
        onClose();
      } else {
        alert(data.message || "Failed to record payment");
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-green-500 text-white p-4 sticky top-0 flex justify-between items-center">
          <h3 className="text-xl font-bold">Record Payment</h3>
          <button onClick={onClose} className="hover:bg-green-600 p-2 rounded">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Payment Type Selection */}
          <div>
            <label className="text-sm font-bold text-gray-600 block mb-2">
              Payment Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "vendor_payment", label: "Vendor Payment" },
                { value: "expense", label: "Expense" },
                { value: "loan_payment", label: "Loan Payment" },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handlePaymentTypeChange(type.value)}
                  className={`p-2 rounded-lg font-semibold transition ${
                    formData.paymentType === type.value
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vendor Payment */}
          {formData.paymentType === "vendor_payment" && (
            <div className="space-y-3 bg-blue-50 p-4 rounded-lg">
              <div>
                <label className="text-sm font-bold text-gray-600 block mb-1">
                  Select Vendor
                </label>
                <select
                  value={formData.vendor.vendorId}
                  onChange={(e) => {
                    const vendor = vendors.find((v) => v._id === e.target.value);
                    setFormData({
                      ...formData,
                      vendor: {
                        vendorId: e.target.value,
                        name: vendor?.name || "",
                      },
                    });
                  }}
                  className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Vendor --</option>
                  {vendors.map((vendor) => (
                    <option key={vendor._id} value={vendor._id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 block mb-1">
                  Purchase Order (Optional)
                </label>
                <select
                  value={formData.purchaseOrder.poId}
                  onChange={(e) => {
                    const po = purchaseOrders.find((p) => p._id === e.target.value);
                    setFormData({
                      ...formData,
                      purchaseOrder: {
                        poId: e.target.value,
                        invoiceId: po?.invoiceId || "",
                      },
                    });
                  }}
                  className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select PO (Optional) --</option>
                  {purchaseOrders.map((po) => (
                    <option key={po._id} value={po._id}>
                      {po.invoiceId}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Expense Payment */}
          {formData.paymentType === "expense" && (
            <div className="space-y-3 bg-orange-50 p-4 rounded-lg">
              <div>
                <label className="text-sm font-bold text-gray-600 block mb-1">
                  Expense Type
                </label>
                <select
                  value={formData.expenseDetails.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expenseDetails: {
                        ...formData.expenseDetails,
                        type: e.target.value,
                      },
                    })
                  }
                  className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="salary">Salary</option>
                  <option value="rent">Rent</option>
                  <option value="electricity">Electricity</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {formData.expenseDetails.type === "salary" && (
                <div>
                  <label className="text-sm font-bold text-gray-600 block mb-1">
                    Person Name
                  </label>
                  <input
                    type="text"
                    value={formData.expenseDetails.personName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        expenseDetails: {
                          ...formData.expenseDetails,
                          personName: e.target.value,
                        },
                      })
                    }
                    placeholder="Enter employee name"
                    className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-bold text-gray-600 block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.expenseDetails.description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expenseDetails: {
                        ...formData.expenseDetails,
                        description: e.target.value,
                      },
                    })
                  }
                  placeholder="e.g., Monthly rent for office, October salary"
                  className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Loan Payment */}
          {formData.paymentType === "loan_payment" && (
            <div className="space-y-3 bg-red-50 p-4 rounded-lg">
              <div>
                <label className="text-sm font-bold text-gray-600 block mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={formData.loanDetails.bankName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      loanDetails: {
                        ...formData.loanDetails,
                        bankName: e.target.value,
                      },
                    })
                  }
                  placeholder="Enter bank name"
                  className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Common Fields */}
          <div className="border-t pt-4 space-y-3">
            <div>
              <label className="text-sm font-bold text-gray-600 block mb-1">
                Amount (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="Enter payment amount"
                className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="text-sm font-bold text-gray-600 block mb-1">
                Payment Method
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) =>
                  setFormData({ ...formData, paymentMethod: e.target.value })
                }
                className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit">Credit</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-600 block mb-1">
                Payment Date
              </label>
              <input
                type="date"
                value={formData.paymentDate}
                onChange={(e) =>
                  setFormData({ ...formData, paymentDate: e.target.value })
                }
                className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {(formData.paymentMethod === "check" ||
              formData.paymentMethod === "bank_transfer") && (
              <div>
                <label className="text-sm font-bold text-gray-600 block mb-1">
                  Reference No. (Check/Bank Ref)
                </label>
                <input
                  type="text"
                  value={formData.referenceNo}
                  onChange={(e) =>
                    setFormData({ ...formData, referenceNo: e.target.value })
                  }
                  placeholder="Check number or bank reference"
                  className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-bold text-gray-600 block mb-1">
                Billing Person
              </label>
              <select
                value={formData.billingPerson}
                onChange={(e) =>
                  setFormData({ ...formData, billingPerson: e.target.value })
                }
                className="w-full p-2 border rounded-lg outline-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Person --</option>
                {salesOwners.map((owner) => (
                  <option key={owner._id} value={owner.name}>
                    {owner.name} (Sales Owner)
                  </option>
                ))}
                {salesMen.map((man) => (
                  <option key={man._id} value={man.name}>
                    {man.name} (Sales Man)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>

        <div className="border-t p-4 flex gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 p-2 border rounded-lg hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-bold"
          >
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
