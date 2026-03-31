import { useState, useEffect, useMemo } from "react";
import { FaTimes, FaUndoAlt, FaHistory, FaSpinner, FaCheckCircle, FaTrashAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";

const CustomerCreditNoteModal = ({ isOpen, onClose, customer, onCreditSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [creditType, setCreditType] = useState("general"); // "general" or "return"
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  
  const [formData, setFormData] = useState({
    amount: "",
    reason: "",
    date: new Date().toISOString().split("T")[0]
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && customer?._id) {
      fetchInvoices();
    }
  }, [isOpen, customer]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      // For returns, we can look at any invoiced order (not just unpaid)
      const response = await fetch(`${API_BASE}/sales-orders?customerName=${customer.name}&status=INVOICED`);
      const result = await response.json();
      if (result.success) {
        setInvoices(result.data || []);
      }
    } catch (error) {
      console.error("Fetch invoices error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = (item) => {
    const exists = selectedItems.find(si => si._id === item._id);
    if (exists) {
      setSelectedItems(selectedItems.filter(si => si._id !== item._id));
    } else {
      setSelectedItems([...selectedItems, { ...item, returnQty: item.qty }]);
    }
  };

  const handleQtyChange = (itemId, qty) => {
    setSelectedItems(selectedItems.map(si => 
      si._id === itemId ? { ...si, returnQty: Math.min(qty, si.qty) } : si
    ));
  };

  const calculatedReturnAmount = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      const itemSubtotal = item.sellingPrice * item.returnQty;
      const itemDiscount = (itemSubtotal * (item.discountPercent || 0)) / 100;
      const itemTaxable = itemSubtotal - itemDiscount;
      const itemTax = (itemTaxable * (item.gst || 0)) / 100;
      return sum + itemTaxable + itemTax;
    }, 0);
  }, [selectedItems]);

  if (!isOpen || !customer) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let finalAmount = parseFloat(formData.amount);
    if (creditType === "return") {
      finalAmount = calculatedReturnAmount;
    }

    if (!finalAmount || finalAmount <= 0) {
      return toast.error("Please enter or select a valid amount");
    }

    if (!formData.reason.trim()) {
      return toast.error("Please provide a reason for the credit note");
    }

    setSubmitting(true);
    try {
      let endpoint = `${API_BASE}/credit-notes/general`;
      let payload = {
        customerId: customer._id,
        amount: finalAmount,
        reasonForReturn: formData.reason,
        branchId: customer.branchId,
        date: formData.date
      };

      if (creditType === "return" && selectedInvoice) {
        endpoint = `${API_BASE}/credit-notes`;
        payload = {
          originalSalesOrderId: selectedInvoice._id,
          items: selectedItems.map(item => ({
            _id: item._id,
            qty: item.returnQty
          })),
          reasonForReturn: formData.reason,
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        toast.success(result.message || "Credit Note created successfully");
        onCreditSuccess();
        onClose();
      } else {
        toast.error(result.message || "Failed to create credit note");
      }
    } catch (error) {
      console.error("Credit Note error:", error);
      toast.error("Error connecting to server");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex justify-center items-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-500 px-8 py-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4 text-white">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <FaUndoAlt size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">Credit Note / Return</h2>
              <p className="text-rose-50 text-xs font-bold opacity-80 uppercase tracking-widest">FOR {customer.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
            <FaTimes size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* Credit Type Toggle */}
          <div className="space-y-4">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Credit Type</label>
            <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
               <button 
                 type="button"
                 onClick={() => { setCreditType("general"); setSelectedInvoice(null); setSelectedItems([]); }}
                 className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${creditType === "general" ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
               >
                 General Credit
               </button>
               <button 
                 type="button"
                 onClick={() => setCreditType("return")}
                 className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${creditType === "return" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
               >
                 Return Items
               </button>
            </div>
          </div>

          {/* Form Content */}
          {creditType === "general" ? (
            <div className="space-y-6 animate-fadeIn">
               <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Amount (₹)</label>
                    <input 
                      type="number"
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-lg font-black text-gray-900 focus:border-rose-500 outline-none transition-all"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      required
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Date</label>
                    <input 
                      type="date"
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-black text-gray-900 focus:border-rose-500 outline-none transition-all"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    />
                </div>
               </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fadeIn">
                <div className="space-y-4">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Select Reference Invoice</label>
                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        {loading ? <FaSpinner className="animate-spin mx-auto" /> : invoices.map(inv => (
                             <div 
                               key={inv._id}
                               onClick={() => { setSelectedInvoice(inv); setSelectedItems([]); }}
                               className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${selectedInvoice?._id === inv._id ? 'border-blue-600 bg-blue-50' : 'border-gray-100 bg-white'}`}
                             >
                                <span className="text-xs font-bold text-gray-900">{inv.invoiceId}</span>
                                <span className="text-xs font-black text-blue-700">₹{(inv.grandTotal || 0).toLocaleString()}</span>
                             </div>
                        ))}
                    </div>
                </div>

                {selectedInvoice && (
                   <div className="space-y-4">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Select Items to Return</label>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                         {selectedInvoice.items.map(item => {
                            const isSelected = selectedItems.find(si => si._id === item._id);
                            return (
                                <div key={item._id} className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${isSelected ? 'border-rose-300 bg-rose-50' : 'border-gray-50 bg-gray-50/50'}`}>
                                    <div className="flex items-center gap-3">
                                        <input 
                                          type="checkbox" 
                                          checked={!!isSelected}
                                          onChange={() => handleToggleItem(item)}
                                          className="w-5 h-5 accent-rose-600 cursor-pointer"
                                        />
                                        <div>
                                            <p className="text-xs font-black text-gray-900">{item.name}</p>
                                            <p className="text-[10px] text-gray-400 font-bold">Qty: {item.qty} x ₹{item.sellingPrice}</p>
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <div className="flex items-center gap-2">
                                            <input 
                                              type="number"
                                              className="w-16 bg-white border border-rose-200 rounded-lg px-2 py-1 text-xs font-black text-gray-900"
                                              value={isSelected.returnQty}
                                              onChange={(e) => handleQtyChange(item._id, parseInt(e.target.value) || 0)}
                                            />
                                            <span className="text-[10px] font-black text-gray-400">/ {item.qty}</span>
                                        </div>
                                    )}
                                </div>
                            );
                         })}
                      </div>
                      <div className="bg-rose-100/50 p-4 rounded-2xl flex justify-between items-center border border-rose-200">
                          <span className="text-xs font-black text-rose-800 uppercase tracking-widest">Total Return Amount</span>
                          <span className="text-xl font-black text-rose-600">₹{calculatedReturnAmount.toLocaleString()}</span>
                      </div>
                   </div>
                )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Reason for Credit</label>
            <textarea 
               className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3 text-sm font-bold text-gray-900 focus:border-rose-500 outline-none transition-all placeholder:text-gray-300 min-h-[80px]"
               placeholder="Why are you issuing this credit note?"
               value={formData.reason}
               onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
               required
            />
          </div>

          <button 
            type="submit"
            disabled={submitting}
            className={`w-full py-5 rounded-2xl text-base font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-3 ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-rose-200'}`}
          >
            {submitting ? (
              <>
                <FaSpinner className="animate-spin" /> Issuing CN...
              </>
            ) : (
              <>
                <FaCheckCircle /> Confirm Credit Note (CN)
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CustomerCreditNoteModal;
