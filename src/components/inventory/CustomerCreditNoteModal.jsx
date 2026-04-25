import { useState, useEffect, useMemo, useRef } from "react";
import { FaTimes, FaUndoAlt, FaSearch, FaSpinner, FaCheckCircle, FaTrashAlt, FaPlus, FaUser, FaChevronDown, FaFileInvoice, FaLayerGroup } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

const inputClass = "w-full border border-gray-200 rounded-md px-3 py-2 focus:ring-1 focus:ring-[#319bab] outline-none text-sm font-semibold text-gray-800";
const selectClass = "w-full border border-gray-200 rounded-md px-3 py-2 bg-white focus:ring-1 focus:ring-[#319bab] outline-none text-sm font-semibold text-gray-800 appearance-none";
const labelClass = "block text-xs font-bold text-gray-500 mb-1 uppercase tracking-tight";

const CustomerCreditNoteModal = ({ isOpen, onClose, customer: initialCustomer, onCreditSuccess, editData }) => {
  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const { currentBranch, user } = useBranch();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nextId, setNextId] = useState("");
  
  const [returnType, setReturnType] = useState("standalone"); // "standalone" (Migrated) or "invoice" (Against Invoice)
  const [customer, setCustomer] = useState(initialCustomer || null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customersList, setCustomersList] = useState([]);
  const [showCustomerResults, setShowCustomerResults] = useState(false);

  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  
  const [productSearch, setProductSearch] = useState("");
  const [productsList, setProductsList] = useState([]);
  const [showProductResults, setShowProductResults] = useState(false);
  
  const [selectedItems, setSelectedItems] = useState([]);
  const [formData, setFormData] = useState({
    reason: "",
    date: new Date().toISOString().split("T")[0]
  });

  const customerDropdownRef = useRef(null);
  const productDropdownRef = useRef(null);

  // Fetch Next ID and Initial Data
  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setNextId(editData.creditNoteId);
        setCustomer(editData.customer?.customerId ? { _id: editData.customer.customerId, name: editData.customer.name } : null);
        setCustomerSearch(editData.customer?.name || "");
        setSelectedItems(editData.items.map(item => ({
          ...item,
          productId: item.productId?._id || item.productId
        })));
        setFormData({
          reason: editData.reasonForReturn || "",
          date: new Date(editData.createdAt || Date.now()).toISOString().split("T")[0]
        });
        setReturnType(editData.originalInvoiceId === "STANDALONE" ? "standalone" : "invoice");
      } else {
        fetchNextId();
        fetchCustomers();
        fetchProducts();
        // Reset if not editing
        setCustomer(initialCustomer || null);
        setCustomerSearch(initialCustomer?.name || "");
        setSelectedItems([]);
        setFormData({ reason: "", date: new Date().toISOString().split("T")[0] });
      }
    }
  }, [isOpen, editData]);

  // Sync initial customer
  useEffect(() => {
    if (initialCustomer) setCustomer(initialCustomer);
  }, [initialCustomer]);

  // Fetch Invoices when customer changes
  useEffect(() => {
    if (isOpen && customer?._id && returnType === "invoice") {
      fetchInvoices();
    }
  }, [isOpen, customer, returnType]);

  // Click Outside Logic
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) setShowCustomerResults(false);
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) setShowProductResults(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNextId = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/credit-notes/next-id?branchId=${currentBranch._id}`);
      const data = await res.json();
      if (data.success) setNextId(data.nextId);
    } catch (err) { console.error("Fetch Next ID Error:", err); }
  };

  const fetchCustomers = async (query = "") => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/customers?search=${query}&branchId=${currentBranch._id}&limit=50`);
      const data = await res.json();
      if (data.success) setCustomersList(data.data || []);
    } catch (err) { console.error("Fetch Customers Error:", err); }
  };

  const fetchProducts = async (query = "") => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/products?search=${query}&branchId=${currentBranch._id}&limit=50`);
      const data = await res.json();
      if (data.success) setProductsList(data.data || []);
    } catch (err) { console.error("Fetch Products Error:", err); }
  };

  const fetchInvoices = async () => {
    if (!customer?._id) return;
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_BASE}/invoices/customer/${customer._id}?branchId=${currentBranch._id}`);
      const data = await response.json();
      const invoiceData = Array.isArray(data) ? data : (data.data || []);
      setInvoices(invoiceData);
    } catch (error) { 
      toast.error("Failed to load invoices");
    } finally { setLoading(false); }
  };

  const handleSelectCustomer = (c) => {
    setCustomer(c);
    setCustomerSearch(c.name);
    setShowCustomerResults(false);
    if (returnType === "invoice") setSelectedInvoice(null);
  };

  const handleSelectProduct = (p) => {
    const exists = selectedItems.find(item => item.productId === p._id);
    if (!exists) {
      setSelectedItems([...selectedItems, {
        productId: p._id,
        name: p.name,
        qty: 1,
        sellingPrice: p.sellingPrice || 0,
        gst: p.gst || 0,
        hsn: p.hsn || "",
        discountPercent: p.discount || 0
      }]);
    }
    setProductSearch("");
    setShowProductResults(false);
  };

  const handleSelectInvoice = (inv) => {
    setSelectedInvoice(inv);
    const populatedItems = inv.items.map(item => ({
      ...item,
      productId: item.productId._id || item.productId,
      maxQty: item.qty,
      qty: 0, // Default to 0 for partial returns
      returnQty: 0 
    }));
    setSelectedItems(populatedItems);
  };

  const handleReturnAll = () => {
    if (!selectedInvoice) return;
    setSelectedItems(selectedItems.map(item => ({
      ...item,
      qty: item.maxQty,
      returnQty: item.maxQty
    })));
    toast.info("All items set to full return");
  };

  const handleClearAll = () => {
    setSelectedItems(selectedItems.map(item => ({
      ...item,
      qty: 0,
      returnQty: 0
    })));
  };

  const handleQtyChange = (productId, val) => {
    setSelectedItems(selectedItems.map(item => {
      if (item.productId === productId || item._id === productId) {
        // If invoice mode, don't allow exceeding maxQty
        let qty = Number(val);
        if (returnType === "invoice" && qty > item.maxQty) {
          toast.warning(`Cannot exceed original qty (${item.maxQty})`);
          qty = item.maxQty;
        }
        return { ...item, qty: qty, returnQty: qty };
      }
      return item;
    }));
  };

  const removeItem = (id) => setSelectedItems(selectedItems.filter(item => (item.productId || item._id) !== id));

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let cgst = 0;
    let sgst = 0;

    selectedItems.forEach(item => {
      const q = Number(item.returnQty || item.qty || 0);
      const p = Number(item.sellingPrice || 0);
      const d = Number(item.discountPercent || 0);
      const gstRate = Number(item.gst || 0);

      const discountedPrice = p * (1 - d / 100);
      const itemSubtotal = q * discountedPrice;
      const itemTax = (itemSubtotal * gstRate) / 100;

      subtotal += itemSubtotal;
      tax += itemTax;
    });

    cgst = tax / 2;
    sgst = tax / 2;

    return {
      subtotal,
      tax,
      cgst,
      sgst,
      grandTotal: subtotal + tax
    };
  }, [selectedItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customer) return toast.error("Select customer");
    if (selectedItems.length === 0) return toast.error("Add at least one item");
    if (!formData.reason.trim()) return toast.error("Reason is required");

    setSubmitting(true);
    try {
      const payload = {
        branchId: currentBranch._id,
        customerId: customer._id,
        reasonForReturn: formData.reason,
        userId: user?._id,
        username: user?.username,
        items: selectedItems.map(item => ({
          productId: item.productId,
          name: item.name,
          qty: item.returnQty || item.qty,
          sellingPrice: item.sellingPrice,
          gst: item.gst,
          discountPercent: item.discountPercent || 0
        })),
        originalSalesOrderId: returnType === "invoice" ? selectedInvoice?.salesOrderId : null
      };

      const res = await fetchWithAuth(`${API_BASE}/credit-notes${editData ? `/${editData._id}` : ""}`, {
        method: editData ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editData ? "Credit Note Updated" : "Credit Note Created");
        onCreditSuccess();
        onClose();
        // Reset
        setSelectedItems([]);
        setSelectedInvoice(null);
        setFormData({ reason: "", date: new Date().toISOString().split("T")[0] });
      } else {
        toast.error(data.message || "Failed");
      }
    } catch (err) { toast.error("Server Error"); }
    finally { setSubmitting(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] bg-gray-50 flex flex-col md:p-6 p-0 overflow-hidden animate-in fade-in duration-300">
      
      {/* HEADER SECTION - Sticky */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-[#319bab]/10 p-2.5 rounded-xl text-[#319bab]">
            <FaUndoAlt size={22} />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight leading-none uppercase italic">{editData ? "Edit Credit Note" : "Process Return / Issue Credit Note"}</h3>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-2">
              <span className="text-[#319bab]">REFERENCE ID: {nextId || "GETTING ID..."}</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-500">{formatDate(editData?.createdAt || new Date())}</span>
              {editData?.originalInvoiceId && editData.originalInvoiceId !== "STANDALONE" && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-black border border-blue-100 uppercase tracking-tighter">
                  Against Inv: {editData.originalInvoiceId}
                </span>
              )}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-3 bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all active:scale-95 border border-gray-200 group">
          <FaTimes size={20} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* MAIN CONTENT - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: Configuration & Item Selection */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Step 1: Customer & Mode Selection */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center gap-2 pb-4 border-b border-gray-50">
                <span className="p-1.5 bg-blue-50 text-blue-500 rounded-lg"><FaUser size={14} /></span>
                <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Customer & Workflow Selection</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative" ref={customerDropdownRef}>
                  <label className={labelClass}>Select Customer</label>
                  <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 focus-within:border-[#319bab] focus-within:bg-white transition-all">
                    <FaSearch className="text-gray-300 mr-2" size={14} />
                    <input 
                      type="text"
                      className="flex-1 bg-transparent py-1 outline-none text-sm font-bold"
                      placeholder="Type name or phone..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        fetchCustomers(e.target.value);
                        setShowCustomerResults(true);
                      }}
                      onFocus={() => setShowCustomerResults(true)}
                    />
                  </div>
                  {showCustomerResults && (
                    <div className="absolute z-40 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                      {customersList.map(c => (
                        <div 
                          key={c._id}
                          onClick={() => handleSelectCustomer(c)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-0 flex justify-between items-center"
                        >
                          <div>
                            <p className="text-sm font-bold text-gray-800">{c.name}</p>
                            <p className="text-xs text-gray-400 font-bold">{c.phone || c.whatsapp}</p>
                          </div>
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-black uppercase">Balance: ₹{(c.debit - c.credit).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Return Methodology</label>
                  <div className="flex p-1 bg-gray-100 rounded-lg gap-1 border border-gray-200">
                    <button 
                      type="button"
                      onClick={() => { setReturnType("standalone"); setSelectedItems([]); setSelectedInvoice(null); }}
                      className={`flex-1 py-2 rounded-md text-xs font-black uppercase tracking-widest transition-all ${returnType === "standalone" ? 'bg-white text-[#319bab] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      Migrated Data
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setReturnType("invoice"); setSelectedItems([]); }}
                      className={`flex-1 py-2 rounded-md text-xs font-black uppercase tracking-widest transition-all ${returnType === "invoice" ? 'bg-white text-[#319bab] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      Against Invoice
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Source Selection (Invoice List or Product Search) */}
              <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm space-y-6">
                <div className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-50">
                    <span className="p-1.5 bg-orange-50 text-orange-500 rounded-lg"><FaSearch size={14} /></span>
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Manual Product Return</h4>
                  </div>
                  <div className="relative" ref={productDropdownRef}>
                    <label className={labelClass}>Search Product</label>
                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md px-4 py-2 focus-within:border-[#319bab] focus-within:bg-white transition-all">
                      <FaSearch className="text-gray-300 mr-3" size={14} />
                      <input 
                        type="text"
                        className="flex-1 bg-transparent outline-none text-sm font-bold"
                        placeholder="Search by product name or group..."
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          fetchProducts(e.target.value);
                          setShowProductResults(true);
                        }}
                        onFocus={() => setShowProductResults(true)}
                      />
                    </div>
                    {showProductResults && (
                      <div className="absolute z-40 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden max-h-72 overflow-y-auto animate-in slide-in-from-top-2">
                        {productsList.map(p => (
                          <div 
                            key={p._id}
                            onClick={() => handleSelectProduct(p)}
                            className="px-6 py-4 hover:bg-gray-50 cursor-pointer border-b last:border-0 flex justify-between items-center group"
                          >
                            <div>
                              <p className="text-sm font-black text-gray-800 group-hover:text-[#319bab] transition-colors">{p.name}</p>
                              <p className="text-xs text-gray-400 font-bold uppercase mt-0.5">₹{p.sellingPrice} | GST: {p.gst}%</p>
                            </div>
                            <div className="bg-gray-100 p-2 rounded-lg group-hover:bg-[#319bab] group-hover:text-white transition-all">
                              <FaPlus size={10} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {returnType === "invoice" && (
                  <div className="space-y-4 pt-6 border-t border-gray-100">
                    <div className="flex items-center gap-2 pb-2">
                      <span className="p-1.5 bg-purple-50 text-purple-500 rounded-lg"><FaFileInvoice size={14} /></span>
                      <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Linked Invoice Items</h4>
                    </div>
                    {!customer ? (
                      <p className="text-center py-6 text-xs font-bold text-gray-400 uppercase italic">Select a customer first to view invoices</p>
                    ) : loading ? (
                      <div className="flex justify-center py-6"><FaSpinner className="animate-spin text-[#319bab]" /></div>
                    ) : invoices.length === 0 ? (
                      <p className="text-center py-6 text-xs font-bold text-gray-400 uppercase italic">No invoices found for this customer</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {invoices.map(inv => (
                          <div 
                            key={inv._id}
                            onClick={() => handleSelectInvoice(inv)}
                            className={`p-4 border-2 rounded-xl transition-all cursor-pointer flex flex-col justify-between h-28 ${selectedInvoice?._id === inv._id ? 'border-[#319bab] bg-[#319bab]/5' : 'border-gray-50 hover:border-[#319bab]/30'}`}
                          >
                            <p className="text-xs font-black text-gray-400 uppercase flex justify-between">
                              #{inv.invoiceNumber}
                              <span className="text-[#319bab]">{formatDate(inv.invoiceDate || inv.createdAt)}</span>
                            </p>
                            <p className="text-base font-black text-gray-900 mt-2">₹{(inv.grandTotal || 0).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

            {/* Step 3: Return Items List */}
            {selectedItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-gray-50/50 px-8 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-teal-50 text-teal-600 rounded-lg"><FaLayerGroup size={14} /></span>
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Return Inventory Worksheet</h4>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-black text-[#319bab] uppercase bg-[#319bab]/10 px-3 py-1 rounded-full">{selectedItems.length} ITEMS READY</span>
                    {returnType === "invoice" && (
                      <div className="flex gap-2">
                        <button onClick={handleReturnAll} className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200 hover:bg-green-100 transition-all uppercase">Return All</button>
                        <button onClick={handleClearAll} className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 hover:bg-red-100 transition-all uppercase">Reset to 0</button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="divide-y divide-gray-50">
                  {selectedItems.map(item => (
                    <div key={item.productId || item._id} className="p-8 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <p className="text-base font-black text-gray-900 mb-1">{item.name}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-gray-400 border border-gray-200 px-2 py-0.5 rounded uppercase tracking-tighter italic">HSN: {item.hsn || '-'}</span>
                            {returnType === "invoice" && (
                              <span className="text-xs font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded uppercase tracking-tighter">Orig Qty: {item.maxQty}</span>
                            )}
                          </div>
                        </div>
                        <button type="button" onClick={() => removeItem(item.productId || item._id)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90">
                          <FaTrashAlt size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                          <label className={labelClass}>Returned Qty</label>
                          <input 
                            type="number"
                            className={inputClass}
                            value={item.returnQty || item.qty}
                            onChange={(e) => handleQtyChange(item.productId || item._id, e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Price (₹)</label>
                          <input 
                            type="number"
                            disabled={returnType === "invoice"}
                            className={`${inputClass} ${returnType === "invoice" ? 'bg-gray-50 text-gray-400' : ''}`}
                            value={item.sellingPrice}
                            onChange={(e) => {
                              setSelectedItems(selectedItems.map(si => ((si.productId === item.productId || si._id === item._id) ? { ...si, sellingPrice: Number(e.target.value) } : si)));
                            }}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Disc %</label>
                          <input 
                            type="number"
                            className={inputClass}
                            value={item.discountPercent || 0}
                            onChange={(e) => {
                              setSelectedItems(selectedItems.map(si => ((si.productId === item.productId || si._id === item._id) ? { ...si, discountPercent: Number(e.target.value) } : si)));
                            }}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>GST %</label>
                          <input 
                            type="number"
                            disabled={returnType === "invoice"}
                            className={`${inputClass} ${returnType === "invoice" ? 'bg-gray-50 text-gray-400' : ''}`}
                            value={item.gst}
                            onChange={(e) => {
                              setSelectedItems(selectedItems.map(si => ((si.productId === item.productId || si._id === item._id) ? { ...si, gst: Number(e.target.value) } : si)));
                            }}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Line Total</label>
                          <div className={inputClass + " bg-teal-50 border-teal-100 flex items-center justify-end"}>
                            ₹{((item.returnQty || item.qty) * item.sellingPrice * (1 - (item.discountPercent || 0)/100) * (1 + item.gst/100)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Totals & Summary */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm space-y-6 sticky top-28">
              <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest border-b border-gray-50 pb-4">Returns Summary</h4>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-500 uppercase tracking-tight">Subtotal</span>
                  <span className="font-black text-gray-900">₹{totals.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-500 uppercase tracking-tight">CGST ({(totals.tax/2).toFixed(1)}%)</span>
                  <span className="font-black text-gray-900">₹{totals.cgst.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-500 uppercase tracking-tight">SGST ({(totals.tax/2).toFixed(1)}%)</span>
                  <span className="font-black text-gray-900">₹{totals.sgst.toLocaleString()}</span>
                </div>
                <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-xs font-black text-[#319bab] uppercase italic">Grand Total</span>
                  <span className="text-2xl font-black text-[#319bab] tracking-tighter">₹{totals.grandTotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-2xl space-y-4 border border-gray-100 shadow-inner">
                <div>
                  <label className={labelClass}>Reason for Issue</label>
                  <textarea 
                    className={inputClass + " h-24 resize-none border-gray-300 focus:bg-white text-sm"}
                    placeholder="e.g., Physical Damage during shipping, Incorrect Product..."
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  />
                </div>
              </div>

              <div className="bg-[#319bab]/5 border border-[#319bab]/10 p-5 rounded-2xl">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 italic text-center">Accounting Impact</p>
                <div className="flex justify-center items-center gap-2 text-xs font-bold text-[#319bab] uppercase">
                  <span className="w-1.5 h-1.5 bg-[#319bab] rounded-full animate-pulse"></span>
                  Balance Reduction & Stock Restoration
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER ACTION BAR - Sticky */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-8 py-6 flex items-center justify-center gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl w-full flex items-center justify-between gap-6">
          <div className="hidden md:block">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest italic">All return values are computed based on original unit pricing and tax rates.</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 md:flex-none px-12 py-4 border border-gray-200 text-gray-500 font-black rounded-xl hover:bg-gray-50 transition-all uppercase tracking-widest text-sm active:scale-95"
            >
              Cancel
            </button>
            <button
              disabled={submitting}
              onClick={handleSubmit}
              className={`flex-1 md:flex-none px-16 py-4 font-black rounded-xl text-white shadow-xl transition-all uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 ${submitting ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#319bab] hover:bg-[#287e8b] active:scale-95 hover:-translate-y-0.5 shadow-[#319bab]/20'}`}
            >
              {submitting ? (
                <><FaSpinner className="animate-spin" /> {editData ? "Updating..." : "Finalizing..."}</>
              ) : (
                <><FaCheckCircle /> {editData ? "Update Credit Note" : "Issue Credit Note"}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCreditNoteModal;
