import { useState, useEffect, useMemo, useRef } from "react";
import { FaTimes, FaUndoAlt, FaSearch, FaSpinner, FaCheckCircle, FaTrashAlt, FaPlus, FaHandshake, FaChevronDown, FaFileInvoice, FaLayerGroup } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

const inputClass = "w-full border border-gray-200 rounded-md px-3 py-2 focus:ring-1 focus:ring-rose-500 outline-none text-sm font-semibold text-gray-800";
const labelClass = "block text-xs font-bold text-gray-500 mb-1 uppercase tracking-tight";

const SupplierDebitNoteModal = ({ isOpen, onClose, preselectedVendor = null, editData = null, onSuccess }) => {
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
  
  const [returnType, setReturnType] = useState("standalone"); // "standalone" or "invoice"
  const [vendor, setVendor] = useState(preselectedVendor || null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorsList, setVendorsList] = useState([]);
  const [showVendorResults, setShowVendorResults] = useState(false);

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

  const vendorDropdownRef = useRef(null);
  const productDropdownRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        // LOAD EDIT DATA
        setNextId(editData.debitNoteId);
        setVendor(editData.vendor?.vendorId || editData.vendor);
        setVendorSearch(editData.vendor?.name || "");
        setReturnType(editData.originalPurchaseOrderId ? "invoice" : "standalone");
        setFormData({
          reason: editData.reason || "",
          date: new Date(editData.createdAt).toISOString().split("T")[0]
        });
        
        const mappedItems = editData.items.map(item => ({
          ...item,
          productId: item.productId._id || item.productId,
          qty: item.qty || item.returnedQty || 0,
          returnQty: item.qty || item.returnedQty || 0,
          maxQty: 999999 // In edit mode, we don't strictly enforce maxQty unless we re-fetch the PO
        }));
        setSelectedItems(mappedItems);
        
        if (editData.originalPurchaseOrderId) {
           setSelectedInvoice(editData.originalPurchaseOrderId);
        }
      } else {
        fetchNextId();
        fetchVendors();
        fetchProducts();
        setVendor(preselectedVendor);
        setVendorSearch(preselectedVendor?.name || "");
        setReturnType("standalone");
        setSelectedItems([]);
        setSelectedInvoice(null);
        setFormData({ reason: "", date: new Date().toISOString().split("T")[0] });
      }
    }
  }, [isOpen, editData]);

  // Fetch Invoices when vendor changes
  useEffect(() => {
    if (isOpen && vendor?._id && returnType === "invoice") {
      fetchInvoices();
    }
  }, [isOpen, vendor, returnType]);

  // Click Outside Logic
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (vendorDropdownRef.current && !vendorDropdownRef.current.contains(e.target)) setShowVendorResults(false);
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) setShowProductResults(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNextId = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/debit-notes/next-id?branchId=${currentBranch._id}`);
      const data = await res.json();
      setNextId(data.nextId);
    } catch (err) { console.error("Fetch Next ID Error:", err); }
  };

  const fetchVendors = async (query = "") => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/vendors?search=${query}&branchId=${currentBranch._id}&limit=50`);
      const data = await res.json();
      if (data.success) setVendorsList(data.data || []);
    } catch (err) { console.error("Fetch Vendors Error:", err); }
  };

  const fetchProducts = async (query = "") => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/products?search=${query}&branchId=${currentBranch._id}&limit=50`);
      const data = await res.json();
      if (data.success) setProductsList(data.data || []);
    } catch (err) { console.error("Fetch Products Error:", err); }
  };

  const fetchInvoices = async () => {
    if (!vendor?._id) return;
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_BASE}/purchase-orders?vendorId=${vendor._id}&statuses=INVOICED,PARTIALLY_RETURNED&branchId=${currentBranch._id}`);
      const data = await response.json();
      setInvoices(data.data || data || []);
    } catch (error) { 
      toast.error("Failed to load purchase invoices");
    } finally { setLoading(false); }
  };

  const handleSelectVendor = (v) => {
    setVendor(v);
    setVendorSearch(v.name);
    setShowVendorResults(false);
    if (returnType === "invoice") setSelectedInvoice(null);
  };

  const handleSelectProduct = (p) => {
    const exists = selectedItems.find(item => item.productId === p._id);
    if (!exists) {
      setSelectedItems([...selectedItems, {
        productId: p._id,
        name: p.name,
        qty: 1,
        purchasePrice: p.purchasePrice || 0,
        gst: p.gst || 0,
        discountPercent: 0,
        hsn: p.hsn || ""
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
      returnQty: 0,
      discountPercent: item.discountPercent || 0
    }));
    setSelectedItems(populatedItems);
  };

  const handleFieldChange = (productId, field, val) => {
    setSelectedItems(selectedItems.map(item => {
      if (item.productId === productId || item._id === productId) {
        let value = Number(val);
        if (field === 'qty' || field === 'returnQty') {
          if (returnType === "invoice" && value > item.maxQty) {
            toast.warning(`Cannot exceed original qty (${item.maxQty})`);
            value = item.maxQty;
          }
          return { ...item, qty: value, returnQty: value };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleQtyChange = (productId, val) => {
    setSelectedItems(selectedItems.map(item => {
      if (item.productId === productId || item._id === productId) {
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
    selectedItems.forEach(item => {
      const q = Number(item.returnQty || item.qty || 0);
      const p = Number(item.purchasePrice || 0);
      const d = Number(item.discountPercent || 0);
      const gstRate = Number(item.gst || 0);
      
      const discountedPrice = p * (1 - d / 100);
      const itemSubtotal = q * discountedPrice;
      
      subtotal += itemSubtotal;
      tax += (itemSubtotal * gstRate) / 100;
    });
    return { subtotal, tax, grandTotal: Math.round(subtotal + tax) };
  }, [selectedItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendor) return toast.error("Select vendor");
    if (selectedItems.filter(i => (i.returnQty || i.qty) > 0).length === 0) return toast.error("Add at least one item with quantity");
    if (!formData.reason.trim()) return toast.error("Reason is required");

    setSubmitting(true);
    try {
      const payload = {
        branchId: currentBranch._id,
        vendor: { vendorId: vendor._id, name: vendor.name },
        reason: formData.reason,
        userId: user?._id,
        username: user?.username,
        items: selectedItems.filter(i => (i.returnQty || i.qty) > 0).map(item => ({
          productId: item.productId,
          name: item.name,
          returnedQty: item.returnQty || item.qty,
          purchasePrice: item.purchasePrice,
          discountPercent: item.discountPercent || 0,
          gst: item.gst
        })),
        originalPurchaseOrderId: returnType === "invoice" ? selectedInvoice?._id : null
      };

      const url = editData 
        ? `${API_BASE}/debit-notes/${editData._id}` 
        : `${API_BASE}/debit-notes`;
      const method = editData ? "PUT" : "POST";

      const res = await fetchWithAuth(url, {
        method: method,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editData ? "Debit Note Updated" : "Debit Note Generated");
        onSuccess?.();
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
          <div className="bg-rose-50 text-rose-600 p-2.5 rounded-xl">
            <FaUndoAlt size={22} className="-rotate-90" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight leading-none uppercase italic">
              {editData ? "Edit Debit Note" : "Purchase Return / Issue Debit Note"}
            </h3>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-2">
              <span className="text-rose-600 uppercase">REF ID: {nextId || (editData ? editData.debitNoteId : "GENERATING...")}</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-500 uppercase tracking-tighter italic">{formatDate(editData ? editData.createdAt : new Date())}</span>
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-3 bg-gray-50 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all active:scale-95 border border-gray-200 group">
          <FaTimes size={20} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* MAIN CONTENT - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: Items & Selection */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Step 1: Vendor & Mode */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center gap-2 pb-4 border-b border-gray-50">
                <span className="p-1.5 bg-rose-50 text-rose-500 rounded-lg"><FaHandshake size={14} /></span>
                <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Supplier & Methodology Selection</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative" ref={vendorDropdownRef}>
                  <label className={labelClass}>Search Supplier</label>
                  <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 focus-within:border-rose-500 focus-within:bg-white transition-all">
                    <FaSearch className="text-gray-300 mr-2" size={14} />
                    <input 
                      type="text"
                      className="flex-1 bg-transparent py-1 outline-none text-sm font-bold"
                      placeholder="Search vendor..."
                      value={vendorSearch || (vendor?.name || "")}
                      onChange={(e) => {
                        setVendorSearch(e.target.value);
                        fetchVendors(e.target.value);
                        setShowVendorResults(true);
                      }}
                      onFocus={() => setShowVendorResults(true)}
                    />
                  </div>
                  {showVendorResults && (
                    <div className="absolute z-40 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                      {vendorsList.map(v => (
                        <div 
                          key={v._id}
                          onClick={() => handleSelectVendor(v)}
                          className="px-4 py-3 hover:bg-rose-50 cursor-pointer border-b last:border-0 flex justify-between items-center"
                        >
                          <div>
                            <p className="text-sm font-bold text-gray-800">{v.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">{v.phone || "No Contact"}</p>
                          </div>
                          <span className="text-[10px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded font-black uppercase tracking-tighter italic">₹{(v.credit || 0).toLocaleString()} CR</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Workflow Strategy</label>
                  <div className="flex p-1 bg-gray-100 rounded-lg gap-1 border border-gray-200">
                    <button 
                      type="button"
                      disabled={editData}
                      onClick={() => { if(!editData) { setReturnType("standalone"); setSelectedItems([]); setSelectedInvoice(null); } }}
                      className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${returnType === "standalone" ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'} ${editData ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      General Return
                    </button>
                    <button 
                      type="button"
                      disabled={editData}
                      onClick={() => { if(!editData) { setReturnType("invoice"); setSelectedItems([]); } }}
                      className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${returnType === "invoice" ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'} ${editData ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Against Invoice
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Product Pickers */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm space-y-6">
              {returnType === "invoice" ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-50">
                    <span className="p-1.5 bg-blue-50 text-blue-500 rounded-lg"><FaFileInvoice size={14} /></span>
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Linked Purchase Invoices</h4>
                  </div>
                  {!vendor ? (
                    <p className="text-center py-6 text-xs font-bold text-gray-400 uppercase italic">Select a supplier first to view history</p>
                  ) : loading ? (
                    <div className="flex justify-center py-6"><FaSpinner className="animate-spin text-rose-600" /></div>
                  ) : invoices.length === 0 ? (
                    <p className="text-center py-6 text-xs font-bold text-gray-400 uppercase italic">No invoiced purchase orders found</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {invoices.map(inv => (
                        <div 
                          key={inv._id}
                          onClick={() => handleSelectInvoice(inv)}
                          className={`p-4 border-2 rounded-xl transition-all cursor-pointer flex flex-col justify-between h-28 ${selectedInvoice?._id === inv._id ? 'border-rose-600 bg-rose-50/50' : 'border-gray-50 hover:border-rose-200'}`}
                        >
                          <p className="text-[10px] font-black text-gray-400 uppercase flex justify-between leading-none">
                            {inv.invoiceId || inv.orderId}
                            <span className="text-rose-600">{formatDate(inv.createdAt)}</span>
                          </p>
                          <p className="text-lg font-black text-gray-900 mt-2 tracking-tighter italic">₹{(inv.grandTotal || 0).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-50">
                    <span className="p-1.5 bg-orange-50 text-orange-500 rounded-lg"><FaSearch size={14} /></span>
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Product Search & Return</h4>
                  </div>
                  <div className="relative" ref={productDropdownRef}>
                    <label className={labelClass}>Select Materials</label>
                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md px-4 py-2 focus-within:border-rose-500 focus-within:bg-white transition-all shadow-sm">
                      <FaSearch className="text-gray-300 mr-3" size={14} />
                      <input 
                        type="text"
                        className="flex-1 bg-transparent outline-none text-sm font-bold placeholder:text-gray-300"
                        placeholder="Search items to return to supplier..."
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
                            className="px-6 py-4 hover:bg-rose-50 cursor-pointer border-b last:border-0 flex justify-between items-center group transition-colors"
                          >
                            <div>
                              <p className="text-sm font-black text-gray-800 group-hover:text-rose-600 transition-colors uppercase tracking-tight">{p.name}</p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 italic tracking-widest">Rate: ₹{p.purchasePrice} | stock: {p.totalQty}</p>
                            </div>
                            <div className="bg-gray-100 p-2 rounded-lg group-hover:bg-rose-600 group-hover:text-white transition-all shadow-sm">
                              <FaPlus size={10} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Return Worksheet */}
            {selectedItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeIn">
                <div className="bg-gray-50/50 px-8 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><FaLayerGroup size={14} /></span>
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Material Return Worksheet</h4>
                  </div>
                  <span className="text-[10px] font-black text-rose-600 uppercase bg-rose-50 px-3 py-1 rounded-full italic tracking-widest">{selectedItems.length} ITEMS SELECTED</span>
                </div>
                
                <div className="divide-y divide-gray-50">
                  {selectedItems.map(item => (
                    <div key={item.productId || item._id} className="p-8 hover:bg-rose-50/20 transition-colors group/row">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <p className="text-base font-black text-gray-900 mb-1 uppercase tracking-tight leading-none italic">{item.name}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded tracking-tighter italic uppercase">Unit ID: {item.productId?.slice(-6) || '-'}</span>
                            {returnType === "invoice" && (
                              <span className="text-[10px] font-black text-rose-600 bg-rose-50/50 px-2 py-0.5 rounded uppercase tracking-tighter italic">Sold Qty: {item.maxQty}</span>
                            )}
                          </div>
                        </div>
                        <button type="button" onClick={() => removeItem(item.productId || item._id)} className="p-2 text-rose-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all active:scale-90">
                          <FaTrashAlt size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                          <label className={labelClass}>Return Qty</label>
                          <input 
                            type="number"
                            className={`${inputClass} text-center`}
                            value={item.returnQty || item.qty}
                            onChange={(e) => handleFieldChange(item.productId || item._id, 'qty', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Cost Rate (₹)</label>
                          <input 
                            type="number"
                            disabled={returnType === "invoice"}
                            className={`${inputClass} ${returnType === "invoice" ? 'bg-gray-100 text-gray-400' : 'text-right'}`}
                            value={item.purchasePrice}
                            onChange={(e) => handleFieldChange(item.productId || item._id, 'purchasePrice', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Disc %</label>
                          <input 
                            type="number"
                            disabled={returnType === "invoice"}
                            className={`${inputClass} text-center ${returnType === "invoice" ? 'bg-gray-100 text-gray-400' : ''}`}
                            value={item.discountPercent || 0}
                            onChange={(e) => handleFieldChange(item.productId || item._id, 'discountPercent', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>GST %</label>
                          <input 
                            type="number"
                            disabled={returnType === "invoice"}
                            className={`${inputClass} text-center ${returnType === "invoice" ? 'bg-gray-100 text-gray-400' : ''}`}
                            value={item.gst}
                            onChange={(e) => handleFieldChange(item.productId || item._id, 'gst', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Debit Value</label>
                          <div className={inputClass + " bg-rose-50 border-rose-100 flex items-center justify-end font-black italic text-rose-700"}>
                            ₹{((item.returnQty || item.qty) * item.purchasePrice * (1 - (item.discountPercent || 0)/100) * (1 + item.gst/100)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Totals & Footer */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm space-y-6 sticky top-28">
              <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest border-b border-gray-50 pb-4">Accounting Summary</h4>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-500 uppercase tracking-tight">Return Subtotal</span>
                  <span className="font-black text-gray-900 italic">₹{totals.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-500 uppercase tracking-tight">Tax Adjusted</span>
                  <span className="font-black text-gray-900 italic">₹{totals.tax.toLocaleString()}</span>
                </div>
                <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-xs font-black text-rose-600 uppercase italic tracking-widest">Debit Amount</span>
                  <span className="text-3xl font-black text-rose-600 tracking-tighter italic">₹{totals.grandTotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-3xl space-y-4 border-2 border-gray-100">
                <div>
                  <label className={labelClass}>Reason for Adjustment</label>
                  <textarea 
                    className={inputClass + " h-28 resize-none shadow-inner border-gray-100 bg-white italic"}
                    placeholder="Briefly explain the reason for material return..."
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  />
                </div>
              </div>

              <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl animate-pulse">
                <p className="text-[9px] font-black text-rose-400 uppercase tracking-[0.2em] mb-1 italic text-center underline">Auto Ledger Posting</p>
                <p className="text-[10px] font-black text-rose-800 uppercase text-center italic tracking-tight">
                  Reducing Vendor Credit Liability & Deducting Stock Qty
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER ACTION BAR - Sticky */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-8 py-6 flex items-center justify-center gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="max-w-7xl w-full flex items-center justify-between gap-6">
          <div className="hidden md:block">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest italic opacity-60">Verification required: Ensure item quantity matches physical stock returned.</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 md:flex-none px-12 py-4 border-2 border-gray-100 text-gray-400 font-black rounded-2xl hover:bg-gray-50 transition-all uppercase tracking-widest text-xs active:scale-95"
            >
              Discard
            </button>
            <button
              disabled={submitting}
              onClick={handleSubmit}
              className={`flex-1 md:flex-none px-20 py-4 font-black rounded-2xl text-white shadow-xl transition-all uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-4 ${submitting ? 'bg-gray-300 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700 active:scale-95 hover:-translate-y-1 shadow-rose-100 italic'}`}
            >
              {submitting ? (
                <><FaSpinner className="animate-spin" size={16} /> UPDATING...</>
              ) : (
                <><FaCheckCircle size={16} /> {editData ? "UPDATE DEBIT NOTE" : "CONFIRM RETURN"}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierDebitNoteModal;
