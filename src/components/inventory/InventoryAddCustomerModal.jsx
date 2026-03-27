import { useEffect, useState } from "react";
import { API_BASE } from "../../api";
import FilterableCheckboxList from "../FilterableCheckboxList";
import FilterableSelect from "../FilterableSelect";

const InventoryAddCustomerModal = ({ isOpen, onClose, onSave, salesOwners = [], customerCategories = [], customerGroups = [], branchId, editingItem }) => {
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
  });

  const [isFetchingGst, setIsFetchingGst] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (editingItem) {
      setCustomer({
        _id: editingItem._id || null,
        name: editingItem.name || "",
        customerCategories: Array.isArray(editingItem.customerCategories) ? editingItem.customerCategories : (editingItem.customerCategory ? [editingItem.customerCategory] : []),
        customerGroups: Array.isArray(editingItem.customerGroups) ? editingItem.customerGroups : (editingItem.customerGroup ? [editingItem.customerGroup] : []),
        whatsapp: editingItem.whatsapp || "",
        email: editingItem.email || "",
        address: editingItem.address || "",
        district: editingItem.district || "",
        state: editingItem.state || "",
        country: editingItem.country || "",
        pincode: editingItem.pincode || "",
        registrationType: editingItem.registrationType || "regular",
        gstin: editingItem.gstin || "",
        salesOwner: editingItem.salesOwner || "",
        margin: editingItem.margin || 0,
        credit: editingItem.credit || 0,
        debit: editingItem.debit || 0,
        accountHolder: editingItem.accountHolder || "",
        accountNumber: editingItem.accountNumber || "",
        ifsc: editingItem.ifsc || "",
        branch: editingItem.branch || "",
        upi: editingItem.upi || "",
        upi: editingItem.upi || "",
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
        upi: "",
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
      const res = await fetch(`${API_BASE}/customers/bulk-upload`, {
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

      console.log("Customer bulk upload:", data);
      onClose();
    } catch (err) {
      console.error("Customer bulk upload error:", err);
      alert(err.message || "Bulk upload failed");
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Round numeric values
    const roundedCustomer = {
      ...customer,
      credit: Math.round(Number(customer.credit || 0)),
      debit: Math.round(Number(customer.debit || 0)),
      margin: Math.round(Number(customer.margin || 0) * 100) / 100,
    };
    
    await onSave(roundedCustomer);

    setCustomer({
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
      upi: "",
    });

    onClose();
  };

  const handleFetchGstDetails = async () => {
    if (!customer.gstin || customer.gstin.length !== 15) {
      alert("Please enter a valid 15-character GSTIN");
      return;
    }

    setIsFetchingGst(true);
    try {
      const res = await fetch(`${API_BASE}/gst/search/${customer.gstin}`);
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

  const labelClass = "text-sm font-bold text-gray-600 mb-1 block";
  const inputClass =
    "w-full p-2 border rounded-lg outline-primary focus:ring-1 focus:ring-primary";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">

        <div className="bg-primary p-4 text-white">
          <h3 className="text-xl font-bold">Register New Customer</h3>
        </div>

        <input
          type="file"
          accept=".xlsx,.xls"
          hidden
          id="customerBulkUpload"
          onChange={handleBulkUpload}
        />

        <button
          type="button"
          onClick={() =>
            document.getElementById("customerBulkUpload").click()
          }
          className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition"
        >
          📤 Bulk Upload Customers (Excel)
        </button>



        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-5 max-h-[80vh] overflow-y-auto"
        >
          {/* BASIC DETAILS */}
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Customer Name *</label>
              <input
                type="text"
                required
                className={inputClass}
                value={customer.name}
                onChange={(e) =>
                  setCustomer({ ...customer, name: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Customer Categories</label>
                {Array.isArray(customerCategories) && customerCategories.length > 0 ? (
                  <FilterableCheckboxList
                    options={customerCategories}
                    selectedIds={customer.customerCategories}
                    onChange={(selectedIds) => {
                      setCustomer({ ...customer, customerCategories: selectedIds });
                    }}
                    placeholder="Search categories..."
                  />
                ) : (
                  <div style={{color: '#999', fontSize: '13px', padding: '12px', textAlign: 'center', border: '2px solid #e5e7eb', borderRadius: '8px'}}>
                    📦 No categories available
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>Customer Groups</label>
                {Array.isArray(customerGroups) && customerGroups.length > 0 ? (
                  <FilterableCheckboxList
                    options={customerGroups}
                    selectedIds={customer.customerGroups}
                    onChange={(selectedIds) => {
                      setCustomer({ ...customer, customerGroups: selectedIds });
                    }}
                    placeholder="Search groups..."
                  />
                ) : (
                  <div style={{color: '#999', fontSize: '13px', padding: '12px', textAlign: 'center', border: '2px solid #e5e7eb', borderRadius: '8px'}}>
                    👥 No groups available
                  </div>
                )}
              </div>
            </div>
          </div>

          <hr />

          {/* CONTACT DETAILS */}
          <div className="space-y-4">
            <h4 className="text-primary font-bold text-sm">📞 Contact Details</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>WhatsApp *</label>
                <input
                  type="tel"
                  required
                  className={inputClass}
                  value={customer.whatsapp}
                  onChange={(e) =>
                    setCustomer({ ...customer, whatsapp: e.target.value })
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  className={inputClass}
                  value={customer.email}
                  onChange={(e) =>
                    setCustomer({ ...customer, email: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <hr />

          {/* ADDRESS DETAILS */}
          <div className="space-y-4">
            <h4 className="text-primary font-bold text-sm">🏠 Address Details</h4>

            <div>
              <label className={labelClass}>Address</label>
              <textarea
                className={`${inputClass} h-20`}
                value={customer.address}
                onChange={(e) =>
                  setCustomer({ ...customer, address: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>District</label>
                <input
                  type="text"
                  className={inputClass}
                  value={customer.district}
                  onChange={(e) =>
                    setCustomer({ ...customer, district: e.target.value })
                  }
                />
              </div>

              <div>
                <label className={labelClass}>State</label>
                <input
                  type="text"
                  className={inputClass}
                  value={customer.state}
                  onChange={(e) =>
                    setCustomer({ ...customer, state: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Country</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g., India"
                  value={customer.country}
                  onChange={(e) =>
                    setCustomer({ ...customer, country: e.target.value })
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Pincode</label>
                <input
                  type="text"
                  className={inputClass}
                  value={customer.pincode}
                  onChange={(e) =>
                    setCustomer({ ...customer, pincode: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <hr />

          {/* TAX & REGISTRATION */}
          <div className="space-y-4">
            <h4 className="text-primary font-bold text-sm">📋 Tax & Registration</h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Registration Type</label>
                <select
                  className={inputClass}
                  value={customer.registrationType}
                  onChange={(e) =>
                    setCustomer({ ...customer, registrationType: e.target.value })
                  }
                >
                  <option value="regular">Regular</option>
                  <option value="unregistered">Unregistered</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>GSTIN</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className={`${inputClass} flex-1`}
                    value={customer.gstin}
                    onChange={(e) =>
                      setCustomer({ ...customer, gstin: e.target.value.toUpperCase() })
                    }
                    placeholder="E.g., 27AABCD1234H1Z0"
                  />
                  <button
                    type="button"
                    onClick={handleFetchGstDetails}
                    disabled={isFetchingGst || !customer.gstin}
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

          {/* BUSINESS DETAILS */}
          <div className="space-y-4">
            <h4 className="text-primary font-bold text-sm">💼 Business Details</h4>

            <div>
              <label className={labelClass}>Sales Owner</label>
              <FilterableSelect
                options={salesOwners.map(owner => ({
                  _id: owner._id,
                  name: `${owner.name} (${owner.phone})`
                }))}
                value={customer.salesOwner}
                onChange={(value) =>
                  setCustomer({ ...customer, salesOwner: value })
                }
                placeholder="Select Sales Owner"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Margin (%)</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputClass}
                  value={customer.margin}
                  onChange={(e) =>
                    setCustomer({ ...customer, margin: e.target.value })
                  }
                  placeholder="Positive or Negative"
                />
              </div>

              <div>
                <label className={labelClass}>Credit</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputClass}
                  value={customer.credit}
                  onChange={(e) =>
                    setCustomer({ ...customer, credit: e.target.value })
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Debit</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputClass}
                  value={customer.debit}
                  onChange={(e) =>
                    setCustomer({ ...customer, debit: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <hr />


          {/* BANK DETAILS */}
          <div className="space-y-4 bg-gray-50 p-4 rounded-xl border">
            <h4 className="text-primary font-bold text-sm">
              🏦 Bank Details
            </h4>

            <div>
              <label className={labelClass}>Account Holder</label>
              <input
                type="text"
                className={inputClass}
                value={customer.accountHolder}
                onChange={(e) =>
                  setCustomer({
                    ...customer,
                    accountHolder: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className={labelClass}>Account Number</label>
              <input
                type="text"
                className={inputClass}
                value={customer.accountNumber}
                onChange={(e) =>
                  setCustomer({
                    ...customer,
                    accountNumber: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>IFSC Code</label>
                <input
                  type="text"
                  className={`${inputClass} uppercase`}
                  value={customer.ifsc}
                  onChange={(e) =>
                    setCustomer({ ...customer, ifsc: e.target.value })
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Branch Name</label>
                <input
                  type="text"
                  className={inputClass}
                  value={customer.branch}
                  onChange={(e) =>
                    setCustomer({ ...customer, branch: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>UPI Number</label>
              <input
                type="text"
                className={inputClass}
                value={customer.upi}
                onChange={(e) =>
                  setCustomer({ ...customer, upi: e.target.value })
                }
                placeholder="e.g., name@bank"
              />
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
              Save Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAddCustomerModal;
