import { useEffect, useRef, useState } from "react";
import {
  FaTimes, FaMoneyBillWave, FaUniversity, FaCreditCard,
  FaMobileAlt, FaEllipsisH, FaSearch, FaFileInvoiceDollar,
  FaChevronRight, FaArrowLeft
} from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: <FaMoneyBillWave /> },
  { value: "bank_transfer", label: "Bank", icon: <FaUniversity /> },
  { value: "check", label: "Cheque", icon: <FaCreditCard /> },
  { value: "credit", label: "UPI", icon: <FaMobileAlt /> },
  { value: "other", label: "Other", icon: <FaEllipsisH /> },
];

export default function VendorCreditPaymentModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  preselectedVendor = null,
}) {
  const { currentBranch } = useBranch();

  // Mode: "general" | "invoice"
  const [mode, setMode] = useState("general");

  // Shared state
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [nextPayId, setNextPayId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);

  // General mode
  const [paymentAmount, setPaymentAmount] = useState("");

  // Invoice mode
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoicePayAmount, setInvoicePayAmount] = useState("");
  const [invoicePayments, setInvoicePayments] = useState({}); // poId → paid total

  // ─── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && currentBranch?._id) {
      if (!preselectedVendor) fetchVendors();
      else { setVendors([]); setSelectedVendor(preselectedVendor); setSearchQuery(preselectedVendor.name); }
      fetchNextPayId();
    }
  }, [isOpen, currentBranch]);

  useEffect(() => {
    if (!isOpen) return;
    setMode("general");
    setPaymentAmount("");
    setPaymentMethod("cash");
    setReference("");
    setNotes("");
    setSelectedInvoice(null);
    setInvoicePayAmount("");
    setInvoices([]);
    if (!preselectedVendor) { setSelectedVendor(null); setSearchQuery(""); }
  }, [isOpen]);

  useEffect(() => {
    if (selectedVendor && mode === "invoice") fetchInvoicesForVendor();
  }, [selectedVendor, mode]);

  useEffect(() => {
    const close = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // ─── Data Fetching ──────────────────────────────────────────────────────────
  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/vendors?branchId=${currentBranch._id}&limit=9999`);
      const data = await res.json();
      setVendors((data?.data || data || []).sort((a, b) => a.name.localeCompare(b.name)));
    } catch { toast.error("Failed to load vendors"); }
    finally { setLoading(false); }
  };

  const fetchNextPayId = async () => {
    try {
      const res = await fetch(`${API_BASE}/payments/next-id?branchId=${currentBranch._id}`);
      const data = await res.json();
      setNextPayId(data.nextId || "");
    } catch { /* silent */ }
  };

  const fetchInvoicesForVendor = async () => {
    if (!selectedVendor) return;
    setInvoicesLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/purchase-orders?branchId=${currentBranch._id}&statuses=INVOICED,PARTIALLY_RETURNED`
      );
      const data = await res.json();
      const all = data.data || data || [];
      const supplierInvoices = all.filter(po => {
        const vendorName = po.vendor?.name || po.vendor;
        // Exclude cancelled invoices
        if (po.status === "CANCELLED") return false;
        return vendorName === selectedVendor.name;
      });
      setInvoices(supplierInvoices);

      // Fetch payment status for each invoice
      const payMap = {};
      await Promise.all(
        supplierInvoices.map(async (po) => {
          try {
            const pRes = await fetch(`${API_BASE}/payments/po/${po._id}`);
            const pData = await pRes.json();
            const paid = (pData.data || []).reduce((s, p) => s + (p.amount || 0), 0);
            payMap[po._id] = paid;
          } catch { payMap[po._id] = 0; }
        })
      );
      setInvoicePayments(payMap);
    } catch { toast.error("Failed to load invoices"); }
    finally { setInvoicesLoading(false); }
  };

  const getPendingAmount = (po) => Math.max(0, (po.grandTotal || 0) - (invoicePayments[po._id] || 0));

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedVendor) { toast.warning("Please select a supplier"); return; }

    let amount, purchaseOrderPayload;

    if (mode === "general") {
      amount = parseFloat(paymentAmount);
      if (!amount || amount <= 0) { toast.warning("Enter a valid amount"); return; }
      purchaseOrderPayload = null;
    } else {
      if (!selectedInvoice) { toast.warning("Please select an invoice"); return; }
      amount = parseFloat(invoicePayAmount);
      if (!amount || amount <= 0) { toast.warning("Enter a valid amount"); return; }
      const pending = getPendingAmount(selectedInvoice);
      if (amount > pending + 0.01) {
        toast.warning(`Amount cannot exceed pending balance of ₹${pending.toLocaleString()}`);
        return;
      }
      purchaseOrderPayload = {
        poId: selectedInvoice._id,
        invoiceId: selectedInvoice.invoiceId,
      };
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: currentBranch._id,
          paymentType: "vendor_payment",
          amount,
          paymentMethod,
          paymentDate: new Date(),
          vendor: { vendorId: selectedVendor._id, name: selectedVendor.name },
          purchaseOrder: purchaseOrderPayload,
          description: notes || (
            mode === "invoice"
              ? `Invoice payment: ${selectedInvoice?.invoiceId} — ${selectedVendor.name}`
              : `General payment to ${selectedVendor.name}`
          ),
          referenceNo: reference,
          status: "completed",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Payment failed");
      toast.success(`✅ Payment recorded! ID: ${data.data?.paymentId || nextPayId}`);
      onPaymentSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentCredit = selectedVendor?.credit || 0;
  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 flex items-center justify-between sticky top-0 z-10 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold">Record Supplier Payment</h2>
            <p className="text-emerald-100 text-xs mt-0.5">
              {nextPayId
                ? <span className="font-mono bg-white/15 px-2 py-0.5 rounded">{nextPayId}</span>
                : "Auto-generating ID..."}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
            <FaTimes />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-2 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => { setMode("general"); setSelectedInvoice(null); setInvoicePayAmount(""); }}
              className={`py-2.5 rounded-lg text-sm font-bold transition ${mode === "general"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-gray-400 hover:text-gray-600"}`}
            >
              🏦 General Payment
            </button>
            <button
              onClick={() => { setMode("invoice"); setPaymentAmount(""); }}
              className={`py-2.5 rounded-lg text-sm font-bold transition ${mode === "invoice"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-gray-400 hover:text-gray-600"}`}
            >
              📄 Pay Against Invoice
            </button>
          </div>

          {/* Vendor Selector (only if not preselected) */}
          {!preselectedVendor && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Supplier <span className="text-red-500">*</span>
              </label>
              {loading ? <p className="text-sm text-gray-400">Loading...</p> : (
                <div ref={dropdownRef} className="relative">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-3 text-gray-400 text-xs" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder="Search supplier..."
                      className="w-full pl-8 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                  {showDropdown && filteredVendors.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto">
                      {filteredVendors.map(v => (
                        <div
                          key={v._id}
                          onClick={() => {
                            setSelectedVendor(v);
                            setSearchQuery(v.name);
                            setShowDropdown(false);
                            setSelectedInvoice(null);
                          }}
                          className="flex justify-between items-center px-4 py-2.5 hover:bg-emerald-50 cursor-pointer border-b last:border-0"
                        >
                          <span className="font-semibold text-sm">{v.name}</span>
                          <span className="text-xs text-orange-600 font-bold">₹{(v.credit || 0).toLocaleString()} cr</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Vendor Summary */}
          {selectedVendor && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase">Supplier</p>
                <p className="font-black text-gray-800">{selectedVendor.name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 font-bold uppercase">Credit Balance</p>
                <p className="text-xl font-black text-orange-600">₹{currentCredit.toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* ── GENERAL MODE ── */}
          {mode === "general" && selectedVendor && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Payment Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-gray-400 font-bold">₹</span>
                  <input
                    type="number" min="0" step="1" value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-base font-bold focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Paying against total credit balance (migrated / general)</p>
              </div>

              {/* Preview */}
              {parseFloat(paymentAmount) > 0 && (
                <div className="bg-gray-50 border-2 border-emerald-400 rounded-xl p-3 text-sm space-y-1.5">
                  <div className="flex justify-between text-gray-500">
                    <span>Current Credit:</span>
                    <span className="font-bold text-orange-600">₹{currentCredit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Payment:</span>
                    <span className="font-bold text-emerald-600">-₹{parseFloat(paymentAmount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-black border-t pt-1.5">
                    <span>New Credit:</span>
                    <span className="text-emerald-700">₹{Math.max(0, currentCredit - parseFloat(paymentAmount)).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── INVOICE MODE ── */}
          {mode === "invoice" && selectedVendor && (
            <div className="space-y-3">
              {!selectedInvoice ? (
                // Invoice List
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Select Purchase Invoice
                  </p>
                  {invoicesLoading ? (
                    <div className="py-8 text-center text-gray-400 text-sm">Loading invoices...</div>
                  ) : invoices.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-sm bg-gray-50 rounded-xl">
                      <FaFileInvoiceDollar className="text-3xl mx-auto mb-2 opacity-30" />
                      No invoiced purchase orders found for this supplier
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {invoices.map(po => {
                        const pending = getPendingAmount(po);
                        const isPaid = pending === 0;
                        return (
                          <button
                            key={po._id}
                            onClick={() => !isPaid && setSelectedInvoice(po)}
                            disabled={isPaid}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition ${
                              isPaid
                                ? "bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed"
                                : "border-gray-200 hover:border-emerald-400 hover:bg-emerald-50"
                            }`}
                          >
                            <div>
                              <p className="font-bold text-sm text-gray-800">{po.invoiceId}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Total: ₹{(po.grandTotal || 0).toLocaleString()} &middot;
                                Paid: ₹{(invoicePayments[po._id] || 0).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              {isPaid ? (
                                <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                  ✅ Paid
                                </span>
                              ) : (
                                <>
                                  <p className="text-sm font-black text-orange-600">₹{pending.toLocaleString()}</p>
                                  <p className="text-xs text-gray-400">Pending</p>
                                </>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                // Invoice Payment Form
                <div className="space-y-3">
                  <button
                    onClick={() => { setSelectedInvoice(null); setInvoicePayAmount(""); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-600 transition"
                  >
                    <FaArrowLeft /> Back to invoice list
                  </button>

                  {/* Selected Invoice Card */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-blue-400 uppercase">Invoice</p>
                        <p className="font-black text-blue-800">{selectedInvoice.invoiceId}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {selectedInvoice.items?.length || 0} items &middot;
                          ₹{(selectedInvoice.grandTotal || 0).toLocaleString()} total
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-orange-500 uppercase">Pending</p>
                        <p className="font-black text-orange-600 text-xl">
                          ₹{getPendingAmount(selectedInvoice).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400">
                          Paid: ₹{(invoicePayments[selectedInvoice._id] || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Payment Amount <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-gray-400 font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        max={getPendingAmount(selectedInvoice)}
                        step="1"
                        value={invoicePayAmount}
                        onChange={e => setInvoicePayAmount(e.target.value)}
                        placeholder="0"
                        className="w-full pl-8 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-base font-bold focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <p className="text-xs text-gray-400">Max: ₹{getPendingAmount(selectedInvoice).toLocaleString()}</p>
                      <button
                        onClick={() => setInvoicePayAmount(String(getPendingAmount(selectedInvoice)))}
                        className="text-xs font-bold text-emerald-600 hover:underline"
                      >
                        Pay Full Pending
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Method */}
          {selectedVendor && (mode === "general" || (mode === "invoice" && selectedInvoice)) && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {PAYMENT_METHODS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setPaymentMethod(m.value)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl border-2 text-xs font-bold transition ${
                        paymentMethod === m.value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-gray-200 text-gray-500 hover:border-emerald-300"
                      }`}
                    >
                      <span>{m.icon}</span> {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  {paymentMethod === "check" ? "Cheque Number" : "Reference / Transaction ID (optional)"}
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder={paymentMethod === "check" ? "e.g. CHQ12345" : "e.g. TXN123456"}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional remarks..."
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition resize-none"
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !selectedVendor ||
                (mode === "general" && !paymentAmount) ||
                (mode === "invoice" && (!selectedInvoice || !invoicePayAmount))}
              className="flex-2 flex-grow py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              {saving ? "Processing..." : "✅ Record Payment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
