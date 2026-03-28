import { useEffect, useState } from "react";
import { API_BASE } from "../../api";

const InventoryAddVendorModal = ({ isOpen, onClose, onSave, branchId: propBranchId, editingItem }) => {
  // Get branchId from props or fallback to localStorage
  const getBranchId = () => {
    if (propBranchId) return propBranchId;
    
    // Fallback to localStorage user data
    const user = localStorage.getItem("user");
    if (user) {
      try {
        const userData = JSON.parse(user);
        if (userData.branchId) return userData.branchId;
      } catch (e) {
        console.error("Failed to parse user data:", e);
      }
    }
    
    // Fallback: from currentBranch
    const currentBranch = localStorage.getItem("currentBranch");
    if (currentBranch) {
      try {
        const branchData = JSON.parse(currentBranch);
        // Check for both _id and id (localStorage might have either)
        return branchData._id || branchData.id;
      } catch (e) {
        console.error("Failed to parse currentBranch data:", e);
      }
    }
    
    return null;
  };

  const actualBranchId = getBranchId();

  const [vendor, setVendor] = useState({
    _id: null,
    name: "",
    phone: "",
    email: "",
    address: "",
    stateName: "",
    gstRegistrationType: "Regular",
    gstin: "",
    debit: 0,
    credit: 0,
  });

  const [isFetchingGst, setIsFetchingGst] = useState(false);

  // Pre-fill form when editing
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
      });
    } else {
      setVendor({
        _id: null,
        name: "",
        phone: "",
        email: "",
        address: "",
        stateName: "",
        gstRegistrationType: "Regular",
        gstin: "",
        debit: 0,
        credit: 0,
      });
    }
  }, [editingItem]);

  if (!isOpen) return null;

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!actualBranchId) {
      alert("❌ Branch ID is missing. Please login again.");
      console.error("Branch ID not available from props or localStorage");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("branchId", actualBranchId);

    try {
      const res = await fetch(`${API_BASE}/vendors/bulk-upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Bulk upload failed");
      }

      alert(
        `Uploaded: ${data.insertedCount}\nSkipped: ${data.skippedCount}`
      );

      console.log("Vendor bulk upload:", data);
      onClose();
    } catch (err) {
      console.error("Vendor bulk upload error:", err);
      alert(err.message || "Bulk upload failed");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Round numeric values
    const roundedVendor = {
      ...vendor,
      credit: Math.round(Number(vendor.credit || 0)),
      debit: Math.round(Number(vendor.debit || 0)),
    };

    // ✅ Pass _id if editing for context to handle PUT
    onSave(roundedVendor);

    // Reset form
    setVendor({
      _id: null,
      name: "",
      phone: "",
      email: "",
      address: "",
      stateName: "",
      gstRegistrationType: "Regular",
      gstin: "",
      debit: 0,
      credit: 0,
    });

    // Close modal
    onClose();
  };

  const handleFetchGstDetails = async () => {
    if (!vendor.gstin || vendor.gstin.length !== 15) {
      alert("Please enter a valid 15-character GSTIN");
      return;
    }

    setIsFetchingGst(true);
    try {
      const res = await fetch(`${API_BASE}/gst/search/${vendor.gstin}`);
      const result = await res.json();

      if (!res.ok) throw new Error(result.message || "Failed to fetch GST details");

      if (result.success && result.data) {
        const { legalName, address, state, pincode } = result.data;
        setVendor(prev => ({
          ...prev,
          name: legalName || prev.name,
          address: address || prev.address,
          stateName: state || prev.stateName,
          gstRegistrationType: "Regular"
        }));
      }
    } catch (err) {
      console.error("GST Fetch Error:", err);
      alert(err.message || "Error fetching GST details");
    } finally {
      setIsFetchingGst(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold">Register New Vendor</h3>
        </div>

        <input
          type="file"
          accept=".xlsx,.xls"
          hidden
          id="vendorBulkUpload"
          onChange={handleBulkUpload}
        />


        {/* OR Divider */}
        <div className="relative my-4 px-6">
          <div className="absolute inset-0 flex items-center px-6">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500 font-semibold uppercase">OR</span>
          </div>
        </div>

        {/* Bulk Upload Drop-zone */}
        <div className="px-6 pb-2">
          <div
            onClick={() => document.getElementById("vendorBulkUpload").click()}
            className="border-2 border-dashed border-green-500 rounded-xl p-6 text-center cursor-pointer hover:bg-green-50 transition-all group shadow-sm bg-green-50/30"
          >
            <div className="flex flex-col items-center">
              <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">📊</span>
              <p className="text-green-700 font-bold text-lg">Bulk Upload Vendors</p>
              <p className="text-xs text-gray-600 mt-1">
                Click to select Excel file (.xlsx, .xls)
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-1">
                {['Name', 'Phone', 'Email', 'Address', 'GSTIN', 'Credit', 'Debit'].map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-semibold">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>


        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* BASIC DETAILS */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-gray-600 mb-1 block">Vendor Name *</label>
              <input
                type="text"
                required
                placeholder="e.g., 3F Industries Limited"
                className="w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary"
                value={vendor.name}
                onChange={(e) => setVendor({ ...vendor, name: e.target.value })}
              />
            </div>
          </div>

          <hr />

          {/* CONTACT DETAILS */}
          <div className="space-y-4">
            <h4 className="text-primary font-bold text-sm">📞 Contact Details</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-gray-600 mb-1 block">Phone</label>
                <input
                  type="tel"
                  placeholder="e.g., 9876543210"
                  className="w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary"
                  value={vendor.phone}
                  onChange={(e) => setVendor({ ...vendor, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 mb-1 block">Email</label>
                <input
                  type="email"
                  placeholder="e.g., contact@vendor.com"
                  className="w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary"
                  value={vendor.email}
                  onChange={(e) => setVendor({ ...vendor, email: e.target.value })}
                />
              </div>
            </div>
          </div>

          <hr />

          {/* ADDRESS DETAILS */}
          <div className="space-y-4">
            <h4 className="text-primary font-bold text-sm">🏠 Address Details</h4>

            <div>
              <label className="text-sm font-bold text-gray-600 mb-1 block">Address</label>
              <textarea
                placeholder="Complete address"
                className="w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary h-16"
                value={vendor.address}
                onChange={(e) => setVendor({ ...vendor, address: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-bold text-gray-600 mb-1 block">State Name</label>
              <input
                type="text"
                placeholder="e.g., Tamil Nadu"
                className="w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary"
                value={vendor.stateName}
                onChange={(e) => setVendor({ ...vendor, stateName: e.target.value })}
              />
            </div>
          </div>

          <hr />

          {/* TAX & REGISTRATION */}
          <div className="space-y-4">
            <h4 className="text-primary font-bold text-sm">📋 Tax & Registration</h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-gray-600 mb-1 block">GST Registration Type</label>
                <select
                  className="w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary"
                  value={vendor.gstRegistrationType}
                  onChange={(e) =>
                    setVendor({ ...vendor, gstRegistrationType: e.target.value })
                  }
                >
                  <option value="Regular">Regular</option>
                  <option value="Unregistered/Consumer">Unregistered/Consumer</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 mb-1 block">GSTIN</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="E.g., 33AAACF2643K1ZU"
                    className="w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary uppercase flex-1"
                    value={vendor.gstin}
                    onChange={(e) =>
                      setVendor({ ...vendor, gstin: e.target.value.toUpperCase() })
                    }
                  />
                  <button
                    type="button"
                    onClick={handleFetchGstDetails}
                    disabled={isFetchingGst || !vendor.gstin}
                    className={`px-3 py-2 rounded-lg font-bold text-xs uppercase transition shadow-sm ${
                      isFetchingGst 
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                        : "bg-orange-500 text-white hover:bg-orange-600 active:scale-95"
                    }`}
                  >
                    {isFetchingGst ? "..." : "🔍 Fetch"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <hr />

          {/* ACCOUNT DETAILS */}
          <div className="space-y-4">
            <h4 className="text-primary font-bold text-sm">💰 Account Details</h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-gray-600 mb-1 block">Debit</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Opening debit balance"
                  className="w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary"
                  value={vendor.debit}
                  onChange={(e) =>
                    setVendor({ ...vendor, debit: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 mb-1 block">Credit</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Opening credit balance"
                  className="w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary"
                  value={vendor.credit}
                  onChange={(e) =>
                    setVendor({ ...vendor, credit: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex gap-3 pt-4 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 p-2 border rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 p-2 bg-primary text-white rounded-lg font-bold shadow-lg"
            >
              Save Vendor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddVendorModal;
