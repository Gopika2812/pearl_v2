import { useEffect, useState } from "react";
import { API_BASE } from "../../api";

const InventoryAddVendorModal = ({ isOpen, onClose, onSave, branchId, editingItem }) => {
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

    const formData = new FormData();
    formData.append("file", file);
    formData.append("branchId", branchId);

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

        <button
          type="button"
          onClick={() =>
            document.getElementById("vendorBulkUpload").click()
          }
          className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition"
        >
          📤 Bulk Upload Vendors (Excel)
        </button>

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
                <input
                  type="text"
                  placeholder="E.g., 33AAACF2643K1ZU"
                  className="w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary uppercase"
                  value={vendor.gstin}
                  onChange={(e) =>
                    setVendor({ ...vendor, gstin: e.target.value.toUpperCase() })
                  }
                />
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
