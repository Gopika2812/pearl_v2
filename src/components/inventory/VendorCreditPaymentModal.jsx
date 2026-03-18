import { useEffect, useRef, useState } from "react";
import { FaSearch, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

export default function VendorCreditPaymentModal({
  isOpen,
  onClose,
  onPaymentSuccess,
}) {
  const { currentBranch } = useBranch();
  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch vendors when modal opens
  useEffect(() => {
    if (isOpen && currentBranch?._id) {
      fetchVendors();
    }
  }, [isOpen, currentBranch]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedVendorId("");
      setSearchQuery("");
      setShowDropdown(false);
      setCreditAmount("");
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

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/vendors?branchId=${currentBranch._id}&limit=9999`,
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      const result = await response.json();

      // Show all vendors, sorted by name
      const allVendors = (result?.data || result || [])
        .sort((a, b) => a.name.localeCompare(b.name));

      console.log("Fetched vendors:", allVendors.length);
      setVendors(allVendors);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      toast.error("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedVendorId) {
      toast.warning("Please select a vendor");
      return;
    }

    const amount = parseFloat(creditAmount);
    if (!amount || amount <= 0) {
      toast.warning("Please enter a valid amount");
      return;
    }

    const selectedVendor = vendors.find((v) => v._id === selectedVendorId);
    if (!selectedVendor) {
      toast.error("Vendor not found");
      return;
    }

    if (amount > (selectedVendor.credit || 0)) {
      toast.warning(
        `Amount cannot exceed vendor's credit balance of ₹${(selectedVendor.credit || 0).toLocaleString()}`
      );
      return;
    }

    setSaving(true);
    try {
      // Calculate new credit balance
      const newCredit = Math.max(0, (selectedVendor.credit || 0) - amount);

      // Update vendor credit balance
      const updateResponse = await fetch(
        `${API_BASE}/vendors/${selectedVendorId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...selectedVendor,
            credit: newCredit,
          }),
        }
      );

      if (!updateResponse.ok) {
        throw new Error("Failed to update vendor credit balance");
      }

      toast.success(
        `Payment recorded successfully! Credit amount reduced by ₹${amount.toLocaleString()}`
      );

      // Refresh and close
      onPaymentSuccess();
      onClose();
    } catch (error) {
      console.error("Error processing vendor payment:", error);
      toast.error(error.message || "Failed to process vendor payment");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const selectedVendor = vendors.find((v) => v._id === selectedVendorId);
  const currentCredit = selectedVendor?.credit || 0;
  const amount = parseFloat(creditAmount) || 0;
  const newCredit = Math.max(0, currentCredit - amount);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold">Vendor Payment</h2>
            <p className="text-green-100 text-sm">
              Record payment to reduce vendor credit
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-green-800 p-2 rounded-lg transition"
          >
            <FaTimes className="text-2xl" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* VENDOR SELECTION */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              Select Vendor <span className="text-red-600">*</span>
            </label>
            {loading ? (
              <p className="text-gray-600 text-sm">Loading vendors...</p>
            ) : vendors.length === 0 ? (
              <p className="text-amber-600 text-sm">
                No vendors found
              </p>
            ) : (
              <div ref={dropdownRef} className="relative">
                <div className="relative">
                  <FaSearch className="absolute left-4 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search vendor by name..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                {/* DROPDOWN LIST */}
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 bg-white border-2 border-gray-300 border-t-0 rounded-b-lg shadow-lg max-h-64 overflow-y-auto z-50">
                    {vendors
                      .filter((v) =>
                        v.name.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((vendor) => (
                        <div
                          key={vendor._id}
                          onClick={() => {
                            setSelectedVendorId(vendor._id);
                            setSearchQuery(vendor.name);
                            setShowDropdown(false);
                            setCreditAmount("");
                          }}
                          className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b last:border-b-0 transition"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-800">
                              {vendor.name}
                            </span>
                            <span className="text-xs font-bold text-orange-600">
                              Credit: ₹{(vendor.credit || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    {vendors.filter((v) =>
                      v.name.toLowerCase().includes(searchQuery.toLowerCase())
                    ).length === 0 && (
                      <div className="px-4 py-3 text-center text-gray-500 text-sm">
                        No vendors found
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* VENDOR DETAIL */}
          {selectedVendor && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 uppercase text-xs font-bold">Vendor Name</p>
                  <p className="font-bold text-gray-800">{selectedVendor.name}</p>
                </div>
                <div>
                  <p className="text-gray-600 uppercase text-xs font-bold">Current Credit</p>
                  <p className="font-bold text-orange-600">
                    ₹{(selectedVendor.credit || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 uppercase text-xs font-bold">Phone</p>
                  <p className="font-bold text-gray-800">{selectedVendor.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-600 uppercase text-xs font-bold">GST</p>
                  <p className="font-bold text-gray-800">{selectedVendor.gstin || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-600 uppercase text-xs font-bold">Email</p>
                  <p className="font-bold text-gray-800 text-xs">{selectedVendor.email || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-600 uppercase text-xs font-bold">Status</p>
                  <p className="font-bold text-green-600">
                    {selectedVendor.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PAYMENT FORM */}
          {selectedVendor && (
            <div className="space-y-4">
              {/* CREDIT AMOUNT */}
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
                    max={currentCredit}
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 font-bold text-lg"
                  />
                </div>
                {creditAmount && (
                  <p className="text-xs text-gray-600 mt-1">
                    Max Amount: ₹{(currentCredit).toLocaleString()}
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
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                  {paymentMethod === "CHEQUE"
                    ? "Cheque Number"
                    : "Reference / Transaction ID"}
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={
                    paymentMethod === "CHEQUE" ? "e.g., CHQ12345" : "e.g., TXN123456"
                  }
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
          )}

          {/* PAYMENT SUMMARY */}
          {creditAmount && selectedVendor && (
            <div className="bg-gray-50 p-4 rounded-lg border-2 border-green-500">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Credit Balance:</span>
                  <span className="font-bold">₹{(currentCredit).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Amount:</span>
                  <span className="font-bold text-green-600">-₹{(amount).toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-gray-800 font-bold">New Credit Balance:</span>
                  <span className="font-black text-green-600">₹{(newCredit).toLocaleString()}</span>
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
              disabled={saving || !selectedVendorId || !creditAmount}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Processing..." : "Record Payment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
