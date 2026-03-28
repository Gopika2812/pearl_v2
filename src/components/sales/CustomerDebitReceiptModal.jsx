import { useEffect, useRef, useState } from "react";
import { FaSearch, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : "https://pearls-erp-2026.onrender.com/api";

export default function CustomerDebitReceiptModal({ isOpen, onClose, onReceiptSuccess }) {
  const { currentBranch } = useBranch();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [debitAmount, setDebitAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch customers when modal opens
  useEffect(() => {
    if (isOpen && currentBranch?._id) {
      fetchCustomers();
    }
  }, [isOpen, currentBranch]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedCustomerId("");
      setSearchQuery("");
      setShowDropdown(false);
      setDebitAmount("");
      setPaymentMethod("CASH");
      setReference("");
      setNotes("");
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/customers?branchId=${currentBranch._id}&limit=9999`,
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      const result = await response.json();
      
      // Show all customers, sorted by name
      const allCustomers = (result?.data || result || [])
        .sort((a, b) => a.name.localeCompare(b.name));
      
      console.log("Fetched customers:", allCustomers.length);
      setCustomers(allCustomers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCustomerId) {
      toast.warning("Please select a customer");
      return;
    }

    const amount = parseFloat(debitAmount);
    if (!amount || amount <= 0) {
      toast.warning("Please enter a valid amount");
      return;
    }

    const selectedCustomer = customers.find((c) => c._id === selectedCustomerId);
    if (!selectedCustomer) {
      toast.error("Customer not found");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/receipts/general`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          amount,
          paymentMethod,
          reference,
          notes,
          branchId: currentBranch?._id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to process debit receipt");
      }

      toast.success(
        `Debit Receipt ${data.data.receiptId} created successfully! Amount: ₹${amount.toLocaleString()}`
      );

      // Refresh and close
      onReceiptSuccess();
      onClose();
    } catch (error) {
      console.error("Error processing debit receipt:", error);
      toast.error(error.message || "Failed to process debit receipt");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const selectedCustomer = customers.find((c) => c._id === selectedCustomerId);
  const currentDebit = selectedCustomer?.debit || 0;
  const amount = parseFloat(debitAmount) || 0;
  const newDebit = Math.max(0, currentDebit - amount);
  const newCredit = Math.max(0, amount - currentDebit);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold">Customer Debit Receipt</h2>
            <p className="text-blue-100 text-sm">
              Settle customer debit (amount owed to customer)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 p-2 rounded-lg transition"
          >
            <FaTimes className="text-2xl" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* CUSTOMER SELECTION */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              Select Customer <span className="text-red-600">*</span>
            </label>
            {loading ? (
              <p className="text-gray-600 text-sm">Loading customers...</p>
            ) : customers.length === 0 ? (
              <p className="text-amber-600 text-sm">
                No customers found
              </p>
            ) : (
              <div ref={dropdownRef} className="relative">
                <div className="relative">
                  <FaSearch className="absolute left-4 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search customer by name..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* DROPDOWN LIST */}
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 bg-white border-2 border-gray-300 border-t-0 rounded-b-lg shadow-lg max-h-64 overflow-y-auto z-50">
                    {customers
                      .filter((c) =>
                        c.name.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((customer) => (
                        <div
                          key={customer._id}
                          onClick={() => {
                            setSelectedCustomerId(customer._id);
                            setSearchQuery(customer.name);
                            setShowDropdown(false);
                            setDebitAmount("");
                          }}
                          className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-800">
                              {customer.name}
                            </span>
                            <span className="text-xs font-bold text-orange-600">
                              Debit: ₹{(customer.debit || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    {customers.filter((c) =>
                      c.name.toLowerCase().includes(searchQuery.toLowerCase())
                    ).length === 0 && (
                      <div className="px-4 py-3 text-center text-gray-500 text-sm">
                        No customers found
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CUSTOMER DETAIL */}
          {selectedCustomer && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 uppercase text-xs font-bold">Customer Name</p>
                  <p className="font-bold text-gray-800">{selectedCustomer.name}</p>
                </div>
                <div>
                  <p className="text-gray-600 uppercase text-xs font-bold">Current Debit</p>
                  <p className="font-bold text-orange-600">
                    ₹{(selectedCustomer.debit || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 uppercase text-xs font-bold">Closing Balance</p>
                  <p className="font-bold text-gray-800">
                    ₹{(selectedCustomer.closingBalance || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 uppercase text-xs font-bold">WhatsApp</p>
                  <p className="font-bold text-gray-800">{selectedCustomer.whatsapp || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-600 uppercase text-xs font-bold">Email</p>
                  <p className="font-bold text-gray-800 text-xs">{selectedCustomer.email || "-"}</p>
                </div>
              </div>
            </div>
          )}

          {/* PAYMENT FORM */}
          {selectedCustomer && (
            <div className="space-y-4">
              {/* DEBIT AMOUNT */}
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  Debit Amount to Settle <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-gray-600 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={debitAmount}
                    onChange={(e) => setDebitAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-lg"
                  />
                </div>
                {currentDebit > 0 && (
                  <p className="text-xs text-gray-600 mt-1">
                    Current Debit: ₹{(currentDebit).toLocaleString()}
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
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  placeholder={
                    paymentMethod === "CHEQUE" ? "e.g., CHQ12345" : "e.g., TXN123456"
                  }
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  placeholder="Add any additional notes about this debit settlement..."
                  rows="3"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* PAYMENT SUMMARY */}
          {debitAmount && selectedCustomer && (
            <div className="bg-gray-50 p-4 rounded-lg border-2 border-blue-500">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Debit Balance:</span>
                  <span className="font-bold">₹{(currentDebit).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Settlement Amount:</span>
                  <span className="font-bold text-green-600">-₹{(amount).toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-gray-800 font-bold">New Debit Balance:</span>
                  <span className="font-black text-blue-600">₹{(newDebit).toLocaleString()}</span>
                </div>
                {newCredit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-800 font-bold">New Credit (Advance):</span>
                    <span className="font-black text-green-600">₹{(newCredit).toLocaleString()}</span>
                  </div>
                )}
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
              disabled={saving || !selectedCustomerId || !debitAmount}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Processing..." : "Record Debit Receipt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
