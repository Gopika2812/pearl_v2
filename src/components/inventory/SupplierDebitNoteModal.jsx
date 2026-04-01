import { useEffect, useRef, useState } from "react";
import {
  FaTimes, FaSearch, FaArrowLeft, FaFileInvoiceDollar,
  FaBoxOpen, FaPlus, FaMinus
} from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

export default function SupplierDebitNoteModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedVendor = null,
}) {
  const { currentBranch } = useBranch();

  // Mode: "general" | "invoice"
  const [mode, setMode] = useState("general");

  // Shared
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [reason, setReason] = useState("");
  const [nextDnId, setNextDnId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);

  // General mode
  const [generalAmount, setGeneralAmount] = useState("");

  // Invoice mode
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [returnItems, setReturnItems] = useState([]); // { productId, name, maxQty, returnQty, purchasePrice, gst }

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && currentBranch?._id) {
      if (!preselectedVendor) fetchVendors();
      else { setVendors([]); setSelectedVendor(preselectedVendor); setSearchQuery(preselectedVendor.name); }
      fetchNextDnId();
    }
  }, [isOpen, currentBranch]);

  useEffect(() => {
    if (!isOpen) return;
    setMode("general");
    setGeneralAmount("");
    setReason("");
    setSelectedInvoice(null);
    setReturnItems([]);
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

  // ─── Data Fetching ─────────────────────────────────────────────────────────
  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/vendors?branchId=${currentBranch._id}&limit=9999`);
      const data = await res.json();
      setVendors((data?.data || data || []).sort((a, b) => a.name.localeCompare(b.name)));
    } catch { toast.error("Failed to load vendors"); }
    finally { setLoading(false); }
  };

  const fetchNextDnId = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/debit-notes/next-id?branchId=${currentBranch._id}`);
      const data = await res.json();
      setNextDnId(data.nextId || "");
    } catch { /* silent */ }
  };

  const fetchInvoicesForVendor = async () => {
    if (!selectedVendor) return;
    setInvoicesLoading(true);
    try {
      const res = await fetchWithAuth(
        `${API_BASE}/purchase-orders?branchId=${currentBranch._id}&statuses=INVOICED,PARTIALLY_RETURNED`
      );
      const data = await res.json();
      const all = data.data || data || [];
      setInvoices(all.filter(po => {
        // Exclude cancelled and fully returned invoices
        if (po.status === "CANCELLED" || po.status === "FULLY_RETURNED") return false;
        const name = po.vendor?.name || po.vendor;
        return name === selectedVendor.name;
      }));
    } catch { toast.error("Failed to load invoices"); }
    finally { setInvoicesLoading(false); }
  };

  const selectInvoice = (po) => {
    setSelectedInvoice(po);
    // Pre-populate return items from PO items
    setReturnItems((po.items || []).map(item => ({
      productId: item.productId?._id || item.productId,
      name: item.name,
      maxQty: item.qty || 0,
      returnQty: 0,
      purchasePrice: item.purchasePrice || 0,
      gst: item.gst || 0,
    })));
  };

  const updateReturnQty = (idx, delta) => {
    setReturnItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const newQty = Math.min(item.maxQty, Math.max(0, (item.returnQty || 0) + delta));
      return { ...item, returnQty: newQty };
    }));
  };

  const setReturnQtyDirect = (idx, val) => {
    const qty = Math.min(
      returnItems[idx].maxQty,
      Math.max(0, parseInt(val) || 0)
    );
    setReturnItems(prev => prev.map((item, i) => i === idx ? { ...item, returnQty: qty } : item));
  };

  // Compute totals
  const returnLineItems = returnItems.filter(i => i.returnQty > 0);
  const subtotal = returnLineItems.reduce((s, i) => s + (i.returnQty * i.purchasePrice), 0);
  const totalTax = returnLineItems.reduce((s, i) => s + (i.returnQty * i.purchasePrice * (i.gst / 100)), 0);
  const grandTotal = subtotal + totalTax;

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedVendor) { toast.warning("Select a supplier"); return; }

    if (mode === "general") {
      const amount = parseFloat(generalAmount);
      if (!amount || amount <= 0) { toast.warning("Enter a valid amount"); return; }

      setSaving(true);
      try {
        const payload = {
          branchId: currentBranch._id,
          originalPurchaseOrderId: null,
          vendor: { vendorId: selectedVendor._id, name: selectedVendor.name },
          items: [{
            productId: "000000000000000000000000",
            name: "General Return / Adjustment",
            returnedQty: 1,
            purchasePrice: amount,
            total: amount,
          }],
          reason: reason || "General debit note / balance adjustment",
          isGeneralAdjustment: true,
          manualGrandTotal: amount,
        };
        const res = await fetchWithAuth(`${API_BASE}/debit-notes`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed");
        toast.success(`✅ Debit Note created! ID: ${data.data?.debitNoteId || nextDnId}`);
        onSuccess?.();
        onClose();
      } catch (err) {
        toast.error(err.message || "Failed to create debit note");
      } finally {
        setSaving(false);
      }
      return;
    }

    // Invoice mode
    if (!selectedInvoice) { toast.warning("Select an invoice"); return; }
    if (returnLineItems.length === 0) { toast.warning("Add at least one return item"); return; }

    setSaving(true);
    try {
      const payload = {
        branchId: currentBranch._id,
        originalPurchaseOrderId: selectedInvoice._id,
        vendor: { vendorId: selectedVendor._id, name: selectedVendor.name },
        items: returnLineItems.map(i => ({
          productId: i.productId,
          name: i.name,
          returnedQty: i.returnQty,
          purchasePrice: i.purchasePrice,
          total: i.returnQty * i.purchasePrice,
        })),
        reason: reason || `Return against ${selectedInvoice.invoiceId}`,
      };
      const res = await fetchWithAuth(`${API_BASE}/debit-notes`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      toast.success(`✅ Debit Note created! ID: ${data.data?.debitNoteId || nextDnId}`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to create debit note");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentCredit = selectedVendor?.credit || 0;
  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white p-5 flex items-center justify-between sticky top-0 z-10 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold">Create Debit Note</h2>
            <p className="text-red-100 text-xs mt-0.5">
              {nextDnId
                ? <span className="font-mono bg-white/15 px-2 py-0.5 rounded">{nextDnId}</span>
                : "Auto-generating ID..."}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
            <FaTimes />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode */}
          <div className="grid grid-cols-2 gap-2 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => { setMode("general"); setSelectedInvoice(null); setReturnItems([]); }}
              className={`py-2.5 rounded-lg text-sm font-bold transition ${mode === "general"
                ? "bg-white text-red-700 shadow-sm"
                : "text-gray-400 hover:text-gray-600"}`}
            >
              🔄 General Return
            </button>
            <button
              onClick={() => { setMode("invoice"); setGeneralAmount(""); }}
              className={`py-2.5 rounded-lg text-sm font-bold transition ${mode === "invoice"
                ? "bg-white text-red-700 shadow-sm"
                : "text-gray-400 hover:text-gray-600"}`}
            >
              📦 Return Against Invoice
            </button>
          </div>

          {/* Vendor Selector */}
          {!preselectedVendor && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
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
                      className="w-full pl-8 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-400 transition"
                    />
                  </div>
                  {showDropdown && filteredVendors.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto">
                      {filteredVendors.map(v => (
                        <div
                          key={v._id}
                          onClick={() => { setSelectedVendor(v); setSearchQuery(v.name); setShowDropdown(false); setSelectedInvoice(null); }}
                          className="flex justify-between items-center px-4 py-2.5 hover:bg-red-50 cursor-pointer border-b last:border-0"
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
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex justify-between items-center">
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
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Return Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-gray-400 font-bold">₹</span>
                  <input
                    type="number" min="0" step="1" value={generalAmount}
                    onChange={e => setGeneralAmount(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-base font-bold focus:outline-none focus:border-red-400 transition"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  For migrated data or manual balance adjustments without a specific invoice
                </p>
              </div>

              {parseFloat(generalAmount) > 0 && (
                <div className="bg-gray-50 border-2 border-red-400 rounded-xl p-3 text-sm space-y-1.5">
                  <div className="flex justify-between text-gray-500">
                    <span>Current Credit:</span>
                    <span className="font-bold text-orange-600">₹{currentCredit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Return Amount:</span>
                    <span className="font-bold text-red-600">-₹{parseFloat(generalAmount).toLocaleString()}</span>
                  </div>
                  {parseFloat(generalAmount) > currentCredit && (
                    <div className="flex justify-between text-xs text-amber-600 font-bold bg-amber-50 rounded-lg px-2 py-1">
                      <span>⚠️ Excess (becomes Debit):</span>
                      <span>₹{(parseFloat(generalAmount) - currentCredit).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black border-t pt-1.5">
                    <span>New Credit:</span>
                    <span className="text-red-700">₹{Math.max(0, currentCredit - parseFloat(generalAmount)).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── INVOICE MODE ── */}
          {mode === "invoice" && selectedVendor && (
            <div className="space-y-3">
              {!selectedInvoice ? (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Invoice</p>
                  {invoicesLoading ? (
                    <div className="py-8 text-center text-gray-400 text-sm">Loading invoices...</div>
                  ) : invoices.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-sm bg-gray-50 rounded-xl">
                      <FaFileInvoiceDollar className="text-3xl mx-auto mb-2 opacity-30" />
                      No invoiced purchase orders found for this supplier
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {invoices.map(po => (
                        <button
                          key={po._id}
                          onClick={() => selectInvoice(po)}
                          className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-red-400 hover:bg-red-50 text-left transition"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm text-gray-800">{po.invoiceId}</p>
                              {po.status === "PARTIALLY_RETURNED" && (
                                <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase">
                                  Partial Return
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {po.items?.length || 0} items &middot; ₹{(po.grandTotal || 0).toLocaleString()}
                            </p>
                          </div>
                          <FaBoxOpen className="text-red-300" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={() => { setSelectedInvoice(null); setReturnItems([]); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-600 transition"
                  >
                    <FaArrowLeft /> Back to invoice list
                  </button>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="font-bold text-blue-800">{selectedInvoice.invoiceId}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Select items to return and enter quantities</p>
                  </div>

                  {/* Return Items Table */}
                  <div className="border rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Items to Return</p>
                    </div>
                    <div className="divide-y">
                      {returnItems.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-800 truncate">{item.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">₹{item.purchasePrice}/unit</span>
                              <span className="text-[10px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                Max returnable: {item.maxQty}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => updateReturnQty(idx, -1)}
                              disabled={item.returnQty === 0}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 transition disabled:opacity-30"
                            >
                              <FaMinus size={10} />
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={item.maxQty}
                              value={item.returnQty}
                              onChange={e => setReturnQtyDirect(idx, e.target.value)}
                              className="w-14 text-center border-2 border-gray-200 rounded-lg py-1 text-sm font-bold focus:outline-none focus:border-red-400"
                            />
                            <button
                              onClick={() => updateReturnQty(idx, 1)}
                              disabled={item.returnQty >= item.maxQty}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 transition disabled:opacity-30"
                            >
                              <FaPlus size={10} />
                            </button>
                          </div>
                          <div className="text-right w-24 shrink-0">
                            <p className="font-bold text-sm text-gray-800">
                              {item.returnQty > 0 ? `₹${(item.returnQty * item.purchasePrice).toFixed(0)}` : "—"}
                            </p>
                            {item.returnQty > 0 && (
                              <p className="text-[10px] text-gray-400">{item.returnQty} pcs</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total */}
                  {returnLineItems.length > 0 && (
                    <div className="bg-gray-50 border-2 border-red-400 rounded-xl p-3 text-sm space-y-1.5">
                      <div className="flex justify-between text-gray-500">
                        <span>Subtotal ({returnLineItems.length} items):</span>
                        <span className="font-bold">₹{subtotal.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Tax:</span>
                        <span className="font-bold">₹{totalTax.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between font-black border-t pt-1.5">
                        <span>Debit Note Total:</span>
                        <span className="text-red-700">₹{grandTotal.toFixed(0)}</span>
                      </div>
                      {grandTotal > currentCredit && (
                        <div className="flex justify-between text-xs text-amber-600 font-bold bg-amber-50 rounded-lg px-2 py-1">
                          <span>⚠️ Excess (added to Debit):</span>
                          <span>₹{(grandTotal - currentCredit).toFixed(0)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reason */}
          {selectedVendor && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Reason / Remarks (optional)
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. Damaged goods, Quality issue, Over-supply..."
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-400 transition resize-none"
              />
            </div>
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
                (mode === "general" && !generalAmount) ||
                (mode === "invoice" && (!selectedInvoice || returnLineItems.length === 0))}
              className="flex-grow py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              {saving ? "Processing..." : "📋 Create Debit Note"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
