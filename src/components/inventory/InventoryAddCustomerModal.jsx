import { useEffect, useState } from "react";
import { FaBuilding, FaChevronRight, FaCloudUploadAlt, FaIdCard, FaMapMarkedAlt, FaPhoneAlt, FaTimes, FaWallet } from "react-icons/fa";
import { API_BASE, fetchWithAuth } from "../../api";
import FilterableCheckboxList from "../FilterableCheckboxList";
import FilterableSelect from "../FilterableSelect";

const InventoryAddCustomerModal = ({ isOpen, onClose, onSave, salesOwners = [], customerCategories = [], customerGroups = [], branchId, editingItem, user }) => {
  const [customer, setCustomer] = useState({
    _id: null,
    name: "",
    customerCategories: [],
    customerGroups: [],
    whatsapp: "",
    email: "",
    address: "",
    district: "",
    state: "",
    country: "",
    pincode: "",
    stateCode: "33",
    registrationType: "regular",
    gstin: "",
    salesOwner: "",
    margin: 0,
    credit: 0,
    debit: 0,
    accountHolder: "",
    accountNumber: "",
    ifsc: "",
    branch: "",
    upi: "",
    creditLimit: 200000,
    creditLimitDays: 0,
    openingBalance: 0, // 🔒 Fixed March 31st Balance
    riskStatus: "safe_zone",
  });

  const [isSafeMode, setIsSafeMode] = useState(false);
  const [isFetchingGst, setIsFetchingGst] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);

  // Pre-fill form when editing
  useEffect(() => {
    if (editingItem) {
      setCustomer({
        _id: editingItem._id || null,
        name: editingItem.name || "",
        customerCategories: Array.isArray(editingItem.customerCategories) 
          ? editingItem.customerCategories.map(c => typeof c === 'object' ? c._id : c) 
          : (editingItem.customerCategory ? [typeof editingItem.customerCategory === 'object' ? editingItem.customerCategory._id : editingItem.customerCategory] : []),
        customerGroups: Array.isArray(editingItem.customerGroups) 
          ? editingItem.customerGroups.map(g => typeof g === 'object' ? g._id : g) 
          : (editingItem.customerGroup ? [typeof editingItem.customerGroup === 'object' ? editingItem.customerGroup._id : editingItem.customerGroup] : []),
        whatsapp: editingItem.whatsapp || "",
        email: editingItem.email || "",
        address: editingItem.address || "",
        district: editingItem.district || "",
        state: editingItem.state || "",
        country: editingItem.country || "",
        pincode: editingItem.pincode || "",
        stateCode: editingItem.stateCode || "33",
        registrationType: editingItem.registrationType || "regular",
        gstin: editingItem.gstin || "",
        salesOwner: typeof editingItem.salesOwner === 'object' ? editingItem.salesOwner._id : (editingItem.salesOwner || ""),
        margin: editingItem.margin || 0,
        credit: editingItem.credit || 0,
        debit: editingItem.debit || 0,
        accountHolder: editingItem.accountHolder || "",
        accountNumber: editingItem.accountNumber || "",
        ifsc: editingItem.ifsc || "",
        branch: editingItem.branch || "",
        upi: editingItem.upi || "",
        creditLimit: editingItem.creditLimit !== undefined ? editingItem.creditLimit : 200000,
        creditLimitDays: editingItem.creditLimitDays !== undefined ? editingItem.creditLimitDays : 0,
        openingBalance: editingItem.openingBalance || 0,
        riskStatus: editingItem.riskStatus || "safe_zone",
      });
    } else {
      setCustomer({
        name: "",
        customerCategories: [],
        customerGroups: [],
        whatsapp: "",
        email: "",
        address: "",
        district: "",
        state: "",
        country: "",
        pincode: "",
        stateCode: "33",
        registrationType: "regular",
        gstin: "",
        salesOwner: "",
        margin: 0,
        credit: 0,
        debit: 0,
        accountHolder: "",
        accountNumber: "",
        ifsc: "",
        branch: "",
        upi: "",
        creditLimit: 200000,
        creditLimitDays: 0,
        openingBalance: 0,
        riskStatus: "safe_zone",
      });
    }
  }, [editingItem]);

  if (!isOpen) return null;

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("branchId", branchId);
    formData.append("updateMode", isSafeMode ? "info_only" : "opening_balance");

    try {
      const res = await fetchWithAuth(`${API_BASE}/customers/bulk-upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Bulk upload failed");
      }

      setUploadResults({
        inserted: data.insertedCount || 0,
        updated: data.updatedCount || 0,
        skipped: data.skippedCount || 0,
        skippedDetails: data.skipped || []
      });
    } catch (err) {
      console.error("Customer bulk upload error:", err);
      alert(err.message || "Bulk upload failed");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const roundedCustomer = {
      ...customer,
      credit: Math.round(Number(customer.credit || 0)),
      debit: Math.round(Number(customer.debit || 0)),
      margin: Math.round(Number(customer.margin || 0) * 100) / 100,
    };
    
    console.log("📝 CUSTOMER FORM DATA BEING SENT:");
    console.log("Name:", roundedCustomer.name);
    console.log("State:", roundedCustomer.state);
    console.log("State Code:", roundedCustomer.stateCode);
    console.log("Pincode:", roundedCustomer.pincode);
    console.log("Full Data:", roundedCustomer);
    console.log("");
    
    await onSave(roundedCustomer);
    onClose();
  };

  const handleFetchGstDetails = async () => {
    if (!customer.gstin || customer.gstin.length !== 15) {
      alert("Please enter a valid 15-character GSTIN");
      return;
    }

    setIsFetchingGst(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/gst/search/${customer.gstin}`);
      const result = await res.json();

      if (!res.ok) throw new Error(result.message || "Failed to fetch GST details");

      if (result.success && result.data) {
        const { legalName, address, state, pincode, district } = result.data;
        setCustomer(prev => ({
          ...prev,
          name: legalName || prev.name,
          address: address || prev.address,
          state: state || prev.state,
          pincode: pincode || prev.pincode,
          district: district || prev.district || "",
          registrationType: "regular"
        }));
      }
    } catch (err) {
      console.error("GST Fetch Error:", err);
      alert(err.message || "Error fetching GST details");
    } finally {
      setIsFetchingGst(false);
    }
  };

  const labelClass = "text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block";
  const inputClass = "w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl outline-primary focus:ring-2 focus:ring-primary/20 focus:bg-white focus:border-primary transition-all duration-200 text-sm font-semibold text-gray-800 placeholder:text-gray-300";

  // RESULTS VIEW AFTER UPLOAD
  if (uploadResults) {
    return (
      <div className="fixed inset-0 bg-[#f8fafc] z-[160] flex flex-col p-6 overflow-y-auto animate-in zoom-in-95 duration-300">
        <div className="max-w-3xl mx-auto w-full space-y-8 pb-20">
          
          <div className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-100 text-center">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <FaCloudUploadAlt className="text-4xl" />
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Bulk Upload Summary</h2>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-2">Data Processed Successfully</p>
            
            <div className="grid grid-cols-3 gap-4 mt-10">
              <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100">
                <p className="text-3xl font-black text-green-700">{uploadResults.inserted}</p>
                <p className="text-[10px] font-bold text-green-600 uppercase mt-1">Inserted</p>
              </div>
              <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                <p className="text-3xl font-black text-blue-700">{uploadResults.updated}</p>
                <p className="text-[10px] font-bold text-blue-600 uppercase mt-1">Updated</p>
              </div>
              <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100">
                <p className="text-3xl font-black text-orange-700">{uploadResults.skipped}</p>
                <p className="text-[10px] font-bold text-orange-600 uppercase mt-1">Skipped</p>
              </div>
            </div>
          </div>

          {uploadResults.skipped > 0 && (
            <div className="bg-white rounded-3xl shadow-xl border border-red-100 overflow-hidden">
              <div className="bg-red-50 px-8 py-4 border-b border-red-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-red-600 font-black">⚠️</span>
                  <p className="text-red-700 font-black text-sm uppercase tracking-wider">Missing Customers Detail</p>
                </div>
                <span className="px-3 py-1 bg-white text-red-600 rounded-full text-[10px] font-black">{uploadResults.skipped} FOUND</span>
              </div>
              
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-8 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Customer Identity</th>
                      <th className="px-8 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Failure Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {uploadResults.skippedDetails.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-8 py-4">
                          <p className="text-sm font-black text-gray-800">
                            {item.row?.CustomerName || item.row?.Name || item.row?.DebtorName || `Unknown (Row ${idx + 2})`}
                          </p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">{item.row?.WhatsApp || "No Phone"}</p>
                        </td>
                        <td className="px-8 py-4">
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-100 rounded-full">
                            <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></span>
                            <span className="text-[10px] text-red-600 font-black uppercase tracking-tighter">{item.reason}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button 
              onClick={() => {
                setUploadResults(null);
                onClose();
                // To allow immediate re-upload if needed, we might want to refresh the parent
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="flex-1 bg-gray-900 text-white p-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-gray-200 hover:-translate-y-1 transition-all active:scale-95"
            >
              Finish & Refresh Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#f8fafc] z-[150] flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-300">
      
      {/* HEADER SECTION --- Sticky */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <FaBuilding className="text-xl text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight">
              {editingItem ? "Edit Customer Details" : "Register New Customer"}
            </h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Customer Relationship Management</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-3 bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200 group active:scale-95 shadow-sm border border-gray-100"
        >
          <FaTimes className="text-xl group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* MAIN CONTENT --- Full Screen Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT SIDE: PRIMARY INFO & CONFIG */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* BULK UPLOAD INTEGRATION */}
            <div className="bg-white rounded-3xl p-1 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <input
                type="file"
                accept=".xlsx,.xls"
                hidden
                id="customerBulkUpload"
                onChange={handleBulkUpload}
              />
              
              {/* Safe Mode Toggle */}
              <div className="px-8 pt-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSafeMode ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                    <FaCloudUploadAlt size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Safe Mode</p>
                    <p className="text-[9px] font-bold text-gray-500 uppercase mt-0.5">Info-Only (Safe)</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSafeMode(!isSafeMode);
                  }}
                  className={`w-12 h-6 rounded-full transition-all relative ${isSafeMode ? 'bg-emerald-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isSafeMode ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              <div 
                onClick={() => {
                  if (!isSafeMode) {
                    const confirmBal = window.confirm("⚠️ You are in BALANCING MODE. This will adjust Debit/Credit balances. Enable SAFE MODE for info-only updates. Proceed?");
                    if (!confirmBal) return;
                  }
                  document.getElementById("customerBulkUpload").click();
                }}
                className="group flex flex-col md:flex-row items-center gap-6 p-8 cursor-pointer rounded-2xl relative overflow-hidden transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="bg-green-100 p-6 rounded-2xl text-green-600 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner z-10">
                  <FaCloudUploadAlt className="text-4xl" />
                </div>
                
                <div className="flex-1 text-center md:text-left z-10">
                  <h4 className="text-green-800 font-black text-xl leading-tight">Fast-Track Bulk Upload</h4>
                  <p className="text-green-600/70 text-sm mt-1 font-medium">Instantly add hundreds of customers via Excel (.xlsx, .xls)</p>
                  
                  <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                    {['Name', 'WhatsApp', 'Email', 'Address', 'Pincode', 'State Code', 'GSTIN', 'Margin', 'Debit'].map(tag => (
                      <span key={tag} className="px-3 py-1 bg-white/80 border border-green-100 text-green-700 rounded-lg text-[10px] font-bold shadow-sm">{tag}</span>
                    ))}
                  </div>
                </div>
                <FaChevronRight className="hidden md:block text-2xl text-green-300 group-hover:text-green-500 group-hover:translate-x-2 transition-all duration-300 z-10" />
              </div>
            </div>

            {/* MAIN FORM */}
            <form onSubmit={handleSubmit} id="customerForm" className="space-y-8">
              
              {/* SECTION: BASIC IDENTITY */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-50">
                  <span className="p-2 bg-blue-50 text-blue-500 rounded-lg"><FaIdCard size={18} /></span>
                  <h4 className="text-gray-900 font-black text-lg tracking-tight uppercase">Basic Identity</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Full Customer Name / Legal Identity *</label>
                    <input
                      type="text"
                      required
                      className={inputClass}
                      placeholder="e.g., Jane Cooper or Acme Corp"
                      value={customer.name}
                      onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Customer Categories</label>
                    {Array.isArray(customerCategories) && customerCategories.length > 0 ? (
                      <FilterableCheckboxList
                        options={customerCategories}
                        selectedIds={customer.customerCategories}
                        onChange={(selectedIds) => setCustomer({ ...customer, customerCategories: selectedIds })}
                        placeholder="Search categories..."
                      />
                    ) : (
                      <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm italic">
                        No categories found
                      </div>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>Customer Groups</label>
                    {Array.isArray(customerGroups) && customerGroups.length > 0 ? (
                      <FilterableCheckboxList
                        options={customerGroups}
                        selectedIds={customer.customerGroups}
                        onChange={(selectedIds) => setCustomer({ ...customer, customerGroups: selectedIds })}
                        placeholder="Search groups..."
                      />
                    ) : (
                      <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm italic">
                        No groups found
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION: CONTACT & LOCATION */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* CONTACT */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 pb-2">
                      <span className="p-2 bg-purple-50 text-purple-500 rounded-lg"><FaPhoneAlt size={16} /></span>
                      <h4 className="text-gray-900 font-black text-sm tracking-widest uppercase">Connectivity</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className={labelClass}>WhatsApp Number *</label>
                        <input
                          type="tel"
                          required
                          className={inputClass}
                          placeholder="+91 XXXXX XXXXX"
                          value={customer.whatsapp}
                          onChange={(e) => setCustomer({ ...customer, whatsapp: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Email Address</label>
                        <input
                          type="email"
                          className={inputClass}
                          placeholder="client@example.com"
                          value={customer.email}
                          onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ADDRESS */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 pb-2">
                      <span className="p-2 bg-orange-50 text-orange-500 rounded-lg"><FaMapMarkedAlt size={16} /></span>
                      <h4 className="text-gray-900 font-black text-sm tracking-widest uppercase">Physical Address</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className={labelClass}>Street Address / Area</label>
                        <textarea
                          className={`${inputClass} h-[132px] resize-none`}
                          placeholder="Plot No. 123, Industry Zone..."
                          value={customer.address}
                          onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ADDRESS METADATA */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>District</label>
                    <input type="text" className={inputClass} value={customer.district} onChange={(e) => setCustomer({ ...customer, district: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>State</label>
                    <input type="text" className={inputClass} value={customer.state} onChange={(e) => setCustomer({ ...customer, state: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Pincode</label>
                    <input type="text" className={inputClass} value={customer.pincode} onChange={(e) => setCustomer({ ...customer, pincode: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>State Code *</label>
                    <input type="text" className={inputClass} placeholder="e.g. 33, 32, 29, 27" value={customer.stateCode} onChange={(e) => setCustomer({ ...customer, stateCode: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Country</label>
                    <input type="text" className={inputClass} value={customer.country} onChange={(e) => setCustomer({ ...customer, country: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* SECTION: FINANCIAL & TAX */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-50">
                  <span className="p-2 bg-green-50 text-green-500 rounded-lg"><FaWallet size={18} /></span>
                  <h4 className="text-gray-900 font-black text-lg tracking-tight uppercase">Tax & Financials</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Registration Type</label>
                    <select
                      className={inputClass}
                      value={customer.registrationType}
                      onChange={(e) => setCustomer({ ...customer, registrationType: e.target.value })}
                    >
                      <option value="regular">Regular / GST Registered</option>
                      <option value="unregistered">Unregistered</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>GSTIN (15 Digits)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className={`${inputClass} flex-1`}
                        placeholder="e.g., 27AABCD1234H1Z0"
                        value={customer.gstin}
                        onChange={(e) => setCustomer({ ...customer, gstin: e.target.value.toUpperCase() })}
                      />
                      <button
                        type="button"
                        onClick={handleFetchGstDetails}
                        disabled={isFetchingGst || !customer.gstin}
                        className={`px-4 rounded-xl font-bold text-[10px] uppercase transition-all shadow-sm flex items-center gap-2 ${
                          isFetchingGst ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-orange-500 text-white hover:bg-orange-600 active:scale-95 shadow-orange-200"
                        }`}
                      >
                        {isFetchingGst ? "..." : "🔍 Auto-Fill"}
                      </button>
                    </div>
                  </div>
                </div>

                {user?.role === "SUPER_ADMIN" && (
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-4 border-t border-gray-50">
                    <div>
                      <label className={labelClass}>Zone</label>
                      <select
                        className={inputClass}
                        value={customer.riskStatus}
                        onChange={(e) => setCustomer({ ...customer, riskStatus: e.target.value })}
                      >
                        <option value="safe_zone">Safe Zone</option>
                        <option value="medium_zone">Medium Zone</option>
                        <option value="risk_zone">Risk Zone</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Default Margin (%)</label>
                      <input type="number" step="0.01" className={inputClass} value={customer.margin} onChange={(e) => setCustomer({ ...customer, margin: e.target.value })} />
                    </div>
                    <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
                      <label className={`${labelClass} !text-blue-600`}>🔒 Fixed 31st Mar Bal</label>
                      <input 
                          type="number" 
                          className={`${inputClass} !bg-white !p-2 !h-10`} 
                          value={customer.openingBalance} 
                          onChange={(e) => setCustomer({ ...customer, openingBalance: e.target.value })} 
                      />
                      <p className="text-[8px] text-blue-400 font-bold mt-1 leading-none uppercase">Static Vault</p>
                    </div>
                    <div>
                      <label className={labelClass}>Total Debit</label>
                      <input type="number" className={`${inputClass} !p-2 !h-10`} value={customer.debit} onChange={(e) => setCustomer({ ...customer, debit: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>Total Credit</label>
                      <input type="number" className={`${inputClass} !p-2 !h-10`} value={customer.credit} onChange={(e) => setCustomer({ ...customer, credit: e.target.value })} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-50">
                  <div>
                    <label className={labelClass}>Credit Limit (₹)</label>
                    <input 
                      type="number" 
                      className={`${inputClass} !bg-indigo-50/50 !border-indigo-100 focus:!border-indigo-500`} 
                      placeholder="Default: 200,000"
                      value={customer.creditLimit} 
                      onChange={(e) => setCustomer({ ...customer, creditLimit: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Credit Limit Days</label>
                    <input 
                      type="number" 
                      className={`${inputClass} !bg-indigo-50/50 !border-indigo-100 focus:!border-indigo-500`} 
                      placeholder="e.g., 30"
                      value={customer.creditLimitDays} 
                      onChange={(e) => setCustomer({ ...customer, creditLimitDays: e.target.value })} 
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* RIGHT SIDE: SETTINGS & OWNER --- Sticky */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-6 sticky top-28">
              <h4 className="text-gray-900 font-black text-lg tracking-tight uppercase border-b border-gray-50 pb-4">Assignment</h4>
              
              <div>
                <label className={labelClass}>Sales Relationship Manager</label>
                <FilterableSelect
                  options={salesOwners.map(owner => ({
                    _id: owner._id,
                    name: `${owner.name} (${owner.phone})`
                  }))}
                  value={customer.salesOwner}
                  onChange={(value) => setCustomer({ ...customer, salesOwner: value })}
                  placeholder="Select Sales Owner"
                  className={inputClass}
                />
              </div>

              <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 space-y-6">
                <h5 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Bank Details (Optional)</h5>
                
                <div className="space-y-4">
                  <input type="text" className={inputClass} placeholder="Account Holder Name" value={customer.accountHolder} onChange={(e) => setCustomer({ ...customer, accountHolder: e.target.value })} />
                  <input type="text" className={inputClass} placeholder="Account Number" value={customer.accountNumber} onChange={(e) => setCustomer({ ...customer, accountNumber: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" className={`${inputClass} uppercase`} placeholder="IFSC" value={customer.ifsc} onChange={(e) => setCustomer({ ...customer, ifsc: e.target.value })} />
                    <input type="text" className={inputClass} placeholder="Branch" value={customer.branch} onChange={(e) => setCustomer({ ...customer, branch: e.target.value })} />
                  </div>
                  <input type="text" className={inputClass} placeholder="UPI ID (optional)" value={customer.upi} onChange={(e) => setCustomer({ ...customer, upi: e.target.value })} />
                </div>
              </div>
              
              <div className="bg-blue-600 rounded-2xl p-6 text-white text-center shadow-xl shadow-blue-200">
                <p className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1 shadow-sm">Registration Status</p>
                <p className="font-black text-lg">{editingItem ? "MODIFICATION MODE" : "INITIAL REGISTRATION"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER ACTION BAR --- Sticky */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-gray-100 px-8 py-6 flex items-center justify-center gap-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <div className="max-w-6xl w-full flex items-center justify-between gap-6">
          <div className="hidden md:block">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Required Fields Marked (*)</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 md:flex-none px-12 py-3 border-2 border-gray-100 text-gray-500 font-black rounded-2xl hover:bg-gray-50 hover:text-gray-700 transition-all duration-200 uppercase tracking-wider text-sm active:scale-95"
            >
              Cancel
            </button>
            <button
              form="customerForm"
              type="submit"
              className="flex-1 md:flex-none px-16 py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary/90 transition-all duration-300 shadow-xl shadow-primary/20 uppercase tracking-widest text-sm hover:-translate-y-1 active:scale-95"
            >
              {editingItem ? "Update Record" : "Register Customer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryAddCustomerModal;
