import { useEffect, useRef, useState } from "react";
import { FaSearch, FaTimes, FaSpinner, FaCheckCircle, FaUser } from "react-icons/fa";
import { toast } from "react-toastify";
import { useBranch } from "../../context/BranchContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : "https://pearls-erp-2026.onrender.com/api";

const labelClass = "block text-xs font-bold text-gray-500 mb-1 uppercase tracking-tight";
const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-black text-gray-800 transition-all";

export default function EditReceiptModal({ isOpen, onClose, onReceiptSuccess, receiptData }) {
  const { currentBranch, user } = useBranch();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [amount, setAmount] = useState("");
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

  // Load existing data when modal opens with receiptData
  useEffect(() => {
    if (isOpen && receiptData) {
      setSelectedCustomerId(receiptData.customer?.customerId?._id || receiptData.customer?.customerId || "");
      setSearchQuery(receiptData.customer?.name || "");
      setAmount(receiptData.amount || "");
      setPaymentMethod(receiptData.paymentMethod || "CASH");
      setReference(receiptData.reference || "");
      setNotes(receiptData.notes || "");
    }
  }, [isOpen, receiptData]);

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
        { headers: { "Content-Type": "application/json" } }
      );
      const result = await response.json();
      const allCustomers = (result?.data || result || [])
        .sort((a, b) => a.name.localeCompare(b.name));
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

    const receiptAmount = parseFloat(amount);
    if (!receiptAmount || receiptAmount <= 0) {
      toast.warning("Please enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/receipts/${receiptData._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          amount: receiptAmount,
          paymentMethod,
          reference,
          notes,
          userId: user?.id || user?._id,
          username: user?.username || "Staff",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update receipt");
      }

      toast.success(`Receipt ${receiptData.receiptId} updated successfully!`);
      onReceiptSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating receipt:", error);
      toast.error(error.message || "Failed to update receipt");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !receiptData) return null;

  const selectedCustomer = customers.find((c) => c._id === selectedCustomerId);

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col scale-in-center">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl shadow-inner">
                <FaCheckCircle className="text-2xl" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight leading-none italic">Edit Receipt</h2>
              <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mt-2">ID: {receiptData.receiptId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all active:scale-90"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto">
          {/* CUSTOMER SELECTION */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-blue-50">
                <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><FaUser size={12} /></span>
                <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Billing Customer {user?.role === "SUPER_ADMIN" ? "(Swap Allowed)" : ""}</h4>
            </div>

            <div ref={dropdownRef} className="relative">
                <div className="relative">
                  <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder={user?.role === "SUPER_ADMIN" ? "Search customer to swap..." : "Customer name"}
                    value={searchQuery}
                    onChange={(e) => {
                      if (user?.role !== "SUPER_ADMIN") return;
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => user?.role === "SUPER_ADMIN" && setShowDropdown(true)}
                    readOnly={user?.role !== "SUPER_ADMIN"}
                    className={`w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none font-black text-sm text-gray-700 ${user?.role === "SUPER_ADMIN" ? "bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" : "bg-gray-100 cursor-not-allowed"}`}
                  />
                </div>

                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-[110] animate-in slide-in-from-top-2">
                    {customers
                      .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((customer) => (
                        <div
                          key={customer._id}
                          onClick={() => {
                            setSelectedCustomerId(customer._id);
                            setSearchQuery(customer.name);
                            setShowDropdown(false);
                          }}
                          className="px-6 py-4 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors flex justify-between items-center"
                        >
                           <div>
                              <p className="font-black text-sm text-gray-800">{customer.name}</p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">ID: {customer.customerId}</p>
                           </div>
                           <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded">Bal: ₹{(customer.closingBalance || 0).toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                )}
            </div>

            {selectedCustomer && (
                <div className="p-3 bg-blue-100/50 rounded-lg border border-blue-200 text-[10px] font-black text-blue-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                    ACTIVE CUSTOMER: {selectedCustomer.name}
                </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* AMOUNT */}
             <div className="space-y-1.5">
                <label className={labelClass}>Amount Received (₹)</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={inputClass}
                    placeholder="0.00"
                />
             </div>

             {/* PAYMENT METHOD */}
             <div className="space-y-1.5">
                <label className={labelClass}>Payment Method</label>
                <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className={inputClass}
                >
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="DEBIT_CARD">Debit Card</option>
                    <option value="CREDIT">Utilize Credit</option>
                    <option value="OTHER">Other</option>
                </select>
             </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>{paymentMethod === "CHEQUE" ? "Cheque Number" : "Reference / Transaction ID"}</label>
            <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Reference Details..."
                className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Notes / Remarks</label>
            <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional details..."
                rows="3"
                className={inputClass + " resize-none"}
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-8 border-t border-gray-100 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 border border-gray-200 text-gray-500 font-black rounded-2xl hover:bg-gray-50 transition-all uppercase tracking-widest text-xs active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !amount}
            className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest text-xs active:scale-95 flex items-center justify-center gap-2"
          >
            {saving ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />}
            {saving ? "SAVING..." : "UPDATE RECEIPT"}
          </button>
        </div>
      </div>
    </div>
  );
}
