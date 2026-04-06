import { useState, useEffect, useMemo } from "react";
import { FaTimes, FaUndoAlt, FaSearch, FaSpinner, FaCheckCircle, FaTrashAlt, FaPlus, FaUser, FaChevronDown } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

const CustomerCreditNoteModal = ({ isOpen, onClose, customer: initialCustomer, onCreditSuccess }) => {
  const { currentBranch, user } = useBranch();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [creditType, setCreditType] = useState("standalone"); // "general", "invoice", or "standalone"
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]); // Used for both invoice and standalone
  
  const [customer, setCustomer] = useState(initialCustomer || null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customersList, setCustomersList] = useState([]);
  const [showCustomerResults, setShowCustomerResults] = useState(false);

  const [productSearch, setProductSearch] = useState("");
  const [productsList, setProductsList] = useState([]);
  const [showProductResults, setShowProductResults] = useState(false);

  const [formData, setFormData] = useState({
    amount: "",
    reason: "",
    date: new Date().toISOString().split("T")[0]
  });

  const [submitting, setSubmitting] = useState(false);

  // Initial data for quick dropdown
  useEffect(() => {
    if (isOpen) {
        fetchCustomers();
        fetchProducts();
    }
  }, [isOpen]);

  // Sync initial customer
  useEffect(() => {
    if (initialCustomer) setCustomer(initialCustomer);
  }, [initialCustomer]);

  // Fetch Invoices when customer changes
  useEffect(() => {
    if (isOpen && customer?._id && creditType === "invoice") {
      fetchInvoices();
    }
  }, [isOpen, customer, creditType]);

  // Customer Search Logic
  useEffect(() => {
    if (customerSearch.length > 0) {
        const timer = setTimeout(() => {
            fetchCustomers(customerSearch);
            setShowCustomerResults(true);
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [customerSearch]);

  // Product Search Logic
  useEffect(() => {
    if (productSearch.length > 0) {
        const timer = setTimeout(() => {
            fetchProducts(productSearch);
            setShowProductResults(true);
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [productSearch]);

  const fetchCustomers = async (query = "") => {
    try {
        const res = await fetchWithAuth(`${API_BASE}/customers?search=${query}&branchId=${currentBranch._id}&limit=50`);
        const data = await res.json();
        if (data.success) {
            setCustomersList(data.data || []);
        }
    } catch (err) { console.error("Fetch Customers Error:", err); }
  };

  const fetchProducts = async (query = "") => {
    try {
        const res = await fetchWithAuth(`${API_BASE}/products?search=${query}&branchId=${currentBranch._id}&limit=50`);
        const data = await res.json();
        if (data.success) {
            setProductsList(data.data || []);
        }
    } catch (err) { console.error("Fetch Products Error:", err); }
  };

  const fetchInvoices = async () => {
    if (!customer?._id) return;
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_BASE}/invoices/customer/${customer._id}?branchId=${currentBranch._id}`);
      const data = await response.json();
      // Handle both array and {data: []} formats just in case
      const invoiceData = Array.isArray(data) ? data : (data.data || []);
      setInvoices(invoiceData);
    } catch (error) { 
      console.error("Error fetching customer invoices:", error);
      toast.error("Failed to load invoices");
    } finally { 
      setLoading(false); 
    }
  };

  const addStandaloneItem = (product) => {
    const exists = selectedItems.find(si => si.productId === product._id);
    if (!exists) {
        setSelectedItems([...selectedItems, {
            productId: product._id,
            name: product.name,
            qty: 1,
            sellingPrice: product.sellingPrice || 0,
            gst: product.gst || 0,
            discountPercent: product.discount || 0,
            hsn: product.hsn || ""
        }]);
    }
    setProductSearch("");
    setShowProductResults(false);
  };

  const handleToggleInvoiceItem = (item) => {
    const exists = selectedItems.find(si => si._id === item._id);
    if (exists) {
      setSelectedItems(selectedItems.filter(si => si._id !== item._id));
    } else {
      setSelectedItems([...selectedItems, { 
        ...item, 
        productId: item.productId, 
        qty: item.qty, // Original qty
        returnQty: item.qty 
      }]);
    }
  };

  const removeItem = (id) => setSelectedItems(selectedItems.filter(si => (si._id || si.productId) !== id));

  const handleQtyChange = (id, val) => {
    setSelectedItems(selectedItems.map(si => {
        if ((si._id || si.productId) === id) {
            return { ...si, qty: val, returnQty: val };
        }
        return si;
    }));
  };

  const handlePriceChange = (id, val) => {
    setSelectedItems(selectedItems.map(si => {
        if ((si._id || si.productId) === id) return { ...si, sellingPrice: val };
        return si;
    }));
  };

  const handleDiscountChange = (id, val) => {
    setSelectedItems(selectedItems.map(si => {
        if ((si._id || si.productId) === id) return { ...si, discountPercent: val };
        return si;
    }));
  };

  const handleGstChange = (id, val) => {
    setSelectedItems(selectedItems.map(si => {
        if ((si._id || si.productId) === id) return { ...si, gst: val };
        return si;
    }));
  };

  const calculatedTotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      const q = Number(item.returnQty || item.qty || 0);
      const p = Number(item.sellingPrice || 0);
      const d = Number(item.discountPercent || 0);
      const discountedPrice = p * (1 - d / 100);
      const subtotal = q * discountedPrice;
      const tax = (subtotal * (item.gst || 0)) / 100;
      return sum + subtotal + tax;
    }, 0);
  }, [selectedItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customer) return toast.error("Please select a customer");
    
    let finalPayload = {
        branchId: currentBranch._id,
        customerId: customer._id,
        reasonForReturn: formData.reason,
        userId: user?._id,
        username: user?.username
    };

    if (creditType === "general") {
        if (!formData.amount || formData.amount <= 0) return toast.error("Enter a valid amount");
        // Reuse general endpoint or handle in main
        finalPayload.items = [{ name: "General Adjustment", qty: 1, sellingPrice: formData.amount, gst: 0, productId: "000000000000000000000000" }];
    } else {
        if (selectedItems.length === 0) return toast.error("Add at least one item");
        finalPayload.items = selectedItems.map(si => ({
            productId: si.productId,
            name: si.name,
            qty: si.returnQty || si.qty,
            sellingPrice: si.sellingPrice,
            gst: si.gst,
            discountPercent: si.discountPercent || 0
        }));
        if (creditType === "invoice" && selectedInvoice) {
            finalPayload.originalSalesOrderId = selectedInvoice._id;
        }
    }

    setSubmitting(true);
    try {
      const response = await fetchWithAuth(`${API_BASE}/credit-notes`, {
        method: "POST",
        body: JSON.stringify(finalPayload),
      });
      const result = await response.json();
      if (result.success) {
        toast.success("Credit Note created successfully");
        onCreditSuccess();
        onClose();
        // Reset
        setSelectedItems([]);
        setSelectedInvoice(null);
        setFormData({ amount: "", reason: "", date: new Date().toISOString().split("T")[0] });
      } else {
        toast.error(result.message || "Failed");
      }
    } catch (error) { toast.error("Server Error"); }
    finally { setSubmitting(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex justify-center items-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-100 flex flex-col max-h-[95vh] animate-slideUp">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-800 px-10 py-8 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-5 text-white">
            <div className="p-4 bg-white/20 rounded-3xl backdrop-blur-md shadow-inner">
              <FaUndoAlt size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter leading-none italic">Record Return</h2>
              <p className="text-teal-100 text-[10px] font-black uppercase tracking-[0.2em] mt-2 opacity-80">
                {customer ? `ISSUE CREDIT NOTE FOR ${customer.name}` : "SELECT CUSTOMER TO PROCEED"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-all p-3 hover:bg-white/10 rounded-full active:scale-90">
            <FaTimes size={28} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/50">
          
          {/* Section 1: Customer Selection (if standalone) */}
          {!initialCustomer && (
            <div className="relative group">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block pl-2">Customer Search</label>
                <div className="flex items-center bg-white border-2 border-gray-100 rounded-3xl px-6 py-4 transition-all focus-within:border-teal-500 shadow-sm">
                    <FaUser className="text-gray-300 mr-4" />
                    <input 
                      type="text"
                      className="flex-1 bg-transparent outline-none font-black text-gray-800 placeholder:text-gray-300"
                      placeholder="Search by name or phone..."
                      value={customer ? customer.name : customerSearch}
                      onFocus={() => { if (!customer) setShowCustomerResults(true); }}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        if (customer) setCustomer(null);
                        setShowCustomerResults(true);
                      }}
                    />
                    {customer ? (
                        <button onClick={() => setCustomer(null)} className="text-rose-500 hover:text-rose-700 font-black text-xs uppercase ml-4">Change</button>
                    ) : (
                        <FaChevronDown 
                            className={`text-gray-300 ml-4 cursor-pointer transition-transform duration-300 ${showCustomerResults ? 'rotate-180 text-teal-500' : ''}`}
                            onClick={() => setShowCustomerResults(!showCustomerResults)}
                        />
                    )}
                </div>
                {showCustomerResults && !customer && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-2 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-fadeIn">
                        {(!Array.isArray(customersList) || customersList.length === 0) ? (
                            <div className="p-6 text-center text-gray-400 text-xs font-bold uppercase">No customers found</div>
                        ) : customersList.map(c => (
                            <div 
                                key={c._id}
                                onClick={() => { setCustomer(c); setShowCustomerResults(false); }}
                                className="p-4 hover:bg-teal-50 cursor-pointer border-b last:border-0 transition-colors flex items-center justify-between"
                            >
                                <span className="font-black text-gray-800 text-sm">{c.name}</span>
                                <span className="text-[10px] bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">{c.phone || c.whatsapp}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          )}

          {/* Section 2: Mode Selector */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-2">Return Methodology</label>
            <div className="flex gap-3 p-2 bg-white rounded-[1.5rem] border-2 border-gray-100 shadow-sm">
               {[
                 { id: "standalone", label: "Direct Product Return", color: "teal" },
                 { id: "invoice", label: "Against Invoice", color: "blue" },
                 { id: "general", label: "General Adjustment", color: "rose" }
               ].map(mode => (
                 <button 
                   key={mode.id}
                   type="button"
                   onClick={() => { setCreditType(mode.id); setSelectedItems([]); setSelectedInvoice(null); }}
                   className={`flex-1 py-4 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${creditType === mode.id ? `bg-${mode.color}-600 text-white shadow-xl shadow-${mode.color}-100 active:scale-95` : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                 >
                   {mode.label}
                 </button>
               ))}
            </div>
          </div>

          {/* Section 3: Mode-Specific Input */}
          <div className="bg-white rounded-[2rem] border-2 border-gray-100 p-8 shadow-sm">
            {creditType === "standalone" && (
                <div className="space-y-6">
                    <div className="relative">
                        <div className="flex items-center bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 focus-within:bg-white focus-within:border-teal-500 transition-all">
                            <FaSearch className="text-gray-300 mr-4" />
                            <input 
                              type="text"
                              className="flex-1 bg-transparent outline-none font-black text-gray-800 text-sm"
                              placeholder="Search products to return..."
                              value={productSearch}
                              onFocus={() => setShowProductResults(true)}
                              onChange={(e) => { setProductSearch(e.target.value); setShowProductResults(true); }}
                            />
                            <FaChevronDown 
                                className={`text-gray-300 ml-4 cursor-pointer transition-transform duration-300 ${showProductResults ? 'rotate-180 text-teal-500' : ''}`}
                                onClick={() => setShowProductResults(!showProductResults)}
                            />
                        </div>
                        {showProductResults && (
                            <div className="absolute z-20 left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                                {productsList.map(p => (
                                    <div key={p._id} onClick={() => addStandaloneItem(p)} className="p-4 hover:bg-teal-50 cursor-pointer border-b flex justify-between items-center transition-colors group">
                                        <div className="flex flex-col">
                                            <span className="font-black text-gray-800 text-xs group-hover:text-teal-700 transition-colors">{p.name}</span>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[9px] text-teal-600 font-black uppercase bg-teal-50 px-1.5 py-0.5 rounded-md">₹{p.sellingPrice}</span>
                                                <span className="text-[9px] text-gray-400 font-bold uppercase">GST: {p.gst}%</span>
                                                <span className="text-[9px] text-gray-400 font-bold uppercase ml-2 italic">Stock: {p.totalQty}</span>
                                            </div>
                                        </div>
                                        <div className="bg-teal-100 p-2 rounded-xl group-hover:bg-teal-600 group-hover:text-white transition-all shadow-sm">
                                            <FaPlus size={12} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        {selectedItems.map(item => (
                            <div key={item.productId} className="bg-gray-50 rounded-3xl p-6 border-2 border-gray-100 group animate-fadeIn transition-all hover:border-teal-100">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <p className="text-sm font-black text-gray-900 mb-1">{item.name}</p>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                HSN: {item.hsn || 'N/A'}
                                            </span>
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter italic">
                                                STOCK ADJUSTMENT: READY
                                            </span>
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => removeItem(item.productId)} className="p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90">
                                        <FaTrashAlt />
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Returned Qty</label>
                                        <input 
                                          type="number" 
                                          className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 text-center text-xs font-black text-gray-900 focus:border-teal-500 outline-none transition-all shadow-sm"
                                          placeholder="0"
                                          value={item.qty}
                                          onChange={(e) => handleQtyChange(item.productId, Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Selling Price</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-3 text-[10px] font-black text-gray-300">₹</span>
                                            <input 
                                              type="number" 
                                              className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 pl-7 pr-3 text-right text-xs font-black text-teal-600 focus:border-teal-500 outline-none transition-all shadow-sm"
                                              value={item.sellingPrice}
                                              onChange={(e) => handlePriceChange(item.productId, Number(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">GST %</label>
                                        <input 
                                          type="number" 
                                          className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 text-center text-xs font-black text-gray-900 focus:border-teal-500 outline-none transition-all shadow-sm"
                                          value={item.gst}
                                          onChange={(e) => handleGstChange(item.productId, Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Disc. %</label>
                                        <input 
                                          type="number" 
                                          className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 text-center text-xs font-black text-orange-600 focus:border-teal-500 outline-none transition-all shadow-sm"
                                          value={item.discountPercent}
                                          onChange={(e) => handleDiscountChange(item.productId, Number(e.target.value))}
                                        />
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t border-dashed border-gray-200 flex justify-between items-center text-[10px] font-black uppercase tracking-tighter italic">
                                    <span className="text-gray-400">Item Total (Inclusive)</span>
                                    <span className="text-teal-700">
                                        ₹{((item.qty * item.sellingPrice * (1 - (item.discountPercent || 0)/100)) * (1 + (item.gst || 0)/100)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {selectedItems.length > 0 && (
                            <div className="pt-6 border-t border-gray-100 flex justify-between items-center">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Standalone Return Value (Inc. GST)</span>
                                <span className="text-2xl font-black text-teal-600 tracking-tighter italic">₹{calculatedTotal.toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {creditType === "invoice" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        {loading ? (
                          <div className="col-span-2 py-10 text-center">
                            <FaSpinner className="animate-spin text-blue-500 mx-auto" />
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">Fetching Invoices...</p>
                          </div>
                        ) : invoices.length === 0 ? (
                          <div className="col-span-2 py-10 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">No generated invoices found for this customer</p>
                          </div>
                        ) : invoices.map(inv => (
                             <div 
                               key={inv._id}
                               onClick={() => { setSelectedInvoice(inv); setSelectedItems([]); }}
                               className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center ${selectedInvoice?._id === inv._id ? 'border-blue-600 bg-blue-50' : 'border-gray-100 bg-white hover:border-blue-200'}`}
                             >
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-blue-900 leading-none">{inv.invoiceNumber || inv.invoiceId}</span>
                                    <span className="text-[9px] text-gray-400 font-bold uppercase mt-1">{inv.invoiceDate ? formatDate(inv.invoiceDate) : formatDate(inv.createdAt)}</span>
                                </div>
                                <span className="text-xs font-black text-blue-700">₹{(inv.grandTotal || 0).toLocaleString()}</span>
                             </div>
                        ))}
                    </div>

                    {selectedInvoice && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="space-y-2">
                                {selectedInvoice.items.map(item => {
                                    const isSelected = selectedItems.find(si => si._id === item._id);
                                    return (
                                        <div key={item._id} className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${isSelected ? 'border-blue-300 bg-blue-50/50' : 'border-gray-50 bg-gray-50/20'}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${isSelected ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-100 scale-110' : 'bg-white border-gray-200'}`} onClick={() => handleToggleInvoiceItem(item)}>
                                                    {isSelected && <FaCheckCircle className="text-white text-[10px]" />}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-gray-900 truncate max-w-[150px]">{item.name}</p>
                                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Ref: ₹{item.sellingPrice} | HSN: {item.hsn || '-'}</p>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                      type="number"
                                                      className="w-16 bg-white border-2 border-blue-100 rounded-lg px-2 py-1.5 text-center text-xs font-black text-gray-900 outline-none focus:border-blue-600"
                                                      value={isSelected.returnQty}
                                                      onChange={(e) => handleQtyChange(item._id, Number(e.target.value))}
                                                    />
                                                    <span className="text-[9px] font-black text-gray-400 italic">UP TO {item.qty}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="bg-blue-100/30 p-6 rounded-3xl flex justify-between items-center border border-blue-100 shadow-inner">
                                <span className="text-[10px] font-black text-blue-800 uppercase tracking-[0.2em] italic">Calculated Invoice Credit Amount</span>
                                <span className="text-2xl font-black text-blue-600 italic tracking-tighter">₹{calculatedTotal.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {creditType === "general" && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest block pl-2">Credit Value (₹)</label>
                            <input 
                              type="number"
                              className="w-full bg-rose-50/50 border-2 border-rose-100 rounded-2xl px-6 py-5 text-2xl font-black text-rose-600 focus:border-rose-500 outline-none transition-all shadow-inner italic"
                              placeholder="0.00"
                              value={formData.amount}
                              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-2">Voucher Date</label>
                            <input 
                              type="date"
                              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-5 text-sm font-black text-gray-800 focus:border-teal-500 outline-none transition-all uppercase"
                              value={formData.date}
                              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-2">Reason / Remarks</label>
            <textarea 
               className="w-full bg-white border-2 border-gray-100 rounded-3xl px-8 py-6 text-sm font-bold text-gray-900 focus:border-teal-500 outline-none transition-all placeholder:text-gray-200 min-h-[120px] shadow-sm"
               placeholder="Why is this credit note being issued? (Required)"
               value={formData.reason}
               onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
               required
            />
          </div>

          <button 
            type="submit"
            disabled={submitting}
            className={`w-full py-6 rounded-3xl text-sm font-black uppercase tracking-[0.3em] text-white shadow-2xl transition-all active:scale-[0.97] mt-8 flex items-center justify-center gap-4 ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-teal-600 to-teal-800 hover:shadow-teal-200 shadow-xl'}`}
          >
            {submitting ? (
              <>
                <FaSpinner className="animate-spin" size={20} /> SYNCING LEDGER...
              </>
            ) : (
              <>
                <FaCheckCircle size={20} /> VALIDATE & CONFIRM RETURN
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CustomerCreditNoteModal;
