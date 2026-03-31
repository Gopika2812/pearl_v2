import { useState, useEffect } from "react";
import { FaTimes, FaMoneyBillWave, FaHistory, FaSpinner, FaCheckCircle } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";

const CustomerReceiptModal = ({ isOpen, onClose, customer, onPaymentSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [paymentType, setPaymentType] = useState("general"); // "general" or "invoice"
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  
  const [formData, setFormData] = useState({
    amount: "",
    paymentMethod: "CASH",
    paymentDate: new Date().toISOString().split("T")[0],
    reference: "",
    notes: ""
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && customer?._id) {
      fetchUnpaidInvoices();
    }
  }, [isOpen, customer]);

  const fetchUnpaidInvoices = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/sales-orders/unpaid/${customer._id}`);
      const result = await response.json();
      if (result.success) {
        setUnpaidInvoices(result.data);
      }
    } catch (error) {
      console.error("Fetch invoices error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !customer) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.amount || formData.amount <= 0) {
      return toast.error("Please enter a valid amount");
    }

    setSubmitting(true);
    try {
      let endpoint = `${API_BASE}/receipts/general`;
      let payload = {
        customerId: customer._id,
        amount: parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        reference: formData.reference,
        notes: formData.notes,
        branchId: customer.branchId,
        paymentDate: formData.paymentDate
      };

      if (paymentType === "invoice" && selectedInvoice) {
        endpoint = `${API_BASE}/receipts`;
        payload = {
          ...payload,
          originalSalesOrderId: selectedInvoice._id
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        toast.success(result.message || "Receipt recorded successfully");
        onPaymentSuccess();
        onClose();
      } else {
        toast.error(result.message || "Failed to record receipt");
      }
    } catch (error) {
      console.error("Receipt error:", error);
      toast.error("Error connecting to server");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex justify-center items-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-8 py-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4 text-white">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <FaMoneyBillWave size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">Record Receipt</h2>
              <p className="text-emerald-50 text-xs font-bold opacity-80 uppercase tracking-widst">FOR {customer.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
            <FaTimes size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
          
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Total Outstanding (Debit)</p>
                <p className="text-xl font-black text-red-600">₹{(customer.debit || 0).toLocaleString()}</p>
             </div>
             <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Advance Balance (Credit)</p>
                <p className="text-xl font-black text-emerald-600">₹{(customer.credit || 0).toLocaleString()}</p>
             </div>
          </div>

          <hr className="border-gray-100" />

          {/* Receipt Type Toggle */}
          <div className="space-y-4">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Receipt Type</label>
            <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
               <button 
                 type="button"
                 onClick={() => { setPaymentType("general"); setSelectedInvoice(null); }}
                 className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${paymentType === "general" ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
               >
                 General Receipt
               </button>
               <button 
                 type="button"
                 onClick={() => setPaymentType("invoice")}
                 disabled={unpaidInvoices.length === 0}
                 className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${paymentType === "invoice" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600 disabled:opacity-50'}`}
               >
                 Against Invoice
               </button>
            </div>
            {unpaidInvoices.length === 0 && paymentType === "general" && (
                <p className="text-[10px] text-gray-400 italic">No outstanding invoices found for this customer.</p>
            )}
          </div>

          {/* Invoice Selection Area */}
          {paymentType === "invoice" && (
            <div className="space-y-4 animate-fadeIn">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Select Outstanding Invoice</label>
                {loading ? (
                  <div className="py-4 text-center"><FaSpinner className="animate-spin inline mr-2" /> Loading invoices...</div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {unpaidInvoices.map((inv) => (
                      <div 
                        key={inv._id}
                        onClick={() => {
                            setSelectedInvoice(inv);
                            setFormData(prev => ({ ...prev, amount: inv.closingBalance.toString() }));
                        }}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center group ${selectedInvoice?._id === inv._id ? 'border-blue-600 bg-blue-50' : 'border-gray-100 hover:border-blue-300 bg-white'}`}
                      >
                         <div>
                            <p className="text-xs font-black text-gray-900 group-hover:text-blue-700">{inv.invoiceId}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                                Date: {new Date(inv.createdAt).toLocaleDateString()}
                            </p>
                         </div>
                         <div className="text-right">
                             <p className="text-sm font-black text-red-600">₹{inv.closingBalance.toLocaleString()}</p>
                             <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Balance Owed</p>
                         </div>
                         {selectedInvoice?._id === inv._id && <FaCheckCircle className="text-blue-600 ml-3" />}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* Payment Form Fields */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Amount (₹)</label>
                <input 
                  type="number"
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-lg font-black text-gray-900 focus:border-emerald-500 outline-none transition-all placeholder:text-gray-300"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
            </div>
            <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Receipt Date</label>
                <input 
                  type="date"
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-black text-gray-900 focus:border-emerald-500 outline-none transition-all"
                  value={formData.paymentDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Payment Method</label>
                <select 
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-black text-gray-900 focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer"
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                >
                    <option value="CASH">CASH</option>
                    <option value="CHEQUE">CHEQUE</option>
                    <option value="BANK_TRANSFER">BANK TRANSFER</option>
                    <option value="UPI">UPI</option>
                    <option value="CREDIT_CARD">CREDIT CARD</option>
                </select>
            </div>
            <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Reference / Chq #</label>
                <input 
                  type="text"
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-black text-gray-900 focus:border-emerald-500 outline-none transition-all placeholder:text-gray-300"
                  placeholder="Txn ID / Cheque No."
                  value={formData.reference}
                  onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Notes / Remarks</label>
            <textarea 
               className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3 text-sm font-bold text-gray-900 focus:border-emerald-500 outline-none transition-all placeholder:text-gray-300 min-h-[80px]"
               placeholder="Add internal notes about this receipt..."
               value={formData.notes}
               onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <button 
            type="submit"
            disabled={submitting}
            className={`w-full py-5 rounded-2xl text-base font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-3 ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}
          >
            {submitting ? (
              <>
                <FaSpinner className="animate-spin" /> Finalizing Receipt...
              </>
            ) : (
              <>
                <FaCheckCircle /> Confirm Receipt (REC)
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CustomerReceiptModal;
