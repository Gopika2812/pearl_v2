import { useState, useEffect } from "react";
import { FaTimes, FaMoneyBillWave, FaHistory, FaSpinner, FaCheckCircle, FaUniversity, FaCreditCard, FaMobileAlt, FaArrowLeft, FaReceipt, FaFileInvoiceDollar, FaWallet } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";

const CustomerReceiptModal = ({ isOpen, onClose, customer, onPaymentSuccess, initialInvoiceId, branchId }) => {
  const [loading, setLoading] = useState(false);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [fullCustomer, setFullCustomer] = useState(null);
  const [paymentType, setPaymentType] = useState("general"); 
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [selectedBank, setSelectedBank] = useState("");
  
  const [formData, setFormData] = useState({
    amount: "",
    paymentMethod: "CASH",
    paymentDate: new Date().toISOString().split("T")[0],
    reference: "",
    notes: ""
  });

  const [submitting, setSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const resetForm = () => {
    setIsResetting(true);
    setFormData({
      amount: "",
      paymentMethod: "CASH",
      paymentDate: new Date().toISOString().split("T")[0],
      reference: "",
      notes: ""
    });
    setPaymentType("general");
    setSelectedInvoiceIds([]);
    setSelectedBank("");
    setTimeout(() => setIsResetting(false), 50);
  };

  useEffect(() => {
    if (isOpen && customer?._id) {
      resetForm();
      fetchUnpaidInvoices();
      fetchCustomerDetails();
    }
  }, [isOpen, customer?._id]);

  const fetchCustomerDetails = async () => {
      const cId = customer._id?.toString() || (typeof customer === 'string' ? customer : "");
      if (!cId || cId === "[object Object]") return;

      try {
          const response = await fetchWithAuth(`${API_BASE}/customers/${cId}`);
          const result = await response.json();
          if (result.success) setFullCustomer(result.data);
          else if (result._id) setFullCustomer(result);
      } catch (err) { console.error(err); }
  };

  const fetchUnpaidInvoices = async () => {
    const cId = customer._id?.toString() || (typeof customer === 'string' ? customer : "");
    if (!cId || cId === "[object Object]") return;

    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_BASE}/sales-orders/unpaid/${cId}${branchId ? `?branchId=${branchId}` : ""}`);
      const result = await response.json();
      if (result.success) {
        setUnpaidInvoices(result.data);
      } else if (Array.isArray(result)) {
        setUnpaidInvoices(result);
      }
    } catch (error) {
      console.error("Fetch invoices error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && initialInvoiceId && unpaidInvoices.length > 0) {
      const inv = unpaidInvoices.find(i => i._id === initialInvoiceId);
      if (inv) {
        setPaymentType("invoice");
        setSelectedInvoiceIds([inv._id]);
        const val = inv.pendingBalance !== undefined ? inv.pendingBalance : 0;
        setFormData(prev => ({ ...prev, amount: val.toString() }));
      }
    }
  }, [isOpen, initialInvoiceId, unpaidInvoices]);

  const toggleInvoiceSelection = (inv) => {
    setSelectedInvoiceIds(prev => {
        const isSelected = prev.includes(inv._id);
        const next = isSelected ? prev.filter(id => id !== inv._id) : [...prev, inv._id];
        const total = unpaidInvoices
          .filter(i => next.includes(i._id))
          .reduce((sum, i) => {
              const pending = parseFloat(i.pendingBalance) || (parseFloat(i.invoiceTotal || i.invoiceGrandTotal || i.grandTotal || 0) - parseFloat(i.totalReceived || 0));
              return sum + Math.max(0, pending);
          }, 0);
        
        setFormData(f => ({ ...f, amount: total.toFixed(2) }));
        return next;
    });
  };

  if (!isOpen || !customer) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) return toast.error("Enter amount");
    if (formData.paymentMethod === "BANK_TRANSFER" && !selectedBank) return toast.error("Select bank");

    setSubmitting(true);
    try {
      let endpoint = `${API_BASE}/receipts/general`;
      let payload = {
        customerId: customer._id,
        amount: parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        reference: selectedBank ? `${selectedBank} - ${formData.reference}` : formData.reference,
        notes: formData.notes,
        branchId: customer.branchId,
        paymentDate: formData.paymentDate
      };

      if (paymentType === "invoice" && selectedInvoiceIds.length > 0) {
        endpoint = `${API_BASE}/receipts/bulk`;
        payload = {
          ...payload,
          payments: unpaidInvoices
            .filter(i => selectedInvoiceIds.includes(i._id))
            .map(i => ({ salesOrderId: i._id, amount: i.pendingBalance || 0 }))
        };
      }

      const response = await fetchWithAuth(endpoint, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        toast.success(result.message || "Saved");
        onPaymentSuccess();
        onClose();
      } else {
        toast.error(result.message || "Failed");
      }
    } catch (error) {
      toast.error("Error connecting to server");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-white overflow-y-auto font-sans text-xs">
      
      {/* Simple Header */}
      <div className="border-b border-gray-200 px-6 py-3 sticky top-0 bg-white z-10 flex justify-between items-center">
          <div className="flex items-center gap-4">
              <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-all">
                  <FaArrowLeft size={16} />
              </button>
              <h1 className="text-sm font-bold text-gray-800 uppercase tracking-tight">
                  Receipt: {customer.name}
              </h1>
          </div>
          <div className="flex items-center gap-6">
              <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Opening Balance</p>
                  <p className="text-xs font-bold text-gray-700">₹{(fullCustomer?.openingBalance || 0).toLocaleString()}</p>
              </div>
              <button onClick={onClose} className="text-gray-300 hover:text-red-500 transition-all">
                  <FaTimes size={18} />
              </button>
          </div>
      </div>

      <div className="max-w-[1200px] mx-auto p-6 flex flex-col lg:flex-row gap-8">
          
          {/* Main Controls */}
          <div className="flex-1 space-y-6">
              
              <div className="flex gap-2">
                  <button 
                      type="button"
                      onClick={() => { 
                        setPaymentType("general"); 
                        setSelectedInvoiceIds([]); 
                        setFormData(f => ({ ...f, amount: "" }));
                      }}
                      className={`flex-1 py-3 border rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${paymentType === 'general' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'}`}
                  >
                      General Receipt
                  </button>
                  <button 
                      type="button"
                      onClick={() => {
                        setPaymentType("invoice");
                        setFormData(f => ({ ...f, amount: "" }));
                        setSelectedInvoiceIds([]);
                        if (unpaidInvoices.length === 0) fetchUnpaidInvoices();
                      }}
                      className={`flex-1 py-3 border rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${paymentType === 'invoice' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'}`}
                  >
                      Against Invoice
                  </button>
              </div>

              {paymentType === "invoice" && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Outstanding Invoices</span>
                          <span className="text-[10px] font-bold text-blue-600 uppercase">{selectedInvoiceIds.length} selected</span>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                          {loading ? (
                               <div className="p-10 text-center text-gray-400">Loading...</div>
                          ) : (
                              <table className="w-full text-left text-[11px]">
                                  <thead className="bg-gray-50 text-gray-400 uppercase text-[9px]">
                                      <tr>
                                          <th className="px-4 py-2 w-10"></th>
                                          <th className="px-2 py-2">Invoice #</th>
                                          <th className="px-2 py-2 text-right">Pending</th>
                                          <th className="px-2 py-2 text-right">Total</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                      {unpaidInvoices.map((inv) => (
                                          <tr 
                                              key={inv._id} 
                                              onClick={() => toggleInvoiceSelection(inv)}
                                              className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedInvoiceIds.includes(inv._id) ? 'bg-blue-50/50' : ''}`}
                                          >
                                              <td className="px-4 py-2">
                                                  <div className={`w-3.5 h-3.5 rounded border transition-colors flex items-center justify-center ${selectedInvoiceIds.includes(inv._id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
                                                      {selectedInvoiceIds.includes(inv._id) && <FaCheckCircle size={8} />}
                                                  </div>
                                              </td>
                                              <td className="px-2 py-2 font-bold text-gray-700">{inv.invoiceId} <span className="block text-[9px] font-normal text-gray-400 uppercase">{new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString()}</span></td>
                                              <td className="px-2 py-2 text-right font-bold text-red-600">
                                                  ₹{(parseFloat(inv.pendingBalance) || (parseFloat(inv.invoiceTotal || inv.invoiceGrandTotal || inv.grandTotal || 0) - parseFloat(inv.totalReceived || 0))).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 text-right text-gray-400">₹{(inv.invoiceGrandTotal || inv.lastInvoicedGrandTotal || inv.grandTotal || 0).toLocaleString()}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          )}
                      </div>
                  </div>
              )}

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Payment Method</label>
                      <select 
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-blue-500"
                          value={formData.paymentMethod}
                          onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      >
                          <option value="CASH">CASH</option>
                          <option value="CHEQUE">CHEQUE</option>
                          <option value="BANK_TRANSFER">BANK TRANSFER</option>
                          <option value="UPI">UPI</option>
                          <option value="CREDIT_CARD">CREDIT CARD</option>
                          <option value="DEBIT_CARD">DEBIT CARD</option>
                      </select>
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Reference #</label>
                      <input 
                          type="text"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-blue-500"
                          placeholder="UTR / Chq #"
                          value={formData.reference}
                          onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                      />
                  </div>
                  {formData.paymentMethod === "BANK_TRANSFER" && (
                      <div className="col-span-2 flex gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                          <button type="button" onClick={() => setSelectedBank("ICICI")} className={`flex-1 py-2 rounded border text-[10px] font-bold uppercase transition-all ${selectedBank === 'ICICI' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-400 border-blue-200'}`}>ICICI BANK</button>
                          <button type="button" onClick={() => setSelectedBank("SBI")} className={`flex-1 py-2 rounded border text-[10px] font-bold uppercase transition-all ${selectedBank === 'SBI' ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-blue-300 border-blue-200'}`}>STATE BANK</button>
                      </div>
                  )}
                  <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Remarks</label>
                      <textarea 
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 outline-none focus:border-blue-500 min-h-[60px]"
                          placeholder="Optional notes..."
                          value={formData.notes}
                          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      />
                  </div>
              </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-full lg:w-80 space-y-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
                  <div className="flex justify-between items-center text-[11px]">
                      <span className="text-gray-400 font-bold uppercase">Ledger Balance</span>
                      <span className="text-red-600 font-black">₹{(fullCustomer?.debit || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                      <span className="text-gray-400 font-bold uppercase">Invoice Total (Unpaid)</span>
                      <span className="text-blue-600 font-black">
                        ₹{(unpaidInvoices.reduce((sum, inv) => sum + (inv.pendingBalance || 0), 0)).toLocaleString()}
                      </span>
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-[10px] text-gray-800 font-black uppercase">Net Payable</span>
                      <span className="text-lg font-black text-gray-900">
                        ₹{Math.max(
                          (unpaidInvoices.reduce((sum, inv) => sum + (inv.pendingBalance || 0), 0)),
                          (fullCustomer?.debit || 0) - (fullCustomer?.credit || 0)
                        ).toLocaleString()}
                      </span>
                  </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-4">
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Amount to Pay (₹)</label>
                      <input 
                          type="number"
                          className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-xl font-black text-gray-800 outline-none focus:border-blue-500 transition-all"
                          placeholder="0"
                          value={formData.amount}
                          onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                          required
                      />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Voucher Date</label>
                      <input 
                          type="date"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 outline-none"
                          value={formData.paymentDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                      />
                  </div>
                  <button 
                      onClick={handleSubmit}
                      disabled={submitting}
                      className={`w-full py-4 rounded-lg text-xs font-black uppercase tracking-widest text-white shadow-md transition-all ${submitting ? 'bg-gray-300' : 'bg-gray-900 hover:bg-black'}`}
                  >
                      {submitting ? "Saving..." : "Confirm Receipt"}
                  </button>
                  <button onClick={resetForm} className="w-full text-[9px] font-bold text-gray-400 uppercase hover:text-gray-600">Clear Form</button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default CustomerReceiptModal;
