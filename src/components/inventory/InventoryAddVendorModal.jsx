import { useEffect, useState } from "react";
import { FaTimes, FaHandshake, FaPhoneAlt, FaMapMarkedAlt, FaFileAlt, FaWallet, FaCloudUploadAlt } from "react-icons/fa";
import { API_BASE, fetchWithAuth } from "../../api";

const InventoryAddVendorModal = ({ isOpen, onClose, onSave, branchId: propBranchId, editingItem, user }) => {
  const getBranchId = () => {
    if (propBranchId) return propBranchId;
    const user = localStorage.getItem("user");
    if (user) {
      try { const d = JSON.parse(user); if (d.branchId) return d.branchId; } catch {}
    }
    const cb = localStorage.getItem("currentBranch");
    if (cb) {
      try { const d = JSON.parse(cb); return d._id || d.id; } catch {}
    }
    return null;
  };

  const actualBranchId = getBranchId();

  const emptyVendor = {
    _id: null, name: "", phone: "", email: "",
    address: "", stateName: "", gstRegistrationType: "Regular",
    gstin: "", debit: 0, credit: 0, openingBalance: 0,
  };

  const [vendor, setVendor] = useState(emptyVendor);
  const [isFetchingGst, setIsFetchingGst] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setVendor({
        _id: editingItem._id || null,
        name: editingItem.name || "",
        phone: editingItem.phone || "",
        email: editingItem.email || "",
        address: editingItem.address || "",
        stateName: editingItem.stateName || "",
        gstRegistrationType: editingItem.gstRegistrationType || "Regular",
        gstin: editingItem.gstin || "",
        debit: editingItem.debit || 0,
        credit: editingItem.credit || 0,
        openingBalance: editingItem.openingBalance || 0,
      });
    } else {
      setVendor(emptyVendor);
    }
  }, [editingItem]);

  if (!isOpen) return null;

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!actualBranchId) { alert("❌ Branch ID is missing. Please login again."); return; }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("branchId", actualBranchId);
    try {
      const res = await fetchWithAuth(`${API_BASE}/vendors/bulk-upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Bulk upload failed");
      alert(`✅ Uploaded: ${data.insertedCount}\nSkipped: ${data.skippedCount}`);
      onClose();
    } catch (err) {
      alert(err.message || "Bulk upload failed");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ 
      ...vendor, 
      credit: Math.round(Number(vendor.credit || 0)), 
      debit: Math.round(Number(vendor.debit || 0)),
      openingBalance: Math.round(Number(vendor.openingBalance || 0))
    });
    setVendor(emptyVendor);
    onClose();
  };

  const handleFetchGstDetails = async () => {
    if (!vendor.gstin || vendor.gstin.length !== 15) { alert("Please enter a valid 15-character GSTIN"); return; }
    setIsFetchingGst(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/gst/search/${vendor.gstin}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed to fetch GST details");
      if (result.success && result.data) {
        const { legalName, address, state } = result.data;
        setVendor(prev => ({ ...prev, name: legalName || prev.name, address: address || prev.address, stateName: state || prev.stateName, gstRegistrationType: "Regular" }));
      }
    } catch (err) {
      alert(err.message || "Error fetching GST details");
    } finally {
      setIsFetchingGst(false);
    }
  };

  const lc = "text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block";
  const ic = "w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl outline-primary focus:ring-2 focus:ring-primary/20 focus:bg-white focus:border-primary transition-all duration-200 text-sm font-semibold text-gray-800 placeholder:text-gray-300";

  return (
    <div className="fixed inset-0 bg-[#f8fafc] z-[150] flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-300">

      {/* STICKY HEADER */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <FaHandshake className="text-xl text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight">
              {editingItem ? "Edit Vendor Details" : "Register New Vendor"}
            </h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Supplier & Procurement Management</p>
          </div>
        </div>
        <button onClick={onClose} className="p-3 bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200 group active:scale-95 shadow-sm border border-gray-100">
          <FaTimes className="text-xl group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* BULK UPLOAD */}
          <div className="bg-white rounded-3xl p-1 shadow-sm border border-gray-100">
            <input type="file" accept=".xlsx,.xls" hidden id="vendorBulkUpload" onChange={handleBulkUpload} />
            <div
              onClick={() => document.getElementById("vendorBulkUpload").click()}
              className="group flex flex-col md:flex-row items-center gap-6 p-6 cursor-pointer rounded-2xl relative overflow-hidden transition-all duration-300 hover:bg-green-50/50"
            >
              <div className="bg-green-100 p-5 rounded-2xl text-green-600 group-hover:scale-110 transition-all duration-500 shadow-inner">
                <FaCloudUploadAlt className="text-3xl" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h4 className="text-green-800 font-black text-lg">Fast-Track Bulk Upload</h4>
                <p className="text-green-600/70 text-sm mt-1 font-medium">Instantly add hundreds of vendors via Excel (.xlsx, .xls)</p>
                <div className="mt-3 flex flex-wrap gap-2 justify-center md:justify-start">
                  {['Name', 'Phone', 'Email', 'Address', 'GSTIN', 'Credit', 'Debit'].map(tag => (
                    <span key={tag} className="px-3 py-1 bg-white/80 border border-green-100 text-green-700 rounded-lg text-[10px] font-bold shadow-sm">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* MAIN FORM */}
          <form onSubmit={handleSubmit} id="vendorForm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* LEFT: Identity + Contact */}
              <div className="space-y-6">

                {/* Basic Identity */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-50">
                    <span className="p-2 bg-blue-50 text-blue-500 rounded-lg"><FaHandshake size={16} /></span>
                    <h4 className="text-gray-900 font-black text-sm tracking-widest uppercase">Vendor Identity</h4>
                  </div>
                  <div>
                    <label className={lc}>Vendor / Company Name *</label>
                    <input type="text" required className={ic} placeholder="e.g., 3F Industries Limited"
                      value={vendor.name} onChange={(e) => setVendor({ ...vendor, name: e.target.value })} />
                  </div>
                </div>

                {/* Contact */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-50">
                    <span className="p-2 bg-purple-50 text-purple-500 rounded-lg"><FaPhoneAlt size={14} /></span>
                    <h4 className="text-gray-900 font-black text-sm tracking-widest uppercase">Contact Details</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className={lc}>Phone Number</label>
                      <input type="tel" className={ic} placeholder="+91 XXXXX XXXXX"
                        value={vendor.phone} onChange={(e) => setVendor({ ...vendor, phone: e.target.value })} />
                    </div>
                    <div>
                      <label className={lc}>Email Address</label>
                      <input type="email" className={ic} placeholder="contact@vendor.com"
                        value={vendor.email} onChange={(e) => setVendor({ ...vendor, email: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-50">
                    <span className="p-2 bg-orange-50 text-orange-500 rounded-lg"><FaMapMarkedAlt size={14} /></span>
                    <h4 className="text-gray-900 font-black text-sm tracking-widest uppercase">Address</h4>
                  </div>
                  <div>
                    <label className={lc}>Street Address / Area</label>
                    <textarea className={`${ic} h-24 resize-none`} placeholder="Plot No. 123, Industrial Zone..."
                      value={vendor.address} onChange={(e) => setVendor({ ...vendor, address: e.target.value })} />
                  </div>
                  <div>
                    <label className={lc}>State</label>
                    <input type="text" className={ic} placeholder="e.g., Tamil Nadu"
                      value={vendor.stateName} onChange={(e) => setVendor({ ...vendor, stateName: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* RIGHT: GST + Financials */}
              <div className="space-y-6">

                {/* Tax & Registration */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-50">
                    <span className="p-2 bg-green-50 text-green-500 rounded-lg"><FaFileAlt size={14} /></span>
                    <h4 className="text-gray-900 font-black text-sm tracking-widest uppercase">Tax & Registration</h4>
                  </div>
                  <div>
                    <label className={lc}>GST Registration Type</label>
                    <select className={ic} value={vendor.gstRegistrationType}
                      onChange={(e) => setVendor({ ...vendor, gstRegistrationType: e.target.value })}>
                      <option value="Regular">Regular</option>
                      <option value="Unregistered/Consumer">Unregistered / Consumer</option>
                    </select>
                  </div>
                  <div>
                    <label className={lc}>GSTIN (15 Digits)</label>
                    <div className="flex gap-2">
                      <input type="text" className={`${ic} flex-1 uppercase`} placeholder="e.g., 33AAACF2643K1ZU"
                        value={vendor.gstin} onChange={(e) => setVendor({ ...vendor, gstin: e.target.value.toUpperCase() })} />
                      <button type="button" onClick={handleFetchGstDetails}
                        disabled={isFetchingGst || !vendor.gstin}
                        className={`px-4 rounded-xl font-bold text-[10px] uppercase transition-all shadow-sm flex items-center gap-2 ${isFetchingGst ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-orange-500 text-white hover:bg-orange-600 active:scale-95 shadow-orange-200"}`}>
                        {isFetchingGst ? "..." : "🔍 Auto-Fill"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Account Details */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-50">
                    <span className="p-2 bg-teal-50 text-teal-500 rounded-lg"><FaWallet size={14} /></span>
                    <h4 className="text-gray-900 font-black text-sm tracking-widest uppercase">Financial Setup</h4>
                  </div>
                  
                  {user?.role === "SUPER_ADMIN" && (
                    <div className="space-y-5">
                      <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                        <label className={`${lc} !text-blue-600`}>🔒 Fixed 31st Mar Bal (Opening)</label>
                        <input type="number" step="0.01" className={`${ic} !bg-white !h-10`} placeholder="e.g., 5000.00"
                          value={vendor.openingBalance} onChange={(e) => setVendor({ ...vendor, openingBalance: parseFloat(e.target.value) || 0 })} />
                        <p className="text-[8px] text-blue-400 font-bold mt-1 uppercase tracking-tighter">Static Vault Snapshot</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                        <div>
                          <label className={lc}>Current Debit (₹)</label>
                          <input type="number" step="0.01" className={ic} placeholder="0.00"
                            value={vendor.debit} onChange={(e) => setVendor({ ...vendor, debit: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                          <label className={lc}>Current Credit (₹)</label>
                          <input type="number" step="0.01" className={ic} placeholder="0.00"
                            value={vendor.credit} onChange={(e) => setVendor({ ...vendor, credit: parseFloat(e.target.value) || 0 })} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="bg-blue-600 rounded-2xl p-6 text-white text-center shadow-xl shadow-blue-200">
                  <p className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">Registration Status</p>
                  <p className="font-black text-lg">{editingItem ? "MODIFICATION MODE" : "INITIAL REGISTRATION"}</p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* STICKY FOOTER */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-gray-100 px-8 py-5 flex items-center justify-center gap-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <div className="max-w-4xl w-full flex items-center justify-between gap-6">
          <p className="hidden md:block text-xs font-bold text-gray-400 uppercase tracking-tighter">* Required Fields</p>
          <div className="flex gap-4 w-full md:w-auto">
            <button type="button" onClick={onClose}
              className="flex-1 md:flex-none px-10 py-3 border-2 border-gray-100 text-gray-500 font-black rounded-2xl hover:bg-gray-50 hover:text-gray-700 transition-all uppercase tracking-wider text-sm active:scale-95">
              Cancel
            </button>
            <button form="vendorForm" type="submit"
              className="flex-1 md:flex-none px-14 py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary/90 transition-all duration-300 shadow-xl shadow-primary/20 uppercase tracking-widest text-sm hover:-translate-y-1 active:scale-95">
              {editingItem ? "Update Vendor" : "Save Vendor"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryAddVendorModal;
